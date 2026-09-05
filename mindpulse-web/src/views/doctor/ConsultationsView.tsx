import React, { useEffect, useMemo, useState } from 'react';
import { DoctorVideoCallPanel } from '../../components/DoctorVideoCallPanel';
import {
  WebChatMessage,
  WebConsultationItem,
  fetchBookedSlotKeys,
  fetchWebChatMessages,
  fetchWebConsultations,
  saveDoctorScheduleAppointment,
  sendWebChatMessage,
} from '../../services/consultations';

export const ConsultationsView: React.FC = () => {
  const [consultations, setConsultations] = useState<WebConsultationItem[]>([]);
  const [consultTab, setConsultTab] = useState<'upcoming' | 'completed' | 'messages'>('upcoming');
  const [activeSessionItem, setActiveSessionItem] = useState<WebConsultationItem | null>(null);
  const [webChatMessages, setWebChatMessages] = useState<WebChatMessage[]>([]);
  const [webInputMessage, setWebInputMessage] = useState<string>('');
  const [showVideoCall, setShowVideoCall] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Manual Schedule Consultation Modal State
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [scheduleStep, setScheduleStep] = useState<1 | 2>(1);
  const [patientName, setPatientName] = useState<string>('John Doe');
  const [patientAge, setPatientAge] = useState<string>('24');
  const [patientEmail, setPatientEmail] = useState<string>('student.test@mindpulse.edu');
  const [patientNotes, setPatientNotes] = useState<string>('Follow-up consultation');
  const [selectedDate, setSelectedDate] = useState<string>('Today (Aug 31)');
  const [selectedTime, setSelectedTime] = useState<string>('10:30 AM');
  const [bookedSlotKeys, setBookedSlotKeys] = useState<Set<string>>(new Set());

  // Real-life date generation
  const realLifeDates = useMemo(() => {
    const dates: { label: string; dateStr: string }[] = [];
    const today = new Date();
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 6; i++) {
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

  const timeSlots = ['9:00 AM', '10:30 AM', '11:45 AM', '1:30 PM', '2:15 PM', '3:30 PM', '4:45 PM', '5:30 PM'];

  useEffect(() => {
    let isActive = true;
    const loadData = async () => {
      setLoading(true);
      const res = await fetchWebConsultations();
      const slots = await fetchBookedSlotKeys();
      if (isActive) {
        setConsultations(res);
        setBookedSlotKeys(slots);
        setLoading(false);
      }
    };
    void loadData();
    return () => {
      isActive = false;
    };
  }, []);

  // Poll Supabase chat messages & slot unavailability in real time
  useEffect(() => {
    let isSubscribed = true;
    const loadMessages = async () => {
      const msgs = await fetchWebChatMessages('1b64dd8f-48f1-4298-ac06-61377665e');
      const slots = await fetchBookedSlotKeys();
      if (isSubscribed) {
        setWebChatMessages(msgs);
        setBookedSlotKeys(slots);
      }
    };
    void loadMessages();
    const interval = setInterval(loadMessages, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeSessionItem, consultTab, showScheduleModal]);

  const handleSendWebMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!webInputMessage.trim()) return;

    const text = webInputMessage.trim();
    setWebInputMessage('');

    const newMsg = await sendWebChatMessage('1b64dd8f-48f1-4298-ac06-61377665e', 'doctor', text);
    setWebChatMessages((prev) => [...prev, newMsg]);
  };

  const handleConfirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !patientEmail.trim() || !selectedDate || !selectedTime) return;

    const slotKey = `${selectedDate}_${selectedTime}`;
    if (bookedSlotKeys.has(slotKey)) return;

    const newConsult = await saveDoctorScheduleAppointment({
      patientName: patientName.trim(),
      age: patientAge.trim(),
      patientEmail: patientEmail.trim(),
      notes: patientNotes.trim(),
      selectedDate,
      selectedTime,
    });

    setConsultations((prev) => [newConsult, ...prev]);
    setBookedSlotKeys((prev) => new Set([...Array.from(prev), slotKey]));
    setShowScheduleModal(false);
    setScheduleStep(1);
  };

  const upcomingConsultations = useMemo(
    () => consultations.filter((c) => c.status !== 'Completed'),
    [consultations],
  );

  const completedConsultations = useMemo(
    () => consultations.filter((c) => c.status === 'Completed'),
    [consultations],
  );

  if (loading) {
    return (
      <div className="consultations-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner" />
        <p style={{ color: '#64748b' }}>Loading Consultations...</p>
      </div>
    );
  }

  return (
    <div className="consultations-page">
      {/* Header */}
      <header className="consultations-header">
        <div className="consultations-title-wrap">
          <h1>Consultations</h1>
          <p>Manage consultations and provide recommendations</p>
        </div>

        <div className="consultations-header-actions">
          <button type="button" className="bell-btn" title="Notifications">
            <span className="bell-icon" />
          </button>
          {/* Schedule Consultation Button opens Manual Booking Modal */}
          <button
            type="button"
            className="schedule-btn"
            onClick={() => {
              setScheduleStep(1);
              setShowScheduleModal(true);
            }}
          >
            + Schedule Consultation
          </button>
        </div>
      </header>

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
            className={`consult-tab-btn ${consultTab === 'completed' ? 'active' : ''}`}
            onClick={() => setConsultTab('completed')}
          >
            Completed ({completedConsultations.length})
          </button>
          <button
            type="button"
            className={`consult-tab-btn ${consultTab === 'messages' ? 'active' : ''}`}
            onClick={() => setConsultTab('messages')}
          >
            Messages 💬
          </button>
        </div>

        {/* TAB CONTENT */}
        {consultTab === 'messages' ? (
          /* DEDICATED MESSAGES TAB INSIDE CONSULTATIONS PANEL */
          <div style={{ display: 'flex', flexDirection: 'column', height: '420px', background: '#faf8ed', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>JD</div>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>John Doe (teststudent)</strong>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>student.test@mindpulse.edu · STU-001</div>
                </div>
              </div>

              <button
                type="button"
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                onClick={() => {
                  if (upcomingConsultations.length > 0) setActiveSessionItem(upcomingConsultations[0]);
                  setShowVideoCall(true);
                }}
              >
                📹 Launch Video Call
              </button>
            </div>

            {/* Messages Thread Body */}
            <div className="web-chat-body" style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
              {webChatMessages.map((msg) => (
                <div key={msg.id} className={`web-msg-row ${msg.sender}`}>
                  <div className={`web-msg-bubble ${msg.sender}`}>
                    <div>{msg.text}</div>
                    <div className="web-msg-time">{msg.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input Bar */}
            <form className="web-chat-input-bar" onSubmit={handleSendWebMessage}>
              <input
                type="text"
                placeholder="Type message to John Doe..."
                value={webInputMessage}
                onChange={(e) => setWebInputMessage(e.target.value)}
              />
              <button type="submit">Send Message</button>
            </form>
          </div>
        ) : (
          /* UPCOMING AND COMPLETED LIST */
          <div className="consultation-items-list">
            {(consultTab === 'upcoming' ? upcomingConsultations : completedConsultations).map((item) => (
              <div key={item.id} className="consult-item-row">
                <div className="consult-item-main">
                  <div className="consult-item-left">
                    <div className="consult-avatar">{item.avatarInitials}</div>
                    <div className="consult-info">
                      <div className="consult-patient-name">{item.patientName}</div>
                      <div className="consult-student-id">{item.studentId} · {item.patientEmail}</div>
                      <div className="consult-time-str">{item.scheduledTime}</div>
                    </div>
                  </div>

                  <div className="consult-item-right">
                    {item.status === 'Completed' ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="status-pill-green">Completed</span>
                        <button
                          type="button"
                          className="view-case-btn"
                          onClick={() => setConsultTab('messages')}
                        >
                          💬 Message
                        </button>
                        <button
                          type="button"
                          className="view-case-btn"
                          onClick={() => setActiveSessionItem(item)}
                        >
                          View Case
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="status-pill-blue">Scheduled</span>
                        <button
                          type="button"
                          className="view-case-btn"
                          style={{ background: '#5b6ef5' }}
                          onClick={() => {
                            setActiveSessionItem(item);
                          }}
                        >
                          💬 Message Patient
                        </button>
                        <button
                          type="button"
                          className="start-session-btn"
                          onClick={() => {
                            setActiveSessionItem(item);
                            setShowVideoCall(true);
                          }}
                        >
                          Start Session
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {item.notes ? (
                  <div className="consult-notes-box">
                    <strong>Notes:</strong> {item.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MANUAL SCHEDULE CONSULTATION BOOKING MODAL */}
      {showScheduleModal && (
        <div className="web-chat-modal-overlay">
          <div className="web-chat-modal-box" style={{ height: 'auto', maxHeight: '90vh', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Schedule Consultation</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {scheduleStep === 1 ? 'Step 1: Walk-In Patient Information' : 'Step 2: Real-Life Date & Time Slot'}
                </p>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setShowScheduleModal(false)}
              >
                ✕
              </button>
            </div>

            {scheduleStep === 1 ? (
              /* STEP 1: PATIENT INFORMATION TEXTBOXES */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                    placeholder="e.g. John Doe"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Age *
                    </label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                      placeholder="e.g. 24"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                      Patient Email *
                    </label>
                    <input
                      type="email"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                      placeholder="student.test@mindpulse.edu"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Clinical Notes / Reason
                  </label>
                  <textarea
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
                    placeholder="Walk-in consultation notes..."
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  style={{ background: '#5b6ef5', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}
                  onClick={() => {
                    if (patientName.trim() && patientEmail.trim()) {
                      setScheduleStep(2);
                    }
                  }}
                >
                  Proceed to Date & Time Slot →
                </button>
              </div>
            ) : (
              /* STEP 2: REAL-LIFE DATE & TIME BOOKING WITH UNAVAILABILITY */
              <form onSubmit={handleConfirmSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Select Real-Life Booking Date
                  </label>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                    {realLifeDates.map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: selectedDate === d.label ? '2px solid #5b6ef5' : '1px solid #cbd5e1',
                          background: selectedDate === d.label ? '#eeedfe' : '#ffffff',
                          color: selectedDate === d.label ? '#5b6ef5' : '#1e293b',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        onClick={() => setSelectedDate(d.label)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Select Available Time Slot
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {timeSlots.map((t) => {
                      const slotKey = `${selectedDate}_${t}`;
                      const isBooked = bookedSlotKeys.has(slotKey);
                      const isSelected = selectedTime === t;

                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={isBooked}
                          style={{
                            padding: '10px 4px',
                            borderRadius: '8px',
                            border: isBooked ? '1px dashed #cbd5e1' : isSelected ? '2px solid #5b6ef5' : '1px solid #cbd5e1',
                            background: isBooked ? '#f1f5f9' : isSelected ? '#5b6ef5' : '#ffffff',
                            color: isBooked ? '#94a3b8' : isSelected ? '#ffffff' : '#1e293b',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: isBooked ? 'not-allowed' : 'pointer',
                            textAlign: 'center',
                          }}
                          onClick={() => !isBooked && setSelectedTime(t)}
                        >
                          {t} {isBooked ? '🔒 (Unavailable)' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    style={{ flex: 1, background: '#e2e8f0', color: '#334155', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => setScheduleStep(1)}
                  >
                    ← Back
                  </button>

                  <button
                    type="submit"
                    disabled={bookedSlotKeys.has(`${selectedDate}_${selectedTime}`)}
                    style={{
                      flex: 2,
                      background: bookedSlotKeys.has(`${selectedDate}_${selectedTime}`) ? '#94a3b8' : '#5b6ef5',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      cursor: bookedSlotKeys.has(`${selectedDate}_${selectedTime}`) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Confirm & Forward to Supabase
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LIVE DOCTOR CONSULTATION & TWO-WAY CHAT MODAL */}
      {activeSessionItem && (
        <div className="web-chat-modal-overlay">
          <div className="web-chat-modal-box">
            <div className="web-chat-modal-header">
              <div>
                <h3>Consultation Session: {activeSessionItem.patientName}</h3>
                <p>STU-001 · {activeSessionItem.scheduledTime}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                  onClick={() => setShowVideoCall(true)}
                >
                  📹 Start Video Call
                </button>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
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
              <div style={{ flex: 1, padding: '10px' }}>
                <DoctorVideoCallPanel />
              </div>
            ) : (
              <>
                <div className="web-chat-body">
                  {webChatMessages.map((msg) => (
                    <div key={msg.id} className={`web-msg-row ${msg.sender}`}>
                      <div className={`web-msg-bubble ${msg.sender}`}>
                        <div>{msg.text}</div>
                        <div className="web-msg-time">{msg.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <form className="web-chat-input-bar" onSubmit={handleSendWebMessage}>
                  <input
                    type="text"
                    placeholder={`Reply to ${activeSessionItem.patientName}...`}
                    value={webInputMessage}
                    onChange={(e) => setWebInputMessage(e.target.value)}
                  />
                  <button type="submit">Send</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
