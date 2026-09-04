import { defineFunction, input, s, c, ref, inp, col, expr } from "@xanots/sdk";
import { members } from "../tables/members.js";
import { benefits } from "../tables/benefits.js";
import { logAccess } from "./log-access.js";
import { requireBenefitsScope } from "./guards.js";

// Governed eligibility rule: a member is eligible for a benefit when the plan
// covers the category AND, if that benefit requires a referral, a referral is on
// file. This is the "define the rule once" point: the same rule answers a human
// endpoint and the agent, and every call is audited.
export const eligibilityRule = defineFunction({
  name: "eligibility_rule",
  input: {
    caller_id: input.int({ required: true }),
    caller_role: input.text({ required: true }),
    allowed_fields: input.json(),
    member_id: input.int({ required: true }),
    category: input.enum(["dental", "vision", "physical_therapy", "mental_health"], {
      required: true,
    }),
    referral_on_file: input.bool({ default: false }),
  },
  stack: [
    ...requireBenefitsScope("benefits/check-eligibility", ["eligibility"]),

    s.db.get_by_id({ table: members, id: inp("member_id"), as: "m" }),
    s.precondition({
      expr: expr(ref("m", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("Member not found."),
    }),

    // Null when this member's plan does not cover the category.
    s.db.query({
      table: benefits,
      where: [
        expr(col("plan_id"), "=", ref("m.plan_id")),
        expr(col("category"), "=", inp("category")),
      ],
      returnType: "single",
      as: "benefit",
    }),

    // Apply the rule.
    s.set_var("covered", c.bool(false)),
    s.set_var("eligible", c.bool(false)),
    s.set_var("rule", c.text("This member's plan does not cover that benefit category.")),
    s.conditional({
      when: expr(ref("benefit", { safe: true }), "!=", c.null()),
      then: [
        s.update_var("covered", c.bool(true)),
        s.conditional({
          when: expr(ref("benefit.requires_referral"), "=", c.bool(true)),
          then: [
            s.conditional({
              when: expr(inp("referral_on_file"), "=", c.bool(true)),
              then: [
                s.update_var("eligible", c.bool(true)),
                s.update_var("rule", c.text("Covered, and a referral is on file.")),
              ],
              else: [
                s.update_var("rule", c.text("Covered, but this benefit needs a referral and none is on file.")),
              ],
            }),
          ],
          else: [
            s.update_var("eligible", c.bool(true)),
            s.update_var("rule", c.text("Covered, and no referral is required.")),
          ],
        }),
      ],
    }),

    s.function.run({
      fn: logAccess,
      input: {
        caller_id: inp("caller_id"),
        caller_role: inp("caller_role"),
        endpoint: "benefits/check-eligibility",
        member_id: inp("member_id"),
        benefit_category: inp("category"),
        decision: "allowed",
        reason: ref("rule"),
        requested_fields: c.array(["eligibility"]),
        returned_fields: c.array(["eligible", "covered", "rule"]),
      },
    }),
  ],
  response: {
    category: inp("category"),
    covered: ref("covered"),
    eligible: ref("eligible"),
    rule: ref("rule"),
    referral_on_file: inp("referral_on_file"),
    decision: c.text("allowed"),
  },
});
