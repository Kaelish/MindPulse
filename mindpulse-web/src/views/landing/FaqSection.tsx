import React, { useCallback, useState } from 'react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQS: readonly FaqItem[] = [
  {
    id: 'web-vs-mobile-login',
    question: 'Who can log in to the MindPulse web portal versus the mobile app?',
    answer:
      'The MindPulse web platform is built exclusively for Doctors and System Administrators. Main users take their stress screenings on the MindPulse mobile app, while doctors also have limited companion access on mobile for quick on-the-go checks.',
  },
  {
    id: 'stress-assessment-camera',
    question: 'How does MindPulse assess stress, and is the camera mandatory?',
    answer:
      'On the mobile app, MindPulse combines a PSS-10 questionnaire, reaction-time mini-games, physiological inputs, and MediaPipe facial expression analysis. The facial scan is completely optional—users can skip it at any time and still complete their screening.',
  },
  {
    id: 'consent-privacy',
    question: 'How are user consent and facial data privacy handled?',
    answer:
      'Facial analysis never starts automatically. Before accessing the camera, the mobile app presents an explicit consent checkbox that users must agree to first, and users are always free to skip the facial step. All screening data is securely stored and shared only with authorized doctors for consultation purposes.',
  },
  {
    id: 'doctor-admin-features',
    question: 'What features are available to Doctors and Admins on the web?',
    answer:
      'Doctors use the web dashboard for full clinical workflows, including reviewing user screening histories, monitoring stress trends, managing consultations, and writing progress notes. Administrators manage system accounts, doctor credentials, and platform oversight.',
  },
  {
    id: 'clinical-diagnosis',
    question: 'Is MindPulse a replacement for a clinical diagnosis?',
    answer:
      'No. MindPulse is an early stress-screening and wellness monitoring platform designed to flag elevated stress patterns and connect mobile users with professional doctor consultations—not a standalone medical diagnostic tool.',
  },
  {
    id: 'screening-duration',
    question: 'How long does a stress screening take on mobile?',
    answer:
      'A full multimodal session takes about 3 to 5 minutes, and even less if a user chooses to skip the optional camera-assisted facial analysis.',
  },
];

export const FaqSection: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id);

  const toggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  return (
    <section id="faq" className="landing-faq" aria-labelledby="faq-heading">
      <div className="landing-container">
        <div className="landing-faq-grid">
          <div className="landing-faq-header">
            <p className="landing-faq-eyebrow">FREQUENTLY ASKED QUESTIONS</p>
            <h2 id="faq-heading" className="landing-faq-heading">
              Quick answers
            </h2>
          </div>
          <div className="landing-faq-list">
            {FAQS.map((item) => {
              const isOpen = openId === item.id;
              return (
                <article
                  key={item.id}
                  className={`landing-faq-item${isOpen ? ' landing-faq-item--open' : ''}`}
                >
                  <button
                    type="button"
                    className="landing-faq-toggle"
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${item.id}`}
                    onClick={() => toggle(item.id)}
                  >
                    <span className="landing-faq-question">{item.question}</span>
                    <span className="landing-faq-icon" aria-hidden="true">
                      {isOpen ? '\u2212' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="landing-faq-answer" id={`faq-answer-${item.id}`}>
                      <p>{item.answer}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
