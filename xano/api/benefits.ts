import { apiGroup, query, input, ref, inp, s } from "@xanots/sdk";
import { callers } from "../tables/callers.js";
import { coverageLookup } from "../functions/coverage.js";
import { eligibilityRule } from "../functions/eligibility.js";
import { remainingLimit } from "../functions/remaining.js";
import { resolveCaller } from "./caller.js";

export const benefitsGroup = apiGroup({ name: "benefits", canonical: "gblbenefits" });

const CATEGORY = input.enum(
  ["dental", "vision", "physical_therapy", "mental_health"],
  { required: true },
);

// Coverage summary for a member's benefit category. Guarded to "benefits" scope,
// audited, and computed by the shared governed function.
export const getCoverageQuery = query({
  name: "get-coverage/{member_id}",
  verb: "GET",
  apiGroup: benefitsGroup,
  auth: callers,
  input: { member_id: input.int({ required: true }), category: CATEGORY },
  stack: [
    ...resolveCaller(),
    s.function.run({
      fn: coverageLookup,
      input: {
        caller_id: ref("me.id"),
        caller_role: ref("me.role"),
        allowed_fields: ref("me.allowed_fields"),
        member_id: inp("member_id"),
        category: inp("category"),
      },
      as: "result",
    }),
  ],
  response: ref("result"),
});

// Eligibility for a benefit: covered by the plan AND (if the benefit needs a
// referral) a referral is on file.
export const checkEligibilityQuery = query({
  name: "check-eligibility",
  verb: "POST",
  apiGroup: benefitsGroup,
  auth: callers,
  input: {
    member_id: input.int({ required: true }),
    category: CATEGORY,
    referral_on_file: input.bool({ default: false }),
  },
  stack: [
    ...resolveCaller(),
    s.function.run({
      fn: eligibilityRule,
      input: {
        caller_id: ref("me.id"),
        caller_role: ref("me.role"),
        allowed_fields: ref("me.allowed_fields"),
        member_id: inp("member_id"),
        category: inp("category"),
        referral_on_file: inp("referral_on_file"),
      },
      as: "result",
    }),
  ],
  response: ref("result"),
});

// Remaining covered visits for a member's benefit (annual_limit minus used).
export const getRemainingLimitQuery = query({
  name: "get-remaining-limit/{member_id}",
  verb: "GET",
  apiGroup: benefitsGroup,
  auth: callers,
  input: { member_id: input.int({ required: true }), category: CATEGORY },
  stack: [
    ...resolveCaller(),
    s.function.run({
      fn: remainingLimit,
      input: {
        caller_id: ref("me.id"),
        caller_role: ref("me.role"),
        allowed_fields: ref("me.allowed_fields"),
        member_id: inp("member_id"),
        category: inp("category"),
      },
      as: "result",
    }),
  ],
  response: ref("result"),
});
