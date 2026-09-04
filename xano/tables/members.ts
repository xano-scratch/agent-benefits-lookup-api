import { table, f } from "@xanots/sdk";
import { plans } from "./plans.js";
import { SEED_MEMBERS } from "../seed-data.js";

// A plan member. full_name, dob and ssn_last4 are PII: a caller sees them only
// when its scope includes "pii". Everything else (member_number, plan) is
// readable by any caller with the "benefits" scope.
export const members = table({
  name: "members",
  schema: {
    full_name: f.text({ required: true }), // PII
    dob: f.text({ required: true }), // PII (kept as text: it is display data, not a date calc)
    member_number: f.text({ required: true }),
    ssn_last4: f.text({ required: true }), // PII
    plan_id: f.tableRef(plans, { required: true }),
  },
  seed: SEED_MEMBERS,
});
