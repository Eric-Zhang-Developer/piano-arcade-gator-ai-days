import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { curriculum } from '../mastery/curriculum';
import { nodeScreen, theoryGates, theoryTitle } from '../theory';

vi.mock('next/font/google', () => ({ Source_Sans_3: () => ({ variable: 'reading-face', className: 'reading-face', style: { fontFamily: 'Source Sans 3' } }) }));

const { EncodingSandbox, chatOutcome } = await import('./EncodingSandbox');

const css = readFileSync(new URL('./encoding.module.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** What a person sees at a glance: the header's and the workspace's own children, Help's closed panel not counted. */
function items(html: string): string[] {
  const tags = (from: string) => {
    const out: string[] = [];
    let depth = 0;
    for (const m of from.matchAll(/<(\/?)([a-z][\w-]*)([^>]*?)(\/?)>/g)) {
      const [whole, close, name, , self] = m;
      if (close) { depth--; if (depth < 0) break; continue; }
      if (depth === 0) out.push(whole);
      if (!self && !['input', 'br', 'img', 'hr'].includes(name)) depth++;
    }
    return out;
  };
  const inside = (open: RegExp) => {
    const m = html.match(open);
    return m ? html.slice(m.index! + m[0].length) : '';
  };
  return [...tags(inside(/<header[^>]*>/)), ...tags(inside(/<section[^>]*aria-label="Workspace"[^>]*>/))];
}

/** Every aria-controls names an element on the page (#1278). */
function controlsExist(html: string) {
  for (const [, id] of html.matchAll(/aria-controls="([^"]*)"/g)) expect(html).toContain(`id="${id}"`);
}

describe('the sandbox on first load', () => {
  // The server render has no saved progress, so it is what a learner sees before answering anything.
  const html = renderToStaticMarkup(<EncodingSandbox />);

  it('has the hairline header: title and Stop back to /learn, and no progress count', () => {
    expect(html).toContain(`<h1>${theoryTitle}</h1>`);
    expect(html).toMatch(/<a [^>]*href="\/learn"[^>]*>Stop<\/a>/);
    expect(html).not.toContain('gates passed');
  });

  it('asks the first question of the first gate, with nothing judged yet', () => {
    const [gate] = theoryGates;
    expect(html).toContain(`data-gate="${gate.id}" data-question="${gate.questions[0].id}"`);
    expect(html).toContain('>Check<');
    expect(html).not.toContain('data-result');
    expect(html).not.toContain('data-complete');
  });

  it('shows a phrase only when the question asks about one, with Listen', async () => {
    // The first question (the tonic) names no phrase, so no score; a phrase question gets its own phrase only.
    expect(theoryGates[0].questions[0].phrase).toBeUndefined();
    expect(html).not.toContain('<figure');
    const { EncodingScore } = await import('./EncodingScore');
    const score = renderToStaticMarkup(<EncodingScore focus={1} />);
    expect([...score.matchAll(/<figure[^>]*data-phrase="(\d)"/g)].map(m => m[1])).toEqual(['1']);
    expect(score.match(/>Listen</g)).toHaveLength(1);
    expect(renderToStaticMarkup(<EncodingScore />)).toBe('');
  });

  it('has no files or gate strip: the question is the screen (decision "Agent drives")', () => {
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('data-tab=');
    expect(html).not.toContain('aria-label="Gates"');
  });

  it('keeps the tutor and Show answer behind a closed Help whose panel exists (#1278)', () => {
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="help-panel"[^>]*>Help</);
    const panel = html.slice(html.indexOf('id="help-panel"'));
    expect(html).toMatch(/<div id="help-panel"[^>]*hidden=""/);
    expect(panel).toContain('>Show answer<');
    expect(panel).toContain('aria-label="Tutor chat"');
    expect(panel).toContain('id="chat-input"');
    controlsExist(html);
  });

  it('holds seven items or fewer: title, Stop, question, answers, Check, Help (a phrase question adds its phrase)', () => {
    expect(items(html)).toHaveLength(6);
  });

  it('says passed, never mastered', () => {
    expect(html.toLowerCase()).not.toContain('master');
  });
});

describe('the sandbox for a node', () => {
  const node = nodeScreen(curriculum, 'pitch-grand-staff')!;
  const html = renderToStaticMarkup(<EncodingSandbox node={node} />);
  const about = node.around.nodes.find(n => n.id === node.gate.id)!;

  it('asks the node\'s first item under its title, with Stop', () => {
    expect(html).toContain('data-mode="node"');
    expect(html).toContain(`<h1>${node.gate.title}</h1>`);
    expect(html).toContain(`data-gate="${node.gate.id}" data-question="${node.gate.questions[0].id}"`);
    expect(html).toMatch(/<a [^>]*href="\/learn"[^>]*>Stop<\/a>/);
  });

  it('has no files, score, gate strip or tutor: Next chose the node', () => {
    expect(html).not.toContain('data-tab=');
    expect(html).not.toContain('<figure');
    expect(html).not.toContain('aria-label="Gates"');
    expect(html).not.toContain('aria-label="Tutor chat"');
    expect(html).not.toContain(theoryGates[0].questions[0].prompt);
  });

  it('keeps why the node matters and where to read about it behind a closed Help', () => {
    expect(html).toMatch(/aria-expanded="false"[^>]*aria-controls="help-panel"/);
    const panel = html.slice(html.indexOf('id="help-panel"'));
    expect(panel).toContain('>Show answer<');
    expect(panel).toContain(about.whyImportant.replace(/&/g, '&amp;').replace(/'/g, '&#x27;'));
    for (const src of about.sources) expect(panel).toContain(`href="${src.url}"`);
    controlsExist(html);
  });

  it('holds seven items or fewer: title, Stop, question, answers, Check, Help', () => {
    expect(items(html)).toHaveLength(6);
  });

  it('says there is nothing to answer for a node without theory items', () => {
    const none = renderToStaticMarkup(<EncodingSandbox node={null} />);
    expect(none).toContain('<h1>No theory questions for this node</h1>');
    expect(none).toMatch(/href="\/learn"[^>]*>Back to map</);
    expect(none).not.toContain('>Check<');
  });
});

describe('chatOutcome', () => {
  it('shows a reply only when the tutor sent one', () => {
    expect(chatOutcome({ status: 'ok', reply: 'C is home.' })).toEqual({ kind: 'reply', text: 'C is home.' });
  });
  it('says the chat is not connected when there is no key or no route', () => {
    expect(chatOutcome({ status: 'not-configured' })).toEqual({ kind: 'not-connected' });
    expect(chatOutcome(null)).toEqual({ kind: 'not-connected' });
  });
  it('passes a tutor error through', () => {
    expect(chatOutcome({ status: 'error', message: 'Too many requests.' })).toEqual({ kind: 'error', message: 'Too many requests.' });
  });
});

describe('the encoding styles', () => {
  it('take colours only from tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgba?|hsla?)\(/i);
    expect(css).not.toContain('--pa-cyan');
  });
  it('are square and upright', () => {
    for (const [, value] of css.matchAll(/border-radius:\s*([^;}]+)/g)) expect(value.trim()).toBe('0');
    expect(css).not.toContain('italic');
  });
  it('underline links and ring focus in the accent (#947)', () => {
    expect(css).toMatch(/\.sources a \{[^}]*text-decoration:underline/);
    expect(css).toMatch(/:focus-visible \{ outline:2px solid var\(--learn-accent\)/);
  });
  it('set no text under 16px', () => {
    const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
    expect(css).not.toMatch(/font-size:\s*[\d.]+(rem|em)/);
  });
  it('keep the paper light whatever the theme', () => {
    expect(css).toMatch(/\.paper \{[^}]*color-scheme:light/);
  });
});

describe('the score for a screen reader (#945)', () => {
  it('names each phrase and its bars, never the note it ends on', async () => {
    const { EncodingScore } = await import('./EncodingScore');
    const { PhraseScore } = await import('../Score');
    const labels = [renderToStaticMarkup(<><EncodingScore focus={1} /><EncodingScore focus={2} /></>), renderToStaticMarkup(<><PhraseScore phrase={1} /><PhraseScore phrase={2} /></>)]
      .flatMap(html => [...html.matchAll(/role="img" aria-label="([^"]*)"/g)].map(m => m[1]));
    expect(labels).toContain('Phrase 1, bars 1 to 2');
    expect(labels).toContain('Phrase 2, bars 3 to 4');
    expect(labels.filter(l => /ending|\b[A-G]\b/.test(l))).toEqual([]);
  });
});
