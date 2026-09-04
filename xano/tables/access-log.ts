import { table, f } from "@xanots/sdk";
import { callers } from "./callers.js";

// The audit surface. Every governed lookup writes one row here: who asked, in
// what role, which endpoint, the decision (allowed or refused), the reason, and
// the fields requested versus the fields actually returned. A governance lead
// reads this trail to see exactly what each caller looked at, human or agent.
export const accessLog = table({
  name: "access_log",
  schema: {
    caller_id: f.tableRef(callers, { required: true }),
    caller_role: f.text({ required: true }),
    endpoint: f.text({ required: true }),
    // 0 when the lookup is not about a specific member.
    member_id: f.int({ default: 0 }),
    // "" when the lookup is not about a specific benefit category.
    benefit_category: f.text(),
    decision: f.enum(["allowed", "refused"], { required: true }),
    reason: f.text({ required: true }),
    requested_fields: f.json(),
    returned_fields: f.json(),
  },
  // Newest-first reads are the common path for the governance view.
  index: [{ type: "btree", fields: [{ name: "created_at" }] }],
});
