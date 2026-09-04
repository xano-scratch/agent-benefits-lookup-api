import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, getAudit, type AuditRow } from "@/lib/api";
import type { Sessions } from "@/lib/demo";

const ROLE_FILTERS = [
  { value: "", label: "All roles" },
  { value: "support_rep", label: "Support rep" },
  { value: "benefits_agent", label: "Agent" },
  { value: "governance_lead", label: "Governance" },
];

const DECISION_FILTERS = [
  { value: "", label: "All" },
  { value: "allowed", label: "Allowed" },
  { value: "refused", label: "Refused" },
];

function time(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ms);
  }
}

export function AuditTrail({ sessions }: { sessions: Sessions }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getAudit(sessions.gov.token, roleFilter, decisionFilter);
      setRows(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sessions, roleFilter, decisionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function probeAsAgent() {
    setProbe(null);
    try {
      await getAudit(sessions.agent.token, "", "");
      setProbe("Unexpected: the agent was able to read the trail.");
    } catch (e) {
      if (e instanceof ApiError) {
        setProbe(`Access denied (${e.status}): ${e.message}`);
      } else {
        setProbe(e instanceof Error ? e.message : String(e));
      }
    }
  }

  const refusedCount = rows.filter((r) => r.decision === "refused").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Audit trail</h2>
          <p className="text-sm text-muted-foreground">
            Every governed lookup, newest first. Restricted to the governance lead
            role, so the agent cannot read the log it writes to.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Role</span>
          {ROLE_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="xs"
              variant={f.value === roleFilter ? "default" : "outline"}
              onClick={() => setRoleFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Decision</span>
          {DECISION_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="xs"
              variant={f.value === decisionFilter ? "default" : "outline"}
              onClick={() => setDecisionFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {rows.length} rows · {refusedCount} refused
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No lookups yet. Run the Scope demo or ask the agent.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {time(r.created_at)}
                  </TableCell>
                  <TableCell>{r.caller_role}</TableCell>
                  <TableCell className="font-mono text-xs">{r.endpoint}</TableCell>
                  <TableCell>{r.member_id ? `#${r.member_id}` : "—"}</TableCell>
                  <TableCell>{r.benefit_category || "—"}</TableCell>
                  <TableCell>
                    {r.decision === "allowed" ? (
                      <Badge variant="success">allowed</Badge>
                    ) : (
                      <Badge variant="destructive">refused</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {r.reason}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-dashed p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="size-4" />
            The agent writes to this log but must not read it.
          </p>
          <Button size="sm" variant="outline" onClick={() => void probeAsAgent()}>
            Try to read the trail as the agent
          </Button>
        </div>
        {probe && (
          <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
            {probe}
          </p>
        )}
      </div>
    </div>
  );
}
