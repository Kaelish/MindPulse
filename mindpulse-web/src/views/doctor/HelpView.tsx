import React, { useMemo, useState } from 'react';
import { DoctorEmpty } from '../../components/doctor/DoctorChrome';
import type { DoctorView } from '../../components/navigation/DoctorSidebar';
import './HelpView.css';

interface HelpTopic {
  id: string;
  icon: string;
  title: string;
  hint: string;
  /** Extra search terms so "receipts" or "bands" land on the right guide. */
  keywords: string;
  steps: string[];
  /** Optional quick-jump into the portal. */
  linkTo?: DoctorView;
  linkLabel?: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'navigate',
    icon: '⌂',
    title: 'Moving around the portal',
    hint: 'Where everything lives, from the sidebar to your profile card.',
    keywords: 'navigation sidebar menu where is home profile sign out landing',
    steps: [
      'The sidebar on the left is your main menu: Dashboard, Student Cases, Assessment Results, Consultations, Transactions, Recommendations, Help & Guide, and Settings.',
      'Your photo card at the bottom of the sidebar opens Profile Setting (photo, bio, contact, fee, availability).',
      'Sign Out is right below your photo card.',
      "Can't find a feature? Type it in the search box above — this guide covers every page.",
    ],
  },
  {
    id: 'dashboard',
    icon: '◈',
    title: 'Reading your dashboard',
    hint: 'What each number means and where it comes from.',
    keywords: 'dashboard stats cards active cases pending reviews high risk completed recent upcoming call meaning numbers',
    steps: [
      'Active Cases — every registered student on your roster; the note below counts students added this week.',
      'Pending Reviews — bookings waiting for your approval (the same rows as Consultations → Upcoming).',
      'High Risk Students — students whose latest score is 61+. The note counts new alerts this week for those students.',
      'Completed this week — sessions finished in the last 7 days, with the trend versus the previous week.',
      'Recent Cases lists the five highest latest scores (click one to open the case); Upcoming Consultations shows your next five dated sessions in order.',
      'The call panel appears when you have a confirmed booking — it opens the soonest confirmed session.',
    ],
    linkTo: 'dashboard',
    linkLabel: 'Go to Dashboard',
  },
  {
    id: 'cases',
    icon: '◉',
    title: "Opening a student's case",
    hint: 'Profile, assessment history, shared files — all in one record.',
    keywords: 'student case history records open view overview tabs files recommendations booking assessments button',
    steps: [
      'Student Cases → View on any row opens the full case record.',
      'From Consultations, every booking row has a 📊 Assessments button that jumps straight into that patient\'s history.',
      'Inside a case, use the tabs: Overview (profile + latest score), Assessments (session history, trends, per-question survey answers), Consultations (bookings you share), Files, and Recommendations.',
      'The Back button returns you to whichever page you came from — dashboard, list, or booking.',
    ],
    linkTo: 'student-cases',
    linkLabel: 'Go to Student Cases',
  },
  {
    id: 'scores',
    icon: '▦',
    title: 'Scores, bands & survey answers',
    hint: 'How to read a result and drill into what the student answered.',
    keywords: 'score band low moderate high 61 results export csv reverse scored survey answers recall 24 hours trend increasing decreasing',
    steps: [
      'Bands are the same everywhere in the system: Low 0–35, Moderate 36–60, High 61–100.',
      'Assessment Results lists every session with filters and a CSV export.',
      'In a case, expand "View survey answers" to see exactly what the student answered — items marked reverse-scored are flipped before scoring.',
      'Surveys ask about "the last 24 hours"; that recall window appears in the question wording on both the app and this portal.',
      'Trend compares the two newest sessions: Increasing, Stable, or Decreasing.',
    ],
    linkTo: 'assessment-results',
    linkLabel: 'Go to Assessment Results',
  },
  {
    id: 'bookings',
    icon: '▣',
    title: 'Handling bookings',
    hint: 'Approve, decline, reschedule, or message — the full booking flow.',
    keywords: 'consultation booking approve decline reschedule message start session payment confirmed awaiting pending history upcoming',
    steps: [
      'Consultations → Upcoming shows pending and active bookings; History shows completed, declined, and cancelled ones.',
      'Approve a pending booking, Decline it (a reason is required and is sent to the student), or Reschedule it to a new date and time.',
      'After you approve, the student pays — the booking moves through Awaiting Payment to Confirmed.',
      'Confirmed bookings show Message and Start Session. The video call opens right in the portal.',
      'Each row has a 📊 Assessments button to review the student\'s history before or after the session.',
    ],
    linkTo: 'consultations',
    linkLabel: 'Go to Consultations',
  },
  {
    id: 'messages',
    icon: '✎',
    title: 'Messages, summaries & files',
    hint: 'Chat with a patient and document what happened.',
    keywords: 'chat message summary note files upload attachment my files document after call',
    steps: [
      'Consultations → Messages opens your chat threads; the list refreshes automatically while you read.',
      'Attach a file while chatting — send to the chat only, or also file it into the patient\'s My Files.',
      'Open a booking and use the Consultation Summary to record what was discussed and the next steps; the student can read it too.',
      'Files uploaded here stay attached to the student\'s case, so the next provider has continuity.',
    ],
  },
  {
    id: 'transactions',
    icon: '◈',
    title: 'Transactions & receipts',
    hint: 'Every consultation payment, with its receipt.',
    keywords: 'transaction payment receipt refund money paid billing cost fee',
    steps: [
      'Transactions lists each consultation payment with amount, date, status, and receipt details.',
      'The student\'s receipt is generated automatically after payment and is available on both the app and this portal.',
      'If a figure looks off, match it against the booking status in Consultations — a payment only appears once it is actually captured.',
    ],
    linkTo: 'transactions',
    linkLabel: 'Go to Transactions',
  },
  {
    id: 'recommendations',
    icon: '❋',
    title: 'Sending recommendations',
    hint: 'Tailored self-care guidance for a student.',
    keywords: 'recommendation self care tips assign suggest advice student',
    steps: [
      'Recommendations lets you send tailored self-care guidance to students.',
      'Match the recommendation to the student\'s latest band — Low, Moderate, or High — from their case record.',
      'Students receive it in their app alongside their own assessment tips.',
    ],
    linkTo: 'recommendations',
    linkLabel: 'Go to Recommendations',
  },
  {
    id: 'profile',
    icon: '◍',
    title: 'Profile & availability',
    hint: 'Set up how students find and book you.',
    keywords: 'profile availability fee slots days blocked dates booking hours photo bio contact specialization license',
    steps: [
      'Profile Setting: photo, name, bio, department/specialization, license number, and contact number.',
      'Set your consultation fee, daily time slots, working days, and blocked dates — students can only book inside these windows.',
      'Use the avatar at the bottom of the sidebar as a shortcut to this page.',
      'Your registration phone number also appears on your profile wherever students see your contact details.',
    ],
  },
  {
    id: 'settings',
    icon: '⚙',
    title: 'Portal settings',
    hint: 'Appearance and where you land after signing in.',
    keywords: 'settings dark mode appearance theme landing page light',
    steps: [
      'Settings → Appearance: toggle dark mode for the doctor portal only — it never changes what the admin portal looks like.',
      'Settings → Landing page: choose which view opens first when you sign in (Dashboard, Consultations, Student Cases, Assessment Results, or Recommendations).',
    ],
    linkTo: 'settings',
    linkLabel: 'Go to Settings',
  },
  {
    id: 'privacy',
    icon: '⌾',
    title: 'Privacy & who sees what',
    hint: 'Why you can see a history — and what others see.',
    keywords: 'privacy security access scope consent records visibility data who can see rls',
    steps: [
      "You see a student's assessment history through their booking with you — access stays scoped to that relationship.",
      'Students only ever see their own data; administrators manage accounts, verification, and aggregated analytics.',
      'Sessions recorded before per-question answers were stored simply show no answer list — the score and history still appear.',
      'Everything you write (summaries, recommendations) is visible to the student it belongs to.',
    ],
  },
];

interface HelpViewProps {
  /** Optional quick-jump used by the "Go to…" buttons on each guide. */
  onNavigate?: (view: DoctorView) => void;
}

const normalize = (value: string) => value.toLowerCase();

export const HelpView: React.FC<HelpViewProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return HELP_TOPICS;
    return HELP_TOPICS.filter((topic) =>
      [topic.title, topic.hint, topic.keywords, ...topic.steps].some((field) =>
        normalize(field).includes(needle),
      ),
    );
  }, [query]);

  return (
    <main className="main-panel">
      <header className="topbar">
        <div>
          <h1>Help &amp; Guide</h1>
          <p className="page-subtitle">
            How to use the doctor portal — search a topic or follow a guide below
          </p>
        </div>
      </header>

      <section className="help-body">
        <div className="help-search">
          <span className="help-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search: e.g. approve a booking, bands, receipts, dark mode…"
            aria-label="Search help topics"
          />
          {query && (
            <button type="button" className="help-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>

        <p className="help-result-count" aria-live="polite">
          {filtered.length} of {HELP_TOPICS.length} guides
        </p>

        <div className="help-grid">
          {filtered.map((topic) => (
            <article className="guide-card" key={topic.id}>
              <div className="guide-head">
                <span className="guide-icon" aria-hidden="true">{topic.icon}</span>
                <div>
                  <h3>{topic.title}</h3>
                  <p>{topic.hint}</p>
                </div>
              </div>
              <ol className="guide-steps">
                {topic.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              {topic.linkTo && topic.linkLabel && onNavigate && (
                <button
                  type="button"
                  className="guide-link"
                  onClick={() => onNavigate(topic.linkTo as DoctorView)}
                >
                  {topic.linkLabel} →
                </button>
              )}
            </article>
          ))}

          {filtered.length === 0 && (
            <DoctorEmpty
              title="No matching guides"
              description="Try another keyword — e.g. “booking”, “bands”, “receipts”, or “availability”."
            />
          )}
        </div>
      </section>
    </main>
  );
};
