# UI sound family: measurements

Written by `UI_TABLE=1 pnpm -C web exec vitest run src/game/x/ui-sounds-ab`. The reference is Twinkle's preview opening as laptop tones: peak 0.0499, RMS 0.0104. "Under" is how far below it, in dB.

## Before

| sound | ms | peak under, dB | RMS under, dB | centroid, Hz | attack, ms | mean | last sample |
|---|---|---|---|---|---|---|---|
| move | 30 | 0.5 | 0.0 | 1540 | 0.25 | 2.7e-4 | -1.3e-5 |
| confirm | 190 | 0.2 | -0.2 | 1789 | 0.25 | 7.5e-5 | -2.3e-4 |
| back | 190 | 0.3 | -0.2 | 1771 | 0.17 | 7.3e-5 | 2.5e-4 |
| sting | 760 | -0.6 | -5.3 | 5497 | 0.00 | 1.9e-4 | -1.0e-3 |
| tick | 30 | 0.1 | -1.8 | 1811 | 0.13 | 2.1e-4 | -4.4e-4 |
| tickAccent | 30 | 0.1 | -1.8 | 2298 | 0.08 | 1.5e-4 | -1.0e-3 |

## After

| sound | ms | peak under, dB | RMS under, dB | centroid, Hz | attack, ms | mean | last sample |
|---|---|---|---|---|---|---|---|
| move | 120 | 17.9 | 15.3 | 874 | 4.00 | -1.2e-7 | 0.0e+0 |
| confirm | 150 | 17.9 | 18.7 | 995 | 5.21 | -1.1e-7 | 0.0e+0 |
| back | 150 | 17.9 | 13.9 | 1001 | 3.79 | -1.9e-7 | 0.0e+0 |
| sting | 550 | 17.9 | 17.2 | 1034 | 4.00 | -5.4e-8 | 0.0e+0 |
| tick | 60 | 17.9 | 16.9 | 1857 | 2.65 | -4.7e-8 | 0.0e+0 |
| tickAccent | 60 | 17.9 | 17.0 | 2364 | 2.83 | -4.8e-8 | 0.0e+0 |
