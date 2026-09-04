import { statements, s, c, ref, inp, expr, withFilters, fl } from "@xanots/sdk";
import { logAccess } from "./log-access.js";

// The benefit-lookup scope guard, shared by get-coverage, check-eligibility and
// get-remaining-limit. It computes whether the caller's allowed_fields include
// "benefits"; if not, it writes ONE refused audit row and then throws 403. The
// same guard binds a human endpoint and the agent path, because both call the
// governed function this is spread into.
//
// Returned with `statements(...)` (not a bare `Statement[]`) so the stack tuple
// survives the spread and the function's response stays typed.
//
// The host function MUST declare these inputs: allowed_fields, caller_id,
// caller_role, member_id, category.
export function requireBenefitsScope(endpoint: string, requested: string[]) {
  return statements(
    s.set_var(
      "has_benefits",
      withFilters(c.text("benefits"), fl.in(inp("allowed_fields"))),
    ),
    s.conditional({
      when: expr(ref("has_benefits"), "=", c.bool(false)),
      then: [
        s.function.run({
          fn: logAccess,
          input: {
            caller_id: inp("caller_id"),
            caller_role: inp("caller_role"),
            endpoint,
            member_id: inp("member_id"),
            benefit_category: inp("category"),
            decision: "refused",
            reason: "Caller scope does not include benefits; lookup refused.",
            requested_fields: c.array(requested),
            returned_fields: c.array([]),
          },
        }),
      ],
    }),
    s.precondition({
      expr: expr(ref("has_benefits"), "=", c.bool(true)),
      error_type: "accessdenied",
      error: c.text("Your access does not include benefit lookups."),
    }),
  );
}
