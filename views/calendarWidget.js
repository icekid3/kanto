// views/calendarWidget.js — shared month-grid renderer used by both the
// host's availability manager and the read-only calendar on a listing page.
import { monthGrid, monthLabel, shiftMonth, todayISO } from '../lib/calendar.js';

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function renderCalendar({ year, month, monthsToShow = 2, statusMap = {}, legend = true }) {
  const today = todayISO();

  const months = [];
  for (let i = 0; i < monthsToShow; i++) {
    const { year: y, month: m } = shiftMonth(year, month, i);
    const weeks = monthGrid(y, m);
    months.push(`
      <div class="cal-month">
        <div class="cal-month-label">${monthLabel(y, m)}</div>
        <table class="cal-grid">
          <tr>${WEEKDAY_HEADERS.map((d) => `<th>${d}</th>`).join('')}</tr>
          ${weeks
            .map(
              (week) => `<tr>${week
                .map((cell) => {
                  if (!cell) return '<td class="cal-cell cal-empty"></td>';
                  const status = cell.date < today ? 'past' : statusMap[cell.date] || 'available';
                  return `<td class="cal-cell cal-${status}" title="${cell.date}">${cell.day}</td>`;
                })
                .join('')}</tr>`
            )
            .join('')}
        </table>
      </div>`);
  }

  const legendHtml = legend
    ? `<div class="cal-legend">
        <span><i class="cal-dot cal-available"></i> Available</span>
        <span><i class="cal-dot cal-booked"></i> Booked</span>
        <span><i class="cal-dot cal-blocked"></i> Blocked</span>
      </div>`
    : '';

  return `<div class="cal-months">${months.join('')}</div>${legendHtml}`;
}
