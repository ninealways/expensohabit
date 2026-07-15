function renderHabitsMockPage() {
  const habits = activeStartedHabits();
  const dates = weekDates();
  const weeklyHabits = activeHabits().filter(habit => habitDatesInRange(habit, dates).length);
  const scoringWeekDates = habitScoringDates(dates);
  const dayLabels = dates.map(date => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'short' }));
  const completed = habits.filter(habit => habitCompleted(habit)).length;
  const weeklyChecks = weeklyHabits.reduce((sum, habit) => sum + habitDatesInRange(habit, scoringWeekDates).length, 0);
  const weeklyCompleted = weeklyHabits.reduce((sum, habit) => sum + habitDatesInRange(habit, scoringWeekDates).filter(date => habitCompleted(habit, date)).length, 0);
  const streakRows = habits.map(habit => ({ habit, streak:habitStreak(habit) })).sort((a, b) => b.streak - a.streak);
  const best = streakRows[0];
  const sleep = weeklyHabits.find(habit => habit.name.toLowerCase().includes('sleep'));
  const sleepLogs = sleep ? habitDatesInRange(sleep, dates).map(date => habitLog(sleep.id, date)).filter(Boolean) : [];
  const sleepAverage = sleepLogs.length ? sleepLogs.reduce((sum, log) => sum + Number(log.value || 0), 0) / sleepLogs.length : 0;
  const weakest = weeklyHabits.map(habit => { const validDates = habitDatesInRange(habit, scoringWeekDates); return { habit, total:validDates.length, done:validDates.filter(date => habitCompleted(habit, date)).length }; }).filter(row => row.total).sort((a, b) => (a.done / a.total) - (b.done / b.total))[0];
  return `<section class="habits-shell">
    <article class="panel habits-hero">
      <div>
        <p class="panel-kicker">DAILY ROUTINES</p>
        <h3>Habit tracker</h3>
        <p class="subtitle">Build consistency across health, learning, sleep, and personal goals.</p>
      </div>
      <div class="habit-hero-actions">
        <button class="primary-button" data-action="open-habit-checkin" type="button">✓ Check in</button>
        <button class="ghost-button" data-page="habitInsights" type="button">View insights</button>
        <button class="ghost-button" data-page="habitCheckins" type="button">History</button>
        <button class="ghost-button" data-page="habitManage" type="button">Manage</button>
        <button class="primary-button" data-action="open-habit-modal" type="button">＋ Add habit</button>
      </div>
    </article>
    <section class="habit-summary-grid">
      <article class="habit-summary-card featured"><span class="map-icon purple-bg">${svgIcon('habit')}</span><p>Today completion</p><strong>${completed}/${habits.length}</strong><small>${habits.length ? Math.round(completed / habits.length * 100) : 0}% done today</small></article>
      <article class="habit-summary-card"><span class="map-icon amber-bg">${svgIcon('flame')}</span><p>Best streak</p><strong>${best?.streak || 0} days</strong><small>${best?.habit.name || 'No habits yet'}</small></article>
      <article class="habit-summary-card"><span class="map-icon teal-bg">${svgIcon('walk')}</span><p>Weekly rate</p><strong>${weeklyChecks ? Math.round(weeklyCompleted / weeklyChecks * 100) : 0}%</strong><small>${weeklyCompleted} of ${weeklyChecks} checks</small></article>
      <article class="habit-summary-card"><span class="map-icon blue-bg">${svgIcon('moon')}</span><p>Sleep avg</p><strong>${sleepAverage ? sleepAverage.toFixed(1) : '—'} hrs</strong><small>Last 7 days</small></article>
    </section>
    <section class="habits-grid">
      <article class="panel todays-habits-panel">
        <div class="panel-heading"><div><p class="panel-kicker">TODAY</p><h3>Daily check-in</h3></div><button class="mini-button" data-action="open-habit-checkin" type="button">Check in all</button></div>
        <div class="habit-check-list">${habits.map(habit => { const log = habitLog(habit.id); const done = habitCompleted(habit); return `<div class="habit-check ${done ? 'done' : ''}"><span class="map-icon ${habit.color}">${svgIcon(habit.icon)}</span><div><b>${esc(habit.name)}</b><small>${habitValueText(habit, log)} · Goal ${habitTargetText(habit)}</small>${log?.note ? `<em>${esc(log.note)}</em>` : ''}</div><div class="habit-actions"><button class="habit-toggle" data-action="toggle-habit" data-id="${habit.id}" type="button">${done ? 'Done' : 'Mark'}</button><button class="mini-button" data-action="open-habit-checkin" data-date="${today()}" data-id="${habit.id}" type="button">Update</button></div></div>`; }).join('') || '<p class="empty-state">Add your first habit to start tracking.</p>'}</div>
      </article>
      <article class="panel habit-week-panel">
        <div class="panel-heading"><div><p class="panel-kicker">THIS WEEK</p><h3>Consistency grid</h3></div></div>
        <div class="habit-grid-head"><span></span>${dayLabels.map(day => `<b>${day}</b>`).join('')}</div>
        ${weeklyHabits.map(habit => `<div class="habit-grid-row"><b>${habit.name}</b>${dates.map(date => `<span title="${habit.name} ${date}" class="${!habitIsStarted(habit, date) ? 'muted' : habitCompleted(habit, date) ? 'filled' : ''}"></span>`).join('')}</div>`).join('') || '<p class="empty-state">Weekly grid will show after habits are added.</p>'}
      </article>
    </section>
    <section class="habits-grid secondary">
      <article class="panel habit-card-panel">
        <div class="panel-heading"><div><p class="panel-kicker">ACTIVE HABITS</p><h3>Habit cards</h3></div></div>
        <div class="habit-card-list">${streakRows.map(({ habit, streak }) => { const milestone = habitMilestoneProgress(habit); return `<div class="habit-mini-card milestone"><span class="map-icon ${habit.color}">${svgIcon(habit.icon)}</span><div><b>${habit.name}</b><small>${habitTargetText(habit)} daily · since ${habitStartDate(habit)}</small><i><em style="width:${milestone.pct}%"></em></i><small>Milestone: ${milestone.label}</small></div><strong>${streak}d</strong></div>`; }).join('') || '<p class="empty-state">No active habits yet.</p>'}</div>
      </article>
      <article class="panel habit-insight-panel">
        <div class="panel-heading"><div><p class="panel-kicker">HABIT INSIGHTS</p><h3>Patterns</h3></div></div>
        <div class="habit-insight-list">
          <div><b>Strongest routine</b><span>${best ? `${best.habit.name} has the best current streak at ${best.streak} days.` : 'Add habits to see strongest routines.'}</span></div>
          <div><b>Needs attention</b><span>${weakest ? `${weakest.habit.name} has ${weakest.done}/${weakest.total} eligible checks this week.` : 'Missed patterns will appear here.'}</span></div>
          <div><b>Sleep trend</b><span>${sleep ? (sleepAverage ? `Sleep average is ${sleepAverage.toFixed(1)} ${sleep.unit || 'hrs'} this week.` : 'Log sleep values to see the weekly average.') : 'Add a sleep habit to track sleep trend.'}</span></div>
        </div>
      </article>
    </section>
  </section>`;
}

function averageClock(values, bedtime = false) {
  const minutes = values.map(timeToMinutes).filter(value => value !== null).map(value => bedtime && value < 720 ? value + 1440 : value);
  if (!minutes.length) return '';
  const avg = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) % 1440;
  return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
}
function sleepRangeStart(range) {
  const now = new Date();
  if (range === 'daily') return dateKey(addDays(now, -6));
  if (range === 'weekly') return dateKey(addDays(now, -55));
  if (range === 'monthly') return dateKey(addDays(now, -29));
  if (range === 'yearly') return monthInputKey(addMonthsToDate(now, -11));
  return '';
}
function sleepBucketKey(log, range) {
  if (range === 'weekly') {
    const date = new Date(`${log.date}T00:00:00`);
    const weekStart = weekDates(date)[0];
    return weekStart;
  }
  if (range === 'yearly' || (range === 'all' && sleepRangeLogCount() > 60)) return log.date.slice(0, 7);
  return log.date;
}
function sleepRangeLogCount() {
  const sleepHabit = (data.habits || []).find(habit => isSleepHabit(habit));
  return sleepHabit ? (data.habitLogs || []).filter(log => log.habitId === sleepHabit.id && Number(log.value || 0) > 0).length : 0;
}
function sleepBucketLabel(key, range) {
  if (key.length === 7) return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short', year:'2-digit' });
  if (range === 'weekly') return new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
}
function sleepTrendRows(sleepHabit, range) {
  if (!sleepHabit) return [];
  const rawLogs = (data.habitLogs || []).filter(log => log.habitId === sleepHabit.id && Number(log.value || 0) > 0 && habitDayClosed(log.date)).sort((a, b) => a.date.localeCompare(b.date));
  const start = sleepRangeStart(range);
  const scoped = start ? rawLogs.filter(log => (range === 'yearly' ? log.date.slice(0, 7) >= start : log.date >= start)) : rawLogs;
  const groups = scoped.reduce((acc, log) => {
    const key = sleepBucketKey(log, range);
    acc[key] = acc[key] || [];
    acc[key].push(log);
    return acc;
  }, {});
  return Object.entries(groups).map(([key, logs]) => {
    const avg = logs.reduce((sum, log) => sum + Number(log.value || 0), 0) / logs.length;
    const startTime = averageClock(logs.map(log => log.sleepStart), true);
    const endTime = averageClock(logs.map(log => log.sleepEnd), false);
    return { key, label:sleepBucketLabel(key, range), value:avg, count:logs.length, startTime, endTime, latest:logs[logs.length - 1] };
  }).sort((a, b) => a.key.localeCompare(b.key));
}
function renderSleepTrendChart(rows, target = 7.5) {
  if (!rows.length) return '<p class="empty-state">Log sleep from and wake-up time to see the sleep cycle graph.</p>';
  const width = 640;
  const height = 250;
  const left = 54;
  const right = 18;
  const top = 20;
  const bottom = 46;
  const values = rows.map(row => row.value);
  const min = Math.max(0, Math.min(6, Math.floor(Math.min(...values, target) - .5)));
  const max = Math.max(9, Math.ceil(Math.max(...values, target) + .5));
  const x = index => left + (rows.length === 1 ? (width - left - right) / 2 : index * ((width - left - right) / (rows.length - 1)));
  const y = value => top + (max - value) / (max - min) * (height - top - bottom);
  const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row.value).toFixed(1)}`).join(' ');
  const area = `${left},${height - bottom} ${points} ${x(rows.length - 1).toFixed(1)},${height - bottom}`;
  const targetY = y(target);
  const grid = [min, min + (max - min) * .33, min + (max - min) * .66, max].map(value => `<g><line x1="${left}" x2="${width - right}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}" /><text x="6" y="${(y(value) + 4).toFixed(1)}">${value.toFixed(value % 1 ? 1 : 0)}h</text></g>`).join('');
  return `<div class="sleep-chart-wrap"><svg class="sleep-cycle-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Time in bed sleep trend">${grid}<line class="sleep-target-line" x1="${left}" x2="${width - right}" y1="${targetY.toFixed(1)}" y2="${targetY.toFixed(1)}" /><polygon class="sleep-area" points="${area}" /><polyline class="sleep-line" points="${points}" />${rows.map((row, index) => `<g class="sleep-point"><circle cx="${x(index).toFixed(1)}" cy="${y(row.value).toFixed(1)}" r="4"><title>${row.label}: ${formatSleepDuration(row.value)} · ${row.startTime && row.endTime ? `${formatClock(row.startTime)} → ${formatClock(row.endTime)}` : 'No time range'}</title></circle>${index % Math.ceil(rows.length / 6 || 1) === 0 || index === rows.length - 1 ? `<text x="${x(index).toFixed(1)}" y="${height - 18}" text-anchor="middle">${row.label}</text>` : ''}</g>`).join('')}</svg></div>`;
}
function renderSleepTrend(sleepHabit, range = habitSleepRange) {
  if (!sleepHabit) return '<p class="empty-state">Add a Sleep habit to track sleep windows and total hours.</p>';
  const target = Number(sleepHabit.target || 7.5);
  const rows = sleepTrendRows(sleepHabit, range);
  const avg = rows.length ? rows.reduce((sum, row) => sum + row.value, 0) / rows.length : 0;
  const variance = rows.length ? rows.reduce((sum, row) => sum + Math.abs(row.value - avg), 0) / rows.length : 0;
  const avgStart = averageClock(rows.map(row => row.startTime).filter(Boolean), true);
  const avgEnd = averageClock(rows.map(row => row.endTime).filter(Boolean), false);
  const latest = rows[rows.length - 1];
  const trend = rows.length > 1 ? latest.value - rows[0].value : 0;
  const feedback = !rows.length ? 'Start logging sleep from and wake-up times to build a baseline.' : avg < target - .5 ? `Average is ${formatSleepDuration(avg)}, below your ${target}h target. Try moving bedtime earlier by 15–30 minutes.` : variance > .8 ? `Average is on track, but sleep length varies by about ${variance.toFixed(1)}h. A more consistent bedtime/wake-up window should help.` : `Sleep duration is stable. Keep the ${avgStart && avgEnd ? `${formatClock(avgStart)} → ${formatClock(avgEnd)}` : 'current'} window consistent.`;
  const ranges = [['daily','Daily'],['weekly','Weekly'],['monthly','Monthly'],['yearly','Yearly'],['all','All time']];
  return `<div class="sleep-trend-card"><div class="sleep-range-tabs">${ranges.map(([value, label]) => `<button class="${range === value ? 'active' : ''}" data-action="sleep-range" data-range="${value}" type="button">${label}</button>`).join('')}</div><div class="sleep-pattern-summary"><div><span>Average time in bed</span><b>${avg ? formatSleepDuration(avg) : '—'}</b></div><div><span>Sleep window</span><b>${avgStart && avgEnd ? `${formatClock(avgStart)} → ${formatClock(avgEnd)}` : 'Needs time logs'}</b></div><div><span>Trend</span><b>${rows.length > 1 ? `${trend >= 0 ? '+' : '−'}${formatSleepDuration(Math.abs(trend))}` : '—'}</b></div></div>${renderSleepTrendChart(rows, target)}<div class="sleep-detail-strip">${latest ? `<span><b>Latest</b>${latest.label} · ${formatSleepDuration(latest.value)} · ${latest.startTime && latest.endTime ? `${formatClock(latest.startTime)} → ${formatClock(latest.endTime)}` : 'No time range'}</span>` : '<span><b>Latest</b>No sleep log yet</span>'}<span><b>Target</b>${target}h/night</span><span><b>Consistency</b>${variance ? `${variance.toFixed(1)}h avg variation` : '—'}</span></div><div class="sleep-feedback"><b>Improvement feedback</b><span>${feedback}</span></div></div>`;
}

function habitValueLabel(value, habit) {
  if (habit.goalType === 'checkbox') return `${Math.round(value)}%`;
  return `${Math.round(value).toLocaleString('en-IN')} ${esc(habit.unit || '')}`.trim();
}
function habitRecentRows(habit, days = 30) {
  const dates = habitScoringDates(Array.from({ length:days }, (_, index) => dateKey(addDays(new Date(), -(days - 1) + index)))).filter(date => habitIsStarted(habit, date));
  return dates.map(date => {
    const log = habitLog(habit.id, date);
    const value = habit.goalType === 'checkbox' ? (log?.completed ? 100 : 0) : Number(log?.value || 0);
    return { date, label:new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }), value, completed:habitCompleted(habit, date), hasLog:!!log };
  });
}
function habitCurrentLevel(habit, rows = habitRecentRows(habit)) {
  if (habit.goalType === 'checkbox') return rows.length ? rows.filter(row => row.completed).length / rows.length * 100 : 0;
  const logs = rows.filter(row => row.hasLog);
  return logs.length ? logs.reduce((sum, row) => sum + row.value, 0) / logs.length : 0;
}
function habitGrowthProgress(habit, current = habitCurrentLevel(habit)) {
  const growthTarget = Number(habit.growthTarget || 0);
  if (!growthTarget) return null;
  return Math.min(100, Math.round(current / growthTarget * 100));
}
function habitRampPlan(habit, current = habitCurrentLevel(habit)) {
  const growthTarget = Number(habit.growthTarget || 0);
  if (!growthTarget || habit.goalType === 'checkbox') return [];
  const base = Number(habit.target || 0);
  const step = Number(habit.growthStep || 0) || Math.max(1, (growthTarget - base) / 6);
  const start = Math.max(base, current || base);
  const steps = [];
  for (let target = Math.min(growthTarget, start + step), index = 1; target <= growthTarget && steps.length < 5; target += step, index += 1) {
    steps.push({ label:`Step ${index}`, value:Math.min(growthTarget, target) });
    if (target >= growthTarget) break;
  }
  return steps;
}
function habitGrowthFeedback(habit, current, monthRate) {
  const growthTarget = Number(habit.growthTarget || 0);
  if (!growthTarget || habit.goalType === 'checkbox') return monthRate >= 80 ? 'Consistency is strong. Consider defining a long-term growth target for the next level.' : 'Build consistency first, then add a growth target.';
  const progress = Math.round(current / growthTarget * 100);
  if (monthRate < 60) return `Stay at ${habitValueLabel(Number(habit.target || 0), habit)} until consistency improves. Do not increase yet.`;
  if (progress < 35) return `Good base. Next bump can be ${habitValueLabel((Number(habit.target || 0) + (Number(habit.growthStep || 0) || Math.max(1, growthTarget / 10))), habit)} after a steady week.`;
  if (progress < 75) return `You are progressing. Keep increasing in small steps toward ${habitValueLabel(growthTarget, habit)}.`;
  return `Close to long-term target. Focus on consistency at ${habitValueLabel(growthTarget, habit)}.`;
}
function renderHabitLineChart(habit, rows, currentTarget = habit.goalType === 'checkbox' ? 100 : Number(habit.target || 1), growthTarget = habit.goalType === 'checkbox' ? 0 : Number(habit.growthTarget || 0)) {
  if (!rows.length) return '<p class="empty-state">No check-ins yet for this habit.</p>';
  const width = 560, height = 210, left = 52, right = 22, top = 22, bottom = 44;
  const values = rows.map(row => row.value);
  const max = Math.max(1, Math.ceil(Math.max(...values, currentTarget, growthTarget || 0) * 1.12));
  const x = index => left + (rows.length === 1 ? (width - left - right) / 2 : index * ((width - left - right) / (rows.length - 1)));
  const y = value => top + (max - value) / max * (height - top - bottom);
  const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row.value).toFixed(1)}`).join(' ');
  const targetY = y(currentTarget);
  const growthY = growthTarget ? y(growthTarget) : null;
  const mid = Math.round(max / 2);
  const markerEvery = Math.max(1, Math.ceil(rows.length / 6));
  const pointLabels = rows.map((row, index) => {
    const showLabel = rows.length <= 7 || index % markerEvery === 0 || index === rows.length - 1;
    const cx = x(index);
    const cy = y(row.value);
    return `<g class="habit-trend-point"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4"><title>${row.label}: ${habitValueLabel(row.value, habit)}</title></circle>${showLabel ? `<text class="habit-value-label" x="${cx.toFixed(1)}" y="${Math.max(14, cy - 10).toFixed(1)}" text-anchor="middle">${habitValueLabel(row.value, habit)}</text><text x="${cx.toFixed(1)}" y="${height - 14}" text-anchor="middle">${row.label}</text>` : ''}</g>`;
  }).join('');
  return `<div class="habit-trend-chart-wrap"><svg class="habit-trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(habit.name)} trend"><line class="habit-grid-line" x1="${left}" x2="${width - right}" y1="${top}" y2="${top}" /><line class="habit-grid-line" x1="${left}" x2="${width - right}" y1="${y(mid).toFixed(1)}" y2="${y(mid).toFixed(1)}" /><line class="habit-grid-line" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}" /><text x="6" y="${top + 4}">${habitValueLabel(max, habit)}</text><text x="6" y="${y(mid).toFixed(1)}">${habitValueLabel(mid, habit)}</text><text x="6" y="${height - bottom + 4}">0</text><line class="habit-target-line" x1="${left}" x2="${width - right}" y1="${targetY.toFixed(1)}" y2="${targetY.toFixed(1)}" />${growthTarget ? `<line class="habit-growth-line" x1="${left}" x2="${width - right}" y1="${growthY.toFixed(1)}" y2="${growthY.toFixed(1)}" />` : ''}<polyline class="habit-trend-line" points="${points}" />${pointLabels}</svg><div class="habit-chart-legend"><span><i class="target-dot current"></i>Current target <b>${habitValueLabel(currentTarget, habit)}</b></span>${growthTarget ? `<span><i class="target-dot growth"></i>Growth target <b>${habitValueLabel(growthTarget, habit)}</b></span>` : ''}<span><i class="target-dot actual"></i>Latest <b>${habitValueLabel(rows[rows.length - 1].value, habit)}</b></span></div></div>`;
}
function renderCombinedGrowthGraph(rows) {
  const growthRows = rows.filter(row => row.habit.goalType !== 'checkbox' && Number(row.habit.growthTarget || 0));
  if (!growthRows.length) return '<p class="empty-state">Add growth targets to habits to see the combined growth map.</p>';
  return `<div class="habit-growth-map">${growthRows.map(row => { const current = habitCurrentLevel(row.habit); const progress = habitGrowthProgress(row.habit, current) || 0; return `<div class="habit-growth-bar"><div><b>${esc(row.habit.name)}</b><small>${habitValueLabel(current, row.habit)} now · ${habitValueLabel(row.habit.growthTarget, row.habit)} target</small></div><i><em style="width:${progress}%"></em></i><strong>${progress}%</strong></div>`; }).join('')}</div>`;
}
function renderHabitGrowthCard(row) {
  const habit = row.habit;
  const rows = habitRecentRows(habit);
  const current = habitCurrentLevel(habit, rows);
  const growthTarget = Number(habit.growthTarget || 0);
  const progress = habitGrowthProgress(habit, current);
  const ramp = habitRampPlan(habit, current);
  return `<article class="panel habit-growth-detail-card"><div class="panel-heading"><div><p class="panel-kicker">HABIT TREND</p><h3>${esc(habit.name)}</h3><p class="subtitle">${habitTargetText(habit)} current target${growthTarget ? ` · ${habitValueLabel(growthTarget, habit)} long-term` : ''}</p></div><button class="mini-button" data-action="open-habit-checkin" data-id="${habit.id}" type="button">Update</button></div><div class="sleep-pattern-summary"><div><span>Current level</span><b>${habitValueLabel(current, habit)}</b></div><div><span>Growth progress</span><b>${progress === null ? 'Not set' : `${progress}%`}</b></div><div><span>Consistency</span><b>${row.monthRate}%</b></div></div>${renderHabitLineChart(habit, rows)}<div class="sleep-feedback"><b>Recommendation</b><span>${habitGrowthFeedback(habit, current, row.monthRate)}</span></div>${ramp.length ? `<div class="habit-ramp-plan">${ramp.map(step => `<span><b>${step.label}</b>${habitValueLabel(step.value, habit)}</span>`).join('')}</div>` : ''}</article>`;
}

function renderHabitInsightsPage() {
  const habits = activeHabits();
  const allHabits = data.habits || [];
  const dates = weekDates();
  const monthDates = Array.from({ length:30 }, (_, index) => dateKey(addDays(new Date(), -29 + index)));
  const scoringWeekDates = habitScoringDates(dates);
  const scoringMonthDates = habitScoringDates(monthDates);
  const insightHabits = habits.filter(habit => habitDatesInRange(habit, scoringMonthDates).length);
  const rows = insightHabits.map(habit => {
    const validWeekDates = habitDatesInRange(habit, scoringWeekDates);
    const validMonthDates = habitDatesInRange(habit, scoringMonthDates);
    const weekDone = validWeekDates.filter(date => habitCompleted(habit, date)).length;
    const monthDone = validMonthDates.filter(date => habitCompleted(habit, date)).length;
    const streak = habitStreak(habit);
    const logs = validMonthDates.map(date => habitLog(habit.id, date)).filter(Boolean);
    const avg = logs.length && habit.goalType !== 'checkbox' ? logs.reduce((sum, log) => sum + Number(log.value || 0), 0) / logs.length : 0;
    const misses = validMonthDates.length - monthDone;
    const bestDay = validWeekDates.map(date => ({ date, done:habitCompleted(habit, date) })).filter(item => item.done).at(-1)?.date;
    const milestone = habitMilestoneProgress(habit);
    return { habit, weekDone, monthDone, misses, streak, avg, bestDay, milestone, validMonthCount:validMonthDates.length, weekRate:validWeekDates.length ? Math.round(weekDone / validWeekDates.length * 100) : 0, monthRate:validMonthDates.length ? Math.round(monthDone / validMonthDates.length * 100) : 0 };
  }).sort((a, b) => b.monthRate - a.monthRate);
  const dailyTotals = scoringMonthDates.map(date => { const eligible = habits.filter(habit => habitIsStarted(habit, date)); return { date, total:eligible.length, done:eligible.filter(habit => habitCompleted(habit, date)).length }; });
  const bestDay = dailyTotals.filter(day => day.total).slice().sort((a, b) => b.done - a.done)[0];
  const lowDays = dailyTotals.filter(day => day.total && day.done > 0 && day.done < Math.max(1, day.total / 2)).slice(-4);
  const noteLogs = (data.habitLogs || []).filter(log => { const habit = allHabits.find(item => item.id === log.habitId); return habit && log.note && scoringMonthDates.includes(log.date) && habitIsStarted(habit, log.date); }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const activeCount = activeStartedHabits().length;
  const inactiveCount = allHabits.filter(habit => habit.active === false).length;
  const sleepHabit = allHabits.find(habit => isSleepHabit(habit));
  const sleepLogs = sleepHabit ? scoringMonthDates.map(date => habitLog(sleepHabit.id, date)).filter(log => log && Number(log.value || 0) > 0) : [];
  const sleepAverage = sleepLogs.length ? sleepLogs.reduce((sum, log) => sum + Number(log.value || 0), 0) / sleepLogs.length : 0;
  const sleepTarget = Number(sleepHabit?.target || 7.5);
  const sleepTargetHits = sleepLogs.filter(log => Number(log.value || 0) >= sleepTarget).length;
  const latestSleep = sleepLogs.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  return `<section class="habits-shell">
    <article class="panel habits-hero">
      <div><p class="panel-kicker">HABIT INSIGHTS</p><h3>Routine report</h3><p class="subtitle">Patterns, streaks, and consistency for your habits.</p></div>
      <div class="habit-hero-actions"><button class="primary-button" data-action="open-habit-checkin" type="button">✓ Check in</button><button class="ghost-button" data-page="habitCheckins" type="button">History</button><button class="ghost-button" data-page="habits" type="button">Back to habits</button></div>
    </article>
    <section class="habit-summary-grid">
      <article class="habit-summary-card featured"><span class="map-icon purple-bg">${svgIcon('calendar')}</span><p>Best day this month</p><strong>${bestDay?.done || 0}/${bestDay?.total || activeCount}</strong><small>${bestDay ? new Date(`${bestDay.date}T00:00:00`).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : 'No check-ins yet'}</small></article>
      <article class="habit-summary-card"><span class="map-icon amber-bg">${svgIcon('bolt')}</span><p>Missed opportunities</p><strong>${rows.reduce((sum, row) => sum + row.misses, 0)}</strong><small>Unchecked closed habit-days</small></article>
      <article class="habit-summary-card"><span class="map-icon teal-bg">${svgIcon('heart')}</span><p>Active habits</p><strong>${activeCount}</strong><small>${inactiveCount} paused</small></article>
      <article class="habit-summary-card"><span class="map-icon blue-bg">${svgIcon('moon')}</span><p>Sleep average</p><strong>${sleepAverage ? sleepAverage.toFixed(1) : '—'} hrs</strong><small>${sleepLogs.length ? `${sleepTargetHits}/${sleepLogs.length} days met target` : 'No sleep logs yet'}</small></article>
    </section>
    <section class="habits-grid">
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">30-DAY CONSISTENCY</p><h3>Habit completion profile</h3></div></div>
        <div class="habit-breakdown-list">${rows.map(row => `<div class="habit-breakdown-item"><span class="map-icon ${row.habit.color}">${svgIcon(row.habit.icon)}</span><div><b>${esc(row.habit.name)}</b><small>${row.monthDone}/${row.validMonthCount} eligible days · ${row.misses} missed · current streak ${row.streak}d</small><i><em style="width:${row.monthRate}%"></em></i></div><strong>${row.monthRate}%</strong></div>`).join('') || '<p class="empty-state">Add habits to see completion breakdown.</p>'}</div>
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">THIS WEEK</p><h3>Habit heatmap</h3></div></div>
        <div class="habit-grid-head"><span></span>${dates.map(date => `<b>${new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'short' })}</b>`).join('')}</div>
        ${habits.filter(habit => habitDatesInRange(habit, dates).length).map(habit => `<div class="habit-grid-row"><b>${esc(habit.name)}</b>${dates.map(date => `<span class="${!habitIsStarted(habit, date) ? 'muted' : habitCompleted(habit, date) ? 'filled' : ''}" title="${esc(habit.name)}: ${date}"></span>`).join('')}</div>`).join('') || '<p class="empty-state">No habits yet.</p>'}
      </article>
    </section>
    <section class="habits-grid secondary">
      <article class="panel habit-growth-overview">
        <div class="panel-heading"><div><p class="panel-kicker">GROWTH TARGETS</p><h3>All habits growth map</h3><p class="subtitle">Current level compared with each long-term target.</p></div></div>
        ${renderCombinedGrowthGraph(rows)}
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">TARGET STRATEGY</p><h3>How to use targets</h3></div></div>
        <div class="habit-insight-list"><div><b>Daily target</b><span>The realistic value that counts as success today.</span></div><div><b>Milestone</b><span>Consistency or total-volume proof that the routine is becoming stable.</span></div><div><b>Growth target</b><span>The future level you are building toward without making today feel like failure.</span></div></div>
      </article>
    </section>
    <section class="habit-growth-grid">
      ${rows.map(renderHabitGrowthCard).join('') || '<p class="empty-state">Add habits to see individual growth charts.</p>'}
    </section>
    <section class="habits-grid secondary">
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">LOW-COMPLETION DAYS</p><h3>Where routines slipped</h3></div></div>
        <div class="habit-insight-list">${lowDays.map(day => `<div><b>${new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' })}</b><span>${day.done}/${day.total} eligible habits checked. Review what changed that day and add notes in check-in history.</span></div>`).join('') || '<p class="empty-state">No low-completion days with check-ins in the last 30 days.</p>'}</div>
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">NOTES</p><h3>Recent reflections</h3></div><button class="mini-button" data-page="habitCheckins" type="button">Edit history</button></div>
        <div class="habit-insight-list">${noteLogs.map(log => { const habit = data.habits.find(item => item.id === log.habitId); return `<div><b>${esc(habit?.name || 'Habit')} · ${log.date}</b><span>${esc(log.note)}</span></div>`; }).join('') || '<p class="empty-state">Daily notes will appear here after check-ins.</p>'}</div>
      </article>
    </section>
    <section class="habits-grid secondary">
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">MILESTONES</p><h3>Progress toward targets</h3></div></div>
        <div class="habit-breakdown-list">${rows.map(row => `<div class="habit-breakdown-item"><span class="map-icon ${row.habit.color}">${svgIcon(row.habit.icon)}</span><div><b>${esc(row.habit.name)}</b><small>${row.milestone.label} · starts ${habitStartDate(row.habit)}</small><i><em style="width:${row.milestone.pct}%"></em></i></div><strong>${row.milestone.pct}%</strong></div>`).join('') || '<p class="empty-state">Add milestones on habits to track progress.</p>'}</div>
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">VALUE HABITS</p><h3>Logged averages vs target</h3></div></div>
        <div class="habit-insight-list">${rows.filter(row => row.habit.goalType !== 'checkbox').map(row => `<div><b>${esc(row.habit.name)}</b><span>30-day average: ${row.avg ? row.avg.toFixed(row.avg >= 10 ? 0 : 1) : '—'} ${esc(row.habit.unit || '')}. Target: ${habitTargetText(row.habit)}.</span></div>`).join('') || '<p class="empty-state">Duration/count habits will show averages here.</p>'}</div>
      </article>
    </section>
    <section class="habits-grid secondary">
      <article class="panel sleep-pattern-panel">
        <div class="panel-heading"><div><p class="panel-kicker">SLEEP CYCLE</p><h3>Sleep pattern</h3></div><button class="mini-button" data-action="open-habit-checkin" data-id="${sleepHabit?.id || ''}" type="button">Log sleep</button></div>
        ${renderSleepTrend(sleepHabit)}
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">SLEEP NOTES</p><h3>What to watch</h3></div></div>
        <div class="habit-insight-list">${sleepHabit ? [`Target is ${sleepTarget} hrs. Keep bedtime and wake-up time consistent to stabilize the cycle.`, sleepAverage ? `Current 30-day average is ${sleepAverage.toFixed(1)} hrs across ${sleepLogs.length} logged nights.` : 'Log sleep from and wake-up time for a few days to establish a baseline.', latestSleep ? `Latest sleep: ${sleepLogText(latestSleep)} on ${latestSleep.date}.` : 'No latest sleep entry yet.'].map((text, index) => `<div><b>${['Target','Average','Latest'][index]}</b><span>${text}</span></div>`).join('') : '<p class="empty-state">Sleep analysis appears after adding a Sleep habit.</p>'}</div>
      </article>
    </section>
    <section class="habits-grid secondary">
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">ACTIONS</p><h3>Recommended follow-ups</h3></div></div>
        <div class="habit-insight-list">${rows.slice().sort((a,b) => a.monthRate - b.monthRate).slice(0, 3).map(row => `<div><b>${esc(row.habit.name)}</b><span>${row.monthRate < 50 ? 'Consider lowering the target or attaching this to an existing routine.' : row.monthRate < 80 ? 'This is close. Add a note on missed days to identify friction.' : 'Strong routine. Keep it active and watch for streak breaks.'}</span></div>`).join('') || '<p class="empty-state">Recommendations appear once habits have check-ins.</p>'}</div>
      </article>
    </section>
  </section>`;
}

function renderHabitManagePage() {
  const habits = (data.habits || []).slice().sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name));
  return `<section class="habits-shell">
    <article class="panel habits-hero">
      <div><p class="panel-kicker">HABIT ADMIN</p><h3>Manage habits</h3><p class="subtitle">Edit targets, pause tracking, or delete habits.</p></div>
      <div class="habit-hero-actions"><button class="ghost-button" data-page="habits" type="button">Back to habits</button><button class="primary-button" data-action="open-habit-modal" type="button">＋ Add habit</button></div>
    </article>
    <article class="panel">
      <div class="panel-heading"><div><p class="panel-kicker">ALL HABITS</p><h3>Habit settings</h3></div><span class="tag">${habits.length} total</span></div>
      <div class="habit-manage-list">${habits.map(habit => `<div class="habit-manage-card ${habit.active === false ? 'inactive' : ''}">
        <span class="map-icon ${habit.color}">${svgIcon(habit.icon)}</span>
        <div><b>${esc(habit.name)}</b><small>${habitTargetText(habit)} · starts ${habitStartDate(habit)} · ${habit.active === false ? 'Inactive' : 'Active'}</small>${habit.description ? `<p>${esc(habit.description)}</p>` : ''}</div>
        <div class="habit-actions"><button class="mini-button" data-action="edit-habit" data-id="${habit.id}" type="button">Edit</button><button class="mini-button" data-action="toggle-habit-active" data-id="${habit.id}" type="button">${habit.active === false ? 'Activate' : 'Pause'}</button><button class="mini-button warn" data-action="confirm-delete-habit" data-id="${habit.id}" type="button">Delete</button></div>
      </div>`).join('') || '<p class="empty-state">No habits yet.</p>'}</div>
    </article>
  </section>`;
}

function renderHabitCheckinsPage() {
  const logs = (data.habitLogs || []).slice().sort((a, b) => b.date.localeCompare(a.date) || a.habitId.localeCompare(b.habitId));
  const rows = logs.map(log => ({ log, habit:data.habits.find(habit => habit.id === log.habitId) })).filter(row => row.habit);
  return `<section class="habits-shell">
    <article class="panel habits-hero">
      <div><p class="panel-kicker">HABIT HISTORY</p><h3>Check-in log</h3><p class="subtitle">Edit previous values, completion status, and daily notes.</p></div>
      <div class="habit-hero-actions"><button class="primary-button" data-action="open-habit-checkin" type="button">✓ Add check-in</button><button class="ghost-button" data-page="habitInsights" type="button">Insights</button><button class="ghost-button" data-page="habits" type="button">Back to habits</button></div>
    </article>
    <article class="panel">
      <div class="panel-heading"><div><p class="panel-kicker">RECENT CHECK-INS</p><h3>History</h3></div><span class="tag">${rows.length} entries</span></div>
      <div class="table-scroll"><table class="outflow-table habit-history-table"><thead><tr><th>Date</th><th>Habit</th><th>Status</th><th>Value</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(({ log, habit }) => `<tr><td>${log.date}</td><td>${esc(habit.name)}</td><td>${log.completed ? 'Done' : 'Not done'}</td><td>${isSleepHabit(habit) ? sleepLogText(log) : habit.goalType === 'checkbox' ? '—' : `${Number(log.value || 0).toLocaleString('en-IN')} ${esc(habit.unit || '')}`}</td><td>${esc(log.note || '')}</td><td><button class="mini-button" data-action="open-habit-checkin" data-date="${log.date}" data-id="${habit.id}" type="button">Edit</button><button class="mini-button warn" data-action="delete-habit-log" data-id="${habit.id}" data-date="${log.date}" type="button">Delete</button></td></tr>`).join('') || '<tr><td colspan="6">No check-ins yet.</td></tr>'}</tbody></table></div>
    </article>
  </section>`;
}
