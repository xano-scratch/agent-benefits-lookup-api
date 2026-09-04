import { table, f } from "@xanots/sdk";
import { SEED_CALLERS } from "../seed-data.js";

// The auth table. A caller is a person (a support rep or a governance lead) or
// a service account the AI agent uses. `role` and `allowed_fields` are the
// governed access scope every endpoint checks — the SAME scope for a human and
// for the agent. This is API-layer role-based access control, not row-level
// security.
export const callers = table({
  name: "callers",
  auth: true,
  schema: {
    username: f.text({ required: true }),
    name: f.text({ required: true }),
    role: f.enum(["support_rep", "benefits_agent", "governance_lead"], {
      required: true,
    }),
    // Hashed on write; access is internal, so a read must name it in `output`.
    password: f.password({ required: true }),
    // The member field groups this caller may read, e.g.
    // ["benefits","eligibility","pii"] for a rep vs ["benefits","eligibility"]
    // for the agent. The per-endpoint scope guard tests membership.
    allowed_fields: f.json(),
  },
  index: [{ type: "unique", fields: [{ name: "username" }] }],
  seed: SEED_CALLERS,
});
