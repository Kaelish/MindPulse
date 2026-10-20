import React, { useEffect, useMemo, useRef, useState } from 'react';
import { JitsiCallPanel } from '../../components/JitsiCallPanel';
import { ConsultationSummaryView } from '../../components/ConsultationSummaryView';
import { ConsultationSummaryForm } from '../../components/ConsultationSummaryForm';
import {
  ALL_WEEKDAY_KEYS,
  CONSULTATION_MODE_LABELS,
  ConsultationMode,
  ConsultationNote,
  DoctorAvailability,
  WebChatMessage,
  WebConsultationItem,
  WebThreadSummary,
  WEEKDAY_KEYS,
  approveAppointment,
  consultationModeLabel,
  declineAppointment,
  editAppointmentTime,
  endVideoConsultation,
  fetchBookedSlotKeys,
  fetchConsultationNote,
  fetchDoctorAvailability,
  fetchDoctorConsultationNotes,
  fetchWebChatMessages,
  fetchWebChatThreads,
  fetchWebConsultations,
  findPatientAccountByEmail,
  isDateUnavailable,
  isSlotInPast,
  markWebThreadRead,
  normalizeWeekdays,
  parseDisplayDate,
  saveDoctorAvailability,
  saveDoctorScheduleAppointment,
  sendWebChatMessage,
  setPatientNotePublication,
  toIsoDate,
} from '../../services/consultations';
import { requireUserId } from '../../services/session';
import { fetchStudentCaseById, StudentCaseRecord } from '../../services/studentCases';
import { PATIENT_FILE_CATEGORIES, PatientFileCategory, uploadStudentFile } from '../../services/patientFiles';
import { DoctorLoading, DoctorNotifications } from '../../components/doctor/DoctorChrome';

const FALLBACK_SLOTS = [
  '9:00 AM', '10:30 AM', '11:45 AM', '1:30 PM',
  '2:15 PM', '3:30 PM', '4:45 PM', '5:30 PM',
];

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-05" → "Mon, Oct 5" for the day-off chips. */
const dayOffLabel = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  return `${SHORT_DAYS[date.getDay()]}, ${SHORT_MONTHS[month - 1]} ${day}`;
};

const UPCOMING_STATUSES = ['scheduled', 'awaiting_payment', 'confirmed'] as const;

/** Set by App.tsx when a notification routes into a specific Consultations tab. */
export interface ConsultationsTabRequest {
  tab: 'upcoming' | 'history' | 'messages';
  /** Bumped per request so the same tab can be asked for twice in a row. */
  nonce: number;
}

interface ConsultationsViewProps {
  openTabRequest?: ConsultationsTabRequest | null;
  /** Opens a patient's full assessment history (old + recent) from a booking row. */
  onViewHistory?: (student: StudentCaseRecord) => void;
}

/**
 * Face-to-face bookings have no Jitsi room to open, so every "Join Call" /
 * "Start Video Call" control becomes this label instead. Keeps the slot the
 * button used to fill while making it impossible to mistake an in-person
 * session for an online one.
 */
const FaceToFaceChip: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: compact ? '5px 10px' : '8px 16px',
      borderRadius: '8px',
      fontWeight: 700,
      fontSize: compact ? '0.78rem' : '0.85rem',
      whiteSpace: 'nowrap',
      background: 'var(--doc-soft)',
      border: '1px dashed var(--doc-line)',
      color: 'var(--doc-muted)',
    }}
  >
    Face-to-face · at the clinic
  </span>
);

export const ConsultationsView: React.FC<ConsultationsViewProps> = ({ openTabRequest = null, onViewHistory }) => {
  const [consultations, setConsultations] = useState<WebConsultationItem[]>([]);
  const [consultTab, setConsultTab] = useState<'upcoming' | 'history' | 'messages'>(openTabRequest?.tab ?? 'upcoming');
  const [activeSessionItem, setActiveSessionItem] = useState<WebConsultationItem | null>(null);
  const [summaryTarget, setSummaryTarget] = useState<WebConsultationItem | null>(null);
  /** True while the therapist-note editor is open for an already-saved note. */
  const [summaryEditing, setSummaryEditing] = useState(false);

  // Opening a different booking's summary always starts from the pad view.
  useEffect(() => {
    setSummaryEditing(false);
  }, [summaryTarget?.id]);
  const [consultNotes, setConsultNotes] = useState<Record<string, ConsultationNote>>({});
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [webChatMessages, setWebChatMessages] = useState<WebChatMessage[]>([]);
  const [webThreads, setWebThreads] = useState<WebThreadSummary[]>([]);
  const [webInputMessage, setWebInputMessage] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<{ file: File; name: string; kind: 'image' | 'document' } | null>(null);
  // null = "Chat only" (send in the thread without filing it into My Files).
  const [fileCategory, setFileCategory] = useState<PatientFileCategory | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showVideoCall, setShowVideoCall] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);

  // Booking row → the patient's assessment history (old + recent sessions).
  const [historyBusy, setHistoryBusy] = useState<string | null>(null);
  const openAssessmentHistory = async (item: WebConsultationItem) => {
    if (!onViewHistory) return;
    setActionError(null);
    setHistoryBusy(item.id);
    try {
      const record = await fetchStudentCaseById(item.patientId);
      if (record) onViewHistory(record);
      else setActionError('No profile exists for this patient yet.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to open the assessment history.');
    } finally {
      setHistoryBusy(null);
    }
  };
  const assessmentHistoryButton = (item: WebConsultationItem) =>
    onViewHistory ? (
      <button
        type="button"
        className="view-case-btn"
        disabled={historyBusy === item.id}
        title="Open this patient's assessment history"
        onClick={() => void openAssessmentHistory(item)}
      >
        {historyBusy === item.id ? 'Opening…' : '📊 Assessments'}
      </button>
    ) : null;

  // Doctor's consultation fee + offered time slots (read by the mobile app too)
  const [availability, setAvailability] = useState<DoctorAvailability | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availFee, setAvailFee] = useState('');
  const [availSlots, setAvailSlots] = useState<string[]>([]);
  const [availSlotDraft, setAvailSlotDraft] = useState('');
  const [availDays, setAvailDays] = useState<string[]>([...ALL_WEEKDAY_KEYS]);
  const [availBlockedDates, setAvailBlockedDates] = useState<string[]>([]);
  const [availBlockDraft, setAvailBlockDraft] = useState('');
  const [availError, setAvailError] = useState<string | null>(null);
  const [availBusy, setAvailBusy] = useState(false);

  // Decline flow (reason is required)
  const [declineTarget, setDeclineTarget] = useState<WebConsultationItem | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [declineBusy, setDeclineBusy] = useState(false);

  // Edit appointment time flow
  const [editTarget, setEditTarget] = useState<WebConsultationItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  // Manual Schedule Consultation Modal State
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [scheduleStep, setScheduleStep] = useState<1 | 2>(1);
  const [scheduleChecking, setScheduleChecking] = useState<boolean>(false);
  const [patientName, setPatientName] = useState<string>('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientEmail, setPatientEmail] = useState<string>('');
  const [patientNotes, setPatientNotes] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [bookedSlotKeys, setBookedSlotKeys] = useState<Set<string>>(new Set());
  /** How the manually booked session happens — walk-ins are face-to-face by default. */
  const [scheduleMode, setScheduleMode] = useState<ConsultationMode>('in_person');

  // Real-life date generation
  const realLifeDates = useMemo(() => {
    const dates: { label: string; dateStr: string }[] = [];
    const today = new Date();
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 7 days so every weekday is reachable even for a doctor who works
    // a single day of the week.
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : daysOfWeek[d.getDay()];
      const monthName = months[d.getMonth()];
      const dayNum = d.getDate();
      const dateStr = `${monthName} ${dayNum}`;
      dates.push({
        label: `${dayName} (${dateStr})`,
        dateStr: `${monthName} ${dayNum}, ${d.getFullYear()}`,
      });
    }
    return dates;
  }, []);

  const timeSlots = availability?.slots?.length ? availability.slots : FALLBACK_SLOTS;

  // Saved availability — falls back to "open every day, nothing blocked" so a
  // missing/legacy profile row never locks patients out of booking.
  const availabilityDays = availability?.days?.length ? availability.days : ALL_WEEKDAY_KEYS;
  const availabilityBlockedDates = availability?.blockedDates ?? [];

  /** True when patients must not pick this date (not a working day / day off). */
  const isDayOff = (dateStr: string) => isDateUnavailable(dateStr, availabilityDays, availabilityBlockedDates);

  /** How many of this doctor's appointments already sit on a blocked date. */
  const bookedCountOnIso = (iso: string) =>
    consultations.filter((row) => {
      const date = parseDisplayDate(row.scheduledTime.split(' at ')[0]);
      return date ? toIsoDate(date) === iso : false;
    }).length;

  const selectedConsultation = selectedPatientId
    ? consultations.find((row) => row.patientId === selectedPatientId) ?? null
    : null;
  const chatTarget = selectedConsultation ?? activeSessionItem ?? consultations[0] ?? null;

  // The conversations panel is per PATIENT ACCOUNT, not per consultation: a
  // patient with five bookings must appear once, not five times. The first
  // row kept for a patient is the same row `selectedConsultation` resolves to
  // (`find` returns the first match), so the highlighted entry and the thread
  // header always point at the same appointment.
  const conversationItems: WebConsultationItem[] = [];
  const seenPatientIds = new Set<string>();
  for (const row of consultations) {
    if (seenPatientIds.has(row.patientId)) continue;
    seenPatientIds.add(row.patientId);
    conversationItems.push(row);
  }

  const totalUnread = webThreads.reduce((sum, row) => sum + row.unreadCount, 0);

  const threadFor = (patientId: string): WebThreadSummary | undefined =>
    webThreads.find((row) => row.otherId === patientId);

  // A notification can ask for a specific sub-tab ("Messages" for chat rows).
  useEffect(() => {
    if (openTabRequest) setConsultTab(openTabRequest.tab);
  }, [openTabRequest]);

  useEffect(() => {
    let isActive = true;
    const loadDoctor = async () => {
      try {
        const id = await requireUserId();
        if (isActive) {
          setDoctorId(id);
          setSessionError(null);
        }
      } catch (err) {
        if (isActive) {
          setDoctorId(null);
          setSessionError(err instanceof Error ? err.message : 'Unable to identify the signed-in doctor.');
        }
      }
    };
    void loadDoctor();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetchWebConsultations();
        const slots = await fetchBookedSlotKeys();
        if (isActive) {
          setConsultations(res);
          setBookedSlotKeys(slots);
        }
        fetchDoctorAvailability()
          .then((availabilityRes) => {
            if (isActive) setAvailability(availabilityRes);
          })
          .catch(() => {
            /* defaults are used when the profile row cannot be read */
          });
        fetchWebChatThreads()
          .then((threadsRes) => {
            if (isActive) setWebThreads(threadsRes);
          })
          .catch(() => {
            /* previews are cosmetic â?" the list still renders without them */
          });
        fetchDoctorConsultationNotes()
          .then((noteRows) => {
            if (!isActive) return;
            setConsultNotes(
              noteRows.reduce<Record<string, ConsultationNote>>((lookup, note) => {
                lookup[note.appointmentId] = note;
                return lookup;
              }, {}),
            );
          })
          .catch(() => {
            /* rows still render; the summary block is simply skipped */
          });
      } catch (err) {
        if (isActive) {
          setSessionError(err instanceof Error ? err.message : 'Unable to load consultations.');
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };
    void loadData();
    return () => {
      isActive = false;
    };
  }, []);

  // Poll Supabase chat messages, thread previews & slot unavailability in real time
  useEffect(() => {
    if (!doctorId || !chatTarget) {
      setWebChatMessages([]);
      return;
    }

    let isSubscribed = true;
    const targetPatientId = chatTarget.patientId;
    const loadMessages = async () => {
      try {
        const [msgs, slots, threads] = await Promise.all([
          fetchWebChatMessages(doctorId, targetPatientId),
          fetchBookedSlotKeys(),
          fetchWebChatThreads(),
        ]);
        if (isSubscribed) {
          setWebChatMessages(msgs);
          setBookedSlotKeys(slots);
          setWebThreads(threads);
          setChatError(null);

          // Read receipt: stamp incoming messages once the thread is on screen,
          // then refresh previews so the badge clears.
          const hasUnreadFromPatient = msgs.some((m) => m.sender === 'patient' && !m.readAt);
          if (hasUnreadFromPatient) {
            await markWebThreadRead(targetPatientId);
            const refreshed = await fetchWebChatThreads();
            if (isSubscribed) setWebThreads(refreshed);
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setChatError(err instanceof Error ? err.message : 'Unable to load messages.');
        }
      }
    };
    void loadMessages();
    const interval = setInterval(loadMessages, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [selectedPatientId, activeSessionItem, consultTab, showScheduleModal, doctorId, chatTarget]);

  const handleSendWebMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = webInputMessage.trim();
    if (!text && !pendingFile) return;
    if (!doctorId || !chatTarget) {
      setChatError('No consultation selected — schedule one to start a conversation.');
      return;
    }

    const outgoingFile = pendingFile;
    const outgoingCategory = fileCategory;
    setWebInputMessage('');
    setPendingFile(null);
    setFileCategory(null);
    setChatError(null);

    try {
      const newMsg = await sendWebChatMessage(doctorId, chatTarget.patientId, text, outgoingFile);
      setWebChatMessages((prev) => [...prev, newMsg]);
      fetchWebChatThreads()
        .then(setWebThreads)
        .catch(() => { /* refreshed by the poll */ });

      // Category chosen → also file the attachment into the patient's My Files.
      if (outgoingFile && outgoingCategory) {
        uploadStudentFile({
          patientId: chatTarget.patientId,
          category: outgoingCategory,
          title: outgoingFile.name,
          file: outgoingFile.file,
        }).catch((err) => {
          setChatError(
            `Message sent, but it was not added to My Files: ${err instanceof Error ? err.message : 'upload failed.'}`,
          );
        });
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to send the message.');
      setWebInputMessage(text);
      if (outgoingFile) setPendingFile(outgoingFile);
      setFileCategory(outgoingCategory);
    }
  };

  const handlePickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const kind: 'image' | 'document' = isImage ? 'image' : 'document';
    if (file.size > 15 * 1024 * 1024) {
      setChatError('That file is larger than 15 MB. Please pick a smaller one.');
      return;
    }
    setPendingFile({ file, name: file.name, kind });
    setFileCategory(null);
    setChatError(null);
  };

  /** Pending-attachment chip: file name + "save to" category picker + remove. */
  const renderPendingAttachment = () =>
    pendingFile ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--primary-soft)', borderTop: '1px solid var(--primary-soft)' }}>
        <span style={{ fontSize: '0.8rem' }}>{pendingFile.kind === 'image' ? 'Image' : 'Document'}</span>
        <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pendingFile.name}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--doc-muted)', whiteSpace: 'nowrap' }}>Save to</span>
        <select
          aria-label="File attachment to My Files"
          title="Send to the chat only, or also file it into the patient's My Files"
          value={fileCategory ?? ''}
          onChange={(event) => setFileCategory((event.target.value || null) as PatientFileCategory | null)}
          style={{ fontSize: '0.72rem', padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--primary)', background: '#fff', color: 'var(--doc-ink)', cursor: 'pointer' }}
        >
          <option value="">Chat only</option>
          {PATIENT_FILE_CATEGORIES.map((category) => (
            <option key={category.key} value={category.key}>{category.label}</option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Remove attachment"
          onClick={() => { setPendingFile(null); setFileCategory(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--doc-muted)', fontSize: '1rem' }}
        >
          ✕
        </button>
      </div>
    ) : null;

  /* ── Approve / decline / reschedule ─────────────────────────────────── */

  const patchConsultation = (id: string, patch: Partial<WebConsultationItem>) => {
    setConsultations((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleApprove = async (item: WebConsultationItem) => {
    setActionError(null);
    setDecisionBusy(item.id);
    try {
      await approveAppointment(item);
      patchConsultation(item.id, { rawStatus: 'awaiting_payment', status: 'Awaiting Payment' });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to approve the booking.');
    } finally {
      setDecisionBusy(null);
    }
  };

  /**
   * Completes a booking whose session happened OUTSIDE the platform (Zoom,
   * Google Meet, Teams, in person…) and opens the therapy progress note
   * editor straight away — completing the session is only half the job,
   * the doctor pressed this button to write the note.
   * Reuses end_video_consultation, which needs no in-app room: it closes
   * any stray session row, flips confirmed → completed, and notifies both
   * sides.
   */
  const handleMarkCompleted = async (item: WebConsultationItem) => {
    setActionError(null);
    setDecisionBusy(item.id);
    try {
      await endVideoConsultation(item);
      const completed: WebConsultationItem = {
        ...item,
        rawStatus: 'completed',
        status: 'Completed',
      };
      patchConsultation(item.id, { rawStatus: 'completed', status: 'Completed' });
      // Close any open chat/call modal, then open the note editor now.
      setActiveSessionItem(null);
      setShowVideoCall(false);
      setSummaryTarget(completed);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark the session completed.');
    } finally {
      setDecisionBusy(null);
    }
  };

  /**
   * After the note editor closes: reload the note so the modal flips from
   * the editor back to the printable pad. "Later" with nothing saved (no
   * note at all) closes the modal instead.
   */
  const handleSummaryFormDone = async () => {
    const id = summaryTarget?.id;
    if (!id) return;
    try {
      const note = await fetchConsultationNote(id);
      if (note) {
        setConsultNotes((prev) => ({ ...prev, [id]: note }));
        setSummaryEditing(false);
      } else {
        setSummaryTarget(null);
      }
    } catch {
      setSummaryTarget(null);
    }
  };

  const openDeclineModal = (item: WebConsultationItem) => {
    setDeclineTarget(item);
    setDeclineReason('');
    setDeclineError(null);
  };

  const handleDeclineConfirm = async () => {
    if (!declineTarget) return;
    if (!declineReason.trim()) {
      setDeclineError('A reason is required when declining an appointment.');
      return;
    }
    setDeclineBusy(true);
    setDeclineError(null);
    try {
      await declineAppointment(declineTarget, declineReason);
      patchConsultation(declineTarget.id, {
        rawStatus: 'declined',
        status: 'Declined',
        declineReason: declineReason.trim(),
      });
      setDeclineTarget(null);
      setDeclineReason('');
    } catch (err) {
      setDeclineError(err instanceof Error ? err.message : 'Unable to decline the booking.');
    } finally {
      setDeclineBusy(false);
    }
  };

  const openEditTimeModal = (item: WebConsultationItem) => {
    const [datePart, timePart] = item.scheduledTime.split(' at ');
    setEditTarget(item);
    setEditDate(datePart || realLifeDates[0].dateStr);
    setEditTime(timePart || '');
    setEditError(null);
  };

  const handleEditTimeConfirm = async () => {
    if (!editTarget) return;
    if (!editDate || !editTime) {
      setEditError('Pick both a date and a time slot.');
      return;
    }
    const currentDate = (editTarget.scheduledTime.split(' at ')[0] || '').trim();
    if (editDate !== currentDate && isDayOff(editDate)) {
      setEditError('That date is a day off for you — pick another date.');
      return;
    }
    // Past times are already disabled in the grid, except the appointment's
    // own slot (which may itself be in the past when rescheduling a missed
    // session). This guard covers time passing while the dialog sits open.
    const ownParts = editTarget.scheduledTime.split(' at ');
    const isOwnSlot = editTime === (ownParts[1] || '').trim() && editDate === currentDate;
    if (!isOwnSlot && isSlotInPast(editDate, editTime)) {
      setEditError('That time slot has already passed. Pick a later one.');
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const scheduledFor = await editAppointmentTime(editTarget, editDate, editTime);
      patchConsultation(editTarget.id, { scheduledTime: scheduledFor });
      setEditTarget(null);
      const slots = await fetchBookedSlotKeys();
      setBookedSlotKeys(slots);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to reschedule the appointment.');
    } finally {
      setEditBusy(false);
    }
  };

  /* ── Fee & availability ─────────────────────────────────────────────── */

  const openAvailabilityModal = () => {
    setAvailFee(availability ? String(availability.fee) : '500');
    setAvailSlots(availability ? [...availability.slots] : [...FALLBACK_SLOTS]);
    setAvailSlotDraft('');
    setAvailDays(availability ? [...availability.days] : [...ALL_WEEKDAY_KEYS]);
    setAvailBlockedDates(availability ? [...availability.blockedDates] : []);
    setAvailBlockDraft('');
    setAvailError(null);
    setShowAvailabilityModal(true);
  };

  const handleAvailabilityConfirm = async () => {
    const fee = Number(availFee);
    if (!Number.isFinite(fee) || fee < 0) {
      setAvailError('Enter a valid consultation fee.');
      return;
    }
    if (availSlots.length === 0) {
      setAvailError('Offer at least one time slot.');
      return;
    }
    if (availDays.length === 0) {
      setAvailError('Pick at least one working day.');
      return;
    }
    setAvailBusy(true);
    setAvailError(null);
    try {
      const next: DoctorAvailability = {
        fee,
        slots: availSlots,
        days: normalizeWeekdays(availDays),
        blockedDates: availBlockedDates,
      };
      await saveDoctorAvailability(next);
      setAvailability(next);
      setShowAvailabilityModal(false);
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : 'Unable to save your availability.');
    } finally {
      setAvailBusy(false);
    }
  };

  /** Adds/removes a weekday; at least one working day must stay ticked. */
  const toggleAvailDay = (day: string) => {
    const next = availDays.includes(day) ? availDays.filter((d) => d !== day) : [...availDays, day];
    if (next.length === 0) {
      setAvailError('Keep at least one working day.');
      return;
    }
    setAvailDays(WEEKDAY_KEYS.filter((d) => next.includes(d)));
    setAvailError(null);
  };

  /** Marks a specific calendar date as a day off (vacation, holiday, …). */
  const addAvailBlockDate = () => {
    const iso = availBlockDraft.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      setAvailError('Pick a valid date to block.');
      return;
    }
    if (availBlockedDates.includes(iso)) {
      setAvailError('That date is already a day off.');
      return;
    }
    setAvailBlockedDates((prev) => [...prev, iso].sort());
    setAvailBlockDraft('');
    setAvailError(null);
  };

  const addAvailabilitySlot = () => {
    const slot = availSlotDraft.trim();
    if (!slot) return;
    if (availSlots.includes(slot)) {
      setAvailError('That slot is already in your list.');
      return;
    }
    setAvailSlots((prev) => [...prev, slot]);
    setAvailSlotDraft('');
    setAvailError(null);
  };

  /**
   * Step 1 → 2: verify the typed email belongs to an existing account NOW,
   * while the walk-in patient is still at the desk — instead of after the
   * doctor has picked a slot. The booking itself re-checks on submit.
   */
  const handleSchedulePatientInfoNext = async () => {
    if (scheduleChecking) return;
    const email = patientEmail.trim();
    if (!patientName.trim() || !email) {
      setScheduleError('Please enter the patient full name and email to continue.');
      return;
    }
    setScheduleError(null);
    setScheduleChecking(true);
    try {
      const account = await findPatientAccountByEmail(email);
      if (!account) {
        setScheduleError(
          `No MindPulse account uses ${email}. Ask the patient to register on the MindPulse app with this exact email — the booking will attach to their account automatically as soon as they do.`,
        );
        return;
      }
      setScheduleStep(2);
    } catch (err) {
      setScheduleError(
        err instanceof Error ? err.message : 'Could not check that email. Please try again.',
      );
    } finally {
      setScheduleChecking(false);
    }
  };

  const handleConfirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);
    if (!patientName.trim() || !patientEmail.trim() || !selectedDate || !selectedTime) {
      setScheduleError('Please fill in the patient name and email, then pick a date and a time slot.');
      return;
    }

    const slotKey = `${selectedDate}_${selectedTime}`;
    if (bookedSlotKeys.has(slotKey)) {
      setScheduleError('That time slot is already booked. Pick another one.');
      return;
    }
    if (isDayOff(selectedDate)) {
      setScheduleError('That date is a day off — pick another date.');
      return;
    }
    if (isSlotInPast(selectedDate, selectedTime)) {
      setScheduleError('That time slot has already passed. Pick a later one.');
      return;
    }

    try {
      const newConsult = await saveDoctorScheduleAppointment({
        patientName: patientName.trim(),
        age: patientAge.trim(),
        patientEmail: patientEmail.trim(),
        notes: patientNotes.trim(),
        selectedDate,
        selectedTime,
        consultationMode: scheduleMode,
      });

      setConsultations((prev) => [newConsult, ...prev]);
      setBookedSlotKeys((prev) => new Set([...Array.from(prev), slotKey]));
      setShowScheduleModal(false);
      setScheduleStep(1);
      setScheduleMode('in_person');
      setScheduleError(null);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Unable to schedule the consultation.');
    }
  };

  /** Chosen slot is no longer bookable (already taken, or its time passed). */
  const selectedSlotBlocked =
    !!selectedDate &&
    !!selectedTime &&
    (bookedSlotKeys.has(`${selectedDate}_${selectedTime}`) ||
      isSlotInPast(selectedDate, selectedTime));

  const upcomingConsultations = useMemo(
    () => consultations.filter((c) => (UPCOMING_STATUSES as readonly string[]).includes(c.rawStatus)),
    [consultations],
  );

  const pastConsultations = useMemo(
    () => consultations.filter((c) => !(UPCOMING_STATUSES as readonly string[]).includes(c.rawStatus)),
    [consultations],
  );

  const completedConsultations = useMemo(
    () => consultations.filter((c) => c.rawStatus === 'completed'),
    [consultations],
  );

  const statusPill = (item: WebConsultationItem) => {
    switch (item.rawStatus) {
      case 'awaiting_payment':
        return <span className="status-pill status-pill-moderate">Awaiting Payment</span>;
      case 'declined':
        return <span className="status-pill status-pill-high">Declined</span>;
      case 'confirmed':
        return <span className="status-pill status-pill-green">Confirmed</span>;
      case 'completed':
        return <span className="status-pill status-pill-green">Completed</span>;
      case 'cancelled':
        return <span className="status-pill-grey">Cancelled</span>;
      default:
        return <span className="status-pill status-pill-blue">Awaiting Approval</span>;
    }
  };

  const renderActions = (item: WebConsultationItem) => {
    const busy = decisionBusy === item.id;
    if (item.rawStatus === 'scheduled') {
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {assessmentHistoryButton(item)}
          <button
            type="button"
            className="decide-btn decide-btn-approve"
            disabled={busy}
            onClick={() => void handleApprove(item)}
          >
            {busy ? 'Approving…' : '✓ Approve'}
          </button>
          <button
            type="button"
            className="decide-btn decide-btn-decline"
            disabled={busy || declineBusy}
            onClick={() => openDeclineModal(item)}
          >
            ✕ Decline
          </button>
          <button type="button" className="view-case-btn" onClick={() => openEditTimeModal(item)}>
            Edit Time
          </button>
          <button
            type="button"
            className="view-case-btn"
            style={{ background: 'var(--primary-strong)' }}
            onClick={() => setActiveSessionItem(item)}
          >
            Message
          </button>
        </div>
      );
    }
    if (item.rawStatus === 'awaiting_payment') {
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {assessmentHistoryButton(item)}
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309' }}>
            Waiting for patient payment
          </span>
          <button type="button" className="view-case-btn" onClick={() => openEditTimeModal(item)}>
            Edit Time
          </button>
          <button
            type="button"
            className="view-case-btn"
            style={{ background: 'var(--primary-strong)' }}
            onClick={() => setActiveSessionItem(item)}
          >
            Message
          </button>
        </div>
      );
    }
    if (item.rawStatus === 'confirmed') {
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {assessmentHistoryButton(item)}
          <button
            type="button"
            className="view-case-btn"
            onClick={() => openEditTimeModal(item)}
          >
            Edit Time
          </button>
          <button
            type="button"
            className="view-case-btn"
            style={{ background: 'var(--primary-strong)' }}
            onClick={() => setActiveSessionItem(item)}
          >
            Message
          </button>
          {item.consultationMode === 'in_person' ? (
            <FaceToFaceChip />
          ) : (
            <button
              type="button"
              className="start-session-btn"
              onClick={() => {
                setActiveSessionItem(item);
                setShowVideoCall(true);
              }}
            >
              Join Call
            </button>
          )}
          <button
            type="button"
            className="view-case-btn"
            disabled={busy}
            title="Session held on Zoom, Meet, Teams or in person? Completes the booking so you can write the consultation note."
            onClick={() => void handleMarkCompleted(item)}
          >
            {busy ? 'Completing…' : '✓ Complete (held elsewhere)'}
          </button>
        </div>
      );
    }
    if (item.rawStatus === 'completed') {
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {assessmentHistoryButton(item)}
          <button
            type="button"
            className="view-case-btn"
            onClick={() => setConsultTab('messages')}
          >
            Message
          </button>
          <button
            type="button"
            className="view-case-btn"
            onClick={() => {
              setActiveSessionItem(null);
              setSummaryTarget(item);
            }}
          >
            View Case
          </button>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {assessmentHistoryButton(item)}
        <button
          type="button"
          className="view-case-btn"
          style={{ background: 'var(--primary-strong)' }}
          onClick={() => setActiveSessionItem(item)}
        >
          Message
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="consultations-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <DoctorLoading label="Loading consultations…" />
      </div>
    );
  }

  return (
    <div className="consultations-page">
      {/* Header */}
      <header className="consultations-header">
        <div className="consultations-title-wrap">
          <h1>Consultations</h1>
          <p>Approve requests, collect your fee, and run video sessions</p>
        </div>

        <div className="consultations-header-actions">
          <DoctorNotifications />
          <button type="button" className="schedule-btn" onClick={openAvailabilityModal}>
            ⚙ Fee &amp; Slots
          </button>
          <button
            type="button"
            className="schedule-btn"
            onClick={() => {
              setScheduleStep(1);
              setScheduleError(null);
              setScheduleMode('in_person');
              setShowScheduleModal(true);
            }}
          >
            + Schedule Consultation
          </button>
        </div>
      </header>

      {sessionError && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger-line)',
            color: '#b91c1c',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          {sessionError}
        </div>
      )}

      {actionError && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger-line)',
            color: '#b91c1c',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          {actionError}
        </div>
      )}

      {/* 3 Top Stat Cards */}
      <div className="consult-stats-grid">
        <div className="consult-stat-card">
          <div className="label">Total Consultations</div>
          <div className="val">{consultations.length}</div>
        </div>
        <div className="consult-stat-card">
          <div className="label">Upcoming</div>
          <div className="val">{upcomingConsultations.length}</div>
        </div>
        <div className="consult-stat-card">
          <div className="label">Completed</div>
          <div className="val">{completedConsultations.length}</div>
        </div>
      </div>

      {/* Main Consultations Table Panel */}
      <div className="consultations-panel-card">
        {/* Tabs inside Consultation Panel */}
        <div className="consult-tabs-row">
          <button
            type="button"
            className={`consult-tab-btn ${consultTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setConsultTab('upcoming')}
          >
            Upcoming ({upcomingConsultations.length})
          </button>
          <button
            type="button"
            className={`consult-tab-btn ${consultTab === 'history' ? 'active' : ''}`}
            onClick={() => setConsultTab('history')}
          >
            History ({pastConsultations.length})
          </button>
          <button
            type="button"
            className={`consult-tab-btn ${consultTab === 'messages' ? 'active' : ''}`}
            onClick={() => setConsultTab('messages')}
          >
            Messages
            {totalUnread > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  borderRadius: 10,
                  background: '#e05c5c',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                }}
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONTENT */}
        {consultTab === 'messages' ? (
          /* DEDICATED MESSAGES TAB INSIDE CONSULTATIONS PANEL */
          <div style={{ display: 'flex', flexDirection: 'row', height: '420px', background: 'var(--doc-soft)', borderRadius: '14px', border: '1px solid var(--doc-line)', overflow: 'hidden' }}>
            {/* Conversation list */}
            <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid var(--doc-line)', background: 'var(--doc-panel)', overflowY: 'auto' }}>
              <div style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--doc-muted)', borderBottom: '1px solid var(--doc-soft)' }}>
                Conversations
              </div>
              {conversationItems.length === 0 ? (
                <div style={{ padding: '18px 14px', color: 'var(--doc-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                  No consultations yet — schedule one to start a conversation.
                </div>
              ) : (
                conversationItems.map((item) => {
                  const summary = threadFor(item.patientId);
                  const isSelected = chatTarget?.patientId === item.patientId;
                  return (
                    <button
                      key={item.patientId}
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(item.patientId);
                        setActiveSessionItem(null);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        background: isSelected ? 'var(--primary-soft)' : 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--doc-soft)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--doc-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', color: 'var(--doc-ink)', flexShrink: 0, overflow: 'hidden' }}>
                        {item.avatarUrl
                          ? <img src={item.avatarUrl} alt="" className="avatar-img" />
                          : item.avatarInitials}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '0.84rem', color: 'var(--doc-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.patientName}
                          </strong>
                          <span style={{ fontSize: '0.66rem', color: 'var(--doc-muted)', flexShrink: 0 }}>
                            {summary && summary.lastAt
                              ? new Date(summary.lastAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--doc-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {summary?.preview ?? `${item.studentId} · ${item.patientEmail}`}
                          </span>
                          {!!summary && summary.unreadCount > 0 && (
                            <span
                              style={{
                                flexShrink: 0,
                                minWidth: 18,
                                height: 18,
                                padding: '0 5px',
                                borderRadius: 9,
                                background: '#e05c5c',
                                color: '#fff',
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {summary.unreadCount > 9 ? '9+' : summary.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Thread */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!chatTarget ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', color: 'var(--doc-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                No consultations yet — schedule one to start a conversation.
              </div>
            ) : (
              <>
                <div style={{ padding: '12px 16px', background: 'var(--doc-panel)', borderBottom: '1px solid var(--doc-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--doc-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, overflow: 'hidden' }}>
                      {chatTarget.avatarUrl
                        ? <img src={chatTarget.avatarUrl} alt="" className="avatar-img" />
                        : chatTarget.avatarInitials}
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--doc-ink)' }}>{chatTarget.patientName}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--doc-muted)' }}>{chatTarget.patientEmail} · {chatTarget.studentId}</div>
                    </div>
                  </div>

                  {chatTarget.consultationMode === 'in_person' ? (
                    <FaceToFaceChip compact />
                  ) : (
                    <button
                      type="button"
                      style={{ background: 'var(--primary-strong)', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                      onClick={() => {
                        setActiveSessionItem(chatTarget);
                        setShowVideoCall(true);
                      }}
                    >
                      Start Video Call
                    </button>
                  )}
                </div>

                {/* Messages Thread Body */}
                <div className="web-chat-body" style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                  {webChatMessages.map((msg) => (
                    <div key={msg.id} className={`web-msg-row ${msg.sender}`}>
                      <div className={`web-msg-bubble ${msg.sender}`}>
                        {msg.attachment?.kind === 'image' && (
                          msg.attachment.url ? (
                            <a href={msg.attachment.url} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: msg.text ? 6 : 0 }}>
                              <img src={msg.attachment.url} alt={msg.attachment.name} style={{ maxWidth: '220px', maxHeight: '160px', borderRadius: 8, display: 'block' }} />
                            </a>
                          ) : (
                            <div style={{ marginBottom: msg.text ? 6 : 0, padding: '24px 32px', background: 'var(--doc-line)', borderRadius: 8, color: 'var(--doc-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                              Photo
                            </div>
                          )
                        )}
                        {msg.attachment?.kind === 'document' && (
                          <a
                            href={msg.attachment.url ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: msg.text ? 6 : 0,
                              padding: '6px 10px',
                              borderRadius: '8px',
                              background: msg.sender === 'doctor' ? 'rgba(255,255,255,0.18)' : 'var(--doc-panel)',
                              border: msg.sender === 'doctor' ? '1px solid rgba(255,255,255,0.4)' : '1px solid var(--doc-line)',
                              color: msg.sender === 'doctor' ? '#ffffff' : 'var(--doc-ink)',
                              textDecoration: 'none',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              maxWidth: '220px',
                            }}
                          >
                            <span>File</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.attachment.name}</span>
                          </a>
                        )}
                        {msg.text ? <div>{msg.text}</div> : null}
                        <div className="web-msg-time">
                          {msg.timestamp}
                          {msg.sender === 'doctor' && (
                            <span style={{ marginLeft: 6, fontWeight: 700 }}>
                              {msg.readAt ? '✓✓ Read' : '✓ Sent'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {renderPendingAttachment()}

                {/* Message Input Bar */}
                <form className="web-chat-input-bar" onSubmit={handleSendWebMessage}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePickFile}
                    style={{ display: 'none' }}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <button
                    type="button"
                    title="Attach a file"
                    className="attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    +
                  </button>
                  <input
                    type="text"
                    placeholder={`Type message to ${chatTarget.patientName}...`}
                    value={webInputMessage}
                    onChange={(e) => setWebInputMessage(e.target.value)}
                  />
                  <button type="submit" disabled={!webInputMessage.trim() && !pendingFile}>Send Message</button>
                </form>
                {chatError && (
                  <div style={{ padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600, color: '#b91c1c', background: 'var(--danger-soft)', borderTop: '1px solid var(--danger-line)' }}>
                    {chatError}
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        ) : (
          /* UPCOMING AND HISTORY LIST */
          <div className="consultation-items-list">
            {(consultTab === 'upcoming' ? upcomingConsultations : pastConsultations).map((item) => (
              <div key={item.id} className="consult-item-row">
                <div className="consult-item-main">
                  <div className="consult-item-left">
                    <div className="consult-avatar">
                      {item.avatarUrl
                        ? <img src={item.avatarUrl} alt="" className="avatar-img" />
                        : item.avatarInitials}
                    </div>
                    <div className="consult-info">
                      <div className="consult-patient-name">{item.patientName}</div>
                      <div className="consult-student-id">{item.studentId} · {item.patientEmail}</div>
                      <div className="consult-time-str">
                        {item.scheduledTime} · {consultationModeLabel(item.consultationMode)}
                      </div>
                    </div>
                  </div>

                  <div className="consult-item-right">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {statusPill(item)}
                      {renderActions(item)}
                    </div>
                  </div>
                </div>

                {item.rawStatus === 'declined' && item.declineReason ? (
                  <div className="appointment-reason">
                    <strong>Declined:</strong> {item.declineReason}
                  </div>
                ) : null}

                {item.notes ? (
                  <div className="consult-notes-box">
                    <strong>Notes:</strong> {item.notes}
                  </div>
                ) : null}
              </div>
            ))}
            {(consultTab === 'upcoming' ? upcomingConsultations : pastConsultations).length === 0 && (
              <p className="empty-table">
                {consultTab === 'upcoming'
                  ? 'No upcoming consultations.'
                  : 'No past consultations yet.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* DECLINE MODAL (reason required) */}
      {declineTarget && (
        <div className="web-chat-modal-overlay">
          <div className="web-chat-modal-box" style={{ height: 'auto', maxHeight: '90vh', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--doc-ink)' }}>Decline appointment</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--doc-muted)' }}>
                  {declineTarget.patientName} · {declineTarget.scheduledTime}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close decline dialog"
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--doc-muted)' }}
                onClick={() => setDeclineTarget(null)}
              >
                ✕
              </button>
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '6px' }}>
              Reason for declining * (the patient sees this)
            </label>
            <textarea
              rows={4}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--doc-line-strong)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="e.g. I am fully booked that day — please pick another slot."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />

            {declineError && (
              <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
                {declineError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="decide-btn decide-btn-quiet"
                style={{ flex: 1 }}
                onClick={() => setDeclineTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="decide-btn decide-btn-decline"
                style={{ flex: 2 }}
                disabled={declineBusy}
                onClick={() => void handleDeclineConfirm()}
              >
                {declineBusy ? 'Declining…' : 'Decline Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT APPOINTMENT TIME MODAL */}
      {editTarget && (
        <div className="web-chat-modal-overlay">
          <div className="web-chat-modal-box" style={{ height: 'auto', maxHeight: '90vh', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--doc-ink)' }}>Edit appointment time</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--doc-muted)' }}>
                  {editTarget.patientName} · currently {editTarget.scheduledTime}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close edit time dialog"
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--doc-muted)' }}
                onClick={() => setEditTarget(null)}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '6px' }}>
                Date *
              </label>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                {realLifeDates.map((d) => {
                  const isOff = isDayOff(d.dateStr);
                  const isCurrent = editDate === d.dateStr;
                  const disabled = isOff && !isCurrent;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      disabled={disabled}
                      title={disabled ? 'Day off — blocked in Fee & Slots' : undefined}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: !disabled && isCurrent ? '2px solid var(--primary-strong)' : '1px solid var(--doc-line-strong)',
                        background: !disabled && isCurrent ? 'var(--primary-soft)' : 'var(--doc-panel)',
                        color: disabled ? 'var(--doc-muted)' : isCurrent ? 'var(--primary-strong)' : 'var(--doc-ink)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.55 : 1,
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => {
                        if (disabled) return;
                        setEditDate(d.dateStr);
                        setEditTime('');
                      }}
                    >
                      {d.label}
                      {disabled ? ' · Day off' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '6px' }}>
                Time slot *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {timeSlots.map((t) => {
                  const slotKey = `${editDate}_${t}`;
                  const isBooked = bookedSlotKeys.has(slotKey) && slotKey !== editTarget.scheduledTime.replace(' at ', '_');
                  // Keep the appointment's own slot pickable even if its time
                  // has passed (rescheduling a missed session back to itself).
                  const ownParts = editTarget.scheduledTime.split(' at ');
                  const isOwnSlot = t === (ownParts[1] || '').trim() && editDate === ownParts[0];
                  const isPast = !isOwnSlot && isSlotInPast(editDate, t);
                  const isUnavailable = isBooked || isPast;
                  const isSelected = editTime === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isUnavailable}
                      title={isBooked ? 'Already booked' : isPast ? 'That time has already passed' : undefined}
                      style={{
                        padding: '10px 4px',
                        borderRadius: '8px',
                        border: isUnavailable ? '1px dashed var(--doc-line-strong)' : isSelected ? '2px solid var(--primary-strong)' : '1px solid var(--doc-line-strong)',
                        background: isUnavailable ? 'var(--doc-soft)' : isSelected ? 'var(--primary-strong)' : 'var(--doc-panel)',
                        color: isUnavailable ? 'var(--doc-muted)' : isSelected ? '#ffffff' : 'var(--doc-ink)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: isUnavailable ? 'not-allowed' : 'pointer',
                        textAlign: 'center',
                      }}
                      onClick={() => !isUnavailable && setEditTime(t)}
                    >
                      {t} {isBooked ? 'Booked' : isPast ? 'Past' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {editError && (
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="decide-btn decide-btn-quiet"
                style={{ flex: 1 }}
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="start-session-btn"
                style={{ flex: 2, padding: '12px' }}
                disabled={editBusy || !editTime}
                onClick={() => void handleEditTimeConfirm()}
              >
                {editBusy ? 'Saving…' : 'Save New Time'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEE & AVAILABILITY MODAL */}
      {showAvailabilityModal && (
        <div className="web-chat-modal-overlay">
          <div className="web-chat-modal-box" style={{ height: 'auto', maxHeight: '90vh', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--doc-ink)' }}>Fee &amp; Availability</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--doc-muted)' }}>
                  Patients pay your fee to confirm a booking; your slots drive their booking grid.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close fee and slots dialog"
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--doc-muted)' }}
                onClick={() => setShowAvailabilityModal(false)}
              >
                ✕
              </button>
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '6px' }}>
              Consultation fee (₱) *
            </label>
            <input
              type="number"
              min={0}
              step={50}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--doc-line-strong)', fontSize: '0.9rem', outline: 'none' }}
              value={availFee}
              onChange={(e) => setAvailFee(e.target.value)}
            />

            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', margin: '16px 0 6px' }}>
              Offered time slots *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {availSlots.map((slot) => (
                <span
                  key={slot}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--primary-soft)',
                    color: 'var(--primary-strong)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                  }}
                >
                  {slot}
                  <button
                    type="button"
                    aria-label={`Remove ${slot}`}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-strong)', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', padding: 0 }}
                    onClick={() => setAvailSlots((prev) => prev.filter((s) => s !== slot))}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {availSlots.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 700 }}>
                  No slots yet — add at least one.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. 7:00 AM"
                style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--doc-line-strong)', fontSize: '0.9rem', outline: 'none' }}
                value={availSlotDraft}
                onChange={(e) => setAvailSlotDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAvailabilitySlot();
                  }
                }}
              />
              <button type="button" className="view-case-btn" onClick={addAvailabilitySlot}>
                + Add Slot
              </button>
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', margin: '16px 0 6px' }}>
              Working days *
            </label>
            <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--doc-muted)' }}>
              Patients can only pick dates that fall on one of these weekdays.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {WEEKDAY_KEYS.map((day) => {
                const active = availDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${DAY_LABELS[day]} ${active ? 'working' : 'off'}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: active ? '1px solid var(--primary-strong)' : '1px solid var(--doc-line-strong)',
                      background: active ? 'var(--primary-strong)' : 'var(--doc-panel)',
                      color: active ? '#ffffff' : 'var(--doc-muted)',
                    }}
                    onClick={() => toggleAvailDay(day)}
                  >
                    {DAY_LABELS[day]}
                  </button>
                );
              })}
            </div>

            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', margin: '16px 0 6px' }}>
              Days off
            </label>
            <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--doc-muted)' }}>
              Block specific dates (vacation, holiday). Patients can&apos;t book them; appointments you already have on
              those dates stay on your schedule.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="date"
                aria-label="Date to block"
                min={toIsoDate(new Date())}
                style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--doc-line-strong)', fontSize: '0.85rem', outline: 'none', background: 'var(--doc-panel)', color: 'var(--doc-ink)' }}
                value={availBlockDraft}
                onChange={(e) => setAvailBlockDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAvailBlockDate();
                  }
                }}
              />
              <button type="button" className="view-case-btn" onClick={addAvailBlockDate}>
                + Add Day Off
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
              {availBlockedDates.map((iso) => {
                const booked = bookedCountOnIso(iso);
                return (
                  <span
                    key={iso}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: booked > 0 ? 'var(--danger-soft)' : 'var(--doc-soft)',
                      color: booked > 0 ? '#b91c1c' : 'var(--doc-ink-2)',
                      border: '1px solid var(--doc-line)',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {dayOffLabel(iso)}
                    {booked > 0 && (
                      <span style={{ fontWeight: 800, fontSize: '0.72rem' }}>
                        {booked} booked
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove day off ${dayOffLabel(iso)}`}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', padding: 0 }}
                      onClick={() => setAvailBlockedDates((prev) => prev.filter((d) => d !== iso))}
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
              {availBlockedDates.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--doc-muted)' }}>
                  No days off yet — you&apos;re bookable on every working day.
                </span>
              )}
            </div>

            {availError && (
              <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--danger-soft)', border: '1px solid var(--danger-line)', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
                {availError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="decide-btn decide-btn-quiet"
                style={{ flex: 1 }}
                onClick={() => setShowAvailabilityModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="start-session-btn"
                style={{ flex: 2, padding: '12px' }}
                disabled={availBusy}
                onClick={() => void handleAvailabilityConfirm()}
              >
                {availBusy ? 'Saving…' : 'Save Fee & Slots'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL SCHEDULE CONSULTATION BOOKING MODAL */}
      {showScheduleModal && (
        <div className="web-chat-modal-overlay">
          <div className="web-chat-modal-box" style={{ height: 'auto', maxHeight: '90vh', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--doc-ink)' }}>Schedule Consultation</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--doc-muted)' }}>
                  {scheduleStep === 1 ? 'Step 1: Walk-In Patient Information' : 'Step 2: Real-Life Date & Time Slot'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close schedule dialog"
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--doc-muted)' }}
                onClick={() => setShowScheduleModal(false)}
              >
                ✕
              </button>
            </div>

            {scheduleStep === 1 ? (
              /* STEP 1: PATIENT INFORMATION TEXTBOXES */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '4px' }}>
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--doc-line-strong)', fontSize: '0.9rem', outline: 'none' }}
                    placeholder="e.g. John Doe"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '4px' }}>
                      Age *
                    </label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--doc-line-strong)', fontSize: '0.9rem', outline: 'none' }}
                      placeholder="e.g. 24"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '4px' }}>
                      Patient Email *
                    </label>
                    <input
                      type="email"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--doc-line-strong)', fontSize: '0.9rem', outline: 'none' }}
                      placeholder="patient@example.com"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '6px' }}>
                    Consultation Type *
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {(['in_person', 'online'] as ConsultationMode[]).map((mode) => {
                      const active = scheduleMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setScheduleMode(mode)}
                          style={{
                            flex: 1,
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            border: active
                              ? '1.5px solid var(--primary-strong)'
                              : '1px solid var(--doc-line-strong)',
                            background: active ? 'rgba(59,130,246,0.10)' : 'transparent',
                            color: 'var(--doc-ink)',
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                            {CONSULTATION_MODE_LABELS[mode]}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--doc-muted)', marginTop: 2 }}>
                            {mode === 'in_person'
                              ? 'The patient comes in to the clinic.'
                              : 'You meet the patient in the video room.'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '4px' }}>
                    Clinical Notes / Reason
                  </label>
                  <textarea
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--doc-line-strong)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
                    placeholder="Walk-in consultation notes..."
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                  />
                </div>

                {scheduleError && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--danger-soft)',
                      border: '1px solid var(--danger-line)',
                      color: '#b91c1c',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    {scheduleError}
                  </div>
                )}

                <button
                  type="button"
                  style={{ background: 'var(--primary-strong)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 700, cursor: scheduleChecking ? 'wait' : 'pointer', marginTop: '10px', opacity: scheduleChecking ? 0.7 : 1 }}
                  onClick={handleSchedulePatientInfoNext}
                  disabled={scheduleChecking}
                >
                  {scheduleChecking ? 'Checking email…' : 'Proceed to Date & Time Slot →'}
                </button>
              </div>
            ) : (
              /* STEP 2: REAL-LIFE DATE & TIME BOOKING WITH UNAVAILABILITY */
              <form onSubmit={handleConfirmSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--doc-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--doc-ink)' }}>Consultation type: </span>
                  {CONSULTATION_MODE_LABELS[scheduleMode]}
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '6px' }}>
                    Select Real-Life Booking Date *
                  </label>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                    {realLifeDates.map((d) => {
                      const disabled = isDayOff(d.dateStr);
                      return (
                        <button
                          key={d.label}
                          type="button"
                          disabled={disabled}
                          title={disabled ? 'Day off — blocked in Fee & Slots' : undefined}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: !disabled && selectedDate === d.dateStr ? '2px solid var(--primary-strong)' : '1px solid var(--doc-line-strong)',
                            background: !disabled && selectedDate === d.dateStr ? 'var(--primary-soft)' : 'var(--doc-panel)',
                            color: disabled ? 'var(--doc-muted)' : selectedDate === d.dateStr ? 'var(--primary-strong)' : 'var(--doc-ink)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.55 : 1,
                            whiteSpace: 'nowrap',
                          }}
                          onClick={() => {
                            if (disabled) return;
                            setSelectedDate(d.dateStr);
                            // The kept time may have passed on the new date.
                            if (selectedTime && isSlotInPast(d.dateStr, selectedTime)) {
                              setSelectedTime('');
                            }
                          }}
                        >
                          {d.label}
                          {disabled ? ' · Day off' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--doc-ink)', display: 'block', marginBottom: '6px' }}>
                    Select Available Time Slot *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {timeSlots.map((t) => {
                      const slotKey = `${selectedDate}_${t}`;
                      const isBooked = bookedSlotKeys.has(slotKey);
                      const isPast = isSlotInPast(selectedDate, t);
                      const isUnavailable = isBooked || isPast;
                      const isSelected = selectedTime === t;

                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={isUnavailable}
                          title={isBooked ? 'Already booked' : isPast ? 'That time has already passed' : undefined}
                          style={{
                            padding: '10px 4px',
                            borderRadius: '8px',
                            border: isUnavailable ? '1px dashed var(--doc-line-strong)' : isSelected ? '2px solid var(--primary-strong)' : '1px solid var(--doc-line-strong)',
                            background: isUnavailable ? 'var(--doc-soft)' : isSelected ? 'var(--primary-strong)' : 'var(--doc-panel)',
                            color: isUnavailable ? 'var(--doc-muted)' : isSelected ? '#ffffff' : 'var(--doc-ink)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: isUnavailable ? 'not-allowed' : 'pointer',
                            textAlign: 'center',
                          }}
                          onClick={() => !isUnavailable && setSelectedTime(t)}
                        >
                          {t} {isBooked ? 'Booked (Unavailable)' : isPast ? 'Past' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {scheduleError && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--danger-soft)',
                      border: '1px solid var(--danger-line)',
                      color: '#b91c1c',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    {scheduleError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    style={{ flex: 1, background: 'var(--doc-line)', color: 'var(--doc-ink)', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => setScheduleStep(1)}
                  >
                    ← Back
                  </button>

                  <button
                    type="submit"
                    disabled={selectedSlotBlocked}
                    style={{
                      flex: 2,
                      background: selectedSlotBlocked ? 'var(--doc-muted)' : 'var(--primary-strong)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      cursor: selectedSlotBlocked ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Confirm booking
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* AFTER-VISIT SUMMARY MODAL (History > View Case) */}
      {summaryTarget && (
        <div className="web-chat-modal-overlay">
          <div className="web-chat-modal-box summary-modal">
            <div className="web-chat-modal-header">
              <div>
                <h3>After-visit summary</h3>
                <p>
                  {summaryTarget.patientName} &middot; {summaryTarget.studentId} &middot;{' '}
                  {summaryTarget.scheduledTime}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close summary"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  color: 'var(--doc-muted)',
                }}
                onClick={() => setSummaryTarget(null)}
              >
                &times;
              </button>
            </div>
            <div className="web-chat-modal-body">
              {consultNotes[summaryTarget.id] && !summaryEditing ? (
                <ConsultationSummaryView
                  note={consultNotes[summaryTarget.id]}
                  publishBusy={decisionBusy === `publish-${summaryTarget.id}`}
                  onEdit={() => setSummaryEditing(true)}
                  onTogglePublish={async (published) => {
                    const appointmentId = summaryTarget.id;
                    setDecisionBusy(`publish-${appointmentId}`);
                    setActionError(null);
                    try {
                      const updated = await setPatientNotePublication(appointmentId, published);
                      setConsultNotes((prev) => ({ ...prev, [appointmentId]: updated }));
                    } catch (err) {
                      setActionError(
                        err instanceof Error
                          ? err.message
                          : 'The publication setting could not be saved.',
                      );
                    } finally {
                      setDecisionBusy(null);
                    }
                  }}
                />
              ) : (
                /* Either no note yet, or the doctor pressed Edit — the editor
                   loads the saved note and prefills every field (its save
                   button becomes "Update note"). Works for sessions held on
                   Jitsi OR anywhere else (Zoom, Meet, Teams, in person). */
                <ConsultationSummaryForm
                  key={`${summaryTarget.id}-${summaryEditing ? 'edit' : 'new'}`}
                  appointment={summaryTarget}
                  onDone={() => void handleSummaryFormDone()}
                />
              )}
              {summaryTarget.notes ? (
                <div className="consult-notes-box">
                  <strong>Booking note:</strong> {summaryTarget.notes}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* LIVE DOCTOR CONSULTATION & TWO-WAY CHAT MODAL */}
      {activeSessionItem && (
        <div className="web-chat-modal-overlay">
          <div className={`web-chat-modal-box${showVideoCall ? ' is-video-call' : ''}`}>
            <div className="web-chat-modal-header">
              <div>
                <h3>Consultation Session: {activeSessionItem.patientName}</h3>
                <p>{activeSessionItem.studentId} · {activeSessionItem.scheduledTime} · {consultationModeLabel(activeSessionItem.consultationMode)} · {activeSessionItem.status}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {activeSessionItem.consultationMode === 'in_person' ? (
                  <FaceToFaceChip compact />
                ) : (
                  <button
                    type="button"
                    style={{
                      background: 'var(--primary-strong)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                    onClick={() => setShowVideoCall(true)}
                  >
                    Start Video Call
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close consultation panel"
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--doc-muted)' }}
                  onClick={() => {
                    setActiveSessionItem(null);
                    setShowVideoCall(false);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {showVideoCall ? (
              <div className="web-chat-modal-body">
                <JitsiCallPanel appointment={activeSessionItem} onBack={() => setShowVideoCall(false)} />
              </div>
            ) : (
              <>
                <div className="web-chat-body">
                  {webChatMessages.map((msg) => (
                    <div key={msg.id} className={`web-msg-row ${msg.sender}`}>
                      <div className={`web-msg-bubble ${msg.sender}`}>
                        {msg.attachment?.kind === 'image' && (
                          msg.attachment.url ? (
                            <a href={msg.attachment.url} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: msg.text ? 6 : 0 }}>
                              <img src={msg.attachment.url} alt={msg.attachment.name} style={{ maxWidth: '220px', maxHeight: '160px', borderRadius: 8, display: 'block' }} />
                            </a>
                          ) : (
                            <div style={{ marginBottom: msg.text ? 6 : 0, padding: '24px 32px', background: 'rgba(255,255,255,0.18)', borderRadius: 8, color: 'var(--primary-strong)', fontSize: '0.78rem', fontWeight: 600 }}>
                              Photo
                            </div>
                          )
                        )}
                        {msg.attachment?.kind === 'document' && (
                          <a
                            href={msg.attachment.url ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginBottom: msg.text ? 6 : 0,
                              padding: '6px 10px',
                              borderRadius: '8px',
                              background: msg.sender === 'doctor' ? 'rgba(255,255,255,0.18)' : 'var(--doc-panel)',
                              border: msg.sender === 'doctor' ? '1px solid rgba(255,255,255,0.4)' : '1px solid var(--doc-line)',
                              color: msg.sender === 'doctor' ? '#ffffff' : 'var(--doc-ink)',
                              textDecoration: 'none',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              maxWidth: '220px',
                            }}
                          >
                            <span>File</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.attachment.name}</span>
                          </a>
                        )}
                        <div>{msg.text}</div>
                        <div className="web-msg-time">
                          {msg.timestamp}
                          {msg.sender === 'doctor' && (
                            <span style={{ marginLeft: 6, fontWeight: 700 }}>
                              {msg.readAt ? '✓✓ Read' : '✓ Sent'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {renderPendingAttachment()}

                <form className="web-chat-input-bar" onSubmit={handleSendWebMessage}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePickFile}
                    style={{ display: 'none' }}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <button
                    type="button"
                    title="Attach a file"
                    className="attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    +
                  </button>
                  <input
                    type="text"
                    placeholder={`Reply to ${activeSessionItem.patientName}...`}
                    value={webInputMessage}
                    onChange={(e) => setWebInputMessage(e.target.value)}
                  />
                  <button type="submit" disabled={!webInputMessage.trim() && !pendingFile}>Send</button>
                </form>
                {chatError && (
                  <div style={{ padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600, color: '#b91c1c', background: 'var(--danger-soft)', borderTop: '1px solid var(--danger-line)' }}>
                    {chatError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
