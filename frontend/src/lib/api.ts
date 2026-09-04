// The one contract. Paths come from the generated route manifest (imports
// nothing, so the SDK runtime and the agent graph never enter the bundle), and
// request/response TYPES are inferred straight from the backend query defs with
// `import type` (erased at build). Change a def and this file follows.

import type { InferInput, InferResponse } from "@xanots/sdk";
import type { loginQuery } from "../../../xano/api/auth.js";
import type { membersGetQuery } from "../../../xano/api/members.js";
import type {
  getCoverageQuery,
  checkEligibilityQuery,
  getRemainingLimitQuery,
} from "../../../xano/api/benefits.js";
import type { askQuery } from "../../../xano/api/agent.js";
import type { auditQueriesQuery } from "../../../xano/api/audit.js";
import { routePath } from "../../../xano/routes.gen";

/**
 * The deployed Xano backend's base URL. Injected as `window.XANO_HOST` by
 * `xanots deploy <entry> --static <dir>`, or read from `VITE_XANO_HOST` in dev.
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// Types derived from the backend, so the UI and the API can never disagree.
export type LoginResult = InferResponse<typeof loginQuery>;
export type Caller = LoginResult["caller"];
export type MemberResult = InferResponse<typeof membersGetQuery>;
export type MemberView = MemberResult["member"];
export type CoverageResult = InferResponse<typeof getCoverageQuery>;
export type EligibilityResult = InferResponse<typeof checkEligibilityQuery>;
export type RemainingResult = InferResponse<typeof getRemainingLimitQuery>;
export type AskResult = InferResponse<typeof askQuery>;
export type AuditRow = InferResponse<typeof auditQueriesQuery>[number];

export type LoginBody = InferInput<typeof loginQuery>;
export type EligibilityBody = InferInput<typeof checkEligibilityQuery>;
export type AskBody = InferInput<typeof askQuery>;
export type Category = InferInput<typeof getCoverageQuery>["category"];

export const CATEGORIES: Category[] = [
  "dental",
  "vision",
  "physical_therapy",
  "mental_health",
];

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(
  path: string,
  verb: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(XANO_HOST + path, {
    method: verb,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      /* keep raw text */
    }
    throw new ApiError(res.status, message || `Request failed (${res.status})`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

function qs(params: Record<string, string>): string {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : "";
}

// ── Endpoints ───────────────────────────────────────────────────────────────

export function login(body: LoginBody): Promise<LoginResult> {
  return call(routePath("POST login"), "POST", { body });
}

export function getMember(token: string, memberId: number): Promise<MemberResult> {
  return call(routePath("GET get/{member_id}", { member_id: memberId }), "GET", {
    token,
  });
}

export function getCoverage(
  token: string,
  memberId: number,
  category: Category,
): Promise<CoverageResult> {
  const path =
    routePath("GET get-coverage/{member_id}", { member_id: memberId }) +
    qs({ category });
  return call(path, "GET", { token });
}

export function checkEligibility(
  token: string,
  body: EligibilityBody,
): Promise<EligibilityResult> {
  return call(routePath("POST check-eligibility"), "POST", { token, body });
}

export function getRemaining(
  token: string,
  memberId: number,
  category: Category,
): Promise<RemainingResult> {
  const path =
    routePath("GET get-remaining-limit/{member_id}", { member_id: memberId }) +
    qs({ category });
  return call(path, "GET", { token });
}

export function ask(token: string, body: AskBody): Promise<AskResult> {
  return call(routePath("POST ask"), "POST", { token, body });
}

export function getAudit(
  token: string,
  roleFilter: string,
  decisionFilter: string,
): Promise<AuditRow[]> {
  const path =
    routePath("GET queries") +
    qs({ role_filter: roleFilter, decision_filter: decisionFilter });
  return call(path, "GET", { token });
}

export function seedRun(): Promise<{ seeded: boolean }> {
  return call(routePath("POST run"), "POST", {});
}
