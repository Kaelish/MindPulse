/**
 * Shape shared by every translation dictionary.
 *
 * Rules:
 *  - The `en` dictionary must stay byte-identical to the strings that used to
 *    be hardcoded in the screens, so English (the default) renders exactly
 *    what users saw before this feature existed.
 *  - Every locale is typed as `Translations`, so a missing key is a *compile*
 *    error — a screen can never render `undefined`.
 *  - Question display text is localized here, but the survey screen keeps its
 *    English module-level arrays for scoring and for the doctor-facing
 *    `survey_answers` snapshot: what the doctor reads never changes.
 */

export type Language = 'en' | 'fil' | 'ceb';

export interface PssDisplayItem {
  id: number;
  pill: string;
  text: string;
}

export interface LifestyleDisplayItem {
  id: number;
  pill: string;
  text: string;
  sub?: string;
  /** Indexed by answer value 0–3. */
  options: readonly [string, string, string, string];
}

export interface LikertOption {
  value: number;
  label: string;
}

export interface Translations {
  common: {
    back: string;
    exit: string;
    cancel: string;
    nextQuestion: string;
    saving: string;
    open: string;
    go: string;
  };

  survey: {
    /** Prepended ("…, how often …") to every PSS-10 item. */
    recall: string;
    partLabel: string;
    pss: {
      q1: PssDisplayItem;
      q2: PssDisplayItem;
      q3: PssDisplayItem;
      q4: PssDisplayItem;
      q5: PssDisplayItem;
      q6: PssDisplayItem;
      q7: PssDisplayItem;
      q8: PssDisplayItem;
      q9: PssDisplayItem;
      q10: PssDisplayItem;
    };
    likert: readonly [string, string, string, string, string];
    lifestyle: {
      q101: LifestyleDisplayItem;
      q102: LifestyleDisplayItem;
      q103: LifestyleDisplayItem;
      q104: LifestyleDisplayItem;
      q105: LifestyleDisplayItem;
      q106: LifestyleDisplayItem;
      q107: LifestyleDisplayItem;
      q108: LifestyleDisplayItem;
    };
    interstitial: {
      title: string;
      sub: string;
      start: string;
      gridSleep: string;
      gridBreathing: string;
      gridMood: string;
      gridEyes: string;
      gridStressors: string;
      gridSymptoms: string;
      gridDevice: string;
      gridEnergy: string;
    };
    footer: {
      continueToPart2: string;
      completeSurvey: string;
    };
  };

  hub: {
    title: string;
    subtitleReady: string;
    subtitleDone: string;
    bannerTitle: string;
    bannerSub: string;
    sectionTitle: string;
    completedToday: string;
    /** Appended after "{n}/4 " — e.g. "Completed". */
    completedSuffix: string;
    sectionNote: string;
    /**
     * Supplementary admin-published questionnaires (A-4) listed under the daily
     * steps. The Multi-Modal tool is excluded — it IS the daily survey step.
     */
    extraTools: {
      title: string;
      note: string;
      /** Duration unit shown after "{n}" on each card. */
      minutes: string;
    };
    steps: {
      survey: { title: string; subtitle: string };
      faceScan: { title: string; subtitle: string };
      heartRate: { title: string; subtitle: string };
      reaction: { title: string; subtitle: string };
    };
    required: string;
    skippable: string;
    skipped: string;
    lockedHintFace: string;
    lockedHintHeart: string;
    lockedHintReaction: string;
    lockedHintDefault: string;
    tipLabel: string;
    noteLabel: string;
    tipBody: string;
    noteBody: string;
    viewResults: string;
    viewTodayResults: string;
    alerts: {
      dayCompleteTitle: string;
      dayCompleteBody: string;
      notAvailable: string;
      completedTitle: string;
      retakePrompt: string;
      retake: string;
    };
  };

  faceScan: {
    pageTitle: string;
    pageSubtitle: string;
    cameraHint: string;
    startBtn: string;
    skipBtn: string;
    checklistTitle: string;
    checklistStep: string;
    infoBefore: string;
    infoBold: string;
    infoAfter: string;
    sectionLabel: string;
    checklist: {
      lighting: { title: string; desc: string };
      environment: { title: string; desc: string };
      camera: { title: string; desc: string };
      expression: { title: string; desc: string };
      accessories: { title: string; desc: string };
      background: { title: string; desc: string };
    };
    readyNext: string;
    privacyTitle: string;
    privacyStep: string;
    calloutTitle: string;
    calloutBefore: string;
    calloutBold1: string;
    calloutMid: string;
    calloutBold2: string;
    calloutAfter: string;
    privacyItems: {
      captured: { title: string; desc: string };
      notStored: { title: string; desc: string };
      feedsScore: { title: string; desc: string };
    };
    consentBefore: string;
    consentBold: string;
    consentAfter: string;
    understandContinue: string;
  };

  heartRate: {
    title: string;
    row1: string;
    row2: string;
    row3: string;
    row4: string;
    tipHighlight: string;
    tipTail: string;
    cta: string;
  };

  reaction: {
    howItWorks: string;
    infoBefore1: string;
    yellowWord: string;
    infoBetween: string;
    greenWord: string;
    infoAfter: string;
    tip: string;
    roundLabel: string;
    tapToBegin: string;
    waitTitle: string;
    waitSub: string;
    tapNow: string;
    reactFast: string;
    reactionTimes: string;
    averageLabel: string;
    nextViewResults: string;
    bands: {
      fast: { label: string; sub: string };
      normal: { label: string; sub: string };
      slow: { label: string; sub: string };
    };
  };

  layout: {
    title: string;
    subtitle: string;
    chipSurvey: string;
    chipFaceScan: string;
    chipHeartRate: string;
    chipReaction: string;
  };

  results: {
    finalScore: string;
    outOf100: string;
    bandLow: string;
    bandModerate: string;
    bandHigh: string;
    legendLow: string;
    legendModerate: string;
    legendHigh: string;
    faceExpressions: { happy: string; neutral: string; sad: string };
    fusionTitle: string;
    fusionSurvey: string;
    fusionFace: string;
    fusionHeartRate: string;
    fusionReaction: string;
    advisoryLowTitle: string;
    advisoryLowBody: string;
    advisoryElevatedTitle: string;
    advisoryElevatedBody: string;
    launcher: {
      low: { title: string; sub: string };
      moderate: { title: string; sub: string };
      high: { title: string; sub: string };
    };
    tools: {
      breathe: { label: string; meta: string; cta: string };
      music: { label: string; metaFmt: string; cta: string };
      exercise: { label: string; metaAvailableFmt: string; metaGuidedFmt: string; metaStepwise: string; cta: string };
      journal: { label: string; meta: string; cta: string };
      pause: { label: string; cta: string };
    };
    clinics: {
      title: string;
      sub: string;
      empty: string;
      tapToView: string;
      openToBook: string;
    };
    hotlinesTitle: string;
    unsaved: string;
    saveSaving: string;
    saveSavedToday: string;
    saveAction: string;
    getHelp: string;
    helpShown: string;
    dontSave: string;
    saveFirstTitle: string;
    saveFirstBody: string;
    saveAndBook: string;
    leaveWithoutSaving: string;
    errorTitle: string;
    errorBody: string;
  };

  toolSurvey: {
    goBack: string;
    noQuestions: string;
    completeAssessment: string;
    completeAlertTitle: string;
    completeAlertBodyFmt: string;
    saveError: string;
  };

  settings: {
    languageTitle: string;
    languageSub: string;
    optionEnglish: string;
    optionFilipino: string;
    optionCebuano: string;
    descEnglish: string;
    descFilipino: string;
    descCebuano: string;
    languageNote: string;
  };
}
