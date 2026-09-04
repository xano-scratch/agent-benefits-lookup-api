import { apiGroup, query, input, s, c, ref, inp, col, cmp, expr } from "@xanots/sdk";
import { callers } from "../tables/callers.js";
import { accessLog } from "../tables/access-log.js";
import { resolveCaller } from "./caller.js";

export const auditGroup = apiGroup({ name: "audit", canonical: "gblaudit" });

// The governance-lead view of the audit trail: every lookup, newest first, with
// optional filters by caller role and decision. Restricted to the
// governance_lead role at the API layer (a hard 403 for anyone else), which is
// how the agent is kept out of the log it writes to.
export const auditQueriesQuery = query({
  name: "queries",
  verb: "GET",
  apiGroup: auditGroup,
  auth: callers,
  input: {
    // "" means "no filter"; ignoreEmpty drops the predicate for an empty value.
    role_filter: input.text({ default: "" }),
    decision_filter: input.text({ default: "" }),
  },
  stack: [
    ...resolveCaller(),
    s.precondition({
      expr: expr(ref("me.role"), "=", c.text("governance_lead")),
      error_type: "accessdenied",
      error: c.text("The audit trail is restricted to the governance lead role."),
    }),
    s.db.query({
      table: accessLog,
      where: [
        cmp(col("caller_role"), "=", inp("role_filter"), { ignoreEmpty: true }),
        cmp(col("decision"), "=", inp("decision_filter"), { ignoreEmpty: true }),
      ],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
