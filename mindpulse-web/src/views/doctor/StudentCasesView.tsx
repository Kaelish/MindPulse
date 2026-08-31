import React from 'react';

export const StudentCasesView: React.FC = () => {
  const student = {
    id: 'STU-001',
    name: 'John Doe',
    email: 'student.test@mindpulse.edu',
    score: 68,
    condition: 'Exam stress & burnout recovery',
    status: 'Watch',
  };

  return (
    <div className="doctor-view-panel" style={{ padding: '32px' }}>
      <div className="doctor-view-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Student Cases</h2>
        <button type="button" className="schedule-btn">Filter Cases</button>
      </div>

      <div className="case-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="consult-item-row">
          <div className="consult-item-main">
            <div className="consult-item-left">
              <div className="consult-avatar">JD</div>
              <div className="consult-info">
                <div className="consult-patient-name">{student.name}</div>
                <div className="consult-student-id">{student.id} · {student.email}</div>
                <div className="consult-time-str">{student.condition}</div>
              </div>
            </div>
            <div className="consult-item-right">
              <span className="status-pill-blue">Stress Score: {student.score}/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
