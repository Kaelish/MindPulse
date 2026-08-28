import { useState } from 'react';
import './App.css';

type OnboardingPage = 'analysis' | 'welcome';

const ModalityTiles = () => (
  <div className="modality-grid">
    <div className="modality-tile"><span className="tile-icon emotion">◉</span><span><strong>Emotion</strong><small>facial cues</small></span></div>
    <div className="modality-tile"><span className="tile-icon heart">♡</span><span><strong>Heart rate</strong><small>pulse data</small></span></div>
    <div className="modality-tile"><span className="tile-icon survey">♧</span><span><strong>Survey</strong><small>your answers</small></span></div>
    <div className="modality-tile"><span className="tile-icon reaction">◌</span><span><strong>Reaction</strong><small>response time</small></span></div>
  </div>
);

const Plant = () => <div className="plant"><i className="plant-stem" /><i className="plant-leaf leaf-a" /><i className="plant-leaf leaf-b" /><i className="plant-leaf leaf-c" /><i className="plant-leaf leaf-d" /></div>;
const Journal = () => <div className="journal"><i className="journal-page page-left" /><i className="journal-page page-right" /><i className="journal-spine" /><i className="journal-leaf" /></div>;
const Dots = ({ active }: { active: number }) => <div className="dots"><i className={active === 0 ? 'active' : ''} /><i className={active === 1 ? 'active' : ''} /><i /></div>;

function App() {
  const [page, setPage] = useState<OnboardingPage>('analysis');

  return (
    <main className={`prototype-stage ${page}`}>
      <section className="phone" aria-label="MindPulse mobile prototype">
        <div className="phone-screen">
          <div className="notch" />
          {page === 'analysis' ? (
            <div className="screen-content analysis-screen">
              <button className="skip" onClick={() => setPage('welcome')}>Skip</button>
              <Plant />
              <ModalityTiles />
              <h1>Multi-modal analysis,<br /><strong>built for precision.</strong></h1>
              <p>Fuses your survey, heart rate, facial cues, and<br />reaction time into one accurate stress score.</p>
              <Dots active={0} />
            </div>
          ) : (
            <div className="screen-content welcome-screen">
              <Journal />
              <h1>Your wellness story,<br /><strong>starts right here.</strong></h1>
              <p>Track trends, get recommendations, and<br />connect with professionals — all in one place.</p>
              <Dots active={1} />
              <button className="create-account" onClick={() => setPage('analysis')}>Create Account <span>›</span></button>
              <button className="sign-in" onClick={() => setPage('analysis')}>Already have an account? <strong>Sign in</strong></button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;