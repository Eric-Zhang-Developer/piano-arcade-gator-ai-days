import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import * as kit from '../../../game/duo-tokens';

vi.mock('next/font/google', () => ({ Source_Sans_3: () => ({ variable: 'reading-face', className: 'reading-face', style: { fontFamily: 'Source Sans 3' } }) }));

const duo = await import('./index');
const { DuoScope, Mark } = duo;

const text = (html: string) => html.replace(/<[^>]+>/g, '|');
const css = readFileSync(new URL('./duo.module.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the kit pieces', () => {
  // duo-tokens.test.tsx covers how they render; /learn must hand out the kit's own, never a copy of its own.
  it.each(['Brackets', 'Button', 'DataCell', 'MonoLabel', 'Panel'] as const)('%s is the duo-tokens component', name => {
    expect(duo[name]).toBe(kit[name]);
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

describe('DuoScope', () => {
  it('puts the reading face variable on the same element as the scope', () => {
    expect(renderToStaticMarkup(<DuoScope>Lesson</DuoScope>)).toMatch(/^<div class="reading-face [^"]+">Lesson<\/div>$/);
  });
});

describe('duo.module.css', () => {
  it('draws no frames, radii, gradients or glows of its own', () => {
    expect(css).not.toMatch(/border|radius|gradient|box-shadow|text-shadow|filter:/);
  });
  it('takes every colour from a --learn-* token, so no fourth colour slips in', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
  it('keeps Saira upright in the headings', () => {
    expect(css).toMatch(/:where\(h1,h2,h3\) \{[^}]*font-style:normal/);
    expect(css).not.toMatch(/italic/);
  });
});
