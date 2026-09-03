import React, { useState } from 'react';

export const AssessmentResultsView: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState('Overview');
  return (
    <div className="doctor-view-panel" style={{ padding: '32px' }}>
      <div className="doctor-view-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Assessment Results</h2>
        <div className="header-actions"><button type="button" className="ghost-button">Export data</button><button type="button" className="schedule-btn">Open patient record</button></div>
      </div>

      <div className="consultations-panel-card">
        <div className="results-patient-header"><div><span className="eyebrow">Latest assessment · Mar 18, 2026</span><h3>John Doe <small>(STU-001)</small></h3></div><span className="status-pill-blue">68/100 · High stress</span></div>
        <div className="result-tabs">{['Overview', 'Biometrics', 'Signals'].map((metric) => <button key={metric} type="button" className={selectedMetric === metric ? 'result-tab active' : 'result-tab'} onClick={() => setSelectedMetric(metric)}>{metric}</button>)}</div>
        <div className="result-score-grid">
          <div className="result-score-hero"><span>Composite stress score</span><strong>68</strong><small>High · needs follow-up</small></div>
          <div className="result-metric"><span>Heart rate</span><strong>88 <small>bpm</small></strong><em>Elevated</em></div>
          <div className="result-metric"><span>Reaction time</span><strong>430 <small>ms</small></strong><em>Moderate load</em></div>
          <div className="result-metric"><span>Face confidence</span><strong>71 <small>%</small></strong><em>Needs review</em></div>
        </div>
        <div className="result-notes"><strong>{selectedMetric} notes</strong><p>Biometric HR: 88 bpm · Emotion: Anxious · Reaction Time: 430ms · Face Confidence: 71%</p>
          <label htmlFor="assessment-note">Clinical note</label><textarea id="assessment-note" defaultValue="Elevated heart rate and facial strain detected. Review breathing routine and schedule a follow-up." />
          <button type="button" className="primary-button">Save assessment note</button>
        </div>
      </div>
    </div>
  );
};
