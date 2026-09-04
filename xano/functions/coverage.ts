import { defineFunction, input, s, c, ref, inp, col, expr } from "@xanots/sdk";
import { members } from "../tables/members.js";
import { benefits } from "../tables/benefits.js";
import { logAccess } from "./log-access.js";
import { requireBenefitsScope } from "./guards.js";

// Governed coverage lookup: the plain-language summary of what a plan covers for
// a benefit category. Guarded to the "benefits" scope and audited.
export const coverageLookup = defineFunction({
  name: "coverage_lookup",
  input: {
    caller_id: input.int({ required: true }),
    caller_role: input.text({ required: true }),
    allowed_fields: input.json(),
    member_id: input.int({ required: true }),
    category: input.enum(["dental", "vision", "physical_therapy", "mental_health"], {
      required: true,
    }),
  },
  stack: [
    ...requireBenefitsScope("benefits/get-coverage", ["coverage_summary", "requires_referral"]),

    s.db.get_by_id({ table: members, id: inp("member_id"), as: "m" }),
    s.precondition({
      expr: expr(ref("m", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("Member not found."),
    }),

    // The one benefit row for this member's plan and the requested category.
    s.db.query({
      table: benefits,
      where: [
        expr(col("plan_id"), "=", ref("m.plan_id")),
        expr(col("category"), "=", inp("category")),
      ],
      returnType: "single",
      as: "benefit",
    }),
    s.precondition({
      expr: expr(ref("benefit", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("This member's plan does not cover that benefit category."),
    }),

    s.function.run({
      fn: logAccess,
      input: {
        caller_id: inp("caller_id"),
        caller_role: inp("caller_role"),
        endpoint: "benefits/get-coverage",
        member_id: inp("member_id"),
        benefit_category: inp("category"),
        decision: "allowed",
        reason: "Coverage summary returned.",
        requested_fields: c.array(["coverage_summary", "requires_referral"]),
        returned_fields: c.array(["coverage_summary", "requires_referral", "annual_limit"]),
      },
    }),
  ],
  response: {
    category: inp("category"),
    coverage_summary: ref("benefit.coverage_summary"),
    requires_referral: ref("benefit.requires_referral"),
    annual_limit: ref("benefit.annual_limit"),
    decision: c.text("allowed"),
    reason: c.text("Coverage summary returned."),
  },
});
