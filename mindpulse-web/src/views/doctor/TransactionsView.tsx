import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DoctorEmpty, DoctorError, DoctorLoading, DoctorNotifications, DoctorResultCount } from '../../components/doctor/DoctorChrome';
import {
  DoctorTransactionItem,
  PAYMENT_METHOD_LABELS,
  PayableAppointment,
  PaymentMethod,
  fetchDoctorTransactions,
  fetchPayableAppointments,
  formatTransactionAmount,
  formatTransactionDate,
  recordWalkInPayment,
} from '../../services/transactions';
import { fetchDoctorAvailability } from '../../services/consultations';
import './TransactionsView.css';

const METHOD_FILTERS = ['All Methods', 'Card', 'GCash', 'Maya', 'Cash'];
const STATUS_FILTERS = ['All Statuses', 'Paid', 'Refunded'];
/** Methods a doctor can record for a walk-in (Cash is the usual one). */
const WALK_IN_METHODS: PaymentMethod[] = ['cash', 'card', 'gcash', 'maya'];

export const TransactionsView: React.FC = () => {
  const [transactions, setTransactions] = useState<DoctorTransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('All Methods');
  const [status, setStatus] = useState('All Statuses');
  /** The clicked transaction — its receipt opens in a dialog. */
  const [receiptTx, setReceiptTx] = useState<DoctorTransactionItem | null>(null);

  // ── Walk-in payment dialog ──
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [payable, setPayable] = useState<PayableAppointment[]>([]);
  const [payableLoaded, setPayableLoaded] = useState(false);
  const [walkInAppointmentId, setWalkInAppointmentId] = useState('');
  const [walkInAmount, setWalkInAmount] = useState('');
  const [walkInMethod, setWalkInMethod] = useState<PaymentMethod>('cash');
  const [walkInSaving, setWalkInSaving] = useState(false);
  const [walkInError, setWalkInError] = useState('');
  const [walkInNotice, setWalkInNotice] = useState('');

  // Back button: Esc closes the receipt dialog.
  useEffect(() => {
    if (!receiptTx) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReceiptTx(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [receiptTx]);

  /** Load the payable bookings + the default amount the first time it opens. */
  const openWalkIn = useCallback(async () => {
    setWalkInError('');
    setWalkInNotice('');
    setWalkInOpen(true);
    if (!payableLoaded) {
      try {
        const [appointments, availability] = await Promise.all([
          fetchPayableAppointments(),
          fetchDoctorAvailability().catch(() => null),
        ]);
        setPayable(appointments);
        setPayableLoaded(true);
        setWalkInAppointmentId(appointments[0]?.id ?? '');
        if (availability && availability.fee) setWalkInAmount(String(availability.fee));
      } catch (error) {
        setWalkInError(
          error instanceof Error ? error.message : 'Unable to load your bookings.',
        );
      }
    }
  }, [payableLoaded]);

  const closeWalkIn = useCallback(() => {
    if (walkInSaving) return;
    setWalkInOpen(false);
    setWalkInError('');
  }, [walkInSaving]);

  // Esc closes the walk-in dialog too.
  useEffect(() => {
    if (!walkInOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeWalkIn();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [walkInOpen, closeWalkIn]);

  const submitWalkIn = useCallback(async () => {
    if (walkInSaving) return;
    const amount = Number.parseFloat(walkInAmount);
    if (!walkInAppointmentId) {
      setWalkInError('Choose the booking this payment is for.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setWalkInError('Enter the amount the patient paid.');
      return;
    }
    setWalkInSaving(true);
    setWalkInError('');
    try {
      await recordWalkInPayment(walkInAppointmentId, amount, walkInMethod);
      const target = payable.find((item) => item.id === walkInAppointmentId);
      setWalkInOpen(false);
      setWalkInAmount('');
      // The booking is now confirmed, so it is no longer payable — refetch next time.
      setPayableLoaded(false);
      setWalkInNotice(
        `Payment of ${formatTransactionAmount(amount)} recorded for ${
          target?.patientName ?? 'the patient'
        } — the booking is now confirmed.`,
      );
      setReloadKey((key) => key + 1);
    } catch (error) {
      setWalkInError(
        error instanceof Error ? error.message : 'Unable to record the payment.',
      );
    } finally {
      setWalkInSaving(false);
    }
  }, [walkInAmount, walkInAppointmentId, walkInMethod, payable, walkInSaving]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    fetchDoctorTransactions()
      .then((rows) => {
        if (active) setTransactions(rows);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load transactions.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesMethod = method === 'All Methods' || PAYMENT_METHOD_LABELS[transaction.method] === method;
      const matchesStatus =
        status === 'All Statuses' ||
        (status === 'Paid' && transaction.status === 'paid') ||
        (status === 'Refunded' && transaction.status === 'refunded');
      const matchesSearch = `${transaction.patientName} ${transaction.reference}`.toLowerCase().includes(query);
      return matchesMethod && matchesStatus && matchesSearch;
    });
  }, [transactions, method, status, search]);

  const totalEarned = transactions
    .filter((transaction) => transaction.status === 'paid')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const paidCount = transactions.filter((transaction) => transaction.status === 'paid').length;
  const refundedCount = transactions.length - paidCount;

  const exportCsv = () => {
    const header = ['Reference', 'Patient', 'Amount', 'Method', 'Status', 'Paid on', 'Session'];
    const rows = visibleTransactions.map((transaction) => [
      transaction.reference,
      transaction.patientName,
      transaction.amount.toFixed(2),
      PAYMENT_METHOD_LABELS[transaction.method],
      transaction.status === 'paid' ? 'Paid' : 'Refunded',
      formatTransactionDate(transaction.createdAt),
      transaction.scheduledFor ?? '',
    ]);
    const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'transactions.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return <main className="main-panel transactions-main">
    <header className="topbar transactions-topbar">
      <div>
        <h1>Transactions</h1>
        <p className="page-subtitle">Track consultation payments from your patients</p>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="ghost-button walk-in-button"
          onClick={openWalkIn}
          disabled={isLoading || !!loadError}
          title="Record a payment a patient made in person (walk-in booking)"
        >
          + Record walk-in payment
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={exportCsv}
          disabled={isLoading || !!loadError || visibleTransactions.length === 0}
          title={visibleTransactions.length === 0 ? 'There are no transactions to export yet' : undefined}
        >
          Export
        </button>
        <DoctorNotifications />
      </div>
    </header>

    {walkInNotice && (
      <p className="walk-in-notice" role="status">
        {walkInNotice}
      </p>
    )}

    <section className="assessment-summary-grid" aria-label="Transaction summary">
      <article className="assessment-summary-card green">
        <span>Total Earned</span>
        <strong>{formatTransactionAmount(totalEarned)}</strong>
        <small>From paid consultations</small>
      </article>
      <article className="assessment-summary-card neutral">
        <span>Transactions</span>
        <strong>{transactions.length}</strong>
        <small>All-time payment records</small>
      </article>
      <article className="assessment-summary-card green">
        <span>Paid</span>
        <strong>{paidCount}</strong>
        <small>Successfully collected</small>
      </article>
      <article className="assessment-summary-card red">
        <span>Refunded</span>
        <strong>{refundedCount}</strong>
        <small>Returned to patients</small>
      </article>
    </section>

    <section className="assessment-filter-bar">
      <label className="assessment-search">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search patient name or reference"
        />
      </label>
      <select value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Filter by payment method">
        {METHOD_FILTERS.map((option) => <option key={option}>{option}</option>)}
      </select>
      <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by payment status">
        {STATUS_FILTERS.map((option) => <option key={option}>{option}</option>)}
      </select>
      <DoctorResultCount shown={visibleTransactions.length} total={transactions.length} noun="transactions" />
    </section>

    <section className="assessment-list-panel">
      {isLoading && <DoctorLoading label="Loading transactions…" variant="skeleton" rows={4} />}
      {!isLoading && loadError && <DoctorError message={loadError} onRetry={retry} />}
      {!isLoading && !loadError && <>
        {visibleTransactions.length > 0 && <div className="assessment-list">{visibleTransactions.map((transaction) => {
          const isPaid = transaction.status === 'paid';
          const meta = [
            PAYMENT_METHOD_LABELS[transaction.method],
            formatTransactionDate(transaction.createdAt),
          ].filter(Boolean).join(' · ');
          return <article
            className="assessment-card is-clickable"
            key={transaction.id}
            role="button"
            tabIndex={0}
            aria-label={`View receipt for ${transaction.reference}, ${formatTransactionAmount(transaction.amount)}`}
            onClick={() => setReceiptTx(transaction)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setReceiptTx(transaction);
              }
            }}
          >
            <div className="assessment-card-header">
              <div className="assessment-student">
                <span className="account-avatar">
                        {transaction.avatarUrl
                          ? <img src={transaction.avatarUrl} alt="" className="avatar-img" />
                          : (transaction.patientName || 'Patient').trim().charAt(0).toUpperCase()}
                      </span>
                <div>
                  <span className="scan-label">{transaction.patientName}</span>
                  <strong>{transaction.reference}</strong>
                  <small>{meta}</small>
                  {transaction.scheduledFor && <small>Session: {transaction.scheduledFor}</small>}
                </div>
              </div>
              <div className="assessment-score">
                <strong>{formatTransactionAmount(transaction.amount)}</strong>
                <span className={`risk-badge ${isPaid ? 'low' : 'moderate'}`}>{isPaid ? 'Paid' : 'Refunded'}</span>
              </div>
            </div>
            <div className="receipt-hint">View receipt ›</div>
          </article>;
        })}</div>}
        {visibleTransactions.length === 0 && (transactions.length === 0
          ? <DoctorEmpty
              title="No transactions yet"
              description="Paid consultations show up here as soon as patients complete payment."
            />
          : <DoctorEmpty
              title="No transactions match your filters"
              description="Try another search term or reset the method and status filters."
              action={
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => { setSearch(''); setMethod('All Methods'); setStatus('All Statuses'); }}
                >
                  Clear filters
                </button>
              }
            />)}
      </>}
    </section>

    {/* ── Receipt dialog (click a transaction) ── */}
    {receiptTx && (
      <div
        className="tx-receipt-overlay"
        role="presentation"
        onClick={() => setReceiptTx(null)}
      >
        <div
          className="tx-receipt-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={`Payment receipt ${receiptTx.reference}`}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="tx-receipt-head">
            <button
              type="button"
              className="tx-receipt-back"
              aria-label="Back to transactions"
              onClick={() => setReceiptTx(null)}
            >
              ←
            </button>
            <h2>Payment Receipt</h2>
            <span className={`risk-badge ${receiptTx.status === 'paid' ? 'low' : 'moderate'}`}>
              {receiptTx.status === 'paid' ? 'Paid' : 'Refunded'}
            </span>
          </header>

          {/* The mode, stated loudly so an in-person payment can never be
              mistaken for an online one. */}
          {receiptTx.consultationMode === 'in_person' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                margin: '0 0 14px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1.5px dashed #E8C766',
                background: '#FFF3CD',
              }}
            >
              <strong
                style={{
                  fontSize: '1rem',
                  fontWeight: 900,
                  letterSpacing: '0.7px',
                  color: '#8A5A00',
                }}
              >
                FACE-TO-FACE SESSION
              </strong>
              <span style={{ fontSize: '0.82rem', color: '#8A5A00' }}>
                Held in person at the clinic — not an online video call.
              </span>
            </div>
          )}

          <div className="tx-receipt-amount">
            <span>{receiptTx.status === 'paid' ? 'AMOUNT PAID' : 'AMOUNT REFUNDED'}</span>
            <strong>{formatTransactionAmount(receiptTx.amount)}</strong>
          </div>

          <dl className="tx-receipt-rows">
            <div>
              <dt>Reference No.</dt>
              <dd>{receiptTx.reference}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatTransactionDate(receiptTx.createdAt)}</dd>
            </div>
            <div>
              <dt>Received from</dt>
              <dd>{receiptTx.patientName}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>
                {receiptTx.consultationMode === 'in_person'
                  ? 'Face-to-face consultation'
                  : 'Online consultation'}
              </dd>
            </div>
            {receiptTx.scheduledFor && (
              <div>
                <dt>Session</dt>
                <dd>{receiptTx.scheduledFor}</dd>
              </div>
            )}
            <div>
              <dt>Method</dt>
              <dd>{PAYMENT_METHOD_LABELS[receiptTx.method]}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{receiptTx.status === 'paid' ? 'Paid' : 'Refunded'}</dd>
            </div>
          </dl>

          <footer className="tx-receipt-foot">
            <p>MindPulse mock payment — no real charge was made.</p>
            <p>Computer-generated receipt · keep for your records.</p>
          </footer>

          <div className="tx-receipt-actions">
            <button type="button" className="ghost-button" onClick={() => setReceiptTx(null)}>
              Close
            </button>
            <button type="button" className="ghost-button" onClick={() => window.print()}>
              🖨 Print
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Walk-in payment dialog ── */}
    {walkInOpen && (
      <div
        className="tx-walkin-overlay"
        role="presentation"
        onClick={closeWalkIn}
      >
        <div
          className="tx-walkin-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Record walk-in payment"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="tx-walkin-head">
            <div>
              <h2>Record Walk-in Payment</h2>
              <p>
                For a patient who booked — and paid — in person. Recording it also
                confirms their booking.
              </p>
            </div>
            <button
              type="button"
              className="tx-receipt-back"
              aria-label="Close"
              onClick={closeWalkIn}
              disabled={walkInSaving}
            >
              ×
            </button>
          </header>

          {walkInError && (
            <p className="walk-in-error" role="alert">{walkInError}</p>
          )}

          {payable.length === 0 && !walkInError ? (
            <div className="walk-in-empty">
              <p>
                You have no bookings awaiting payment. Book the walk-in patient
                first from <strong>Consultations → + Schedule Consultation</strong>,
                then record their payment here.
              </p>
              <button
                type="button"
                className="ghost-button"
                onClick={closeWalkIn}
              >
                Close
              </button>
            </div>
          ) : (
            <div className="walk-in-form">
              <label className="walk-in-field">
                <span>Booking</span>
                <select
                  value={walkInAppointmentId}
                  onChange={(event) => setWalkInAppointmentId(event.target.value)}
                  disabled={walkInSaving}
                >
                  {payable.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.patientName} —{' '}
                      {item.scheduledTime ? formatTransactionDate(item.scheduledTime) : 'No date set'} ·{' '}
                      {item.rawStatus === 'awaiting_payment' ? 'Awaiting payment' : 'Scheduled'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="walk-in-field">
                <span>Amount received</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={walkInAmount}
                  placeholder="e.g. 1500"
                  onChange={(event) => setWalkInAmount(event.target.value)}
                  disabled={walkInSaving}
                  autoFocus
                />
              </label>

              <label className="walk-in-field">
                <span>Payment method</span>
                <select
                  value={walkInMethod}
                  onChange={(event) => setWalkInMethod(event.target.value as PaymentMethod)}
                  disabled={walkInSaving}
                >
                  {WALK_IN_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {PAYMENT_METHOD_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>

              <p className="walk-in-hint">
                A <strong>MP-WALKIN-…</strong> reference is generated automatically so
                manual records are always distinguishable from in-app payments.
              </p>

              <div className="tx-receipt-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={closeWalkIn}
                  disabled={walkInSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ghost-button walk-in-submit"
                  onClick={submitWalkIn}
                  disabled={walkInSaving}
                >
                  {walkInSaving ? 'Recording…' : 'Record payment & confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
  </main>;
};
