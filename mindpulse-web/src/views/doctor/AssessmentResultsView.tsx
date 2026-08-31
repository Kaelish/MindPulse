import React from 'react';

export const AssessmentResultsView: React.FC = () => {
  return (
    <div className="doctor-view-panel" style={{ padding: '32px' }}>
      <div className="doctor-view-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Assessment Results</h2>
        <button type="button" className="schedule-btn">Export Data</button>
      </div>

      <div className="consultations-panel-card">
        <h3>Recent Student Stress Assessment</h3>
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginTop: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong>John Doe (STU-001)</strong>
            <span className="status-pill-blue">Score: 68/100 (High)</span>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            Biometric HR: 88 bpm · Emotion: Anxious · Reaction Time: 430ms · Face Confidence: 71%
          </p>
        </div>
      </div>
    </div>
  );
};
