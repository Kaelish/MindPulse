/**
 * Regression test for the reported render crash
 * "Cannot read property 'options' of undefined" (StressSurveyScreen, line 49):
 * walking the whole survey — Part 1 → interstitial → Part 2 → completion —
 * must never white-screen, because a crash mid-survey destroys the patient's
 * in-progress answers.
 *
 * The screen's render path is plain RN primitives; the only native-backed
 * piece (react-native-safe-area-context) is mocked below, and the completion
 * path uses AsyncStorage, which jest.config.js already maps to its mock.
 */
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { StressSurveyScreen } from './StressSurveyScreen';

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: (props: Record<string, unknown>) => ReactLocal.createElement(View, props),
  };
});

// @expo/vector-icons ships untransformed ESM that jest's RN preset refuses to
// load in node_modules; the icons are decorative here, so render a stub.
jest.mock('@expo/vector-icons', () => {
  const StubIcon = () => null;
  return { Ionicons: StubIcon, MaterialCommunityIcons: StubIcon, MaterialIcons: StubIcon };
});

const ReactTestRenderer = require('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => Renderer;
};

type TestNode = { props: { onPress?: () => void | Promise<void>; disabled?: boolean } };

type Renderer = {
  /** Re-fetched on demand: fiber wrappers go stale across re-renders. */
  readonly root: { findAllByType: (type: unknown) => TestNode[] };
  toJSON: () => unknown;
};

/** Presses an element's onPress and awaits an async handler's promise. */
const tap = async (element: TestNode): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    const result = element.props.onPress?.();
    if (result && typeof (result as Promise<void>).then === 'function') await result;
  });
};

/**
 * Button layout while a question is on screen (tree order): header Back,
 * header Exit, then one TouchableOpacity per answer option, then the single
 * footer Next button. The interstitial only has Back + Start.
 */
const answerAndNext = async (renderer: Renderer): Promise<void> => {
  const beforeAnswer = renderer.root.findAllByType(TouchableOpacity);
  await tap(beforeAnswer[2]); // first answer option
  const afterAnswer = renderer.root.findAllByType(TouchableOpacity);
  const next = afterAnswer[afterAnswer.length - 1];
  expect(next.props.disabled).toBe(false); // selecting an option enables Next
  await tap(next);
};

const renderedText = (renderer: Renderer): string => JSON.stringify(renderer.toJSON() ?? '');

// The full walk mounts 18 question screens; it takes ~4 s alone and can
// exceed jest's 5 s default when other suites (e.g. the web build) compete
// for CPU, so give it headroom instead of a load-dependent flake.
jest.setTimeout(20000);

test('full survey walk (Part 1 → interstitial → Part 2 → complete) never crashes', async () => {
  const onBack = jest.fn();
  let renderer!: Renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<StressSurveyScreen onBack={onBack} />);
  });

  // Part 1: 10 PSS-10 questions.
  for (let question = 0; question < 10; question += 1) {
    await answerAndNext(renderer);
  }
  expect(renderedText(renderer)).toContain('Part 2: Psychological Check');

  // Interstitial → Start resets the index to question 1 of Part 2. (A stale
  // index here is what crashed the reported build.)
  const interstitialButtons = renderer.root.findAllByType(TouchableOpacity);
  await tap(interstitialButtons[interstitialButtons.length - 1]);
  expect(renderedText(renderer)).toContain('Sleep Hours'); // q101 pill

  // Part 2: 8 lifestyle questions.
  for (let question = 0; question < 8; question += 1) {
    await answerAndNext(renderer);
    if (question === 0) expect(renderedText(renderer)).toContain('Breathing Pattern'); // q102 pill
  }

  // Completing the survey saves through AsyncStorage and hands back to the hub.
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('header Back returns to the previous question and keeps answers; Exit leaves the survey', async () => {
  const onBack = jest.fn();
  let renderer!: Renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<StressSurveyScreen onBack={onBack} />);
  });

  const buttons = () => renderer.root.findAllByType(TouchableOpacity);
  const headerBack = () => buttons()[0];
  const headerExit = () => buttons()[1];
  const next = () => buttons()[buttons().length - 1];

  // Answer question 1 and advance to question 2.
  await tap(buttons()[2]);
  await tap(next());
  expect(renderedText(renderer)).toContain('Control'); // q2 pill

  // Header Back returns to question 1 instead of leaving, and the answer
  // already given is still selected (Next is enabled).
  await tap(headerBack());
  expect(onBack).not.toHaveBeenCalled();
  expect(renderedText(renderer)).toContain('Unexpected Event'); // q1 pill
  expect(next().props.disabled).toBe(false);

  // Header Exit is the one that returns to the assessment hub.
  await tap(headerExit());
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('Back walks one continuous stack across parts and exits from question 1', async () => {
  const onBack = jest.fn();
  let renderer!: Renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<StressSurveyScreen onBack={onBack} />);
  });

  const buttons = () => renderer.root.findAllByType(TouchableOpacity);
  const headerBack = () => buttons()[0];
  const next = () => buttons()[buttons().length - 1];

  // Walk all of Part 1 into the interstitial.
  for (let question = 0; question < 10; question += 1) {
    await answerAndNext(renderer);
  }
  expect(renderedText(renderer)).toContain('Part 2: Psychological Check');

  // Interstitial Back returns to the last Part 1 question, not the hub.
  await tap(buttons()[0]);
  expect(onBack).not.toHaveBeenCalled();
  expect(renderedText(renderer)).toContain('Overwhelm'); // q10 pill

  // Continue forward to Part 2 and start it.
  await tap(next());
  await tap(buttons()[buttons().length - 1]); // interstitial Start
  expect(renderedText(renderer)).toContain('Sleep Hours');

  // Back on Part 2 question 1 crosses into the last Part 1 question.
  await tap(headerBack());
  expect(renderedText(renderer)).toContain('Overwhelm'); // q10 pill

  // Keep walking back to question 1, where Back leaves the survey.
  for (let question = 0; question < 9; question += 1) {
    await tap(headerBack());
  }
  expect(renderedText(renderer)).toContain('Unexpected Event'); // q1 pill
  await tap(headerBack());
  expect(onBack).toHaveBeenCalledTimes(1);
});
