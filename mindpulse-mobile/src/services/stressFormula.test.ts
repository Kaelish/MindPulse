/**
 * Contract tests for the canonical stress formula (A-6).
 *
 * The hub, the standalone final-score screen and the web portal's component
 * bars all derive from these transforms — a change here changes saved scores,
 * so the expectations below pin the exact published behaviour (baselines,
 * clamps, confidence pull, weight renormalization).
 */
import {
  faceStress,
  fuseStressScore,
  heartRateStress,
  reactionStress,
  surveyStress,
} from './stressFormula';

test('survey transform passes the PSS-10 total through, clamped to 0–100', () => {
  expect(surveyStress(0)).toBe(0);
  expect(surveyStress(63)).toBe(63);
  expect(surveyStress(100)).toBe(100);
  expect(surveyStress(-5)).toBe(0);
  expect(surveyStress(140)).toBe(100);
});

test('heart rate: 60 bpm baseline, +2 stress per bpm, clamped', () => {
  expect(heartRateStress(60)).toBe(0);
  expect(heartRateStress(75)).toBe(30);
  expect(heartRateStress(45)).toBe(0); // below baseline clamps to 0, never negative
  expect(heartRateStress(120)).toBe(100);
});

test('reaction: 250 ms baseline, +1 stress per 3 ms, clamped', () => {
  expect(reactionStress(250)).toBe(0);
  expect(reactionStress(550)).toBe(100); // 300/3 = 100
  expect(reactionStress(100)).toBe(0);
  expect(reactionStress(900)).toBe(100);
});

test('face: happy 20 / neutral 50 / sad 80 at full confidence', () => {
  expect(faceStress('happy', 1)).toBe(20);
  expect(faceStress('neutral', 1)).toBe(50);
  expect(faceStress('sad', 1)).toBe(80);
});

test('face confidence pulls the value toward neutral', () => {
  expect(faceStress('sad', 0)).toBe(50); // zero confidence → neutral
  expect(faceStress('happy', 0.5)).toBe(35); // 50 + (20−50)×0.5
  expect(faceStress('sad', 2)).toBe(80); // confidence clamped to 1
});

test('face: unknown or missing labels fall back to neutral, no scan → null', () => {
  expect(faceStress('angry', 1)).toBe(50); // legacy FER labels are not in the map
  expect(faceStress(null, 1)).toBeNull();
  expect(faceStress(undefined, null)).toBeNull();
});

test('fusion uses canonical weights (0.5/0.2/0.2/0.1) when all four are present', () => {
  // 70 survey, 75 bpm, sad@1.0, 400 ms → 70×.5 + 30×.2 + 80×.2 + 50×.1
  // = 35 + 6 + 16 + 5 = 62 (callers round — the hub always has)
  expect(fuseStressScore(70, 75, 'sad', 1, 400)).toBeCloseTo(62, 5);
});

test('fusion renormalizes over the indicators actually present', () => {
  // HR + reaction only (the standalone flow): weights 0.2/0.1 → 2/3, 1/3.
  // 75 bpm → 30, 400 ms → 50: 30×(2/3) + 50×(1/3) = 36.666… → not rounded here.
  expect(fuseStressScore(null, 75, null, null, 400)).toBeCloseTo(36.667, 2);
  // Single indicator → its value, full stop.
  expect(fuseStressScore(63, null, null, null, null)).toBe(63);
  // Nothing at all → null (callers substitute their own fallback).
  expect(fuseStressScore(null, null, null, null, null)).toBeNull();
});

test('fusion skips a face entry with no usable expression', () => {
  // Survey only: the face indicator contributes nothing to the average.
  expect(fuseStressScore(80, null, null, 1, null)).toBe(80);
});
