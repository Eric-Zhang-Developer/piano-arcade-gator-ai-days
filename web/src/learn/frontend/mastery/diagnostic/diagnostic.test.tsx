import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { curriculum } from '../curriculum';
import type { PlayingItem } from '../schema';

vi.mock('next/font/google', () => ({ Source_Sans_3: () => ({ variable: 'reading-face', className: 'reading-face', style: { fontFamily: 'Source Sans 3' } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }) }));

const { Diagnostic } = await import('./index');
const { Passage } = await import('./Passage');

const css = readFileSync(new URL('./diagnostic.module.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('Diagnostic', () => {
  it('shows only Stop, leading to the map, until the progress has loaded', () => {
    const html = renderToStaticMarkup(<Diagnostic/>);
    expect(html).toMatch(/<a[^>]*href="\/learn"[^>]*>Stop<\/a>/);
    expect(html).not.toContain('<h1');
    expect(html.replace(/<[^>]+>/g, '')).toBe('Stop');
  });
});

describe('Passage', () => {
  it('draws every note of a playing item on the staff', () => {
    const item = curriculum.items.find((i): i is PlayingItem => i.type === 'playing')!;
    const html = renderToStaticMarkup(<Passage notes={item.notes} label="passage"/>);
    expect(html).toContain('role="img"');
    expect(html.match(/data-pitch=/g)).toHaveLength(item.notes.length);
  });
});

describe('the look', () => {
  it('has no gradients, shadows, filters, raw colours or italics', () => {
    expect(css).not.toMatch(/gradient|box-shadow|text-shadow|filter|italic/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
  it('is square, has no mobile layout, and sets no font under 16px', () => {
    for (const r of css.matchAll(/border-radius:\s*([^;]+)/g)) expect(r[1].trim()).toBe('0');
    expect(css).not.toMatch(/@media/);
    for (const f of css.matchAll(/font-size:\s*(\d+)px/g)) expect(Number(f[1])).toBeGreaterThanOrEqual(16);
  });
});
