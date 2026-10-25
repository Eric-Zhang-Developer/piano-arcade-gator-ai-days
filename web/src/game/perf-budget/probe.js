// Perf budget's frame timer (spec: perf-budget). One plain script with no imports: perf.mjs injects it before load,
// and a person can paste it into the console mid-song. It wraps window.requestAnimationFrame and times each callback;
// callbacks sharing a frame timestamp sum to one frame. Only frames during fever, before the results show, count.
// At the results: __perfProbe.report() -> { frames, p50, p95, max } in ms. __perfProbe.intervals() gives the same stats
// for the gaps between consecutive counted frames: what compositing costs shows there and not in callback time, but an
// empty headless page already reads p95 17.6 ms that way, so it's only for comparing two runs, never a budget.
(function (window) {
  if (window.__perfProbe) return;
  var BUDGET_MS = 16.7; // one 60 Hz frame
  var clock = window.performance;
  var raf = window.requestAnimationFrame.bind(window);
  var frames = []; // { ts, ms }
  var feverSeen = false;

  function counting() {
    var g = window.__pianoArcadeFeverGauge;
    var fever = !!(g && g.fever);
    if (fever) feverSeen = true;
    return fever && !window.document.querySelector('[data-testid="results"]');
  }

  // Nearest rank: the smallest value with at least q% of the list at or below it.
  function rank(sorted, q) {
    return sorted[Math.max(0, Math.ceil((q / 100) * sorted.length) - 1)];
  }

  function stats(ms) {
    var s = ms.slice().sort(function (a, b) {
      return a - b;
    });
    if (!s.length) return { frames: 0, p50: null, p95: null, max: null };
    return { frames: s.length, p50: rank(s, 50), p95: rank(s, 95), max: s[s.length - 1] };
  }

  // Runs: [{ frames, p95, ... , invalid? }] -> { pass, invalid: [reasons] }. Every run's p95 must be within budget.
  function verdict(runs) {
    var invalid = [];
    runs.forEach(function (r, i) {
      if (r.invalid) invalid.push("run " + (i + 1) + ": " + r.invalid);
      else if (!r.frames) invalid.push("run " + (i + 1) + ": no frames counted");
    });
    var pass = !invalid.length && runs.length > 0 && runs.every(function (r) {
      return r.p95 <= BUDGET_MS;
    });
    return { pass: pass, invalid: invalid };
  }

  window.requestAnimationFrame = function (cb) {
    return raf(function (ts) {
      var t0 = clock.now();
      try {
        cb(ts);
      } finally {
        var dt = clock.now() - t0;
        if (counting()) {
          var last = frames[frames.length - 1];
          if (last && last.ts === ts) last.ms += dt;
          else frames.push({ ts: ts, ms: dt });
        }
      }
    });
  };

  window.__perfProbe = {
    budgetMs: BUDGET_MS,
    stats: stats,
    verdict: verdict,
    feverSeen: function () {
      return feverSeen;
    },
    intervals: function () {
      var gaps = [];
      for (var i = 1; i < frames.length; i++) {
        var gap = frames[i].ts - frames[i - 1].ts;
        if (gap < 250) gaps.push(gap); // longer is fever stopping and starting again, not a frame
      }
      return stats(gaps);
    },
    report: function () {
      var r = stats(
        frames.map(function (f) {
          return f.ms;
        }),
      );
      if (window.console) window.console.info("perf-budget probe:", JSON.stringify(r));
      return r;
    },
  };
})(window);
