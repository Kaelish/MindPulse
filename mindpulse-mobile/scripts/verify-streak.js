/**
 * Verifies the MindPlant streak rules in src/services/streakLogic.ts.
 *
 * Run:  node scripts/verify-streak.js
 *
 * streakLogic.ts is deliberately dependency-free, so this script compiles it
 * on the fly with tsc and asserts the behaviour that matters:
 * a missed day spends a freeze, running out lapses the streak AND the plant
 * stage to 0, and the weekly freeze grant cannot be farmed.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'services', 'streakLogic.ts');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'streak-'));

let passed = 0;
const failures = [];

const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failures.push(`  ${label}\n    expected ${e}\n    actual   ${a}`);
  }
};

// ── Compile the pure module ──────────────────────────────────────────────────
execFileSync(
  process.execPath,
  [
    path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
    SRC,
    '--outDir', OUT,
    '--module', 'commonjs',
    '--target', 'es2019',
    '--skipLibCheck',
    '--ignoreConfig',
  ],
  { stdio: 'inherit' },
);

const {
  applyGap,
  nextSessionState,
  stageForStreak,
  daysBetween,
  FREEZE_START,
  FREEZE_MAX,
  POINTS_PER_SESSION,
} = require(path.join(OUT, 'streakLogic.js'));

const state = (streak, freezes, freezeTier) => ({ streak, freezes, freezeTier });
const day = (y, m, d) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// ── daysBetween ──────────────────────────────────────────────────────────────
check('same day', daysBetween(day(2026, 10, 15), day(2026, 10, 15)), 0);
check('consecutive', daysBetween(day(2026, 10, 15), day(2026, 10, 16)), 1);
check('one missed day', daysBetween(day(2026, 10, 15), day(2026, 10, 17)), 2);
check('month rollover', daysBetween(day(2026, 1, 31), day(2026, 2, 2)), 2);
check('leap day', daysBetween(day(2028, 2, 28), day(2028, 3, 1)), 2);
check('leap year vs non-leap', daysBetween(day(2026, 2, 28), day(2026, 3, 1)), 1);
check('backward', daysBetween(day(2026, 10, 17), day(2026, 10, 15)), -2);
check('garbage input', daysBetween('not-a-date', day(2026, 10, 15)), 0);

// ── applyGap: the core of the feature ────────────────────────────────────────
check(
  'no sessions yet',
  applyGap(state(0, FREEZE_START, 0), null, day(2026, 10, 15)),
  state(0, FREEZE_START, 0),
);

check(
  'recorded today: untouched',
  applyGap(state(9, 2, 1), day(2026, 10, 15), day(2026, 10, 15)),
  state(9, 2, 1),
);

check(
  'consecutive days: nothing spent',
  applyGap(state(9, 2, 1), day(2026, 10, 14), day(2026, 10, 15)),
  state(9, 2, 1),
);

check(
  'missed ONE day, freeze covers it -> streak kept, one spent',
  applyGap(state(9, 2, 1), day(2026, 10, 14), day(2026, 10, 16)),
  state(9, 1, 1),
);

check(
  'missed TWO days, both covered -> streak kept, bank empty',
  applyGap(state(9, 2, 1), day(2026, 10, 13), day(2026, 10, 16)),
  state(9, 0, 1),
);

check(
  'missed TWO days, only ONE freeze -> LAPSE to 0, freeze spent, tier reset',
  applyGap(state(9, 1, 1), day(2026, 10, 13), day(2026, 10, 16)),
  state(0, 0, 0),
);

check(
  'long gap with an empty bank -> LAPSE to 0',
  applyGap(state(40, 0, 3), day(2026, 9, 1), day(2026, 10, 15)),
  state(0, 0, 0),
);

check(
  'long gap, all freezes spent but still short -> LAPSE, bank at 0',
  applyGap(state(40, 2, 3), day(2026, 9, 1), day(2026, 10, 15)),
  state(0, 0, 0),
);

check(
  'future-dated row (clock skew) is not treated as a gap',
  applyGap(state(9, 2, 1), day(2026, 10, 20), day(2026, 10, 15)),
  state(9, 2, 1),
);

check(
  'gap of exactly 1 is consecutive, not a miss',
  applyGap(state(1, 2, 0), day(2026, 10, 14), day(2026, 10, 15)),
  state(1, 2, 0),
);

check(
  'reading is side-effect free: lapse result does not mutate input',
  applyGap(Object.freeze(state(9, 1, 1)), day(2026, 10, 13), day(2026, 10, 16)),
  state(0, 0, 0),
);

// ── stage follows the streak (plant wilts with it) ───────────────────────────
check('stage 0 wilts to Bare Pot', stageForStreak(0), 'Bare Pot');
check('stage 1', stageForStreak(1), 'Seedling');
check('stage 4 still Seedling', stageForStreak(4), 'Seedling');
check('stage 5', stageForStreak(5), 'Sprout');
check('stage 10', stageForStreak(10), 'Young Plant');
check('stage 15', stageForStreak(15), 'Mature Plant');
check('stage 25', stageForStreak(25), 'Full Bloom');
check('stage 99 caps at Full Bloom', stageForStreak(99), 'Full Bloom');

// ── nextSessionState: recording ──────────────────────────────────────────────
check(
  'first session of a brand-new streak',
  nextSessionState(state(0, FREEZE_START, 0), null, 0, day(2026, 10, 15), false),
  { streak: 1, freezes: FREEZE_START, freezeTier: 0, points: POINTS_PER_SESSION },
);

check(
  'consecutive session continues the streak',
  nextSessionState(state(4, 2, 0), day(2026, 10, 14), 40, day(2026, 10, 15), false),
  { streak: 5, freezes: 2, freezeTier: 0, points: 50 },
);

check(
  're-recording the same day is idempotent (no streak step, no points)',
  nextSessionState(state(4, 2, 0), day(2026, 10, 15), 40, day(2026, 10, 15), true),
  { streak: 4, freezes: 2, freezeTier: 0, points: 40 },
);

check(
  'missed day + freeze: streak keeps growing, freeze spent',
  nextSessionState(state(4, 1, 0), day(2026, 10, 13), 40, day(2026, 10, 15), false),
  { streak: 5, freezes: 0, freezeTier: 0, points: 50 },
);

check(
  'lapsed streak restarts at 1 with a fresh stage',
  nextSessionState(state(40, 0, 3), day(2026, 9, 1), 400, day(2026, 10, 15), false),
  { streak: 1, freezes: 0, freezeTier: 0, points: 410 },
);

check(
  'lapse then record: stage resets to Seedling, not Full Bloom',
  stageForStreak(
    nextSessionState(state(40, 0, 3), day(2026, 9, 1), 400, day(2026, 10, 15), false).streak,
  ),
  'Seedling',
);

// ── weekly freeze grant (7 / 14 / 21 days) ───────────────────────────────────
check(
  'day 7 crosses tier 1 -> +1 freeze',
  nextSessionState(state(6, 2, 0), day(2026, 10, 14), 60, day(2026, 10, 15), false),
  { streak: 7, freezes: 3, freezeTier: 1, points: 70 },
);

check(
  'day 8 does NOT grant again',
  nextSessionState(state(7, 3, 1), day(2026, 10, 14), 70, day(2026, 10, 15), false),
  { streak: 8, freezes: 3, freezeTier: 1, points: 80 },
);

check(
  'day 14 crosses tier 2 -> +1 freeze',
  nextSessionState(state(13, 3, 1), day(2026, 10, 14), 130, day(2026, 10, 15), false),
  { streak: 14, freezes: 4, freezeTier: 2, points: 140 },
);

check(
  'day 21 crosses tier 3 -> +1 freeze (bank at cap 5)',
  nextSessionState(state(20, 4, 2), day(2026, 10, 14), 200, day(2026, 10, 15), false),
  { streak: 21, freezes: 5, freezeTier: 3, points: 210 },
);

check(
  'cap holds: 7 days past a full bank earns nothing extra',
  nextSessionState(state(27, 5, 3), day(2026, 10, 14), 270, day(2026, 10, 15), false),
  { streak: 28, freezes: FREEZE_MAX, freezeTier: 3, points: 280 },
);

check(
  'tier cannot be farmed: after a lapse the tier restarts at 0',
  applyGap(state(40, 0, 3), day(2026, 9, 1), day(2026, 10, 15)).freezeTier,
  0,
);

check(
  'rebuilding past day 7 earns the grant again (tier was reset)',
  nextSessionState(state(6, 0, 0), day(2026, 10, 14), 60, day(2026, 10, 15), false),
  { streak: 7, freezes: 1, freezeTier: 1, points: 70 },
);

// ── report ───────────────────────────────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  console.log('FAILURES:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('All MindPlant streak rules verified.');
