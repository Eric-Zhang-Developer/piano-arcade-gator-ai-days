const { page } = globalThis;
const origin = await page.eval(() => location.origin);

async function open(path) {
  await page.open(`${origin}/learn/${path}`);
  await page.wait('main h2');
  await page.eval(() => {
    const contexts = [];
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); contexts.push(this); }
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 50));
    const text = () => document.querySelector('main').innerText;
    function assert(value, message) { if (!value) throw new Error(message); }
    async function until(predicate, message) {
      const end = Date.now() + 10000;
      while (Date.now() < end) {
        if (predicate()) return;
        await flush();
      }
      throw new Error(message);
    }
    async function click(label) {
      const button = [...document.querySelectorAll('main button')].find(b => b.textContent.trim().startsWith(label));
      assert(button && !button.disabled, `Unavailable button: ${label}`);
      button.click();
      await flush();
    }
    async function choose(value) {
      document.querySelector(`input[value=${JSON.stringify(value)}]`).click();
      await flush();
    }
    async function connect(online) {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
      window.dispatchEvent(new Event(online ? 'online' : 'offline'));
      await until(() => online
        ? document.querySelector('main')?.checkVisibility()
        : document.body.innerText.includes('You’re offline') && !document.querySelector('main')?.checkVisibility(),
      online ? 'Activity did not recover' : 'Offline activity remains exposed');
      await flush();
    }
    async function recover() { await connect(false); await connect(true); }
    async function playingAudio() {
      await until(() => contexts.some(c => c.state === 'running'), 'Audio did not start');
    }
    async function stoppedAudio() {
      await until(() => contexts.length > 0 && contexts.every(c => c.state === 'closed'), 'Audio survived offline cancellation');
    }
    window.learningOfflineTest = { assert, flush, text, until, click, choose, connect, recover, playingAudio, stoppedAudio };
  });
}

await open('understand');
await page.eval(async () => {
  const { assert, flush, text, click, choose, connect, recover, playingAudio, stoppedAudio } = window.learningOfflineTest;
  await choose('Phrase 2');
  await click('Check answer');
  await click('Continue');
  const input = document.querySelector('textarea');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'C sounds like home to me.');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await click('Need a hint?');
  await click('Listen to phrase 1');
  await playingAudio();
  assert(text().includes('Stop phrase 1'), 'Phrase ended before cancellation');
  await connect(false);
  await stoppedAudio();
  await connect(true);
  assert(document.querySelector('textarea')?.value === 'C sounds like home to me.' && text().includes('Previous answers (1)') && text().includes('Hide hint'), 'Understand lost draft, history or hint');
  assert(!text().includes('Stop phrase'), 'Theory listening control stayed active');
  await click('Listen to phrase 2');
  await playingAudio();
  await click('Stop phrase 2');
  await click('Compare answer');
  await recover();
  assert(document.querySelector('textarea').readOnly && text().includes('Compare your explanation.'), 'Comparison state reset');
  await click('Continue');
  await choose('G');
  await click('Check answer');
  await click('Finish');
  await recover();
  assert(text().includes('That’s the idea.'), 'Completed Understand reset');
});

await open('review');
await page.eval(async () => {
  const { assert, text, click, choose, recover } = window.learningOfflineTest;
  const reference = () => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Reference'));
  assert(reference().disabled, 'Review reference starts unlocked');
  await choose('C');
  await recover();
  assert(document.querySelector('input[value="C"]').checked, 'Review selection reset');
  await click('Check answer');
  await click('Reference');
  await recover();
  assert(text().includes('Correct.') && document.querySelector('article h2')?.textContent === 'A sense of home', 'Review feedback or reference state reset');
  await click('Continue');
  assert(reference().disabled && text().includes('Previous answers (1)'), 'Review did not advance with a fresh reference gate');
  await choose('Phrase 2');
  await click('Check answer');
  await click('Continue');
  await choose('No');
  await click('Check answer');
  await click('Finish');
  await recover();
  assert(text().includes('Review complete.') && text().includes('3 of 3 answers correct'), 'Completed review or answers reset');
});

await open('practice');
await page.eval(async () => {
  const { assert, flush, text, until, click, connect, recover, playingAudio, stoppedAudio } = window.learningOfflineTest;
  const tempo = () => document.querySelector('input[type="range"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(tempo(), '80');
  tempo().dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('input[name="note-names"]').closest('details').open = true;
  document.querySelector('input[name="note-names"]').click();
  await flush();
  await click('Hear the opening');
  await playingAudio();
  assert(text().includes('Stop demo'), 'Demo ended before cancellation');
  await connect(false);
  await stoppedAudio();
  await connect(true);
  assert(tempo().value === '80' && !document.querySelector('input[name="note-names"]').checked && !tempo().disabled, 'Practice settings reset or remained locked');
  await click('Hear the opening');
  await playingAudio();
  await click('Stop demo');
  await click('Start preview take');
  await recover();
  assert(text().includes('Start preview take') && !document.querySelector('main').textContent.includes('example take'), 'Interrupted practice take completed or stayed active');
  await click('Start preview take');
  await until(() => text().includes('Practise the held note'), 'Practice could not finish after recovery');
  await click('Practise the held note');
  await click('I played it');
  await click('I played it');
  await recover();
  assert(text().includes('2 of 4 repetitions') && document.querySelector('main').textContent.includes('1 example take') && tempo().value === '80', 'Practice repetitions, take count or settings reset');
  await click('I played it');
  await click('I played it');
  await click('Preview at');
  await until(() => text().includes('Go to Play-through'), 'Practice support fading did not finish');
  await recover();
  assert(text().includes('Go to Play-through') && document.querySelector('main').textContent.includes('2 example takes'), 'Completed practice reset');
});

await open('play-through');
await page.eval(async () => {
  const { assert, text, until, click, recover } = window.learningOfflineTest;
  await click('Start preview take');
  assert(text().includes('Get ready'), 'Count-in did not start');
  await recover();
  assert(text().includes('Start preview take'), 'Count-in was not cancelled');
  await click('Start preview take');
  await until(() => text().includes('Playing through'), 'Play-through did not start');
  await recover();
  assert(text().includes('Start preview take'), 'Active play-through was not cancelled');
  await click('Start preview take');
});
await page.wait(32000);
await page.eval(async () => {
  const { assert, text, until, click, recover } = window.learningOfflineTest;
  await until(() => text().includes('Play-through complete'), 'Play-through could not finish after recovery');
  await recover();
  assert(text().includes('Play-through complete'), 'Completed play-through result reset');
  await click('Play again');
  assert(text().includes('Start preview take'), 'Play again no longer resets completed result');
  delete navigator.onLine;
});
