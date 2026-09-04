import { useCallback, useEffect, useState } from "react";
import {
  login,
  seedRun,
  getCoverage,
  getRemaining,
  checkEligibility,
  type Caller,
} from "./api";

// The demo callers, one per role. All share one password (public demo creds,
// documented in the README). Signing all three in on load lets the Scope demo
// run the SAME member read as a rep and as the agent, side by side.
export const DEMO_PASSWORD = "demo1234";
export const DEMO_MEMBER_ID = 1;

export type DemoUserId = "rep" | "agent" | "gov";

export interface DemoUser {
  id: DemoUserId;
  username: string;
  label: string;
  scope: string;
  blurb: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: "rep",
    username: "rep",
    label: "Support rep",
    scope: "benefits · eligibility · pii",
    blurb: "A person helping a member. Sees the full record, PII included.",
  },
  {
    id: "agent",
    username: "agent",
    label: "AI benefits agent",
    scope: "benefits · eligibility",
    blurb: "The service account the assistant uses. Never sees member PII.",
  },
  {
    id: "gov",
    username: "gov",
    label: "Governance lead",
    scope: "audit",
    blurb: "Reads the whole audit trail. Cannot read member benefits.",
  },
];

export interface Session {
  token: string;
  caller: Caller;
}
export type Sessions = Record<DemoUserId, Session>;

async function loginAll(): Promise<Sessions> {
  const entries = await Promise.all(
    DEMO_USERS.map(async (u) => {
      const r = await login({ username: u.username, password: DEMO_PASSWORD });
      return [u.id, { token: r.token, caller: r.caller }] as const;
    }),
  );
  return Object.fromEntries(entries) as Sessions;
}

// Exercise a few governed lookups so the audit trail has content to show
// (coverage / remaining / eligibility as the agent, and one refused read as the
// governance lead, who lacks the benefits scope). Best effort — never fatal.
export async function warmAuditTrail(s: Sessions): Promise<void> {
  const a = s.agent.token;
  await getCoverage(a, DEMO_MEMBER_ID, "dental").catch(() => {});
  await getRemaining(a, DEMO_MEMBER_ID, "physical_therapy").catch(() => {});
  await checkEligibility(a, {
    member_id: DEMO_MEMBER_ID,
    category: "physical_therapy",
    referral_on_file: false,
  }).catch(() => {});
  await checkEligibility(a, {
    member_id: DEMO_MEMBER_ID,
    category: "mental_health",
    referral_on_file: false,
  }).catch(() => {});
  // Refused: the governance lead has no "benefits" scope.
  await getCoverage(s.gov.token, DEMO_MEMBER_ID, "dental").catch(() => {});
}

export function useSession() {
  const [sessions, setSessions] = useState<Sessions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let s: Sessions;
      try {
        s = await loginAll();
      } catch {
        // The environment may be empty (freshly swept). Seed and retry once.
        await seedRun();
        s = await loginAll();
      }
      setSessions(s);
      await warmAuditTrail(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await seedRun();
      const s = await loginAll();
      setSessions(s);
      await warmAuditTrail(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { sessions, error, loading, reload: load, reset };
}
