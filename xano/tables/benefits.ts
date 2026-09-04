import { table, f } from "@xanots/sdk";
import { plans } from "./plans.js";
import { SEED_BENEFITS } from "../seed-data.js";

// A covered benefit on a plan. `annual_limit` is a count of covered visits per
// year (not a currency amount). `requires_referral` drives the eligibility rule.
export const benefits = table({
  name: "benefits",
  schema: {
    plan_id: f.tableRef(plans, { required: true }),
    category: f.enum(
      ["dental", "vision", "physical_therapy", "mental_health"],
      { required: true },
    ),
    coverage_summary: f.text({ required: true }),
    annual_limit: f.int({ required: true }),
    requires_referral: f.bool({ required: true }),
  },
  seed: SEED_BENEFITS,
});
