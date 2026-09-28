function calendarRange() {
  const month = calendarFilter.month || currentMonthKey();
  if (calendarFilter.view === 'week') {
    const anchor = calendarFilter.selectedDate || today();
    const days = weekDates(new Date(`${anchor}T00:00:00`));
    return { from:days[0], to:days[6], days, label:`${days[0]} to ${days[6]}` };
  }
  const end = new Date(`${month}-01T00:00:00`);
  const from = `${month}-01`;
  const to = dateKey(new Date(end.getFullYear(), end.getMonth() + 1, 0));
  return { from, to, label:month };
}

function calendarTransactions(range = calendarRange()) {
  return data.transactions.filter(transaction => {
    const inRange = transaction.date >= range.from && transaction.date <= range.to;
    if (!inRange) return false;
    if (calendarFilter.type === 'real') return transaction.type === 'expense' && transaction.includeInReal !== false;
    return calendarFilter.type === 'all' || transaction.type === calendarFilter.type;
  });
}

function calendarDayMeta(items) {
  const total = sumAmount(items);
  return {
    total,
    expense:sumAmount(items.filter(item => item.type === 'expense')),
    loan:sumAmount(items.filter(item => item.type === 'loan')),
    investment:sumAmount(items.filter(item => item.type === 'investment')),
    real:sumAmount(items.filter(item => item.type === 'expense' && item.includeInReal !== false)),
    count:items.length,
    top:items.slice().sort((a,b) => b.amount - a.amount)[0]
  };
}

function calendarRangeDays(range = calendarRange()) {
  if (Array.isArray(range.days)) return range.days;
  const start = new Date(`${range.from}T00:00:00`);
  const end = new Date(`${range.to}T00:00:00`);
  const days = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) days.push(dateKey(cursor));
  return days;
}

function calendarZeroSpendStats(rows, range = calendarRange()) {
  const byDate = rows.reduce((acc, item) => {
    acc[item.date] = acc[item.date] || [];
    acc[item.date].push(item);
    return acc;
  }, {});
  const todayKey = today();
  const eligibleDays = calendarRangeDays(range).filter(day => day <= todayKey);
  const zeroDays = eligibleDays.filter(day => calendarDayMeta(byDate[day] || []).total === 0);
  const percent = eligibleDays.length ? Math.round((zeroDays.length / eligibleDays.length) * 100) : 0;
  return { eligibleDays:eligibleDays.length, zeroDays:zeroDays.length, percent };
}

function calendarMonthDays(month) {
  const start = new Date(`${month}-01T00:00:00`);
  const mondayOffset = (start.getDay() + 6) % 7;
  const gridStart = addDays(start, -mondayOffset);
  return Array.from({ length:42 }, (_, index) => dateKey(addDays(gridStart, index)));
}

function renderCalendarFilterBar() {
  const typeButtons = [['all','All'],['expense','Expenses'],['loan','Loans'],['investment','Investments'],['real','Real expenses']];
  return `<div class="calendar-toolbar">
    <div class="schedule-tabs calendar-view-tabs">
      <button class="schedule-tab ${calendarFilter.view === 'month' ? 'active' : ''}" data-calendar-view="month" type="button">Month</button>
      <button class="schedule-tab ${calendarFilter.view === 'week' ? 'active' : ''}" data-calendar-view="week" type="button">Week</button>
    </div>
    <div class="calendar-period-control">
      <button class="mini-button" data-calendar-nav="previous" type="button">‹</button>
      <input id="calendarMonthInput" type="text" data-picker="month" value="${calendarFilter.month || currentMonthKey()}" />
      <button class="mini-button" data-calendar-nav="next" type="button">›</button>
    </div>
    <div class="calendar-type-pills">${typeButtons.map(([value, label]) => `<button class="${calendarFilter.type === value ? 'active' : ''}" data-calendar-type="${value}" type="button">${label}</button>`).join('')}</div>
  </div>`;
}

function renderCalendarMonth(range, rows) {
  const month = calendarFilter.month || currentMonthKey();
  const days = calendarMonthDays(month);
  const byDate = rows.reduce((acc, item) => { acc[item.date] = acc[item.date] || []; acc[item.date].push(item); return acc; }, {});
  const max = Math.max(...days.map(day => calendarDayMeta(byDate[day] || []).total), 1);
  return `<div class="calendar-card panel">
    <div class="calendar-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => `<span>${day}</span>`).join('')}</div>
    <div class="calendar-grid">${days.map(day => {
      const items = byDate[day] || [];
      const meta = calendarDayMeta(items);
      const isCurrentMonth = day.slice(0, 7) === month;
      const isToday = day === today();
      const isSelected = day === calendarFilter.selectedDate;
      const isZeroSpend = isCurrentMonth && day <= today() && meta.total === 0;
      const heat = meta.total ? Math.max(.08, Math.min(.5, meta.total / max * .5)) : 0;
      return `<button class="calendar-day ${isCurrentMonth ? '' : 'muted'} ${isZeroSpend ? 'zero-spend' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-calendar-date="${day}" style="--heat:${heat}">
        <span>${Number(day.slice(-2))}</span>
        <strong>${meta.total ? money(meta.total) : isZeroSpend ? '₹0' : ''}</strong>
        <em>${meta.top ? esc(meta.top.subcategory || meta.top.category || meta.top.type) : isZeroSpend ? 'No-spend day' : ''}</em>
        <i>${meta.expense ? '<b class="expense-dot"></b>' : ''}${meta.loan ? '<b class="loan-dot"></b>' : ''}${meta.investment ? '<b class="investment-dot"></b>' : ''}</i>
      </button>`;
    }).join('')}</div>
    <div class="calendar-legend"><span><i class="expense-dot"></i>Expenses</span><span><i class="loan-dot"></i>Loans</span><span><i class="investment-dot"></i>Investments</span><span><i class="zero-dot"></i>₹0 days</span><small>Darker shade = higher outflow</small></div>
  </div>`;
}

function renderCalendarWeek(range, rows) {
  const byDate = rows.reduce((acc, item) => { acc[item.date] = acc[item.date] || []; acc[item.date].push(item); return acc; }, {});
  return `<div class="calendar-week-view">${range.days.map(day => {
    const items = byDate[day] || [];
    const meta = calendarDayMeta(items);
    const date = new Date(`${day}T00:00:00`);
    const isZeroSpend = day <= today() && meta.total === 0;
    return `<button class="calendar-week-card ${isZeroSpend ? 'zero-spend' : ''} ${day === calendarFilter.selectedDate ? 'selected' : ''}" data-calendar-date="${day}">
      <small>${date.toLocaleDateString('en-IN', { weekday:'short' })}</small>
      <b>${date.getDate()}</b>
      <strong>${meta.total ? money(meta.total) : money(0)}</strong>
      <span>${meta.top ? `Top: ${esc(meta.top.category || meta.top.type)}` : 'No spend'}</span>
      <i>${meta.count} entries</i>
    </button>`;
  }).join('')}</div>`;
}

function renderCalendarSummary(rows, selectedRows) {
  const selectedMeta = calendarDayMeta(selectedRows);
  const highest = Object.entries(rows.reduce((acc, item) => { acc[item.date] = acc[item.date] || []; acc[item.date].push(item); return acc; }, {}))
    .map(([date, items]) => ({ date, ...calendarDayMeta(items) }))
    .sort((a,b) => b.total - a.total)[0];
  const scheduled = data.schedules.slice().sort((a,b) => (a.dueDay || 31) - (b.dueDay || 31)).slice(0, 4);
  const meta = calendarDayMeta(rows);
  const zeroStats = calendarZeroSpendStats(rows);
  return `<aside class="calendar-sidebar">
    <div class="panel calendar-summary-card"><p class="panel-kicker">SELECTED RANGE</p><h3>Summary</h3><div class="calendar-summary-list">
      <span><b>Total outflow</b><strong>${money(meta.total)}</strong></span>
      <span><b>Real expenses</b><strong>${money(meta.real)}</strong></span>
      <span><b>Loans</b><strong>${money(meta.loan)}</strong></span>
      <span><b>Investments</b><strong>${money(meta.investment)}</strong></span>
      <span class="zero-spend-summary"><b>₹0 days</b><strong>${zeroStats.zeroDays}/${zeroStats.eligibleDays}</strong><em>${zeroStats.percent}% achieved</em></span>
    </div><button class="primary-button" data-page="insights" type="button">View insights</button></div>
    <div class="panel calendar-summary-card"><p class="panel-kicker">DAY DETAIL</p><h3>${calendarFilter.selectedDate || today()}</h3><strong class="calendar-focus-total">${money(selectedMeta.total)}</strong>${selectedRows.length ? `<div class="calendar-day-list">${selectedRows.slice().sort((a,b) => b.amount - a.amount).map(item => `<div><span class="type-badge ${item.type}">${item.type}</span><b>${esc(item.subcategory || item.category)}</b><strong>${money(item.amount)}</strong></div>`).join('')}</div>` : '<p class="empty-state">No transactions for this day.</p>'}</div>
    <div class="panel calendar-summary-card"><p class="panel-kicker">HIGHEST DAY</p><h3>${highest?.date || 'No spend yet'}</h3><strong class="calendar-focus-total">${highest ? money(highest.total) : money(0)}</strong><small class="calendar-card-note">${highest ? `${highest.count} entries in selected range` : 'Add transactions to populate this card.'}</small></div>
    <div class="panel calendar-summary-card"><p class="panel-kicker">UPCOMING</p><h3>Scheduled</h3><div class="commitment-list">${scheduled.length ? scheduled.map(schedule => `<div class="commitment-item"><span class="upcoming-icon ${schedule.type === 'loan' ? 'amber-bg' : schedule.type === 'investment' ? 'teal-bg' : 'purple-bg'}">${svgIcon(schedule.type === 'loan' ? 'receipt' : schedule.type === 'investment' ? 'pie' : 'bag')}</span><div><b>${esc(schedule.subcategory || schedule.category)}</b><small>${scheduleWhen(schedule)}</small></div><strong>${money(schedule.amount)}</strong></div>`).join('') : '<p class="empty-state">No schedules configured.</p>'}</div></div>
  </aside>`;
}

function calendarComparisonTransactions(month) {
  const start = `${month}-01`;
  const endDate = new Date(`${month}-01T00:00:00`);
  const end = dateKey(new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0));
  return data.transactions.filter(transaction => {
    const inRange = transaction.date >= start && transaction.date <= end;
    if (!inRange) return false;
    if (calendarFilter.type === 'real') return transaction.type === 'expense' && transaction.includeInReal !== false;
    return calendarFilter.type === 'all' || transaction.type === calendarFilter.type;
  });
}

function calendarComparisonMonths() {
  const safeOffset = Math.max(0, Math.min(8, Number(calendarComparisonOffset) || 0));
  const baseDate = new Date(`${calendarFilter.month || currentMonthKey()}-01T00:00:00`);
  const endDate = addMonthsToDate(baseDate, -safeOffset);
  const months = Array.from({ length:4 }, (_, index) => {
    const date = addMonthsToDate(endDate, index - 3);
    const month = monthInputKey(date);
    const rows = calendarComparisonTransactions(month);
    const allRows = data.transactions.filter(transaction => transaction.date >= `${month}-01` && transaction.date <= dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)));
    const byDay = rows.reduce((acc, item) => {
      const day = Number(item.date.slice(-2));
      acc[day] = (acc[day] || 0) + Number(item.amount || 0);
      return acc;
    }, {});
    return {
      month,
      label:date.toLocaleDateString('en-IN', { month:'short' }),
      daysInMonth:new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      total:sumAmount(rows),
      realTotal:sumAmount(allRows.filter(item => item.type === 'expense' && item.includeInReal !== false)),
      loanTotal:sumAmount(allRows.filter(item => item.type === 'loan')),
      investmentTotal:sumAmount(allRows.filter(item => item.type === 'investment')),
      byDay
    };
  });
  return { safeOffset, months };
}

function calendarComparisonRangeLabel(months) {
  return `${months[0]?.label || ''} – ${months[months.length - 1]?.label || ''}`;
}

function renderCalendarSpendGraph(comparison = calendarComparisonMonths()) {
  const { safeOffset, months } = comparison;
  const width = 760;
  const height = 260;
  const pad = { top:24, right:28, bottom:34, left:62 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxSpend = Math.max(...months.flatMap(month => Array.from({ length:31 }, (_, index) => month.byDay[index + 1] || 0)), 1);
  const yTicks = [0, .25, .5, .75, 1].map(ratio => Math.round(maxSpend * ratio));
  const xTicks = [1, 3, 5, 7, 10, 13, 16, 19, 22, 25, 28, 31];
  const palette = ['#7857f4', '#35bfa9', '#ff9f37', '#3f64b7'];
  const x = day => pad.left + ((day - 1) / 30) * plotWidth;
  const y = value => pad.top + plotHeight - (value / maxSpend) * plotHeight;
  const linePath = month => Array.from({ length:31 }, (_, index) => {
    const day = index + 1;
    const value = day <= month.daysInMonth ? month.byDay[day] || 0 : null;
    if (value === null) return '';
    return `${index ? 'L' : 'M'} ${x(day).toFixed(1)} ${y(value).toFixed(1)}`;
  }).filter(Boolean).join(' ');
  return `<section class="panel calendar-spend-graph-card">
    <div class="calendar-comparison-head">
      <div><p class="panel-kicker">DAILY SPEND GRAPH</p><h3>Spend by day</h3><p class="subtitle">X-axis is day 1–31. Lines represent the shown months.</p></div>
      <div class="calendar-comparison-nav"><button type="button" data-calendar-comparison-nav="back" ${safeOffset >= 8 ? 'disabled' : ''}>←</button><span>${calendarComparisonRangeLabel(months)}</span><button type="button" data-calendar-comparison-nav="forward" ${safeOffset <= 0 ? 'disabled' : ''}>→</button></div>
    </div>
    <div class="calendar-graph-wrap">
      <svg class="calendar-spend-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily spends by month">
        ${xTicks.map(day => `<line class="x-grid" x1="${x(day).toFixed(1)}" y1="${pad.top}" x2="${x(day).toFixed(1)}" y2="${height - pad.bottom}"></line>`).join('')}
        ${yTicks.map(tick => `<g><line class="y-grid" x1="${pad.left}" y1="${y(tick).toFixed(1)}" x2="${width - pad.right}" y2="${y(tick).toFixed(1)}"></line><text x="${pad.left - 10}" y="${(y(tick) + 4).toFixed(1)}" text-anchor="end">${tick ? compactMoney(tick) : '0'}</text></g>`).join('')}
        ${xTicks.map(day => `<text class="x-label" x="${x(day).toFixed(1)}" y="${height - 8}" text-anchor="middle">${day}</text>`).join('')}
        ${months.map((month, index) => `<path class="spend-line" d="${linePath(month)}" style="--line:${palette[index]}"></path>${Array.from({ length:31 }, (_, pointIndex) => { const day = pointIndex + 1; const value = day <= month.daysInMonth ? month.byDay[day] || 0 : null; if (!value) return ''; const pointX = x(day); const pointY = y(value); const labelY = Math.max(14, pointY - 10); return `<g class="spend-point" tabindex="0" style="--line:${palette[index]}"><circle cx="${pointX.toFixed(1)}" cy="${pointY.toFixed(1)}" r="3.2"></circle><text class="point-label" x="${pointX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle">${money(value)}</text><title>${month.label} ${day}: ${money(value)}</title></g>`; }).join('')}`).join('')}
      </svg>
    </div>
    <div class="calendar-graph-legend">${months.map((month, index) => `<span><i style="background:${palette[index]}"></i>${month.label}<b>${money(month.total)}</b></span>`).join('')}</div>
  </section>`;
}

function renderCalendarDayComparison(comparison = calendarComparisonMonths()) {
  const { safeOffset, months } = comparison;
  const values = months.flatMap(month => Object.values(month.byDay));
  const highThreshold = values.length ? Math.max(...values) * .55 : 0;
  const maxMonthTotal = Math.max(...months.map(month => month.total), 0);
  const currentDay = Number(today().slice(-2));
  const monthToDateTotal = month => Array.from({ length:Math.min(currentDay, month.daysInMonth) }, (_, index) => month.byDay[index + 1] || 0).reduce((sum, value) => sum + value, 0);
  const monthToDateTotals = months.map(monthToDateTotal);
  const maxMonthToDateTotal = Math.max(...monthToDateTotals, 0);
  const summaryRows = [
    { label:'Real Expenses', key:'realTotal' },
    { label:'Loans', key:'loanTotal' },
    { label:'Investment', key:'investmentTotal' }
  ];
  const summaryRow = row => {
    const maxValue = Math.max(...months.map(month => month[row.key] || 0), 0);
    return `<tr class="calendar-comparison-total"><td>${row.label}</td>${months.map(month => `<td><span class="calendar-compare-pill ${(month[row.key] || 0) && month[row.key] === maxValue ? 'high' : ''}">${money(month[row.key] || 0)}</span></td>`).join('')}</tr>`;
  };
  const cell = (month, day) => {
    if (day > month.daysInMonth) return '<span class="calendar-compare-pill unavailable">—</span>';
    const amount = month.byDay[day] || 0;
    const cls = !amount ? 'zero' : amount >= highThreshold && highThreshold > 0 ? 'high' : '';
    return `<span class="calendar-compare-pill ${cls}">${amount ? money(amount) : '₹0'}</span>`;
  };
  return `<section class="panel calendar-comparison-card">
    <div class="calendar-comparison-head">
      <div><p class="panel-kicker">DAILY MONTH COMPARISON</p><h3>Day-wise spend</h3><p class="subtitle">Rows are dates. Columns are months. Values use the selected calendar type filter.</p></div>
      <div class="calendar-comparison-nav"><button type="button" data-calendar-comparison-nav="back" ${safeOffset >= 8 ? 'disabled' : ''}>←</button><span>${calendarComparisonRangeLabel(months)}</span><button type="button" data-calendar-comparison-nav="forward" ${safeOffset <= 0 ? 'disabled' : ''}>→</button></div>
    </div>
    <div class="calendar-comparison-legend"><span><i class="zero-dot"></i>₹0 day</span><span><i class="expense-dot"></i>Regular spend</span><span><i class="high-dot"></i>High spend day</span></div>
    <div class="calendar-comparison-scroll"><table class="calendar-comparison-table"><thead><tr><th>Date</th>${months.map(month => `<th>${month.label}</th>`).join('')}</tr></thead><tbody>
      <tr class="calendar-comparison-total"><td>Total</td>${months.map(month => `<td><span class="calendar-compare-pill ${month.total && month.total === maxMonthTotal ? 'high' : ''}">${money(month.total)}</span></td>`).join('')}</tr>
      ${summaryRows.map(summaryRow).join('')}
      <tr class="calendar-comparison-total"><td>Till ${String(currentDay).padStart(2, '0')}</td>${months.map((month, index) => `<td><span class="calendar-compare-pill ${monthToDateTotals[index] && monthToDateTotals[index] === maxMonthToDateTotal ? 'high' : ''}">${money(monthToDateTotals[index])}</span></td>`).join('')}</tr>
      ${Array.from({ length:31 }, (_, index) => index + 1).map(day => `<tr><td>${String(day).padStart(2, '0')}</td>${months.map(month => `<td>${cell(month, day)}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
  </section>`;
}

function renderCalendarPage() {
  calendarFilter.month = calendarFilter.month || currentMonthKey();
  calendarFilter.selectedDate = calendarFilter.selectedDate || today();
  const range = calendarRange();
  const rows = calendarTransactions(range);
  const selectedDate = calendarFilter.selectedDate;
  const selectedRows = data.transactions.filter(item => item.date === selectedDate && (calendarFilter.type === 'all' || (calendarFilter.type === 'real' ? item.type === 'expense' && item.includeInReal !== false : item.type === calendarFilter.type)));
  const comparison = calendarComparisonMonths();
  return `<article class="calendar-shell">
    <section class="panel calendar-hero"><div><p class="panel-kicker">SPEND CALENDAR</p><h3>Calendar</h3><p class="subtitle">See daily outflow by month or week.</p></div><div class="panel-actions"><button class="ghost-button" data-page="transactions">Back to transactions</button><button class="primary-button" data-action="open-add">＋ Add transaction</button></div></section>
    ${renderCalendarFilterBar()}
    <section class="calendar-layout">
      <div class="calendar-main-column">${calendarFilter.view === 'week' ? renderCalendarWeek(range, rows) : renderCalendarMonth(range, rows)}${renderCalendarSpendGraph(comparison)}</div>
      ${renderCalendarSummary(rows, selectedRows)}
    </section>
    ${renderCalendarDayComparison(comparison)}
  </article>`;
}
