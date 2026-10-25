import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { curriculum } from '../mastery/curriculum';
import type { Colour } from '../mastery/schema';
import { songMilestone, songPages, songsPerPage, songTitle } from './song-titles';

const chartTitle = (songId: string) => (JSON.parse(readFileSync(join(process.cwd(), 'public/songs', songId, 'chart.json'), 'utf8')) as { title: string }).title;

describe('song titles', () => {
  it.each(curriculum.songs.map(song => song.songId))('%s matches its chart', songId => {
    expect(songTitle(songId)).toBe(chartTitle(songId));
  });
  it('shows the id for a song with no known title, never an invented one', () => {
    expect(songTitle('not-a-song')).toBe('not-a-song');
  });
});

describe('song pages', () => {
  const pages = songPages(curriculum.songs);
  it('hold every tagged song once, six or fewer to a page', () => {
    expect(pages.flatMap(page => page.songs.map(song => song.songId)).sort()).toEqual(curriculum.songs.map(song => song.songId).sort());
    for (const page of pages) expect(page.songs.length).toBeLessThanOrEqual(songsPerPage);
  });
  it('run from fewest tagged skills to most, and each page states its real range', () => {
    const counts = pages.flatMap(page => page.songs.map(song => song.nodeIds.length));
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    for (const page of pages) {
      expect(page.fewest).toBe(Math.min(...page.songs.map(song => song.nodeIds.length)));
      expect(page.most).toBe(Math.max(...page.songs.map(song => song.nodeIds.length)));
    }
  });
});

describe('song milestone', () => {
  const song = curriculum.songs[0];
  it('counts only mastered tagged skills, out of all tagged skills', () => {
    const colours = new Map<string, Colour>(song.nodeIds.map((id, index) => [id, index === 0 ? 'mastered' : index === 1 ? 'in-progress' : 'unknown']));
    expect(songMilestone(song, colours)).toEqual({ mastered: 1, total: new Set(song.nodeIds).size });
  });
  it('is zero with no evidence', () => {
    expect(songMilestone(song, new Map()).mastered).toBe(0);
  });
});
