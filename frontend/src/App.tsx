import { useEffect, useState } from "react";
import { FileClock, Loader2, MessagesSquare, RotateCcw, ShieldCheck, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AskAgent } from "@/components/AskAgent";
import { AuditTrail } from "@/components/AuditTrail";
import { ScopeDemo } from "@/components/ScopeDemo";
import { DEMO_USERS, useSession } from "@/lib/demo";

type Tab = "scope" | "ask" | "audit";

const TABS: { id: Tab; label: string; icon: typeof UsersRound }[] = [
  { id: "scope", label: "Scope demo", icon: UsersRound },
  { id: "ask", label: "Ask the agent", icon: MessagesSquare },
  { id: "audit", label: "Audit trail", icon: FileClock },
];

export default function App() {
  const { sessions, error, loading, reset } = useSession();
  const [tab, setTab] = useState<Tab>("scope");

  // Pin the dark theme so the whole template set looks consistent.
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Governed Benefits Lookup
            </h1>
            <Badge variant="outline" className="ml-1">
              Play 4 · Healthcare
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            A benefits lookup API where a support rep and an AI agent call the same
            endpoints. The same role scope decides which member fields each may
            read, out-of-scope reads are refused at the API layer, and every
            lookup is written to an audit trail.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DEMO_USERS.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs"
              >
                <span className="font-medium">{u.label}</span>
                <span className="text-muted-foreground">{u.scope}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        {loading && !sessions ? (
          <div className="flex items-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Signing in the demo callers…
          </div>
        ) : error && !sessions ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            Could not reach the backend: {error}
          </div>
        ) : sessions ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 rounded-lg border p-1">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Button
                      key={t.id}
                      size="sm"
                      variant={t.id === tab ? "default" : "ghost"}
                      onClick={() => setTab(t.id)}
                    >
                      <Icon /> {t.label}
                    </Button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void reset()}
                disabled={loading}
              >
                <RotateCcw className={loading ? "animate-spin" : ""} /> Reset demo
              </Button>
            </div>

            {tab === "scope" && <ScopeDemo sessions={sessions} />}
            {tab === "ask" && <AskAgent sessions={sessions} />}
            {tab === "audit" && <AuditTrail sessions={sessions} />}
          </>
        ) : null}

        <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
          <p>
            Built with XanoTS. Native API-layer role-based access control (an auth
            table, scoped tokens, and per-endpoint scope guards), not row-level
            security. Runs on seed data with no external LLM key.
          </p>
        </footer>
      </main>
    </div>
  );
}
