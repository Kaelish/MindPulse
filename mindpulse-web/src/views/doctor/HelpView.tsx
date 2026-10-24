import React, { useEffect, useMemo, useState } from 'react';
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
      'The sidebar on the left is your main menu: Dashboard, Patient Cases, Assessment Results, Consultations, Transactions, Suggestions, Help & Guide, and Settings.',
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
      'Active Cases — every registered patient on your roster; the note below counts patients added this week.',
      'Pending Reviews — bookings waiting for your approval (the same rows as Consultations → Upcoming).',
      'High Risk Patients — patients whose latest score is 61+. The note counts new alerts this week for those patients.',
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
    title: "Opening a patient's case",
    hint: 'Profile, assessment history, shared files — all in one record.',
    keywords: 'student case history records open view overview tabs files recommendations booking assessments button',
    steps: [
      'Patient Cases → View on any row opens the full case record.',
      'From Consultations, every booking row has a 📊 Assessments button that jumps straight into that patient\'s history.',
      'Inside a case, use the tabs: Overview (profile + latest score), Assessments (session history, trends, per-question survey answers), Consultations (bookings you share), Files, and Recommendations (past and new).',
      'The Back button returns you to whichever page you came from — dashboard, list, or booking.',
    ],
    linkTo: 'student-cases',
    linkLabel: 'Go to Patient Cases',
  },
  {
    id: 'scores',
    icon: '▦',
    title: 'Scores, bands & survey answers',
    hint: 'How to read a result and drill into what the patient answered.',
    keywords: 'score band low moderate high 61 results export csv reverse scored survey answers recall 24 hours trend increasing decreasing',
    steps: [
      'Bands are the same everywhere in the system: Low 0–35, Moderate 36–60, High 61–100.',
      'Assessment Results lists every session with filters and a CSV export.',
      'In a case, expand "View survey answers" to see exactly what the patient answered — items marked reverse-scored are flipped before scoring.',
      'Surveys ask about "the last 24 hours"; that recall window appears in the question wording on both the app and this portal.',
      'Trend compares the two newest sessions: Increasing, Stable, or Decreasing.',
    ],
    linkTo: 'assessment-results',
    linkLabel: 'Go to Assessment Results',
  },
  {
    id: 'bookings',
    icon: '▣',
    title: 'Handling bookings & walk-ins',
    hint: 'Approve, decline, reschedule — plus booking a walk-in patient.',
    keywords: 'consultation booking approve decline reschedule message start session payment confirmed awaiting pending history upcoming walk in walkin schedule cash desk appointment zoom google meet microsoft teams external own link',
    steps: [
      'Consultations → Upcoming shows pending and active bookings; History shows completed, declined, and cancelled ones.',
      'Approve a pending booking, Decline it (a reason is required and is sent to the patient), or Reschedule it to a new date and time.',
      'After you approve, the patient pays — the booking moves through Awaiting Payment to Confirmed.',
      'Confirmed bookings show Message and Start Session. The video call opens right in the portal.',
      'Each row has a 📊 Assessments button to review the patient\'s history before or after the session.',
      '+ Schedule Consultation books someone in two steps: their details and the consultation type (face-to-face at the clinic, or an online video call), then the date and time. The email must match a registered account — if the patient has not registered yet, they do it on their phone (about a minute) and the booking attaches to that account automatically.',
      'Time slots whose start time has already passed are greyed out as "Past" — you can only book forward, and so can patients on the app.',
      'Using your own meeting link instead — Zoom, Google Meet, Teams, or in person? Send the link through Messages, hold the session there, then press ✓ Complete (held elsewhere) on the booking: the therapy progress note editor opens immediately, exactly as it does after a Jitsi call.',
    ],
    linkTo: 'consultations',
    linkLabel: 'Go to Consultations',
  },
  {
    id: 'notes',
    icon: '✎',
    title: 'Messages & consultation notes',
    hint: 'Chat with a patient, then document the session privately.',
    keywords: 'chat message note therapy progress summary private publish patient note signature handwritten scan files upload attachment document after call observations mse risk edit update revise typo',
    steps: [
      'Consultations → Messages opens your chat threads; the list refreshes automatically while you read.',
      'Attach a file while chatting — send to the chat only, or also file it into the patient\'s My Files.',
      'Open a completed booking (View Case) to write the Consultation Note — a structured Therapy Progress Note (presenting problem, session content, interventions, client response, observations, MSE, risk, clinical impressions, plan) ending with your drawn signature. It works the same whether the session ran in Jitsi or on Zoom, Meet, or in person.',
      'The whole progress note is PRIVATE — from the presenting problem all the way down. It stays with you and the clinic administrators; the patient never sees it in their app, and there is no way for them to read it.',
      'Anything the patient SHOULD read goes in the "Note for the patient" field at the bottom of the editor. It stays a draft until you switch on "Publish note" — only then does it appear in their app, and switching it off hides it again.',
      'Spotted a typo or want to add something later? Open the booking → View Case → ✎ Edit note: the editor reopens prefilled with everything you wrote, and saving updates the note in place (the publication setting is kept).',
      'Prefer paper? Attach a scanned or photographed handwritten note — it stays in your portal: the patient never sees the scan, only a note you explicitly publish.',
      'Files uploaded here stay attached to the patient\'s case, so the next provider has continuity.',
    ],
  },
  {
    id: 'transactions',
    icon: '◈',
    title: 'Transactions & receipts',
    hint: 'Every consultation payment — in-app or recorded at the desk.',
    keywords: 'transaction payment receipt refund money paid billing cost fee walk in walkin cash manual record desk gcash maya card',
    steps: [
      'Transactions lists each consultation payment with amount, date, method, status, and receipt details.',
      'The patient\'s receipt is generated automatically after payment and is available on both the app and this portal.',
      'Walk-in patient paid at the desk? + Record walk-in payment lets you pick their unpaid booking, enter the amount, and choose Cash (or card, GCash, Maya). Recording it also confirms that booking so the patient can join the session.',
      'Walk-in payments carry an MP-WALKIN-… reference, so manual records are always easy to tell apart from in-app payments — in the list, the receipt, and the CSV export.',
      'If a figure looks off, match it against the booking status in Consultations — a payment only appears once it is actually captured.',
    ],
    linkTo: 'transactions',
    linkLabel: 'Go to Transactions',
  },
  {
    id: 'recommendations',
    icon: '❋',
    title: 'Patient recommendations',
    hint: 'Tailored self-care guidance for a patient.',
    keywords: 'recommendation self care tips assign suggest advice student case history priority category completed active',
    steps: [
      'Open a patient case and use the Recommendations tab to give tailored self-care guidance — the tab also lists every past recommendation for that patient.',
      'Match the recommendation to the patient\'s latest band — Low, Moderate, or High — from their case record.',
      'Mark a past recommendation Completed once the patient has acted on it; the rest stay listed as Active.',
      'Patients receive it in their app alongside their own assessment tips.',
    ],
  },
  {
    id: 'suggestions',
    icon: '✦',
    title: 'Suggestions for the admin',
    hint: 'Ask for features, improvements, or report issues.',
    keywords: 'suggestion admin feature request improve issue bug system feedback recommend add',
    steps: [
      'Open Suggestions in the sidebar to send the clinic admin a feature request, an improvement idea, or a report about the system.',
      'Add a title, category, priority, and details, then press Send to admin.',
      'The admin replies and updates the status (Open, In progress, Resolved) — you get a notification and can read the reply on the card.',
      'Changed your mind? You can withdraw a suggestion any time before it is resolved.',
    ],
    linkTo: 'recommendations',
    linkLabel: 'Go to Suggestions',
  },
  {
    id: 'profile',
    icon: '◍',
    title: 'Profile & availability',
    hint: 'Set up how patients find and book you.',
    keywords: 'profile availability fee slots days blocked dates booking hours photo bio contact specialization license',
    steps: [
      'Profile Setting: photo, name, bio, department/specialization, license number, and contact number.',
      'Set your consultation fee, daily time slots, working days, and blocked dates — patients can only book inside these windows.',
      'Use the avatar at the bottom of the sidebar as a shortcut to this page.',
      'Your registration phone number also appears on your profile wherever patients see your contact details.',
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
      'Settings → Landing page: choose which view opens first when you sign in (Dashboard, Consultations, Patient Cases, Assessment Results, or Suggestions).',
    ],
    linkTo: 'settings',
    linkLabel: 'Go to Settings',
  },
  {
    id: 'privacy',
    icon: '⌾',
    title: 'Privacy & who sees what',
    hint: 'Why you can see a history — and what others see.',
    keywords: 'privacy security access scope consent records visibility data who can see rls private share publish',
    steps: [
      "You see a patient's assessment history through their booking with you — access stays scoped to that relationship.",
      'Patients only ever see their own data; administrators manage accounts, verification, and aggregated analytics.',
      'Sessions recorded before per-question answers were stored simply show no answer list — the score and history still appear.',
      'Consultation notes are private to you and the clinic administrators — patients have no access to them at all. The single exception is a short "Note for the patient", which appears in their app only once you publish it. Recommendations are visible to the patient they belong to.',
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
  /** Expanded FAQ items. Everything starts collapsed so the page stays scannable. */
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return HELP_TOPICS;
    return HELP_TOPICS.filter((topic) =>
      [topic.title, topic.hint, topic.keywords, ...topic.steps].some((field) =>
        normalize(field).includes(needle),
      ),
    );
  }, [query]);

  // While searching, every match expands so the answer is visible immediately.
  useEffect(() => {
    if (!query.trim()) return;
    setOpenIds(new Set(filtered.map((topic) => topic.id)));
  }, [query, filtered]);

  const toggleTopic = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOpen = filtered.length > 0 && filtered.every((topic) => openIds.has(topic.id));

  return (
    <main className="main-panel">
      <header className="topbar">
        <div>
          <h1>Help &amp; Guide</h1>
          <p className="page-subtitle">
            Search a topic, then tap a guide to expand it
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
            placeholder="Search: e.g. approve a booking, bands, receipts, walk-in…"
            aria-label="Search help topics"
          />
        </div>

        <div className="help-toolbar">
          <p className="help-result-count" aria-live="polite">
            {filtered.length} of {HELP_TOPICS.length} guides
          </p>
          {filtered.length > 0 && (
            <button
              type="button"
              className="help-expand-all"
              onClick={() =>
                setOpenIds(allOpen ? new Set() : new Set(filtered.map((topic) => topic.id)))
              }
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>

        <div className="help-list">
          {filtered.map((topic) => {
            const isOpen = openIds.has(topic.id);
            const bodyId = `guide-body-${topic.id}`;
            return (
              <article className={`guide-card${isOpen ? ' is-open' : ''}`} key={topic.id}>
                <button
                  type="button"
                  className="guide-toggle"
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  onClick={() => toggleTopic(topic.id)}
                >
                  <span className="guide-icon" aria-hidden="true">{topic.icon}</span>
                  <span className="guide-heading">
                    <span className="guide-title">{topic.title}</span>
                    <span className="guide-hint">{topic.hint}</span>
                  </span>
                  <span className="guide-chevron" aria-hidden="true">▾</span>
                </button>

                {isOpen && (
                  <div className="guide-body" id={bodyId}>
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
                  </div>
                )}
              </article>
            );
          })}

          {filtered.length === 0 && (
            <DoctorEmpty
              title="No matching guides"
              description="Try another keyword — e.g. “booking”, “bands”, “receipts”, or “walk-in”."
            />
          )}
        </div>
      </section>
    </main>
  );
};
