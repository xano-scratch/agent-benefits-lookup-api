import { defineFunction, input, s, inp, ref } from "@xanots/sdk";
import { accessLog } from "../tables/access-log.js";

// The ONE place an audit row is written. Every governed lookup, human or agent,
// allowed or refused, calls this. Centralizing it is the point: the trail cannot
// drift between callers because there is only one writer.
export const logAccess = defineFunction({
  name: "log_access",
  input: {
    caller_id: input.int({ required: true }),
    caller_role: input.text({ required: true }),
    endpoint: input.text({ required: true }),
    // 0 when the lookup is not about a specific member.
    member_id: input.int({ default: 0 }),
    // "" when the lookup is not about a specific benefit category.
    benefit_category: input.text({ default: "" }),
    // "allowed" | "refused" — kept as text so a dynamic (masked-read) decision
    // passes without enum-literal friction; the column is the enum.
    decision: input.text({ required: true }),
    reason: input.text({ required: true }),
    requested_fields: input.json(),
    returned_fields: input.json(),
  },
  stack: [
    s.db.add({
      table: accessLog,
      row: {
        caller_id: inp("caller_id"),
        caller_role: inp("caller_role"),
        endpoint: inp("endpoint"),
        member_id: inp("member_id"),
        benefit_category: inp("benefit_category"),
        decision: inp("decision"),
        reason: inp("reason"),
        requested_fields: inp("requested_fields"),
        returned_fields: inp("returned_fields"),
      },
      as: "row",
    }),
  ],
  response: ref("row"),
});
