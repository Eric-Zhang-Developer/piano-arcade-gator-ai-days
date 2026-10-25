import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({ Source_Sans_3: () => ({ variable: 'reading-face', className: 'reading-face', style: { fontFamily: 'Source Sans 3' } }) }));

const { Brackets, Button, DuoScope, Mark, MonoLabel, Panel } = await import('./index');

const text = (html: string) => html.replace(/<[^>]+>/g, '|');
const css = readFileSync(new URL('./duo.module.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('Panel', () => {
  it('renders the dark panel by default and the paper sheet on request', () => {
    expect(renderToStaticMarkup(<Panel>Bar 3</Panel>)).toMatch(/^<div data-variant="panel"[^>]*>Bar 3<\/div>$/);
    expect(renderToStaticMarkup(<Panel variant="paper" aria-label="Score">x</Panel>)).toMatch(/data-variant="paper"[^>]*aria-label="Score"/);
  });
});

describe('Brackets', () => {
  it.each(['primary', 'line'] as const)('puts four hidden corners around its child in the %s tone', tone => {
    const html = renderToStaticMarkup(<Brackets tone={tone}><Panel>Focus</Panel></Brackets>);
    expect(html).toContain(`data-tone="${tone}"`);
    expect(html.match(/<span aria-hidden="true" data-corner="(tl|tr|bl|br)"/g)).toHaveLength(4);
    expect(text(html)).toContain('|Focus|');
  });
});

describe('Button', () => {
  it('is a primary, non-submitting button by default', () => {
    expect(renderToStaticMarkup(<Button>Check</Button>)).toMatch(/^<button type="button" data-variant="primary"[^>]*>Check<\/button>$/);
  });
  it('renders the hairline secondary and passes through disabled and type', () => {
    const html = renderToStaticMarkup(<Button variant="secondary" type="submit" disabled>Skip</Button>);
    expect(html).toMatch(/type="submit" data-variant="secondary"/);
    expect(html).toContain('disabled=""');
  });
});

describe('Mark', () => {
  it('shows the wrong answer with a hidden ✕ and the word', () => {
    const html = renderToStaticMarkup(<Mark kind="wrong" />);
    expect(html).toContain('data-kind="wrong"');
    expect(html).toContain('<span aria-hidden="true">✕</span>');
    expect(text(html)).toContain('|Wrong|');
  });
  it('shows the correct answer with the word and no ✕', () => {
    const html = renderToStaticMarkup(<Mark kind="correct" />);
    expect(html).toContain('data-kind="correct"');
    expect(html).not.toContain('✕');
    expect(text(html)).toContain('|Correct|');
  });
  it('lets the screen say which answer it judged', () => {
    expect(text(renderToStaticMarkup(<Mark kind="wrong">Wrong: that was E</Mark>))).toContain('|Wrong: that was E|');
  });
});

describe('MonoLabel', () => {
  it('renders its data as a span', () => {
    expect(renderToStaticMarkup(<MonoLabel>BAR 14 / 32</MonoLabel>)).toMatch(/^<span[^>]*>BAR 14 \/ 32<\/span>$/);
  });
});

describe('DuoScope', () => {
  it('puts the reading face variable on the same element as the scope', () => {
    expect(renderToStaticMarkup(<DuoScope>Lesson</DuoScope>)).toMatch(/^<div class="reading-face [^"]+">Lesson<\/div>$/);
  });
});

describe('duo.module.css', () => {
  it('keeps every corner square and adds no gradient or glow', () => {
    expect(css.match(/border-radius:[^;}]+/g)?.every(rule => rule === 'border-radius:0')).toBe(true);
    expect(css).not.toMatch(/gradient|box-shadow|text-shadow|filter:/);
  });
  it('takes every colour from a --learn-* token, so no fourth colour slips in', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
  it('moves for 150-250ms ease-out and stands still under reduced motion', () => {
    const durations = [...css.matchAll(/(\d+)ms/g)].map(([, ms]) => Number(ms));
    expect(durations.length).toBeGreaterThan(0);
    expect(durations.every(ms => ms >= 150 && ms <= 250)).toBe(true);
    expect(css).toMatch(/ease-out/);
    expect(css).not.toMatch(/ease-in\b|ease-in-out|linear\b/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.button \{ transition:none; \}/);
  });
});
