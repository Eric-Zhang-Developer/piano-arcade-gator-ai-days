'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button, DuoScope, Mark } from '../duo';
import {
  type Attempt,
  type ChatMessage,
  type ChatResponse,
  type ClosedQuestion,
  type Gate,
  type NodeScreen,
  type ProgressEvent,
  type TheoryProgress,
  CHAT_LIMITS,
  allPassed,
  chatRequest,
  choiceById,
  choices,
  emptyProgress,
  findQuestion,
  gateProgress,
  isCorrect,
  loadProgress,
  openGate,
  parseChatResponse,
  progressReducer,
  recordAnswer,
  saveProgress,
  theoryGates,
  theoryTitle,
} from '../theory';
import { EncodingScore } from './EncodingScore';
import s from './encoding.module.css';

// Progress lives in this device's storage. The server and the first client render see no attempts, then the saved
// ones arrive, so hydration always matches.
let saved: TheoryProgress | undefined;
const listeners = new Set<() => void>();
const readProgress = () => (saved ??= loadProgress());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Applies an event, saves it, and says whether storage kept it. */
function record(e: ProgressEvent): boolean {
  saved = progressReducer(readProgress(), e);
  listeners.forEach(l => l());
  return saveProgress(saved);
}

export type ChatOutcome = { kind: 'reply'; text: string } | { kind: 'not-connected' } | { kind: 'error'; message: string };
/** What the chat shows for a route response. Only `ok` is a reply; anything unreadable means the route isn't there. */
export function chatOutcome(r: ChatResponse | null): ChatOutcome {
  if (r?.status === 'ok') return { kind: 'reply', text: r.reply };
  if (r?.status === 'error') return { kind: 'error', message: r.message };
  return { kind: 'not-connected' };
}

/** The question just judged, held on screen until Next even though progress has moved on. */
type Judged = { gate: Gate; question: ClosedQuestion; round: number; choiceId?: string };

// A failed save is said with the verdict that caused it, so it never adds a line of its own beside the question.
const unsavedTwinkle = 'Progress isn’t saved on this device.';
const unsavedNode = 'Answers aren’t being saved on this device.';

// The kit button's inline colours would beat any class, so they are cleared and .solid / .outline own every state.
const owned = { background: undefined, color: undefined, border: undefined, cursor: undefined, fontSize: 16 };

/**
 * Without a node, the Twinkle sandbox: its three gates one question at a time, the phrase each asks about, and the tutor
 * behind Help. With a node, only that node's items as one gate, with why the node matters and where to read about it
 * behind Help; every checked answer is appended to the device's attempts. A null node has no theory items.
 */
export function EncodingSandbox({ node }: { node?: NodeScreen | null } = {}) {
  if (node === null) return <NoQuestions />;
  return node ? <NodeSandbox node={node} /> : <TwinkleSandbox />;
}

/** The question on screen and what Check, Show answer and Next do to it, for any list of gates. */
function useGates(gates: readonly Gate[], attempts: readonly Attempt[], dispatch: (e: ProgressEvent) => void) {
  const [selected, setSelected] = useState<string | null>(null);
  const [judged, setJudged] = useState<Judged | null>(null);
  const prompt = useRef<HTMLParagraphElement>(null);

  const open = openGate(attempts, gates);
  const live = open && gateProgress(open, attempts);
  const shown: Judged | null = judged ?? (open && live?.status === 'open' ? { gate: open, question: live.current, round: live.round } : null);
  const complete = !shown && allPassed(attempts, gates);

  const check = () => {
    if (!shown || !selected) return;
    dispatch({ type: 'answer', gateId: shown.gate.id, questionId: shown.question.id, choiceId: selected });
    setJudged({ ...shown, choiceId: selected });
  };
  const reveal = () => {
    if (!shown) return;
    dispatch({ type: 'reveal', gateId: shown.gate.id, questionId: shown.question.id });
    setJudged({ ...shown, choiceId: undefined });
  };
  const next = () => {
    setJudged(null);
    setSelected(null);
    requestAnimationFrame(() => prompt.current?.focus());
  };
  const question = shown && { shown, judged, selected, promptRef: prompt, onSelect: setSelected, onCheck: check, onReveal: reveal, onNext: next };
  return { shown, complete, question };
}

function TwinkleSandbox() {
  const progress = useSyncExternalStore(subscribe, readProgress, () => emptyProgress);
  const [saveFailed, setSaveFailed] = useState(false);

  const attempts = progress.attempts;
  const dispatch = (e: ProgressEvent) => setSaveFailed(!record(e));
  const { shown, complete, question } = useGates(theoryGates, attempts, dispatch);
  const lastGate = theoryGates[theoryGates.length - 1];
  const focus = shown ? { gateId: shown.gate.id, questionId: shown.question.id } : { gateId: lastGate?.id ?? '' };

  return <DuoScope className={s.sandbox}>
    <header className={s.head}>
      <h1>{theoryTitle}</h1>
      <Link href="/learn" className={s.stop}>Stop</Link>
    </header>

    <section className={s.work} aria-label="Workspace">
      <EncodingScore focus={shown?.question.phrase} />
      {question && <Question {...question} unsaved={saveFailed ? unsavedTwinkle : undefined} />}
      {complete && <div className={s.done} data-complete="true">
        <h2>All three gates passed</h2>
        {saveFailed && <p className={s.saveFailed} role="status">{unsavedTwinkle}</p>}
      </div>}
      <Help onReveal={question && !question.judged ? question.onReveal : undefined}>
        <Chat focus={focus} attempts={attempts} />
      </Help>
    </section>
  </DuoScope>;
}

/**
 * One node's work and nothing to choose: Next chose the node, so there is no score or tutor, only its questions and,
 * behind Help, why it matters. The round lives in memory; what lasts is the attempts each Check appends to the device.
 */
function NodeSandbox({ node }: { node: NodeScreen }) {
  const gates = useMemo(() => [node.gate], [node]);
  const [progress, setProgress] = useState<TheoryProgress>(emptyProgress);
  const [saveFailed, setSaveFailed] = useState(false);

  const dispatch = (e: ProgressEvent) => {
    const after = progressReducer(progress, e, gates);
    if (after === progress) return;
    setProgress(after);
    // A reveal isn't appended on its own: the answer after it carries it as revealed, so it isn't counted.
    const question = e.type === 'answer' && findQuestion(node.gate, e.questionId);
    if (!question || e.type !== 'answer') return;
    void recordAnswer({ nodeId: node.gate.id, question, choiceId: e.choiceId, earlier: progress.attempts })
      .then(kept => { if (!kept) setSaveFailed(true); });
  };
  const { complete, question } = useGates(gates, progress.attempts, dispatch);
  const about = node.around.nodes.find(n => n.id === node.gate.id);

  return <DuoScope className={s.sandbox} data-mode="node">
    <header className={s.head}>
      <h1>{node.gate.title}</h1>
      {!complete && <Link href="/learn" className={s.stop}>Stop</Link>}
    </header>

    <section className={s.work} aria-label="Workspace">
      {question && <Question {...question} unsaved={saveFailed ? unsavedNode : undefined} />}
      {complete && <div className={s.done} data-complete="true">
        <h2>All questions passed</h2>
        {saveFailed && <p className={s.saveFailed} role="status">{unsavedNode}</p>}
        <Link href="/learn" className={s.backLink}>Back to map</Link>
      </div>}
      {question && <Help onReveal={question.judged ? undefined : question.onReveal}>
        {about && <div className={s.about}>
          <p>{about.whyImportant}</p>
          {about.sources.length > 0 && <ul className={s.sources}>
            {about.sources.map(src => <li key={src.url}><a href={src.url} target="_blank" rel="noreferrer">{src.title}</a></li>)}
          </ul>}
        </div>}
      </Help>}
    </section>
  </DuoScope>;
}

/**
 * Everything that isn't the question, closed until asked for: Show answer while a question is open, then what the
 * screen offers beside it. The panel stays in the DOM when closed, so the tutor's conversation survives a close.
 */
function Help({ onReveal, children }: { onReveal?: () => void; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className={s.help}>
    <button type="button" className={s.helpToggle} aria-expanded={open} aria-controls="help-panel" onClick={() => setOpen(o => !o)}>Help</button>
    <div id="help-panel" className={s.helpPanel} hidden={!open}>
      {onReveal && <Button kind="secondary" className={s.outline} style={owned} onClick={onReveal}>Show answer</Button>}
      {children}
    </div>
  </div>;
}

function NoQuestions() {
  return <DuoScope className={s.none}>
    <h1>No theory questions for this node</h1>
    <Link href="/learn" className={s.backLink}>Back to map</Link>
  </DuoScope>;
}

function Question({ shown, judged, selected, promptRef, unsaved, onSelect, onCheck, onNext }: {
  shown: Judged;
  unsaved?: string;
  judged: Judged | null;
  selected: string | null;
  promptRef: React.RefObject<HTMLParagraphElement | null>;
  onSelect: (id: string) => void;
  onCheck: () => void;
  onReveal: () => void;
  onNext: () => void;
}) {
  const { gate, question, round } = shown;
  const picked = judged?.choiceId ? choiceById(question, judged.choiceId) : undefined;
  const right = picked !== undefined && isCorrect(question, picked.id);
  return <>
    <p ref={promptRef} className={s.prompt} tabIndex={-1} data-gate={gate.id} data-question={question.id}>{question.prompt}</p>
    {judged
      ? <>
        {/* The choices give way to the verdict, which names the answer it judged so nothing is lost with them. */}
        <div className={s.feedback} role="status" data-result={picked ? (right ? 'correct' : 'wrong') : 'revealed'}>
          {picked
            ? <><p><Mark kind={right ? 'correct' : 'wrong'} /></p><p>Your answer: {picked.text}. {picked.explanation}</p></>
            : <><p>The answer is {question.answer.text}.</p><p>{question.answer.explanation}</p></>}
          {unsaved && <p className={s.unsaved}>{unsaved}</p>}
        </div>
        <div className={s.actions}>
          <Button kind="primary" className={s.solid} style={owned} onClick={onNext} autoFocus>Next</Button>
        </div>
      </>
      : <>
        <fieldset className={s.choices}>
          <legend className={s.srOnly}>Answer</legend>
          {choices(question, round).map(c => <label key={c.id} className={s.choice}>
            <input type="radio" name="answer" value={c.id} data-choice={c.id} checked={selected === c.id} onChange={() => onSelect(c.id)} />
            <span>{c.text}</span>
          </label>)}
        </fieldset>
        <div className={s.actions}>
          <Button kind="primary" className={s.solid} style={owned} disabled={!selected} onClick={onCheck}>Check</Button>
        </div>
      </>}
  </>;
}

function Chat({ focus, attempts }: { focus: { gateId: string; questionId?: string }; attempts: TheoryProgress['attempts'] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages.length, pending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || pending) return;
    const history = messages;
    const asked: ChatMessage = { role: 'student', text };
    setMessages([...history, asked]);
    setDraft('');
    setPending(true);
    setStatus(null);
    let response: ChatResponse | null = null;
    try {
      const res = await fetch('/learn/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(chatRequest(focus, attempts, history, text)),
      });
      response = parseChatResponse(await res.json());
    } catch {
      // No route, no network or not JSON: the chat isn't connected, and it says so instead of replying.
    }
    const outcome = chatOutcome(response);
    setPending(false);
    if (outcome.kind === 'reply') {
      setMessages([...history, asked, { role: 'tutor', text: outcome.text }]);
      return;
    }
    // Nothing answered, so the message goes back to the composer to send again.
    setMessages(history);
    setDraft(text);
    setStatus(outcome.kind === 'not-connected' ? 'Chat isn’t connected.' : `The tutor couldn’t reply: ${outcome.message}`);
  };

  return <aside className={s.chat} aria-label="Tutor chat">
    <div ref={log} className={s.log} role="log" aria-live="polite">
      {messages.map((m, i) => <div key={i} className={s.message} data-role={m.role}>
        <span className={s.who}>{m.role === 'student' ? 'You' : 'Tutor'}</span>
        <p>{m.text}</p>
      </div>)}
      {pending && <p className={s.pending}>Tutor is replying…</p>}
    </div>
    <form className={s.composer} onSubmit={e => { e.preventDefault(); void send(); }}>
      {status && <p className={s.status} role="status" data-chat-status>{status}</p>}
      <label htmlFor="chat-input" className={s.srOnly}>Message</label>
      <textarea
        id="chat-input"
        className={s.input}
        value={draft}
        maxLength={CHAT_LIMITS.messageChars}
        placeholder="Ask the tutor"
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
          e.preventDefault();
          void send();
        }}
      />
      <Button kind="secondary" type="submit" className={`${s.outline} ${s.send}`} style={owned} disabled={pending || !draft.trim()}>Send</Button>
    </form>
  </aside>;
}
