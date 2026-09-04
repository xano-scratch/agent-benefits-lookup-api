import { apiGroup, query, input, s, c, ref, inp, expr } from "@xanots/sdk";
import { callers } from "../tables/callers.js";

export const authGroup = apiGroup({ name: "auth", canonical: "gblauth" });

// Authenticate a caller by username + password and mint a scoped token. The
// token identifies the caller; every protected endpoint reads the caller's role
// and allowed_fields fresh from the callers table, so scope changes take effect
// at once. The password is taken as text and compared by check_password (an
// input.password would double-hash and never match).
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: authGroup,
  input: {
    username: input.text({ required: true }),
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({
      table: callers,
      fieldName: "username",
      fieldValue: inp("username"),
      // password is access:internal, so it must be named to be read back.
      output: ["id", "username", "name", "role", "password", "allowed_fields"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error_type: "notfound",
      error: c.text("No caller with that username."),
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error_type: "unauthorized",
      error: c.text("Incorrect password."),
    }),
    s.security.create_auth_token({ table: callers, id: ref("u.id"), as: "token" }),
  ],
  response: {
    token: ref("token"),
    caller: {
      id: ref("u.id"),
      username: ref("u.username"),
      name: ref("u.name"),
      role: ref("u.role"),
      allowed_fields: ref("u.allowed_fields"),
    },
  },
});
