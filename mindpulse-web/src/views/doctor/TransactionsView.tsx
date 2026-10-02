import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DoctorEmpty, DoctorError, DoctorLoading, DoctorNotifications, DoctorResultCount } from '../../components/doctor/DoctorChrome';
import {
  DoctorTransactionItem,
  PAYMENT_METHOD_LABELS,
  fetchDoctorTransactions,
  formatTransactionAmount,
  formatTransactionDate,
} from '../../services/transactions';

const METHOD_FILTERS = ['All Methods', 'Card', 'GCash', 'Maya'];
const STATUS_FILTERS = ['All Statuses', 'Paid', 'Refunded'];

export const TransactionsView: React.FC = () => {
  const [transactions, setTransactions] = useState<DoctorTransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('All Methods');
  const [status, setStatus] = useState('All Statuses');

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
          return <article className="assessment-card" key={transaction.id}>
            <div className="assessment-card-header">
              <div className="assessment-student">
                <span className="account-avatar">{(transaction.patientName || 'Patient').trim().charAt(0).toUpperCase()}</span>
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
  </main>;
};
