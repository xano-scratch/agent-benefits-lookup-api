import { table, f } from "@xanots/sdk";
import { members } from "./members.js";
import { benefits } from "./benefits.js";
import { SEED_USAGE } from "../seed-data.js";

// How many visits a member has used for a benefit this year. The remaining
// limit is annual_limit minus used_count.
export const memberBenefitUsage = table({
  name: "member_benefit_usage",
  schema: {
    member_id: f.tableRef(members, { required: true }),
    benefit_id: f.tableRef(benefits, { required: true }),
    used_count: f.int({ required: true }),
  },
  seed: SEED_USAGE,
});
