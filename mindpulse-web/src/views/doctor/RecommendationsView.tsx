import React from 'react';

export const RecommendationsView: React.FC = () => {
  return (
    <div className="doctor-view-panel" style={{ padding: '32px' }}>
      <div className="doctor-view-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Clinical Recommendations</h2>
        <button type="button" className="schedule-btn">+ Add Recommendation</button>
      </div>

      <div className="consultations-panel-card">
        <h3>Care Plan for John Doe (STU-001)</h3>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          Suggested 4-7-8 breathing exercises daily at 8:00 PM and limit screen time 1 hour before bed.
        </p>
      </div>
    </div>
  );
};
