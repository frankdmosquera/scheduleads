import { useState } from "react";

import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import type { ChatTraceType } from "../agent/chat-event-type.js";
import { devRow, type ChatDevFactsType, type ChatDevRowType } from "./dev-row.js";

/** The ladder's steps as the panel names them; laptop only, so plain English, never the site's words. */
const WHO: Record<ChatDevRowType["who"], string> = {
  button: "Button tap",
  jev: "Jev",
  ai: "LLM",
  handOver: "Hand-over",
};

const { jev: jevSettings } = CHAT_SETTINGS;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const time = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

/** What would make this question faster or right next time, from how it was answered. */
function nextStep(
  who: ChatDevRowType["who"],
  trace: ChatTraceType | undefined,
  suggested: boolean
): string {
  // Jev down is TypeSafe's side, not a gap in the answers: say so, rather than blame the wording.
  if (trace?.jev?.kind === "skipped") {
    const why = `Jev could not run (${trace.jev.reason}${trace.jev.status ? ` ${trace.jev.status}` : ""})`;
    if (trace.llmPicked)
      return `${why}, so the LLM answered, and still found a stored answer. Nothing to fix in the answers; it is just slower until Jev is back.`;
    return `${why}, so the LLM answered. Nothing to fix in the answers; ask again once Jev is back to see the normal path.`;
  }
  if (who === "ai" && trace?.llmPicked)
    return "The LLM found a stored answer Jev missed: another wording of that question lets Jev answer at once.";
  if (who === "ai")
    return "The LLM wrote this. If the answer is right and people ask it, save it as a stored answer: Jev then answers in a fraction of a second.";
  if (suggested)
    return `Jev was between ${pct(jevSettings.suggestConfidence)} and ${pct(jevSettings.storedConfidence)} sure. A stored question worded more like this one makes it sure.`;
  if (who === "handOver") return "Nobody could answer: a person takes it.";
  return "Instant, in the site's own words. Nothing to do.";
}

/** One question, every step of the ladder it went through. */
function Question({
  facts,
  open,
  onToggle,
}: {
  facts: ChatDevFactsType;
  open: boolean;
  onToggle: () => void;
}) {
  const row = devRow(facts);
  const trace = facts.reply?.trace;
  const jev = trace?.jev;
  const ai = trace?.ai;
  return (
    <section className="sc-inspector-question" data-who={row.who}>
      <button type="button" className="sc-inspector-head" aria-expanded={open} onClick={onToggle}>
        <span className="sc-inspector-who">{WHO[row.who]}</span>
        <span className="sc-inspector-asked">{facts.question}</span>
        <span className="sc-inspector-total">{time(facts.ms)}</span>
      </button>
      {open && (
        <div className="sc-inspector-steps">
          {facts.chip && (
            <div className="sc-inspector-step">
              You tapped this button, you did not type it. Its answer comes straight from the site's
              answers in the browser: no Jev, no LLM.
            </div>
          )}
          {jev && (
            <div className="sc-inspector-step">
              <div className="sc-inspector-step-head">
                <b>1 · Jev</b>{" "}
                <span>{jev.kind === "skipped" ? `skipped (${jev.reason})` : jev.kind}</span>
                <span className="sc-inspector-ms">{time(jev.ms)}</span>
              </div>
              {jev.seen && (
                <>
                  <div className="sc-inspector-note">
                    Intent: <b>{jev.seen.intent}</b> {pct(jev.seen.intentConfidence)}
                  </div>
                  {jev.seen.clarity !== undefined && (
                    <div className="sc-inspector-note">
                      One thing? <b>{pct(jev.seen.oneThing ?? 0)}</b> (AI below{" "}
                      {pct(jevSettings.oneThingYes)}) · Clear? <b>{jev.seen.clarity.toFixed(1)}</b>
                      /3 (asks below {jevSettings.clarityFloor})
                    </div>
                  )}
                  <div className="sc-inspector-bars">
                    {jev.seen.top.map((t) => (
                      <div
                        key={t.question}
                        className="sc-inspector-bar"
                        data-none={t.question === "none" ? "" : undefined}
                      >
                        <span className="sc-inspector-bar-label">{t.question}</span>
                        <span className="sc-inspector-bar-track">
                          <progress
                            className="sc-inspector-bar-fill"
                            max={1}
                            value={Math.max(t.confidence, 0.01)}
                          />
                        </span>
                        <span className="sc-inspector-bar-pct">{pct(t.confidence)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="sc-inspector-legend">
                    {pct(jevSettings.suggestConfidence)} asks &quot;did you mean&quot;,{" "}
                    {pct(jevSettings.storedConfidence)} answers
                  </div>
                </>
              )}
            </div>
          )}
          {ai && (
            <div className="sc-inspector-step" data-step="ai">
              <div className="sc-inspector-step-head">
                <b>2 · LLM</b>{" "}
                <span>
                  {ai.model}
                  {ai.spoken ? ", spoken" : ""}
                </span>
                <span className="sc-inspector-ms">{time(ai.totalMs)}</span>
              </div>
              <div className="sc-inspector-facts">
                <span>
                  Brief in: {ai.inputTokens.toLocaleString()} tokens,{" "}
                  {ai.cachedTokens.toLocaleString()} cached (
                  {pct(ai.inputTokens ? ai.cachedTokens / ai.inputTokens : 0)})
                </span>
                <span>Written: {ai.outputTokens} tokens</span>
                <span>
                  First word after {ai.firstWordMs === undefined ? "none" : time(ai.firstWordMs)},
                  writing{" "}
                  {ai.firstWordMs === undefined ? "none" : time(ai.totalMs - ai.firstWordMs)}
                </span>
              </div>
              {trace?.llmPicked && (
                <div className="sc-inspector-note">
                  It picked the stored answer &quot;{trace.llmPicked}&quot;, sent in the site's
                  exact words.
                </div>
              )}
            </div>
          )}
          <div className="sc-inspector-step">
            <div className="sc-inspector-step-head">
              <b>{ai ? "3" : jev ? "2" : "1"} · Result</b> <span>{row.detail}</span>
            </div>
            <div className="sc-inspector-next">
              {nextStep(row.who, trace, Boolean(facts.reply?.suggest))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * The chat inspector, laptop only: pinned to the screen's bottom-left corner while the chat is open. For each
 * question, newest first and open, every step of the ladder: what Jev weighed against its thresholds, the LLM's
 * brief, cache and timing, and what to do next.
 */
export function ChatInspector({ rows }: { rows: readonly (ChatDevFactsType & { id: number })[] }) {
  const [folded, setFolded] = useState(false);
  // Which question is open, and for which newest question that was chosen: a new question opens itself again.
  const [opened, setOpened] = useState<{ id: number; newest: number | undefined } | null>(null);
  const newest = rows[0]?.id;
  const shown = opened && opened.newest === newest ? opened.id : newest;
  return (
    <aside
      className="sc-inspector"
      data-folded={folded ? "" : undefined}
      aria-label="Chat inspector"
    >
      <button
        type="button"
        className="sc-inspector-title"
        aria-expanded={!folded}
        onClick={() => setFolded((f) => !f)}
      >
        <b>Chat inspector</b> {rows.length} question{rows.length === 1 ? "" : "s"}, newest first{" "}
        <span aria-hidden="true">{folded ? "▴" : "▾"}</span>
      </button>
      {!folded && (
        <div className="sc-inspector-list">
          {rows.map(({ id, ...facts }) => (
            <Question
              key={id}
              facts={facts}
              open={id === shown}
              onToggle={() => setOpened({ id: id === shown ? -1 : id, newest })}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
