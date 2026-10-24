import { expect, test, vi } from "vitest";
import { pianoTone, toneVoice } from "./piano";
function audio() {
  const voices: { type: string; frequency: {value:number}; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const envelopes: { linearRampToValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }[] = [];
  const bus = { connect: () => bus };
  const ctx = { currentTime: 1, destination: {}, createOscillator() { const v = {type:"", frequency:{value:0}, connect:()=>bus, disconnect:vi.fn(), start:vi.fn(), stop:vi.fn(), onended:null};voices.push(v);return v; }, createGain() { const gain = {setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()};envelopes.push(gain);return {gain,connect:()=>bus,disconnect:vi.fn()}; } } as unknown as AudioContext;
  return {ctx, voices, envelopes};
}
test("speaker fallback has a piano-like attack/decay and earlier upper-partial decay; stop cancels every voice", () => {
  const {ctx,voices,envelopes}=audio();const stop=pianoTone(ctx,69,2000);
  expect(voices.map(v=>v.frequency.value)).toEqual([440,880,1320]);
  expect(voices.every(v=>v.type==='sine')).toBe(true);
  expect(envelopes[0].linearRampToValueAtTime.mock.calls[0][1]).toBe(1.004);
  expect(voices[1].stop.mock.calls[0][0]).toBeLessThan(voices[0].stop.mock.calls[0][0]);
  stop();expect(voices.every(v=>v.stop.mock.calls.length===2)).toBe(true);
});
test("replay fallback stops its own sounding voices",()=>{
  const {ctx,voices}=audio();const voice=toneVoice(ctx);voice.note(60,500);voice.stop();
  expect(voices.every(v=>v.stop.mock.calls.length===2)).toBe(true);
});
