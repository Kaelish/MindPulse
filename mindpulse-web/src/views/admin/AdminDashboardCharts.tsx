import React from 'react';
import { AdminActivityWeek, AppointmentStatusCount } from '../../services/admin';
import './AdminDashboardCharts.css';

export const AppointmentStatusDonut = ({ statuses }: { statuses: AppointmentStatusCount[] }) => {
  const total = statuses.reduce((sum, entry) => sum + entry.count, 0);
  const visible = statuses.filter((entry) => entry.count > 0);

  if (total === 0) {
    return <p className="admin-chart-empty">No appointments yet. Bookings will appear here.</p>;
  }

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="admin-donut-wrap">
      <svg className="admin-donut-svg" viewBox="0 0 140 140" role="img" aria-label="Appointments by status">
        <circle className="admin-donut-track" cx="70" cy="70" r={radius} fill="none" strokeWidth="16" />
        {visible.map((entry) => {
          const share = entry.count / total;
          const length = share * circumference;
          const segment = (
            <circle
              key={entry.status}
              className={`admin-donut-seg admin-donut-seg--${entry.status}`}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              strokeWidth="16"
              strokeLinecap="butt"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            >
              <title>{`${entry.label}: ${entry.count} (${Math.round(share * 100)}%)`}</title>
            </circle>
          );
          offset += length;
          return segment;
        })}
        <text x="70" y="66" textAnchor="middle" className="admin-donut-total">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" className="admin-donut-caption">
          appointments
        </text>
      </svg>
      <ul className="admin-donut-legend">
        {visible.map((entry) => (
          <li key={entry.status}>
            <i className={`admin-donut-dot admin-donut-dot--${entry.status}`} />
            <span>{entry.label}</span>
            <strong>{entry.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface ActivityChartProps {
  weeks: AdminActivityWeek[];
  /** Caption under the legend, e.g. "last 12 weeks". */
  rangeLabel?: string;
}

export const ActivityLineChart = ({ weeks, rangeLabel = 'last 12 weeks' }: ActivityChartProps) => {
  const width = 720;
  const height = 240;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 34;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const peak = Math.max(1, ...weeks.map((week) => Math.max(week.bookings, week.assessments)));
  const yMax = Math.max(4, Math.ceil(peak / 4) * 4);
  const stepX = weeks.length > 1 ? plotWidth / (weeks.length - 1) : plotWidth;
  const xOf = (index: number) => padLeft + index * stepX;
  const yOf = (value: number) => padTop + plotHeight - (value / yMax) * plotHeight;

  const bookingsTotal = weeks.reduce((sum, week) => sum + week.bookings, 0);
  const assessmentsTotal = weeks.reduce((sum, week) => sum + week.assessments, 0);

  const lineOf = (key: 'bookings' | 'assessments') =>
    weeks.map((week, index) => `${xOf(index).toFixed(1)},${yOf(week[key]).toFixed(1)}`).join(' ');

  const areaPath = [
    `M ${xOf(0).toFixed(1)} ${yOf(0).toFixed(1)}`,
    ...weeks.map((week, index) => `L ${xOf(index).toFixed(1)} ${yOf(week.bookings).toFixed(1)}`),
    `L ${xOf(weeks.length - 1).toFixed(1)} ${yOf(0).toFixed(1)}`,
    'Z',
  ].join(' ');

  const gridValues = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax];

  return (
    <div>
      <div className="admin-activity-legend">
        <span className="admin-activity-key admin-activity-key--bookings">
          <i /> Bookings <strong>{bookingsTotal}</strong>
        </span>
        <span className="admin-activity-key admin-activity-key--assessments">
          <i /> Assessments <strong>{assessmentsTotal}</strong>
        </span>
        <em>{rangeLabel}</em>
      </div>
      <svg
        className="admin-activity-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Bookings and assessments over the ${rangeLabel}. ${bookingsTotal} bookings and ${assessmentsTotal} assessments.`}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={yOf(value)}
              y2={yOf(value)}
              className="admin-activity-grid"
            />
            <text x={padLeft - 10} y={yOf(value) + 4} textAnchor="end" className="admin-activity-axis">
              {value}
            </text>
          </g>
        ))}
        <path d={areaPath} className="admin-activity-area" />
        <polyline points={lineOf('bookings')} className="admin-activity-line admin-activity-line--bookings" />
        <polyline points={lineOf('assessments')} className="admin-activity-line admin-activity-line--assessments" />
        {weeks.map((week, index) => (
          <g key={week.label}>
            {index % 2 === 0 && (
              <text x={xOf(index)} y={height - 12} textAnchor="middle" className="admin-activity-axis">
                {week.label}
              </text>
            )}
            <circle cx={xOf(index)} cy={yOf(week.bookings)} r={3.5} className="admin-activity-dot admin-activity-dot--bookings">
              <title>{`${week.label}: ${week.bookings} bookings, ${week.assessments} assessments`}</title>
            </circle>
            <circle
              cx={xOf(index)}
              cy={yOf(week.assessments)}
              r={3.5}
              className="admin-activity-dot admin-activity-dot--assessments"
            >
              <title>{`${week.label}: ${week.assessments} assessments, ${week.bookings} bookings`}</title>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
};
