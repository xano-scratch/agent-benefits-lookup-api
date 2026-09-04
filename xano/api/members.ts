import { apiGroup, query, input, s, c, ref, inp, auth, expr } from "@xanots/sdk";
import { callers } from "../tables/callers.js";
import { memberRead } from "../functions/member-read.js";

export const membersGroup = apiGroup({ name: "members", canonical: "gblmembers" });

// Read a member with fields filtered to the caller's scope. The governed
// member_read function does the work: it withholds PII unless the caller has the
// "pii" scope and audits every read. The endpoint just resolves the caller.
export const membersGetQuery = query({
  name: "get/{member_id}",
  verb: "GET",
  apiGroup: membersGroup,
  auth: callers,
  input: { member_id: input.int({ required: true }) },
  stack: [
    s.db.get_by_id({ table: callers, id: auth("id"), as: "me" }),
    s.precondition({
      expr: expr(ref("me", { safe: true }), "!=", c.null()),
      error_type: "unauthorized",
      error: c.text("Unknown caller."),
    }),
    s.function.run({
      fn: memberRead,
      input: {
        caller_id: ref("me.id"),
        caller_role: ref("me.role"),
        allowed_fields: ref("me.allowed_fields"),
        member_id: inp("member_id"),
      },
      as: "result",
    }),
  ],
  response: ref("result"),
});
