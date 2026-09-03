import React, { useState } from 'react';

export const RecommendationsView: React.FC = () => {
  const [saved, setSaved] = useState(false);
  return (
    <div className="doctor-view-panel" style={{ padding: '32px' }}>
      <div className="doctor-view-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Clinical Recommendations</h2>
        <button type="button" className="schedule-btn" onClick={() => setSaved(false)}>+ Add recommendation</button>
      </div>

      <div className="consultations-panel-card">
        <div className="results-patient-header"><div><span className="eyebrow">Personalized care plan</span><h3>John Doe <small>(STU-001)</small></h3></div><span className="status-pill-green">Active plan</span></div>
        <div className="recommendation-layout"><div><h4>Current recommendations</h4><div className="recommendation-item"><span className="recommendation-icon">◒</span><div><strong>4-7-8 breathing</strong><p>Practice daily at 8:00 PM for five minutes.</p></div><span className="status-pill-green">Daily</span></div><div className="recommendation-item"><span className="recommendation-icon">◷</span><div><strong>Reduce evening screen time</strong><p>Stop screen use one hour before bedtime.</p></div><span className="status-pill-blue">Lifestyle</span></div></div><form className="recommendation-form" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}><h4>Add recommendation</h4><label htmlFor="recommendation-title">Recommendation</label><input id="recommendation-title" placeholder="e.g. Guided breathing" required /><label htmlFor="recommendation-detail">Instructions</label><textarea id="recommendation-detail" placeholder="Write practical guidance for the patient" required /><button type="submit" className="primary-button">Save recommendation</button>{saved && <span className="save-confirmation">Recommendation saved</span>}</form></div>
      </div>
    </div>
  );
};
