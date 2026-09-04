import { table, f } from "@xanots/sdk";
import { SEED_PLANS } from "../seed-data.js";

// A benefit plan. `tier` drives which benefits and limits a member gets.
export const plans = table({
  name: "plans",
  schema: {
    name: f.text({ required: true }),
    tier: f.enum(["bronze", "silver", "gold"], { required: true }),
  },
  seed: SEED_PLANS,
});
