import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { theoryGates, theoryTitle } from '../theory';

vi.mock('next/font/google', () => ({ Source_Sans_3: () => ({ variable: 'reading-face', className: 'reading-face', style: { fontFamily: 'Source Sans 3' } }) }));

const { EncodingSandbox, chatOutcome } = await import('./EncodingSandbox');

const css = readFileSync(new URL('./encoding.module.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the sandbox on first load', () => {
  // The server render has no saved progress, so it is what a learner sees before answering anything.
  const html = renderToStaticMarkup(<EncodingSandbox />);

  it('has the hairline header: title, gate progress and Stop back to /learn', () => {
    expect(html).toContain(`<h1>${theoryTitle}</h1>`);
    expect(html).toContain(`<strong>0</strong>/${theoryGates.length} gates passed`);
    expect(html).toMatch(/<a [^>]*href="\/learn"[^>]*>Stop<\/a>/);
  });

  it('has the Score, Reference and Gates files, with Gates open', () => {
    for (const tab of ['score', 'reference', 'gates']) expect(html).toContain(`data-tab="${tab}"`);
    expect(html).toMatch(/data-tab="gates"[^>]*>Gates</);
    expect(html).toMatch(/aria-selected="true"[^>]*data-tab="gates"/);
  });

  it('asks the first question of the first gate, with nothing judged yet', () => {
    const [gate] = theoryGates;
    expect(html).toContain(`data-gate="${gate.id}" data-question="${gate.questions[0].id}"`);
    expect(html).toContain('>Check<');
    expect(html).not.toContain('data-result');
    expect(html).not.toContain('data-complete');
  });

  it('has the tutor chat beside the workspace', () => {
    expect(html).toContain('aria-label="Tutor chat"');
    expect(html).toContain('id="chat-input"');
  });

  it('says passed, never mastered', () => {
    expect(html.toLowerCase()).not.toContain('master');
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
