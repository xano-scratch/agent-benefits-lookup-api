import { statements, s, c, ref, auth, expr } from "@xanots/sdk";
import { callers } from "../tables/callers.js";

// Resolve the authenticated caller into `me`, read fresh from the callers table
// so role and scope are never stale. Spread at the top of a protected endpoint;
// returned as a tuple so `ref("me.*")` stays typed downstream.
export function resolveCaller() {
  return statements(
    s.db.get_by_id({ table: callers, id: auth("id"), as: "me" }),
    s.precondition({
      expr: expr(ref("me", { safe: true }), "!=", c.null()),
      error_type: "unauthorized",
      error: c.text("Unknown caller."),
    }),
  );
}
