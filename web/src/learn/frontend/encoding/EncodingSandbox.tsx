'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { Button, DuoScope, Mark } from '../duo';
import {
  type ChatMessage,
  type ChatResponse,
  type ClosedQuestion,
  type Gate,
  type ProgressEvent,
  type TheoryProgress,
  CHAT_LIMITS,
  allPassed,
  chatRequest,
  choiceById,
  choices,
  emptyProgress,
  firstTry,
  gateProgress,
  isCorrect,
  loadProgress,
  openGate,
  parseChatResponse,
  progressReducer,
  saveProgress,
  sources,
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

type Tab = 'score' | 'reference' | 'gates';
const tabs: readonly { id: Tab; label: string }[] = [
  { id: 'score', label: 'Score' },
  { id: 'reference', label: 'Reference' },
  { id: 'gates', label: 'Gates' },
];

/** The question just judged, held on screen until Next even though progress has moved on. */
type Judged = { gate: Gate; question: ClosedQuestion; round: number; choiceId?: string };

// The kit button's inline colours would beat any class, so they are cleared and .solid / .outline own every state.
const owned = { background: undefined, color: undefined, border: undefined, cursor: undefined, fontSize: 16 };

export function EncodingSandbox() {
  const progress = useSyncExternalStore(subscribe, readProgress, () => emptyProgress);
  const [saveFailed, setSaveFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('gates');
  const [selected, setSelected] = useState<string | null>(null);
  const [judged, setJudged] = useState<Judged | null>(null);
  const prompt = useRef<HTMLParagraphElement>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const attempts = progress.attempts;
  const passedGates = theoryGates.filter(g => gateProgress(g, attempts).status === 'passed').length;
  const open = openGate(attempts);
  const live = open && gateProgress(open, attempts);
  const shown: Judged | null = judged ?? (open && live?.status === 'open' ? { gate: open, question: live.current, round: live.round } : null);
  const complete = !shown && allPassed(attempts);
  const lastGate = theoryGates[theoryGates.length - 1];
  const focus = shown ? { gateId: shown.gate.id, questionId: shown.question.id } : { gateId: lastGate?.id ?? '' };

  const dispatch = (e: ProgressEvent) => setSaveFailed(!record(e));

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
  const startOver = () => {
    dispatch({ type: 'reset' });
    setJudged(null);
    setSelected(null);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = tabs.findIndex(t => t.id === tab);
    const to = tabs[(i + step + tabs.length) % tabs.length].id;
    setTab(to);
    tabRefs.current[to]?.focus();
  };

  return <DuoScope className={s.sandbox}>
    <header className={s.head}>
      <h1>{theoryTitle}</h1>
      <span className={s.count} data-passed={passedGates}><strong>{passedGates}</strong>/{theoryGates.length} gates passed</span>
      <Link href="/learn" className={s.stop}>Stop</Link>
    </header>

    <section className={s.work} aria-label="Workspace">
      <div className={s.tabs} role="tablist" aria-label="Files">
        {tabs.map(t => <button
          key={t.id}
          ref={el => { tabRefs.current[t.id] = el; }}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={tab === t.id ? 0 : -1}
          className={s.tab}
          data-tab={t.id}
          onClick={() => setTab(t.id)}
          onKeyDown={onTabKey}
        >{t.label}</button>)}
      </div>
      <div className={s.panel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === 'score' && <EncodingScore focus={shown?.question.phrase} />}
        {tab === 'reference' && <Reference />}
        {tab === 'gates' && <>
          <ol className={s.strip} aria-label="Gates">
            {theoryGates.map((g, i) => {
              const p = gateProgress(g, attempts);
              const state = p.status === 'passed' ? 'passed' : g.id === shown?.gate.id ? 'current' : 'open';
              return <li key={g.id} data-state={state} data-gate={g.id} aria-current={state === 'current' ? 'step' : undefined}>
                <span className={s.stripMeta}>
                  <span>Gate {i + 1}</span>
                  <span>{p.status === 'passed' ? 'Passed' : `${p.passed}/${p.total}`}</span>
                </span>
                <span className={s.stripTitle}>{g.title}</span>
              </li>;
            })}
          </ol>
          {shown && <Question
            shown={shown}
            judged={judged}
            selected={selected}
            promptRef={prompt}
            onSelect={setSelected}
            onCheck={check}
            onReveal={reveal}
            onNext={next}
            onScore={() => setTab('score')}
          />}
          {complete && <div className={s.done} data-complete="true">
            <h2>All three gates passed</h2>
            <p>{firstTry(attempts).right.length} of {theoryGates.reduce((n, g) => n + g.questions.length, 0)} right on the first try.</p>
            <Button kind="secondary" className={s.outline} style={owned} onClick={startOver}>Start over</Button>
          </div>}
          {saveFailed && <p className={s.saveFailed} role="status">Progress isn&apos;t saved on this device.</p>}
        </>}
      </div>
    </section>

    <Chat focus={focus} attempts={attempts} />
  </DuoScope>;
}

function Question({ shown, judged, selected, promptRef, onSelect, onCheck, onReveal, onNext, onScore }: {
  shown: Judged;
  judged: Judged | null;
  selected: string | null;
  promptRef: React.RefObject<HTMLParagraphElement | null>;
  onSelect: (id: string) => void;
  onCheck: () => void;
  onReveal: () => void;
  onNext: () => void;
  onScore: () => void;
}) {
  const { gate, question, round } = shown;
  const picked = judged?.choiceId ? choiceById(question, judged.choiceId) : undefined;
  const right = picked !== undefined && isCorrect(question, picked.id);
  return <>
    <p ref={promptRef} className={s.prompt} tabIndex={-1} data-gate={gate.id} data-question={question.id}>{question.prompt}</p>
    <fieldset className={s.choices} disabled={!!judged}>
      <legend className={s.srOnly}>Answer</legend>
      {choices(question, round).map(c => <label key={c.id} className={s.choice}>
        <input
          type="radio"
          name="answer"
          value={c.id}
          data-choice={c.id}
          checked={(judged ? judged.choiceId : selected) === c.id}
          onChange={() => onSelect(c.id)}
        />
        <span>{c.text}</span>
      </label>)}
    </fieldset>
    {judged
      ? <>
        <div className={s.feedback} role="status" data-result={picked ? (right ? 'correct' : 'wrong') : 'revealed'}>
          {picked
            ? <><p><Mark kind={right ? 'correct' : 'wrong'} /></p><p>{picked.explanation}</p></>
            : <><p>The answer is {question.answer.text}.</p><p>{question.answer.explanation}</p></>}
          {!right && <p className={s.later}>This question comes back later.</p>}
        </div>
        <div className={s.actions}>
          <Button kind="primary" className={s.solid} style={owned} onClick={onNext} autoFocus>Next</Button>
        </div>
      </>
      : <div className={s.actions}>
        <Button kind="primary" className={s.solid} style={owned} disabled={!selected} onClick={onCheck}>Check</Button>
        <Button kind="secondary" className={s.outline} style={owned} onClick={onReveal}>Show answer</Button>
        {question.phrase && <button type="button" className={s.link} onClick={onScore}>See phrase {question.phrase} in Score</button>}
      </div>}
  </>;
}

function Reference() {
  return <>
    <h2>Reference</h2>
    <dl className={s.facts}>
      <dt>C major</dt>
      <dd>C D E F G A B C. The scale starts and ends on C, scale degree 1.</dd>
      <dt>Degrees</dt>
      <dd>1 tonic (home) · 3 mediant · 4 subdominant · 5 dominant · 6 submediant</dd>
      <dt>Treble staff</dt>
      <dd>Bottom line E, bottom space F, second line G (the clef curls around it), middle line B. A C this low sits on a ledger line below the staff.</dd>
      <dt>Cadences</dt>
      <dd>Authentic: V to I at the end of a phrase. Half: the phrase ends on V. The chords show which; the melody alone doesn&apos;t.</dd>
    </dl>
    <h2>Sources</h2>
    <ul className={s.sources}>
      {sources.map(src => <li key={src.url}><a href={src.url} target="_blank" rel="noreferrer">{src.title}</a></li>)}
    </ul>
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
    <h2 className={s.chatHead}>Tutor chat</h2>
    <div ref={log} className={s.log} role="log" aria-live="polite">
      {messages.length === 0 && !pending && <p className={s.empty}>Ask about the current question.</p>}
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
