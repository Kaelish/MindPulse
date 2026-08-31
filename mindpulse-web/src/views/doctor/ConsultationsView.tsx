import React, { useEffect, useMemo, useState } from 'react';
import { DoctorVideoCallPanel } from '../../components/DoctorVideoCallPanel';
import {
  WebChatMessage,
  WebConsultationItem,
  fetchWebChatMessages,
  fetchWebConsultations,
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

  useEffect(() => {
    let isActive = true;
    const loadData = async () => {
      setLoading(true);
      const res = await fetchWebConsultations();
      if (isActive) {
        setConsultations(res);
        setLoading(false);
      }
    };
    void loadData();
    return () => {
      isActive = false;
    };
  }, []);

  // Poll Supabase chat messages in real time when live session or messages tab is open
  useEffect(() => {
    let isSubscribed = true;
    const loadMessages = async () => {
      const msgs = await fetchWebChatMessages('1b64dd8f-48f1-4298-ac06-61377665e');
      if (isSubscribed) {
        setWebChatMessages(msgs);
      }
    };
    void loadMessages();
    const interval = setInterval(loadMessages, 1500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeSessionItem, consultTab]);

  const handleSendWebMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!webInputMessage.trim()) return;

    const text = webInputMessage.trim();
    setWebInputMessage('');

    const newMsg = await sendWebChatMessage('1b64dd8f-48f1-4298-ac06-61377665e', 'doctor', text);
    setWebChatMessages((prev) => [...prev, newMsg]);
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
            🔔
          </button>
          <button
            type="button"
            className="schedule-btn"
            onClick={() => setConsultTab('messages')}
          >
            💬 Open Messages
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
