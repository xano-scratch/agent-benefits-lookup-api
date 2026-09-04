import {
  agent,
  apiGroup,
  query,
  input,
  s,
  c,
  ref,
  inp,
  expr,
  withFilters,
  fl,
} from "@xanots/sdk";
import { callers } from "../tables/callers.js";
import { memberRead } from "../functions/member-read.js";
import { coverageLookup } from "../functions/coverage.js";
import { eligibilityRule } from "../functions/eligibility.js";
import { remainingLimit } from "../functions/remaining.js";
import { resolveCaller } from "./caller.js";

export const agentGroup = apiGroup({ name: "agent", canonical: "gblagent" });

// The benefits assistant. It CLASSIFIES a natural-language question into an
// intent and a benefit category with structured output. It deliberately does
// NOT answer the question: the endpoint runs the same governed function a human
// endpoint runs, under the caller's own scope, so the answer's values come from
// governed data (never invented by the model) and the SAME scope guard and audit
// bind the agent that bind a person. Runs on the built-in xano-free model, so no
// external LLM key is needed.
export const benefitsAssistant = agent({
  name: "benefits_assistant",
  llm: {
    type: "xano-free",
    maxSteps: 2,
    systemPrompt:
      "You classify a health-plan member's benefits question. Decide the intent and, when the question is about a specific benefit, its category. Do NOT answer the question and do NOT invent any values; the system computes the real answer from governed data. intent is one of: coverage (what is covered), eligibility (does the member qualify), remaining_limit (how many visits are left), member_pii (asks for personal data such as SSN, date of birth, or full name), or other. category is one of dental, vision, physical_therapy, mental_health, or none when no benefit category applies.",
    prompt: "Member question: {{ $args.question }}",
  },
  output: {
    schema: {
      intent: input.enum([
        "coverage",
        "eligibility",
        "remaining_limit",
        "member_pii",
        "other",
      ]),
      category: input.enum([
        "dental",
        "vision",
        "physical_therapy",
        "mental_health",
        "none",
      ]),
    },
  },
});

// A deterministic keyword classifier, used only if the model call fails, so the
// endpoint always answers. Highest-priority signal wins (PII last).
function keywordFallback() {
  const has = (needle: string) =>
    expr(withFilters(inp("question"), fl.icontains(needle)), "=", c.bool(true));
  return s.group([
    // category
    s.conditional({ when: has("dental"), then: [s.update_var("category", c.text("dental"))] }),
    s.conditional({ when: has("vision"), then: [s.update_var("category", c.text("vision"))] }),
    s.conditional({ when: has("eye"), then: [s.update_var("category", c.text("vision"))] }),
    s.conditional({ when: has("physical"), then: [s.update_var("category", c.text("physical_therapy"))] }),
    s.conditional({ when: has("therapy"), then: [s.update_var("category", c.text("physical_therapy"))] }),
    s.conditional({ when: has("mental"), then: [s.update_var("category", c.text("mental_health"))] }),
    s.conditional({ when: has("counsel"), then: [s.update_var("category", c.text("mental_health"))] }),
    // intent (later overrides earlier; PII is the strongest signal)
    s.conditional({ when: has("cover"), then: [s.update_var("intent", c.text("coverage"))] }),
    s.conditional({ when: has("remain"), then: [s.update_var("intent", c.text("remaining_limit"))] }),
    s.conditional({ when: has("left"), then: [s.update_var("intent", c.text("remaining_limit"))] }),
    s.conditional({ when: has("visits"), then: [s.update_var("intent", c.text("remaining_limit"))] }),
    s.conditional({ when: has("eligib"), then: [s.update_var("intent", c.text("eligibility"))] }),
    s.conditional({ when: has("qualif"), then: [s.update_var("intent", c.text("eligibility"))] }),
    s.conditional({ when: has("ssn"), then: [s.update_var("intent", c.text("member_pii"))] }),
    s.conditional({ when: has("social security"), then: [s.update_var("intent", c.text("member_pii"))] }),
    s.conditional({ when: has("birth"), then: [s.update_var("intent", c.text("member_pii"))] }),
    s.conditional({ when: has("date of"), then: [s.update_var("intent", c.text("member_pii"))] }),
  ]);
}

// A benefit lookup needs a category; ask for one if the classifier found none.
const NEEDS_CATEGORY = c.text(
  "Which benefit did you mean? Try dental, vision, physical therapy, or mental health.",
);

// POST agent/ask — the Play 4 showcase.
export const askQuery = query({
  name: "ask",
  verb: "POST",
  apiGroup: agentGroup,
  auth: callers,
  input: {
    question: input.text({ required: true }),
    member_id: input.int({ default: 1 }),
    referral_on_file: input.bool({ default: false }),
  },
  stack: [
    ...resolveCaller(),

    // Classify with the real agent; fall back to keywords if the model is down.
    s.set_var("agent_used", c.bool(false)),
    s.set_var("intent", c.text("other")),
    s.set_var("category", c.text("none")),
    s.try_catch({
      try: [
        s.ai.agent.run({ agent: benefitsAssistant, args: { question: inp("question") }, as: "run" }),
        s.update_var("intent", ref("run.result.intent")),
        s.update_var("category", ref("run.result.category")),
        s.update_var("agent_used", c.bool(true)),
      ],
      catch: [keywordFallback()],
    }),

    // Dispatch to the SAME governed function a human endpoint would call, under
    // this caller's scope. The answer's values come from the governed result.
    s.set_var("tool_called", c.text("none")),
    s.set_var("decision", c.text("allowed")),
    s.set_var("answer", c.text("")),
    s.conditional({
      when: expr(ref("intent"), "=", c.text("member_pii")),
      then: [
        s.function.run({
          fn: memberRead,
          input: {
            caller_id: ref("me.id"),
            caller_role: ref("me.role"),
            allowed_fields: ref("me.allowed_fields"),
            member_id: inp("member_id"),
          },
          as: "res",
        }),
        s.update_var("tool_called", c.text("members/get")),
        s.update_var("decision", ref("res.decision")),
        s.conditional({
          when: expr(ref("res.member.pii_masked"), "=", c.bool(true)),
          then: [
            s.update_var(
              "answer",
              c.text("That information is not available to you under your current access. The request was logged."),
            ),
          ],
          else: [
            s.update_var(
              "answer",
              c.text("Your access includes PII, so the full member record is available on the member endpoint."),
            ),
          ],
        }),
      ],
      elif: [
        {
          when: expr(ref("intent"), "=", c.text("coverage")),
          then: [
            s.conditional({
              when: expr(ref("category"), "=", c.text("none")),
              then: [s.update_var("answer", NEEDS_CATEGORY)],
              else: [
                s.function.run({
                  fn: coverageLookup,
                  input: {
                    caller_id: ref("me.id"),
                    caller_role: ref("me.role"),
                    allowed_fields: ref("me.allowed_fields"),
                    member_id: inp("member_id"),
                    category: ref("category"),
                  },
                  as: "res",
                }),
                s.update_var("tool_called", c.text("benefits/get-coverage")),
                s.update_var("answer", withFilters(c.text("Coverage — "), fl.concat(ref("res.coverage_summary")))),
              ],
            }),
          ],
        },
        {
          when: expr(ref("intent"), "=", c.text("eligibility")),
          then: [
            s.conditional({
              when: expr(ref("category"), "=", c.text("none")),
              then: [s.update_var("answer", NEEDS_CATEGORY)],
              else: [
                s.function.run({
                  fn: eligibilityRule,
                  input: {
                    caller_id: ref("me.id"),
                    caller_role: ref("me.role"),
                    allowed_fields: ref("me.allowed_fields"),
                    member_id: inp("member_id"),
                    category: ref("category"),
                    referral_on_file: inp("referral_on_file"),
                  },
                  as: "res",
                }),
                s.update_var("tool_called", c.text("benefits/check-eligibility")),
                s.update_var("answer", withFilters(c.text("Eligibility — "), fl.concat(ref("res.rule")))),
              ],
            }),
          ],
        },
        {
          when: expr(ref("intent"), "=", c.text("remaining_limit")),
          then: [
            s.conditional({
              when: expr(ref("category"), "=", c.text("none")),
              then: [s.update_var("answer", NEEDS_CATEGORY)],
              else: [
                s.function.run({
                  fn: remainingLimit,
                  input: {
                    caller_id: ref("me.id"),
                    caller_role: ref("me.role"),
                    allowed_fields: ref("me.allowed_fields"),
                    member_id: inp("member_id"),
                    category: ref("category"),
                  },
                  as: "res",
                }),
                s.update_var("tool_called", c.text("benefits/get-remaining-limit")),
                s.update_var(
                  "answer",
                  withFilters(
                    c.text("Remaining covered visits: "),
                    fl.concat(ref("res.remaining")),
                    fl.concat(c.text(" of ")),
                    fl.concat(ref("res.annual_limit")),
                  ),
                ),
              ],
            }),
          ],
        },
      ],
      else: [
        s.update_var(
          "answer",
          c.text("I can answer questions about coverage, eligibility, and remaining visits for a member's benefits. For example: what dental care is covered, or how many physical therapy visits are left."),
        ),
      ],
    }),
  ],
  response: {
    answer: ref("answer"),
    intent: ref("intent"),
    category: ref("category"),
    tool_called: ref("tool_called"),
    decision: ref("decision"),
    agent_used: ref("agent_used"),
    member_id: inp("member_id"),
  },
  // answer/intent/category/tool_called/decision are set in control flow, so the
  // static walk cannot type them. Declare the shape for the frontend.
  responseShape: null as unknown as {
    answer: string;
    intent: string;
    category: string;
    tool_called: string;
    decision: string;
    agent_used: boolean;
    member_id: number;
  },
});
