import React from 'react';
import {
  DOCTOR_TRASH_CATEGORIES,
  RecentlyDeletedPanel,
} from '../../components/RecentlyDeletedPanel';

/** Doctor portal "Recently Deleted" — same panel as the admin portal, doctor RLS scope. */
export const DoctorTrashView: React.FC = () => (
  <main className="main-panel">
    <header className="topbar">
      <div>
        <div className="eyebrow">Records</div>
        <h1>Recently Deleted</h1>
        <p className="page-subtitle">
          Nothing here has been erased. Restore a record to make it visible in its normal list again.
        </p>
      </div>
    </header>
    <RecentlyDeletedPanel categories={DOCTOR_TRASH_CATEGORIES} />
  </main>
);
