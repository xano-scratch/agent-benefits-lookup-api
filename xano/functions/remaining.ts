import { defineFunction, input, s, c, ref, inp, col, expr, withFilters, fl } from "@xanots/sdk";
import { members } from "../tables/members.js";
import { benefits } from "../tables/benefits.js";
import { memberBenefitUsage } from "../tables/member-benefit-usage.js";
import { logAccess } from "./log-access.js";
import { requireBenefitsScope } from "./guards.js";

// Governed remaining-limit lookup: annual_limit minus the visits already used.
// Guarded to the "benefits" scope and audited.
export const remainingLimit = defineFunction({
  name: "remaining_limit",
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
    ...requireBenefitsScope("benefits/get-remaining-limit", ["remaining_limit"]),

    s.db.get_by_id({ table: members, id: inp("member_id"), as: "m" }),
    s.precondition({
      expr: expr(ref("m", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("Member not found."),
    }),

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

    // The usage row for this (member, benefit) pair, if any.
    s.db.query({
      table: memberBenefitUsage,
      where: [
        expr(col("member_id"), "=", inp("member_id")),
        expr(col("benefit_id"), "=", ref("benefit.id")),
      ],
      returnType: "single",
      as: "usage",
    }),

    // used_count defaults to 0 when the member has no usage row yet.
    s.set_var("used_count", withFilters(ref("usage.used_count", { safe: true }), fl.first_notnull(c.int(0)))),
    s.set_var("remaining", withFilters(ref("benefit.annual_limit"), fl.sub(ref("used_count")))),

    s.function.run({
      fn: logAccess,
      input: {
        caller_id: inp("caller_id"),
        caller_role: inp("caller_role"),
        endpoint: "benefits/get-remaining-limit",
        member_id: inp("member_id"),
        benefit_category: inp("category"),
        decision: "allowed",
        reason: "Remaining visits computed.",
        requested_fields: c.array(["remaining_limit"]),
        returned_fields: c.array(["annual_limit", "used_count", "remaining"]),
      },
    }),
  ],
  response: {
    category: inp("category"),
    annual_limit: ref("benefit.annual_limit"),
    used_count: ref("used_count"),
    remaining: ref("remaining"),
    decision: c.text("allowed"),
  },
});
