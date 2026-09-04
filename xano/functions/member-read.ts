import { defineFunction, input, s, c, ref, inp, expr, withFilters, fl } from "@xanots/sdk";
import { members } from "../tables/members.js";
import { plans } from "../tables/plans.js";
import { logAccess } from "./log-access.js";

// The governed member read. It enforces two scope rules and writes one audit
// row:
//   - "benefits" scope is required to look a member up at all (no scope -> 403).
//   - "pii" scope is required to see full_name, dob and ssn_last4. Without it
//     those fields are withheld and the read is logged as refused (a partial
//     read), so the audit trail shows the agent was denied the PII a rep sees.
export const memberRead = defineFunction({
  name: "member_read",
  input: {
    caller_id: input.int({ required: true }),
    caller_role: input.text({ required: true }),
    allowed_fields: input.json(),
    member_id: input.int({ required: true }),
  },
  stack: [
    // Scope flags derived from the caller's allowed_fields.
    s.set_var("has_benefits", withFilters(c.text("benefits"), fl.in(inp("allowed_fields")))),
    s.set_var("has_pii", withFilters(c.text("pii"), fl.in(inp("allowed_fields")))),

    // Require "benefits" to look a member up at all. Log the refusal, then 403.
    s.conditional({
      when: expr(ref("has_benefits"), "=", c.bool(false)),
      then: [
        s.function.run({
          fn: logAccess,
          input: {
            caller_id: inp("caller_id"),
            caller_role: inp("caller_role"),
            endpoint: "members/get",
            member_id: inp("member_id"),
            decision: "refused",
            reason: "Caller scope does not include benefits; member lookup refused.",
            requested_fields: c.array(["full_name", "dob", "member_number", "ssn_last4", "plan_id"]),
            returned_fields: c.array([]),
          },
        }),
      ],
    }),
    s.precondition({
      expr: expr(ref("has_benefits"), "=", c.bool(true)),
      error_type: "accessdenied",
      error: c.text("Your access does not include member lookups."),
    }),

    // Fetch the member and its plan.
    s.db.get_by_id({ table: members, id: inp("member_id"), as: "m" }),
    s.precondition({
      expr: expr(ref("m", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("Member not found."),
    }),
    s.db.get_by_id({ table: plans, id: ref("m.plan_id"), as: "plan" }),

    // Default: full record, allowed. The PII fields start from the real values.
    s.set_var("v_full_name", ref("m.full_name")),
    s.set_var("v_dob", ref("m.dob")),
    s.set_var("v_ssn_last4", ref("m.ssn_last4")),
    s.set_var("pii_masked", c.bool(false)),
    s.set_var("decision", c.text("allowed")),
    s.set_var("reason", c.text("Full member record returned; caller scope includes pii.")),
    s.set_var("returned", c.array(["full_name", "dob", "member_number", "ssn_last4", "plan_id"])),

    // No "pii" scope: withhold the PII fields and mark the read refused.
    s.conditional({
      when: expr(ref("has_pii"), "=", c.bool(false)),
      then: [
        s.update_var("v_full_name", c.text("(withheld)")),
        s.update_var("v_dob", c.text("(withheld)")),
        s.update_var("v_ssn_last4", c.text("(withheld)")),
        s.update_var("pii_masked", c.bool(true)),
        s.update_var("decision", c.text("refused")),
        s.update_var("reason", c.text("PII fields withheld; caller scope does not include pii.")),
        s.update_var("returned", c.array(["member_number", "plan_id"])),
      ],
    }),

    // Audit the read (allowed for a rep, refused/partial for the agent).
    s.function.run({
      fn: logAccess,
      input: {
        caller_id: inp("caller_id"),
        caller_role: inp("caller_role"),
        endpoint: "members/get",
        member_id: inp("member_id"),
        decision: ref("decision"),
        reason: ref("reason"),
        requested_fields: c.array(["full_name", "dob", "member_number", "ssn_last4", "plan_id"]),
        returned_fields: ref("returned"),
      },
    }),
  ],
  response: {
    member: {
      id: ref("m.id"),
      full_name: ref("v_full_name"),
      dob: ref("v_dob"),
      member_number: ref("m.member_number"),
      ssn_last4: ref("v_ssn_last4"),
      plan_id: ref("m.plan_id"),
      plan_name: ref("plan.name"),
      plan_tier: ref("plan.tier"),
      pii_masked: ref("pii_masked"),
    },
    decision: ref("decision"),
    reason: ref("reason"),
    requested_fields: c.array(["full_name", "dob", "member_number", "ssn_last4", "plan_id"]),
    returned_fields: ref("returned"),
  },
  // The view is assembled in control flow (PII masking), so the static walk
  // cannot type it. Declare the shape once here; every caller (the members
  // endpoint and the agent path) derives from it.
  responseShape: null as unknown as {
    member: {
      id: number;
      full_name: string;
      dob: string;
      member_number: string;
      ssn_last4: string;
      plan_id: number;
      plan_name: string;
      plan_tier: string;
      pii_masked: boolean;
    };
    decision: string;
    reason: string;
    requested_fields: string[];
    returned_fields: string[];
  },
});
