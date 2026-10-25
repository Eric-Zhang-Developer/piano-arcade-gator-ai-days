const { page } = globalThis;
const origin = await page.eval(() => location.origin);

// An offline interruption must cancel prepared-entry navigation and restore its action.
await page.open(`${origin}/learn`);
await page.wait('aside[aria-label="Your next activity"] button');
await page.eval(async () => {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('aside[aria-label="Your next activity"] button').click();
  await delay(100);
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
  window.dispatchEvent(new Event('offline'));
  await delay(100);
  delete navigator.onLine;
  window.dispatchEvent(new Event('online'));
  await delay(1600);
  const guide = document.querySelector('aside[aria-label="Your next activity"]');
  if (location.pathname !== '/learn' || document.querySelector('[data-entering]')?.dataset.entering !== 'false' || !guide || guide.querySelector('button').disabled || getComputedStyle(guide).opacity !== '1') {
    throw new Error('Interrupted entry navigated late or failed to restore the prepared action');
  }
});

async function open(path, ready = 'main h2') {
  await page.open(`${origin}/learn/${path}`);
  await page.wait(ready);
  await page.eval(() => {
    const contexts = [];
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); contexts.push(this); }
    };
    const flush = () => new Promise(resolve => setTimeout(resolve, 50));
    const text = () => document.querySelector('main').textContent;
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
      document.querySelector(`main input[value=${JSON.stringify(value)}]`).click();
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

await page.eval(() => localStorage.removeItem('pianoArcade.theory.v1'));
await open('understand', 'main h1');
await page.eval(async () => {
  const { assert, flush, text, until, click, choose, connect, recover, playingAudio, stoppedAudio } = window.learningOfflineTest;
  const gates = () => [...document.querySelectorAll('ol[aria-label="Gates"] li[data-gate]')].map(li => li.dataset.state).join(' ');
  const result = () => document.querySelector('main [role=status][data-result]')?.dataset.result;
  const tab = async id => { document.querySelector(`main button[role=tab][data-tab=${id}]`).click(); await flush(); };
  const answer = async value => { await choose(value); await click('Check'); assert(result() === 'correct', `${value} was not judged correct`); await click('Next'); };
  assert(gates() === 'current open open', 'Understand did not start on the first gate');
  assert([...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Check')?.disabled, 'Check starts enabled with nothing chosen');
  const input = document.querySelector('#chat-input');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'G sounds like home to me.');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await choose('g');
  await recover();
  assert(document.querySelector('main input[value="g"]').checked && document.querySelector('#chat-input').value === 'G sounds like home to me.', 'Understand lost the choice or the chat draft');
  await click('Check');
  await recover();
  assert(result() === 'wrong' && text().includes('Next'), 'Understand lost the judged answer');
  await click('Next');
  await answer('1');
  await answer('g');
  await answer('c');
  await recover();
  assert(gates() === 'passed current open', 'Understand lost a passed gate');
  await tab('score');
  await click('Listen');
  await playingAudio();
  await connect(false);
  await stoppedAudio();
  await connect(true);
  assert(![...document.querySelectorAll('main button')].some(b => b.textContent.trim() === 'Stop'), 'Score listening control stayed active');
  await tab('gates');
  for (const value of ['g', 'c', 'phrase-2', 'steps', 'second-line', 'ledger', 'no']) await answer(value);
  await choose('half');
  await click('Check');
  assert(result() === 'correct', 'half was not judged correct');
  const done = () => gates() === 'passed passed passed' && text().includes('All three gates passed');
  if (!done()) await click('Next');
  await until(done, 'Understand did not finish the gates');
  await recover();
  assert(done(), 'Completed Understand reset');
});

await open('review/theory', 'main h1');
await page.eval(async () => {
  const { assert, text, until, click, choose, recover } = window.learningOfflineTest;
  const verdict = value => document.querySelector(`main input[value=${JSON.stringify(value)}]`).closest('[data-verdict]')?.dataset.verdict;
  const check = () => [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Check');
  assert(check()?.disabled, 'Review Check starts enabled with nothing chosen');
  await choose('g');
  await recover();
  assert(document.querySelector('main input[value="g"]').checked, 'Review selection reset');
  await click('Check');
  await recover();
  assert(verdict('g') === 'wrong' && text().includes('Next'), 'Review lost the checked answer');
  await click('Next');
  for (const value of ['1', 'g', 'g', 'c', 'phrase-2', 'steps', 'second-line', 'ledger', 'no', 'half']) {
    await choose(value);
    await click('Check');
    assert(verdict(value) === 'correct', `${value} was not judged correct`);
    await click('Next');
  }
  await until(() => text().includes('10 of 11 right on the first try'), 'Review did not finish');
  await recover();
  assert(text().includes('10 of 11 right on the first try') && text().includes('To revisit') && !!document.querySelector('main a[href="/learn"]'), 'Completed review reset');
});

await open('practice');
await page.eval(async () => {
  const { assert, text, until, click, connect, recover, playingAudio, stoppedAudio } = window.learningOfflineTest;
  const heading = () => document.querySelector('main h2')?.textContent;
  const ready = label => [...document.querySelectorAll('main button')].some(b => b.textContent.trim().startsWith(label) && !b.disabled);
  await click('Hear the opening');
  await playingAudio();
  assert(text().includes('Stop demo'), 'Demo ended before cancellation');
  await connect(false);
  await stoppedAudio();
  await connect(true);
  assert(heading() === 'Give the ending room' && ready('See an example take') && ready('Hear the opening') && !text().includes('Stop demo'), 'Practice moved on or remained locked after the demo was cancelled');
  await click('Hear the opening');
  await playingAudio();
  await click('Stop demo');
  await click('See an example take');
  await recover();
  assert(heading() === 'Give the ending room' && ready('See an example take') && !text().includes('Stop example') && !text().includes('Practise the held note'), 'Interrupted practice take completed or stayed active');
  await click('See an example take');
  await until(() => text().includes('Practise the held note'), 'Practice could not finish after recovery');
  await click('Practise the held note');
  await click('I played it');
  await click('I played it');
  await recover();
  assert(heading() === 'Give G two full beats' && text().includes('2 of 4 repetitions'), 'Practice repetitions reset or the drill was lost');
  await click('I played it');
  await click('I played it');
  assert(heading() === 'Read from the staff', 'Practice support fading did not start with note names');
  await click('Example without note names');
  await until(() => ready('Example at 100 bpm'), 'Practice support fading did not move on to tempo');
  assert(heading() === 'Bring it up to tempo', 'Note names were not faded first');
  await click('Example at 100 bpm');
  await until(() => !!document.querySelector('main a[href="/learn"]'), 'Practice support fading did not finish');
  await recover();
  assert(!!document.querySelector('main a[href="/learn"]') && heading() === 'Connect the whole melody' && !ready('Hear the opening'), 'Completed practice reset');
});

await open('play-through');
await page.eval(async () => {
  const { assert, text, until, click, recover } = window.learningOfflineTest;
  await click('See an example take');
  assert(text().includes('Get ready'), 'Count-in did not start');
  await recover();
  assert(text().includes('See an example take'), 'Count-in was not cancelled');
  await click('See an example take');
  await until(() => text().includes('Playing through'), 'Play-through did not start');
  await recover();
  assert(text().includes('See an example take'), 'Active play-through was not cancelled');
  await click('See an example take');
});
await page.wait(32000);
await page.eval(async () => {
  const { assert, text, until, recover } = window.learningOfflineTest;
  await until(() => text().includes('Play-through complete'), 'Play-through could not finish after recovery');
  await recover();
  assert(text().includes('Play-through complete') && !!document.querySelector('main a[href="/learn"]') && !text().includes('See an example take'), 'Completed play-through result reset');
  delete navigator.onLine;
});
