/**
 * A-4 regression: admin-published supplementary questionnaires need an entry
 * point into ToolSurveyScreen (they used to be unreachable — the hub listed
 * only the four built-in daily steps), while the Multi-Modal tool must NOT
 * appear as a card, because it IS the daily Stress Survey step. Listing it
 * twice would recreate the duplicate entry point the original tool list was
 * removed for.
 */
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { StressAssessmentHubScreen } from './StressAssessmentHubScreen';
import { fetchActiveAssessmentTools } from '../../services/assessmentTools';
import type { AssessmentTool } from '../../services/assessmentTools';

// @expo/vector-icons ships untransformed ESM that jest's RN preset refuses to
// load from node_modules; the icons are decorative here.
jest.mock('@expo/vector-icons', () => {
  const StubIcon = () => null;
  return { Ionicons: StubIcon, MaterialCommunityIcons: StubIcon, MaterialIcons: StubIcon };
});

jest.mock('../../services/assessmentTools', () => ({
  fetchActiveAssessmentTools: jest.fn(),
}));

// The hub render must not depend on the live Supabase client: the real
// auth/session path makes this test's act() flush time vary with network and
// machine load, which timed out under the full suite. The once-per-day gate is
// pinned separately in services/dashboard.test.ts.
jest.mock('../../services/dashboard', () => ({
  fetchTodayStressSession: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../services/session', () => ({
  requireUserId: jest.fn(() => Promise.resolve('test-user')),
  requireUser: jest.fn(() => Promise.resolve({ id: 'test-user' })),
}));

const mockedFetch = fetchActiveAssessmentTools as jest.MockedFunction<typeof fetchActiveAssessmentTools>;

const multiModalTool: AssessmentTool = {
  id: 'mm-1',
  title: 'Daily Multi-Modal Check-In',
  description: 'The built-in check-in.',
  category: 'Multi-Modal',
  status: 'active',
  durationMinutes: 10,
  questions: [{ id: 1, text: 'How stressed have you been?' }],
};

const supplementaryTool: AssessmentTool = {
  id: 'sup-1',
  title: 'Sleep Hygiene Check',
  description: 'Optional: how well are you sleeping?',
  category: 'Supplementary',
  status: 'active',
  durationMinutes: 5,
  questions: [{ id: 1, text: 'What time do you usually sleep?' }],
};

const ReactTestRenderer = require('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => Renderer;
};

type TestNode = { props: { onPress?: () => void | Promise<void>; children?: unknown } };

type Renderer = {
  /** Re-fetched on demand: fiber wrappers go stale across re-renders. */
  readonly root: { findAllByType: (type: unknown) => TestNode[] };
  toJSON: () => unknown;
};

/** Gathers every string rendered inside a node (element trees are plain data). */
const collectText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectText).join(' ');
  if (typeof value === 'object') {
    return collectText((value as { props?: { children?: unknown } }).props?.children);
  }
  return '';
};

const renderedText = (renderer: Renderer): string => JSON.stringify(renderer.toJSON() ?? '');

test('supplementary tools open ToolSurvey; the Multi-Modal tool stays out of the list', async () => {
  mockedFetch.mockResolvedValueOnce({ tools: [multiModalTool, supplementaryTool], failed: false });
  const onNavigate = jest.fn();

  let renderer!: Renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<StressAssessmentHubScreen onNavigate={onNavigate} />);
  });
  // Flush loadAssessmentState + fetchActiveAssessmentTools promise chains.
  await ReactTestRenderer.act(async () => {});

  const text = renderedText(renderer);
  expect(text).toContain('MORE ASSESSMENTS'); // section header (en locale)
  expect(text).toContain('Sleep Hygiene Check');
  expect(text).not.toContain('Daily Multi-Modal Check-In');

  const card = renderer.root
    .findAllByType(TouchableOpacity)
    .find((node) => collectText(node.props.children).includes('Sleep Hygiene Check'));
  expect(card).toBeDefined();

  await ReactTestRenderer.act(async () => {
    await card?.props.onPress?.();
  });
  expect(onNavigate).toHaveBeenCalledWith('ToolSurvey', supplementaryTool);
  expect(onNavigate).toHaveBeenCalledTimes(1);
});
