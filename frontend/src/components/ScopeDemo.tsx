import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Lock, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMember, type MemberResult, type MemberView } from "@/lib/api";
import type { Sessions } from "@/lib/demo";

const MEMBERS = [
  { id: 1, label: "M-1001" },
  { id: 2, label: "M-1002" },
  { id: 3, label: "M-1003" },
];

const FIELDS: { key: keyof MemberView; label: string; pii?: boolean }[] = [
  { key: "full_name", label: "Full name", pii: true },
  { key: "dob", label: "Date of birth", pii: true },
  { key: "ssn_last4", label: "SSN (last 4)", pii: true },
  { key: "member_number", label: "Member number" },
  { key: "plan_name", label: "Plan" },
  { key: "plan_tier", label: "Tier" },
];

function MemberCard({
  title,
  subtitle,
  result,
}: {
  title: string;
  subtitle: string;
  result: MemberResult | null;
}) {
  const masked = result?.member.pii_masked ?? false;
  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            {masked ? (
              <EyeOff className="size-4 text-muted-foreground" />
            ) : (
              <Eye className="size-4 text-muted-foreground" />
            )}
            {title}
          </CardTitle>
          {result &&
            (result.decision === "allowed" ? (
              <Badge variant="success">allowed</Badge>
            ) : (
              <Badge variant="destructive">refused</Badge>
            ))}
        </div>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!result ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <dl className="divide-y divide-border rounded-lg border">
              {FIELDS.map((f) => {
                const value = String(result.member[f.key] ?? "");
                const withheld = f.pii && masked;
                return (
                  <div
                    key={f.key}
                    className="flex items-center justify-between gap-4 px-3 py-2"
                  >
                    <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      {f.label}
                      {f.pii && (
                        <span className="rounded bg-muted px-1 text-[10px] font-medium uppercase tracking-wide">
                          PII
                        </span>
                      )}
                    </dt>
                    <dd className="text-sm font-medium">
                      {withheld ? (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <Lock className="size-3" /> withheld
                        </span>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="text-xs text-muted-foreground">{result.reason}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ScopeDemo({ sessions }: { sessions: Sessions }) {
  const [memberId, setMemberId] = useState(1);
  const [rep, setRep] = useState<MemberResult | null>(null);
  const [agent, setAgent] = useState<MemberResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (id: number) => {
      setLoading(true);
      setError(null);
      setRep(null);
      setAgent(null);
      try {
        const [r, a] = await Promise.all([
          getMember(sessions.rep.token, id),
          getMember(sessions.agent.token, id),
        ]);
        setRep(r);
        setAgent(a);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [sessions],
  );

  useEffect(() => {
    void run(memberId);
  }, [run, memberId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Same read, two callers</h2>
          <p className="text-sm text-muted-foreground">
            One member, looked up as a support rep and as the AI agent. The rep is
            scoped for PII; the agent is not, so the same endpoint withholds those
            fields and logs the read as refused.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Member</span>
          {MEMBERS.map((m) => (
            <Button
              key={m.id}
              size="sm"
              variant={m.id === memberId ? "default" : "outline"}
              onClick={() => setMemberId(m.id)}
            >
              {m.label}
            </Button>
          ))}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => void run(memberId)}
            disabled={loading}
            aria-label="Refresh"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4 md:flex-row">
        <MemberCard
          title="As the support rep"
          subtitle="Scope includes pii"
          result={rep}
        />
        <MemberCard
          title="As the AI agent"
          subtitle="Scope does not include pii"
          result={agent}
        />
      </div>
    </div>
  );
}
