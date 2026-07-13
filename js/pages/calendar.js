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
      const heat = meta.total ? Math.max(.08, Math.min(.5, meta.total / max * .5)) : 0;
      return `<button class="calendar-day ${isCurrentMonth ? '' : 'muted'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-calendar-date="${day}" style="--heat:${heat}">
        <span>${Number(day.slice(-2))}</span>
        <strong>${meta.total ? money(meta.total) : ''}</strong>
        <em>${meta.top ? esc(meta.top.subcategory || meta.top.category || meta.top.type) : ''}</em>
        <i>${meta.expense ? '<b class="expense-dot"></b>' : ''}${meta.loan ? '<b class="loan-dot"></b>' : ''}${meta.investment ? '<b class="investment-dot"></b>' : ''}</i>
      </button>`;
    }).join('')}</div>
    <div class="calendar-legend"><span><i class="expense-dot"></i>Expenses</span><span><i class="loan-dot"></i>Loans</span><span><i class="investment-dot"></i>Investments</span><small>Darker shade = higher outflow</small></div>
  </div>`;
}

function renderCalendarWeek(range, rows) {
  const byDate = rows.reduce((acc, item) => { acc[item.date] = acc[item.date] || []; acc[item.date].push(item); return acc; }, {});
  return `<div class="calendar-week-view">${range.days.map(day => {
    const items = byDate[day] || [];
    const meta = calendarDayMeta(items);
    const date = new Date(`${day}T00:00:00`);
    return `<button class="calendar-week-card ${day === calendarFilter.selectedDate ? 'selected' : ''}" data-calendar-date="${day}">
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
  return `<aside class="calendar-sidebar">
    <div class="panel calendar-summary-card"><p class="panel-kicker">SELECTED RANGE</p><h3>Summary</h3><div class="calendar-summary-list">
      <span><b>Total outflow</b><strong>${money(meta.total)}</strong></span>
      <span><b>Real expenses</b><strong>${money(meta.real)}</strong></span>
      <span><b>Loans</b><strong>${money(meta.loan)}</strong></span>
      <span><b>Investments</b><strong>${money(meta.investment)}</strong></span>
    </div><button class="primary-button" data-page="insights" type="button">View insights</button></div>
    <div class="panel calendar-summary-card"><p class="panel-kicker">DAY DETAIL</p><h3>${calendarFilter.selectedDate || today()}</h3><strong class="calendar-focus-total">${money(selectedMeta.total)}</strong>${selectedRows.length ? `<div class="calendar-day-list">${selectedRows.slice().sort((a,b) => b.amount - a.amount).map(item => `<div><span class="type-badge ${item.type}">${item.type}</span><b>${esc(item.subcategory || item.category)}</b><strong>${money(item.amount)}</strong></div>`).join('')}</div>` : '<p class="empty-state">No transactions for this day.</p>'}</div>
    <div class="panel calendar-summary-card"><p class="panel-kicker">HIGHEST DAY</p><h3>${highest?.date || 'No spend yet'}</h3><strong class="calendar-focus-total">${highest ? money(highest.total) : money(0)}</strong><small class="calendar-card-note">${highest ? `${highest.count} entries in selected range` : 'Add transactions to populate this card.'}</small></div>
    <div class="panel calendar-summary-card"><p class="panel-kicker">UPCOMING</p><h3>Scheduled</h3><div class="commitment-list">${scheduled.length ? scheduled.map(schedule => `<div class="commitment-item"><span class="upcoming-icon ${schedule.type === 'loan' ? 'amber-bg' : schedule.type === 'investment' ? 'teal-bg' : 'purple-bg'}">${svgIcon(schedule.type === 'loan' ? 'receipt' : schedule.type === 'investment' ? 'pie' : 'bag')}</span><div><b>${esc(schedule.subcategory || schedule.category)}</b><small>${scheduleWhen(schedule)}</small></div><strong>${money(schedule.amount)}</strong></div>`).join('') : '<p class="empty-state">No schedules configured.</p>'}</div></div>
  </aside>`;
}

function renderCalendarPage() {
  calendarFilter.month = calendarFilter.month || currentMonthKey();
  calendarFilter.selectedDate = calendarFilter.selectedDate || today();
  const range = calendarRange();
  const rows = calendarTransactions(range);
  const selectedDate = calendarFilter.selectedDate;
  const selectedRows = data.transactions.filter(item => item.date === selectedDate && (calendarFilter.type === 'all' || (calendarFilter.type === 'real' ? item.type === 'expense' && item.includeInReal !== false : item.type === calendarFilter.type)));
  return `<article class="calendar-shell">
    <section class="panel calendar-hero"><div><p class="panel-kicker">SPEND CALENDAR</p><h3>Calendar</h3><p class="subtitle">See daily outflow by month or week.</p></div><button class="primary-button" data-action="open-add">＋ Add transaction</button></section>
    ${renderCalendarFilterBar()}
    <section class="calendar-layout">
      <div>${calendarFilter.view === 'week' ? renderCalendarWeek(range, rows) : renderCalendarMonth(range, rows)}</div>
      ${renderCalendarSummary(rows, selectedRows)}
    </section>
  </article>`;
}
