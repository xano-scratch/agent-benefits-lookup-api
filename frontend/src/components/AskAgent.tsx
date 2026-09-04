import { useState } from "react";
import { Bot, Send, ShieldCheck, ShieldX, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ask, type AskResult } from "@/lib/api";
import { DEMO_MEMBER_ID, type Sessions } from "@/lib/demo";

const EXAMPLES = [
  "What dental care is covered for this member?",
  "How many physical therapy visits are left?",
  "Is the member eligible for physical therapy?",
  "What is the member's SSN?",
];

const TOOL_LABEL: Record<string, string> = {
  "members/get": "members/get",
  "benefits/get-coverage": "benefits/get-coverage",
  "benefits/check-eligibility": "benefits/check-eligibility",
  "benefits/get-remaining-limit": "benefits/get-remaining-limit",
  none: "none",
};

export function AskAgent({ sessions }: { sessions: Sessions }) {
  const [question, setQuestion] = useState(EXAMPLES[0]);
  const [referral, setReferral] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await ask(sessions.agent.token, {
        question: q,
        member_id: DEMO_MEMBER_ID,
        referral_on_file: referral,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Ask the agent</h2>
        <p className="text-sm text-muted-foreground">
          The assistant classifies your question, then the endpoint runs the same
          governed lookup a person would, under the agent's scope. The answer's
          values come from governed data, and every lookup is audited. A PII
          question is refused, because the agent has no pii scope.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <Button
            key={ex}
            size="sm"
            variant="outline"
            onClick={() => {
              setQuestion(ex);
              void submit(ex);
            }}
          >
            {ex}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="Ask about a member's benefits…"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={referral}
              onChange={(e) => setReferral(e.target.checked)}
            />
            Referral on file (affects eligibility)
          </label>
          <Button onClick={() => void submit(question)} disabled={loading}>
            <Send /> {loading ? "Asking…" : "Ask"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="size-4" /> Governed answer
              </CardTitle>
              {result.decision === "allowed" ? (
                <Badge variant="success">
                  <ShieldCheck /> allowed
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <ShieldX /> refused
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-base">{result.answer}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">intent: {result.intent}</Badge>
              {result.category !== "none" && (
                <Badge variant="secondary">category: {result.category}</Badge>
              )}
              <Badge variant="muted">
                endpoint: {TOOL_LABEL[result.tool_called] ?? result.tool_called}
              </Badge>
              <Badge variant={result.agent_used ? "default" : "outline"}>
                <Sparkles />
                {result.agent_used ? "classified by the model" : "keyword fallback"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
