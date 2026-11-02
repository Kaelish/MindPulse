import React from 'react';

/**
 * Friendly doctor-and-patient scene used beside the phone mockup. It is a
 * lightweight inline SVG so it stays sharp at every size and needs no extra
 * network request. Swap it for a supplied artwork file if one becomes available.
 */
export const DoctorPatientIllustration: React.FC = () => (
  <svg
    className="landing-illustration"
    viewBox="0 0 420 320"
    role="img"
    aria-label="Illustration of a doctor and a patient talking about care"
  >
    <path
      d="M55 246c-26-54-4-128 60-158s152-24 196 26 30 132-20 168-210 18-236-36Z"
      fill="#E7F6F1"
    />
    <path
      d="M84 258c-18-40 0-96 46-118s116-16 148 20 18 98-16 124-160 14-178-26Z"
      fill="#EDF3FB"
      opacity="0.9"
    />

    {/* Plant */}
    <g>
      <path d="M88 286c-2-26 12-48 30-56 4 24-8 46-30 56Z" fill="#8FDCC4" />
      <path d="M86 286c-16-18-18-42-8-56 14 14 18 38 8 56Z" fill="#5FC5A9" />
      <path d="M64 286h52l-7 26a6 6 0 0 1-6 5H77a6 6 0 0 1-6-5Z" fill="#C9E6DD" />
    </g>

    {/* Patient */}
    <g>
      <ellipse cx="168" cy="298" rx="62" ry="10" fill="#D9E8EF" opacity="0.75" />
      <path d="M124 298v-72c0-20 20-34 44-34s44 14 44 34v72Z" fill="#7DA2FF" />
      <path d="M168 192v106" stroke="#6C90E8" strokeWidth="2" opacity="0.6" />
      <circle cx="168" cy="154" r="30" fill="#F4CBA6" />
      <path
        d="M138 150c0-23 13-36 30-36s30 13 30 36c0-10-12-17-30-17s-30 7-30 17Z"
        fill="#2B2320"
      />
      <circle cx="158" cy="156" r="2.6" fill="#2B2320" />
      <circle cx="178" cy="156" r="2.6" fill="#2B2320" />
      <path d="M160 168c4 3 12 3 16 0" stroke="#B9835F" strokeWidth="2" strokeLinecap="round" />
      <path d="M150 214c-8 10-10 24-8 36" stroke="#F4CBA6" strokeWidth="10" strokeLinecap="round" />
    </g>

    {/* Doctor */}
    <g>
      <ellipse cx="288" cy="298" rx="70" ry="11" fill="#D9E8EF" opacity="0.75" />
      <path d="M240 298v-78c0-22 22-38 48-38s48 16 48 38v78Z" fill="#FFFFFF" />
      <path
        d="M240 298v-78c0-22 22-38 48-38s48 16 48 38v78"
        fill="none"
        stroke="#D6E5EE"
        strokeWidth="2"
      />
      <path d="M288 182v116" stroke="#E2EDF4" strokeWidth="2" />
      <path d="M272 188l16 16 16-16" fill="none" stroke="#CFE2EC" strokeWidth="2" />
      <circle cx="288" cy="146" r="32" fill="#F4CBA6" />
      <path
        d="M256 142c0-25 14-39 32-39s32 14 32 39c0-9-12-15-32-15s-32 6-32 15Z"
        fill="#3B2F2B"
      />
      <circle cx="278" cy="148" r="2.6" fill="#2B2320" />
      <circle cx="298" cy="148" r="2.6" fill="#2B2320" />
      <path d="M280 160c4 3 12 3 16 0" stroke="#B9835F" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M268 196c0 30 40 30 40 0"
        fill="none"
        stroke="#3FB5C5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="268" cy="196" r="5" fill="#3FB5C5" />
      <circle cx="308" cy="196" r="5" fill="#3FB5C5" />
      <path d="M308 198v26c0 8-6 12-14 12" fill="none" stroke="#3FB5C5" strokeWidth="3" strokeLinecap="round" />
      <circle cx="292" cy="236" r="7" fill="#E9F7FA" stroke="#3FB5C5" strokeWidth="3" />
    </g>

    {/* Speech bubble */}
    <g>
      <rect x="196" y="58" width="102" height="48" rx="16" fill="#FFFFFF" stroke="#DCE9F1" />
      <path d="M226 106l-9 16 24-16Z" fill="#FFFFFF" stroke="#DCE9F1" />
      <path
        d="M247 82c-3-5-11-5-13 1-2-6-10-6-13-1-2 6 4 11 13 17 9-6 15-11 13-17Z"
        fill="#F2999A"
      />
      <circle cx="270" cy="82" r="2.4" fill="#C9DCE7" />
      <circle cx="280" cy="82" r="2.4" fill="#C9DCE7" />
    </g>
  </svg>
);
