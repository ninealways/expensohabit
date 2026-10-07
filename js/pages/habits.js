const habitDashboardPalette = ['#7549ef', '#f2a62f', '#20b99a', '#4f86ed', '#eb668c', '#8a6fd7'];

function habitDashboardIconName(habit = {}) {
  if (isSleepHabit(habit)) return 'habit-sleep';
  if (isReadingHabit(habit)) return 'habit-reading';
  const label = `${habit.name || ''} ${habit.icon || ''}`.toLowerCase();
  if (/walk|step|run/.test(label)) return 'habit-walking';
  if (/meditat|mind|brain|lotus/.test(label)) return 'habit-meditation';
  return 'habits';
}

function habitDashboardRows(habits, dates) {
  return habits.map((habit, index) => {
    const validDates = habitDatesInRange(habit, dates);
    const done = validDates.filter(date => habitCompleted(habit, date)).length;
    const logs = validDates.map(date => habitLog(habit.id, date)).filter(Boolean);
    const average = logs.length && habit.goalType !== 'checkbox' ? logs.reduce((sum, log) => sum + Number(log.value || 0), 0) / logs.length : 0;
    return { habit, validDates, done, missed:validDates.length - done, rate:validDates.length ? Math.round(done / validDates.length * 100) : 0, average, streak:habitStreak(habit), color:habitDashboardPalette[index % habitDashboardPalette.length] };
  });
}

function habitDashboardWeeklyBlocks(habits) {
  return Array.from({ length:4 }, (_, index) => {
    const anchor = addDays(new Date(), (index - 3) * 7);
    const dates = weekDates(anchor);
    const scoredDates = habitScoringDates(dates);
    const total = habits.reduce((sum, habit) => sum + habitDatesInRange(habit, scoredDates).length, 0);
    const done = habits.reduce((sum, habit) => sum + habitDatesInRange(habit, scoredDates).filter(date => habitCompleted(habit, date)).length, 0);
    const start = new Date(`${dates[0]}T00:00:00`);
    const end = new Date(`${dates[6]}T00:00:00`);
    return { rate:total ? Math.round(done / total * 100) : 0, done, total, label:`${start.getDate()}–${end.getDate()} ${end.toLocaleDateString('en-IN', { month:'short' })}` };
  });
}

function renderHabitDashboardSparkline(values, color = '#4f86ed') {
  if (!values.length) return '<span class="habit-dashboard-no-chart">No logs yet</span>';
  const width = 130, height = 54, pad = 5;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const x = index => pad + index * ((width - pad * 2) / Math.max(1, values.length - 1));
  const y = value => pad + (max - value) / (max - min) * (height - pad * 2);
  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  return `<svg class="habit-dashboard-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recent values"><polyline points="${points}" style="--habit-chart-color:${color}" />${values.map((value, index) => `<circle cx="${x(index).toFixed(1)}" cy="${y(value).toFixed(1)}" r="2" style="--habit-chart-color:${color}"><title>${value.toFixed(1)}</title></circle>`).join('')}</svg>`;
}

function renderHabitDashboardBars(values, color = '#7549ef', rangeLabel = 'selected period') {
  const max = Math.max(...values, 1);
  return `<div class="habit-dashboard-tiny-bars" role="img" aria-label="Activity values across ${esc(rangeLabel.toLowerCase())}">${values.map(value => `<i title="${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits:1 })}" style="height:${value ? Math.max(16, Math.round(Number(value) / max * 100)) : 7}%;--habit-chart-color:${color}"></i>`).join('')}</div>`;
}

function renderHabitDashboardConsistency(rows, dates) {
  if (!rows.length || !dates.length) return '<p class="empty-state">Check in for a few days to build the consistency view.</p>';
  const shortDate = date => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  return `<div class="habit-dashboard-consistency" role="img" aria-label="Daily completion status by habit for the last 30 days">
    <div class="habit-dashboard-consistency-axis"><span>Habit</span><div><span>${shortDate(dates[0])}</span><span>${shortDate(dates[dates.length - 1])}</span></div><span>Rate</span></div>
    ${rows.map(row => {
      const eligible = dates.filter(date => habitIsStarted(row.habit, date) && habitDayClosed(date));
      const completed = eligible.filter(date => habitCompleted(row.habit, date)).length;
      const rate = eligible.length ? Math.round(completed / eligible.length * 100) : 0;
      return `<div class="habit-dashboard-consistency-row" style="--habit-chart-color:${row.color}"><b title="${esc(row.habit.name)}">${esc(row.habit.name)}</b><div>${dates.map(date => { const state = !habitIsStarted(row.habit, date) ? 'inactive' : !habitDayClosed(date) ? 'pending' : habitCompleted(row.habit, date) ? 'completed' : 'missed'; return `<span class="${state}" title="${esc(row.habit.name)} · ${shortDate(date)} · ${state === 'completed' ? 'Completed' : state === 'missed' ? 'Missed' : state === 'pending' ? 'Not due yet' : 'Not started'}"></span>`; }).join('')}</div><strong>${rate}%</strong></div>`;
    }).join('')}
    <div class="habit-dashboard-consistency-legend"><span><i class="completed"></i>Completed</span><span><i class="missed"></i>Missed</span><span><i class="pending"></i>Not due yet</span></div>
  </div>`;
}

function renderHabitsPage() {
  const habits = activeStartedHabits();
  const habitColorById = new Map(habits.map((habit, index) => [habit.id, habitDashboardPalette[index % habitDashboardPalette.length]]));
  const week = weekDates();
  const scoringWeek = habitScoringDates(week);
  const monthDates = Array.from({ length:30 }, (_, index) => dateKey(addDays(new Date(), -29 + index)));
  const scoringMonth = habitScoringDates(monthDates);
  const completedToday = habits.filter(habit => habitCompleted(habit)).length;
  const todayRate = habits.length ? Math.round(completedToday / habits.length * 100) : 0;
  const weekTotal = habits.reduce((sum, habit) => sum + habitDatesInRange(habit, scoringWeek).length, 0);
  const weekDone = habits.reduce((sum, habit) => sum + habitDatesInRange(habit, scoringWeek).filter(date => habitCompleted(habit, date)).length, 0);
  const weekRate = weekTotal ? Math.round(weekDone / weekTotal * 100) : 0;
  const monthRows = habitDashboardRows(habits.filter(habit => habitDatesInRange(habit, scoringMonth).length), scoringMonth).map(row => ({ ...row, color:habitColorById.get(row.habit.id) })).sort((a, b) => b.rate - a.rate || b.streak - a.streak);
  const consistencyRows = habits.map(habit => ({ habit, color:habitColorById.get(habit.id) }));
  const consistencyEligible = habits.reduce((sum, habit) => sum + habitDatesInRange(habit, scoringMonth).length, 0);
  const consistencyCompleted = habits.reduce((sum, habit) => sum + habitDatesInRange(habit, scoringMonth).filter(date => habitCompleted(habit, date)).length, 0);
  const bestStreak = habits.map(habit => ({ habit, streak:habitStreak(habit) })).sort((a, b) => b.streak - a.streak)[0];
  const weakest = monthRows.slice().sort((a, b) => a.rate - b.rate || a.streak - b.streak)[0];
  const sleepHabit = habits.find(habit => isSleepHabit(habit));
  const sleepLogs = sleepHabit ? scoringMonth.map(date => habitLog(sleepHabit.id, date)).filter(log => log && Number(log.value || 0) > 0) : [];
  const sleepAverage = sleepLogs.length ? sleepLogs.reduce((sum, log) => sum + Number(log.value || 0), 0) / sleepLogs.length : 0;
  const sleepTarget = Number(sleepHabit?.target || 7.5);
  const sleepTargetHits = sleepLogs.filter(log => Number(log.value || 0) >= sleepTarget).length;
  const weeklyBlocks = habitDashboardWeeklyBlocks(habits);
  const readingHabits = habits.filter(habit => isReadingHabit(habit));
  const readingHabit = readingHabits[0];
  const currentMonth = currentMonthKey();
  const previousMonth = monthInputKey(addMonthsToDate(new Date(`${currentMonth}-01T00:00:00`), -1));
  const readingSummary = readingStatsForMonths(readingHabits, [previousMonth, currentMonth]);
  const readingMonth = readingSummary.months[currentMonth] || { started:[], completed:[] };
  const currentBook = readingHabit ? currentReadingTitle(readingHabit) : '';
  const latestBook = readingSummary.completedNotes[0];
  const allHabitLogs = (data.habitLogs || []).filter(log => log.date <= today());
  const activityHabits = habits.filter(habit => habit.goalType !== 'checkbox');
  const activityHabitIds = new Set(activityHabits.map(habit => habit.id));
  const eligibleActivityLogs = allHabitLogs.filter(log => activityHabitIds.has(log.habitId));
  const activityRangeLabels = { last7:'Last 7 days', last30:'Last 30 days', all:'All time' };
  const activityRangeDays = habitActivityRange === 'last30' ? 30 : habitActivityRange === 'all' ? null : 7;
  const firstActivityDate = eligibleActivityLogs.map(log => log.date).sort()[0] || today();
  const activityStart = activityRangeDays ? dateKey(addDays(new Date(`${today()}T00:00:00`), -(activityRangeDays - 1))) : firstActivityDate;
  const activitySpanDays = Math.max(1, Math.round((new Date(`${today()}T00:00:00`) - new Date(`${activityStart}T00:00:00`)) / 86400000) + 1);
  const activityBucketCount = habitActivityRange === 'last7' ? 7 : habitActivityRange === 'last30' ? 10 : Math.min(12, activitySpanDays);
  const activityBucketDays = Math.max(1, Math.ceil(activitySpanDays / activityBucketCount));
  const activityChartStart = dateKey(addDays(new Date(`${today()}T00:00:00`), -(activityBucketCount * activityBucketDays - 1)));
  const scopedActivityLogs = eligibleActivityLogs.filter(log => log.date >= activityStart);
  const activityRows = activityHabits.map((habit, index) => {
    const habitLogs = scopedActivityLogs.filter(log => log.habitId === habit.id);
    const values = Array.from({ length:activityBucketCount }, () => 0);
    habitLogs.forEach(log => {
      const offset = Math.floor((new Date(`${log.date}T00:00:00`) - new Date(`${activityChartStart}T00:00:00`)) / 86400000);
      const bucket = Math.min(activityBucketCount - 1, Math.max(0, Math.floor(offset / activityBucketDays)));
      values[bucket] += Number(log.value || 0);
    });
    const total = habitLogs.reduce((sum, log) => sum + Number(log.value || 0), 0);
    return { habit, total, values, color:habitColorById.get(habit.id) || habitDashboardPalette[index % habitDashboardPalette.length] };
  });
  const activityRangeLabel = activityRangeLabels[habitActivityRange] || activityRangeLabels.last7;
  const walkingHabit = habits.find(habit => habitDashboardIconName(habit) === 'habit-walking');
  const walkingPeak = walkingHabit ? Math.max(0, ...allHabitLogs.filter(log => log.habitId === walkingHabit.id).map(log => Number(log.value || 0))) : 0;
  const readingDays = readingHabit ? new Set(allHabitLogs.filter(log => log.habitId === readingHabit.id && habitCompleted(readingHabit, log.date)).map(log => log.date)).size : 0;
  const sleepTargetNights = sleepHabit ? new Set(allHabitLogs.filter(log => log.habitId === sleepHabit.id && Number(log.value || 0) >= sleepTarget).map(log => log.date)).size : 0;
  const compactAchievementValue = value => value >= 1000 ? `${Number((value / 1000).toFixed(value >= 10000 ? 0 : 1))}k` : `${Math.round(value)}`;
  const achievementRows = [
    bestStreak?.streak ? { tone:'purple', value:bestStreak.streak, title:`${bestStreak.streak}-day streak`, text:`${bestStreak.habit.name} · keep going!` } : null,
    walkingPeak ? { tone:'teal', value:compactAchievementValue(walkingPeak), title:'Walking peak', text:`${walkingPeak.toLocaleString('en-IN')} ${walkingHabit?.unit || 'steps'} in one day` } : null,
    readingDays ? { tone:'amber', value:readingDays, title:'Reading days', text:'Days with the reading target met' } : null,
    sleepTargetNights ? { tone:'blue', value:sleepTargetNights, title:'Sleep target nights', text:`At least ${sleepTarget} hours logged` } : null
  ].filter(Boolean);
  const noteLogs = (data.habitLogs || []).filter(log => log.note && monthDates.includes(log.date)).sort((a, b) => b.date.localeCompare(a.date));
  const latestNote = noteLogs[0];
  const latestNoteHabit = latestNote ? (data.habits || []).find(habit => habit.id === latestNote.habitId) : null;
  const dayLabels = week.map(date => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'short' }));
  const formatActivity = row => `${row.total.toLocaleString('en-IN', { maximumFractionDigits:1 })} ${esc(row.habit.unit || '')}`.trim();
  const insightRows = [
    { icon:'habit-streak', title:'Strongest routine', text:bestStreak ? `${bestStreak.habit.name} has the best current streak at ${bestStreak.streak} days.` : 'Add habits to start building streaks.' },
    { icon:'habit-weekly', title:'Needs attention', text:weakest ? (weakest.rate < 80 ? `${weakest.habit.name} completed ${weakest.done}/${weakest.validDates.length} eligible days in the last 30 days.` : 'Every active habit is above 80% completion this month.') : 'Completion patterns will appear after check-ins.' },
    latestNote ? { icon:'habit-patterns', title:'Recent reflection', text:`${latestNoteHabit?.name || 'Habit'} · ${latestNote.date}: ${latestNote.note}` } : { icon:'habit-sleep', title:'Sleep trend', text:sleepAverage ? `Sleep averages ${sleepAverage.toFixed(1)} hrs across ${sleepLogs.length} logged nights.` : 'Log sleep to see recovery patterns.' }
  ];
  return `<section class="habits-shell habit-dashboard">
    <article class="panel habits-hero habit-dashboard-hero">
      <div><p class="panel-kicker">DAILY ROUTINES</p><h3>Habit tracker</h3><p class="subtitle">Build consistency across health, learning, sleep, and personal goals.</p></div>
      <div class="habit-hero-actions"><button class="primary-button" data-action="open-habit-checkin" type="button">✓ Check in</button><button class="ghost-button" data-page="habitCheckins" type="button">History</button><button class="ghost-button" data-page="habitManage" type="button">Manage</button><button class="primary-button" data-action="open-habit-modal" type="button">＋ Add habit</button></div>
    </article>

    <section class="habit-dashboard-summary" aria-label="Habit summary">
      <article class="habit-dashboard-summary-card featured"><span class="habit-dashboard-summary-icon">${richIcon('habit-progress')}</span><div><p>Today’s progress</p><strong>${completedToday}/${habits.length}</strong><small>${todayRate}% completed</small><i><em style="width:${todayRate}%"></em></i></div></article>
      <article class="habit-dashboard-summary-card"><span class="habit-dashboard-summary-icon amber">${richIcon('habit-streak')}</span><div><p>Current streak</p><strong>${bestStreak?.streak || 0} days</strong><small>${esc(bestStreak?.habit.name || 'No habits yet')} · strongest routine</small></div><div class="habit-dashboard-streak-days">${week.map(date => `<span class="${bestStreak && habitCompleted(bestStreak.habit, date) ? 'done' : ''}"></span>`).join('')}</div></article>
      <article class="habit-dashboard-summary-card"><span class="habit-dashboard-summary-icon teal">${richIcon('habit-weekly')}</span><div><p>Weekly completion</p><strong>${weekRate}%</strong><small>${weekDone} of ${weekTotal} eligible checks</small></div><div class="habit-dashboard-mini-bars">${weeklyBlocks.map(block => `<span style="height:${Math.max(8, block.rate)}%" title="${block.label}: ${block.rate}%"></span>`).join('')}</div></article>
      <article class="habit-dashboard-summary-card"><span class="habit-dashboard-summary-icon blue">${richIcon('habit-sleep')}</span><div><p>Average sleep</p><strong>${sleepAverage ? sleepAverage.toFixed(1) : '—'} hrs</strong><small>${sleepLogs.length ? `${sleepTargetHits}/${sleepLogs.length} nights met target` : 'No sleep logs yet'}</small></div>${renderHabitDashboardSparkline(sleepLogs.slice(-14).map(log => Number(log.value || 0)), '#4f86ed')}</article>
    </section>

    <section class="habit-dashboard-primary-grid">
      <article class="panel habit-dashboard-checkin-panel"><div class="panel-heading"><div><p class="panel-kicker">TODAY · ${new Date().toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' })}</p><h3>Daily check-in</h3></div><button class="mini-button" data-action="open-habit-checkin" type="button">Check in all</button></div><div class="habit-dashboard-checkins">${habits.map(habit => { const log = habitLog(habit.id); const done = habitCompleted(habit); return `<div class="habit-dashboard-checkin ${done ? 'done' : ''}"><span class="habit-dashboard-habit-icon">${richIcon(habitDashboardIconName(habit))}</span><div><b>${esc(habit.name)}</b><small>${habitValueText(habit, log)} · Goal ${habitTargetText(habit)}</small></div><button class="habit-toggle" data-action="toggle-habit" data-id="${habit.id}" type="button">${done ? 'Done' : 'Mark'}</button><button class="habit-dashboard-more" data-action="open-habit-checkin" data-date="${today()}" data-id="${habit.id}" type="button" aria-label="Update ${esc(habit.name)}">•••</button></div>`; }).join('') || '<p class="empty-state">Add your first habit to start tracking.</p>'}</div></article>

      <article class="panel habit-dashboard-week-panel"><div class="panel-heading"><div><p class="panel-kicker">THIS WEEK</p><h3>Consistency grid</h3></div><span class="habit-dashboard-rate">${weekRate}%</span></div><div class="habit-dashboard-grid-head"><span></span>${dayLabels.map(day => `<b>${day}</b>`).join('')}</div>${habits.map(habit => `<div class="habit-dashboard-grid-row" style="--habit-chart-color:${habitColorById.get(habit.id)}"><b>${esc(habit.name)}</b>${week.map(date => { const state = !habitIsStarted(habit, date) ? 'muted' : habitCompleted(habit, date) ? 'filled' : !habitDayClosed(date) ? 'pending' : 'missed'; const label = state === 'filled' ? 'Completed' : state === 'missed' ? 'Missed' : state === 'pending' ? 'Open until 11:59 PM' : 'Not started'; return `<span title="${esc(habit.name)} · ${date} · ${label}" class="${state} ${date === today() ? 'today' : ''}"></span>`; }).join('')}</div>`).join('') || '<p class="empty-state">The weekly grid appears after you add habits.</p>'}</article>

      <article class="panel habit-dashboard-active-panel"><div class="panel-heading"><div><p class="panel-kicker">HABIT CARDS</p><h3>Active habits</h3></div><button class="mini-button" data-page="habitManage" type="button">Manage</button></div><div class="habit-dashboard-active-grid">${habits.map(habit => { const milestone = habitMilestoneProgress(habit); const streak = habitStreak(habit); return `<div class="habit-dashboard-active-card"><span class="habit-dashboard-habit-icon">${richIcon(habitDashboardIconName(habit))}</span><div><b>${esc(habit.name)}</b><small>${habitTargetText(habit)} daily</small></div><strong>${streak}d</strong><i><em style="width:${milestone.pct}%"></em></i><small>Milestone: ${milestone.label}</small></div>`; }).join('') || '<p class="empty-state">No active habits yet.</p>'}</div></article>
    </section>

    <section class="habit-dashboard-analytics-grid">
      <article class="panel habit-dashboard-trend-panel"><div class="panel-heading"><div><p class="panel-kicker">LAST 30 DAYS</p><h3>30-day consistency</h3></div><span class="tag">${consistencyCompleted}/${consistencyEligible} complete</span></div>${renderHabitDashboardConsistency(consistencyRows, monthDates)}</article>
      <article class="panel habit-dashboard-weekly-bars"><div class="panel-heading"><div><p class="panel-kicker">LAST 4 WEEKS</p><h3>Weekly completion</h3></div></div><div class="habit-dashboard-week-bars">${weeklyBlocks.map(block => `<div><strong>${block.rate}%</strong><i><em style="height:${Math.max(5, block.rate)}%"></em></i><small>${block.label}</small></div>`).join('')}</div></article>
      <article class="panel habit-dashboard-activity-panel"><div class="panel-heading"><div><p class="panel-kicker">ACTIVITY</p><h3>Time spent on habits</h3></div><div class="habit-dashboard-activity-range" role="group" aria-label="Time spent range">${[['last7','7 days'],['last30','30 days'],['all','All']].map(([value, label]) => `<button class="${habitActivityRange === value ? 'active' : ''}" data-action="habit-activity-range" data-range="${value}" type="button" aria-pressed="${habitActivityRange === value}">${label}</button>`).join('')}</div></div><div class="habit-dashboard-activity-grid">${activityRows.map(row => `<div><span class="habit-dashboard-habit-icon">${richIcon(habitDashboardIconName(row.habit))}</span><p><b>${esc(row.habit.name)}</b><strong>${formatActivity(row)}</strong></p>${renderHabitDashboardBars(row.values, row.color, activityRangeLabel)}</div>`).join('') || '<p class="empty-state">Value-based habits will appear here.</p>'}</div></article>
    </section>

    <section class="habit-dashboard-lower-grid">
      <article class="panel habit-dashboard-target-panel"><div class="panel-heading"><div><p class="panel-kicker">PROGRESS</p><h3>Toward daily targets</h3></div><button class="mini-button" data-page="habitManage" type="button">Edit</button></div><div class="habit-dashboard-target-list">${monthRows.map(row => { const target = Number(row.habit.target || 1); const progress = row.habit.goalType === 'checkbox' ? row.rate : Math.min(100, Math.round(row.average / target * 100)); return `<div><span class="habit-dashboard-habit-icon">${richIcon(habitDashboardIconName(row.habit))}</span><p><b>${esc(row.habit.name)}</b><small>${row.habit.goalType === 'checkbox' ? `${row.rate}% completed` : `${row.average ? row.average.toFixed(row.average >= 10 ? 0 : 1) : 0} ${esc(row.habit.unit || '')} avg · ${habitTargetText(row.habit)} target`}</small></p><i><em style="width:${progress}%"></em></i><strong>${progress}%</strong></div>`; }).join('') || '<p class="empty-state">Target progress appears after check-ins.</p>'}</div></article>

      <article class="panel habit-dashboard-patterns-panel"><div class="panel-heading"><div><p class="panel-kicker">PATTERNS</p><h3>Useful insights</h3></div></div><div class="habit-dashboard-pattern-list">${insightRows.map(row => `<div><span>${richIcon(row.icon)}</span><p><b>${esc(row.title)}</b><small>${esc(row.text)}</small></p></div>`).join('')}</div></article>

      <article class="panel habit-dashboard-achievements-panel"><div class="panel-heading"><div><p class="panel-kicker">MILESTONES</p><h3>Achievements</h3></div></div><div class="habit-dashboard-achievement-grid">${achievementRows.map(row => `<div><span class="${row.tone}">${esc(row.value)}</span><b>${esc(row.title)}</b><small>${esc(row.text)}</small></div>`).join('') || '<p class="empty-state">Achievements appear as your habit history grows.</p>'}</div></article>

      <article class="panel habit-dashboard-context-panel"><div class="panel-heading"><div><p class="panel-kicker">READING &amp; RECOVERY</p><h3>Current context</h3></div></div><div class="habit-dashboard-context-list"><div><span class="habit-dashboard-habit-icon">${richIcon('habit-reading')}</span><p><b>${currentBook ? esc(currentBook) : 'Reading tracker'}</b><small>${readingMonth.started.length} started · ${readingMonth.completed.length} completed this month${latestBook?.rating ? ` · latest ${'★'.repeat(latestBook.rating)}${'☆'.repeat(5 - latestBook.rating)}` : ''}</small></p><button class="mini-button" data-action="open-habit-checkin" data-id="${readingHabit?.id || ''}" type="button">Log</button></div><div><span class="habit-dashboard-habit-icon">${richIcon('habit-sleep')}</span><p><b>${sleepAverage ? `${sleepAverage.toFixed(1)} hrs average` : 'Sleep tracker'}</b><small>${sleepLogs.length ? `${sleepTargetHits}/${sleepLogs.length} nights met ${sleepTarget}h target` : 'Log sleep to build your recovery baseline'}</small></p><button class="mini-button" data-action="open-habit-checkin" data-id="${sleepHabit?.id || ''}" type="button">Log</button></div></div></article>
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
  const readingHabits = allHabits.filter(habit => isReadingHabit(habit));
  const currentMonth = currentMonthKey();
  const previousMonth = monthInputKey(addMonthsToDate(new Date(`${currentMonth}-01T00:00:00`), -1));
  const readingSummary = readingStatsForMonths(readingHabits, [previousMonth, currentMonth]);
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
        ${habits.filter(habit => habitDatesInRange(habit, dates).length).map(habit => `<div class="habit-grid-row"><b>${esc(habit.name)}</b>${dates.map(date => { const state = !habitIsStarted(habit, date) ? 'muted' : habitCompleted(habit, date) ? 'filled' : !habitDayClosed(date) ? 'pending' : 'missed'; const label = state === 'filled' ? 'Completed' : state === 'missed' ? 'Missed' : state === 'pending' ? 'Open until 11:59 PM' : 'Not started'; return `<span class="${state}" title="${esc(habit.name)} · ${date} · ${label}"></span>`; }).join('')}</div>`).join('') || '<p class="empty-state">No habits yet.</p>'}
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
      <article class="panel reading-insight-panel">
        <div class="panel-heading"><div><p class="panel-kicker">READING TRACKER</p><h3>Books started &amp; completed</h3><p class="subtitle">Based on Reading habit check-ins with book titles.</p></div><button class="mini-button" data-action="open-habit-checkin" data-id="${readingHabits[0]?.id || ''}" type="button">Log reading</button></div>
        ${renderReadingSummary(readingSummary, currentMonth, previousMonth)}
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">BOOK NOTES</p><h3>Completed notes</h3></div><button class="mini-button" data-page="habitCheckins" type="button">Edit history</button></div>
        <div class="habit-insight-list">${readingSummary.completedNotes.length ? readingSummary.completedNotes.slice(0, 6).map(item => `<div><b>${esc(item.title)} · Started ${item.startedDate || '—'} · Completed ${item.date}${item.rating ? ` · ${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}` : ''}</b><span>${esc(item.note || 'Completed without a final note.')}</span></div>`).join('') : '<p class="empty-state">Mark a reading entry as completed and add a completion note.</p>'}</div>
      </article>
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

function readingStatsForMonths(readingHabits, months) {
  const readingIds = new Set(readingHabits.map(habit => habit.id));
  const logs = (data.habitLogs || []).filter(log => readingIds.has(log.habitId) && log.bookTitle).sort((a, b) => a.date.localeCompare(b.date));
  const monthStats = months.reduce((acc, month) => {
    const monthLogs = logs.filter(log => log.date?.startsWith(month));
    const started = new Map();
    const completed = new Map();
    monthLogs.forEach(log => {
      const title = String(log.bookTitle || '').trim();
      if (!title) return;
      const key = title.toLowerCase();
      if (!started.has(key)) started.set(key, { title, date:log.date });
      if (log.bookStatus === 'completed') completed.set(key, { title, date:log.date, note:log.bookNote || log.note || '', rating:Number(log.bookRating || 0) });
    });
    acc[month] = { started:[...started.values()], completed:[...completed.values()] };
    return acc;
  }, {});
  const firstLogByTitle = logs.reduce((acc, log) => {
    const key = String(log.bookTitle || '').trim().toLowerCase();
    if (key && (!acc[key] || log.date < acc[key])) acc[key] = log.date;
    return acc;
  }, {});
  const completedNotes = logs.filter(log => log.bookStatus === 'completed' && (log.bookNote || log.note || log.bookRating)).map(log => {
    const key = String(log.bookTitle || '').trim().toLowerCase();
    return { title:log.bookTitle, date:log.date, startedDate:firstLogByTitle[key] || log.date, note:log.bookNote || log.note || '', rating:Number(log.bookRating || 0) };
  }).sort((a, b) => b.date.localeCompare(a.date));
  return { months:monthStats, completedNotes };
}

function renderReadingSummary(summary, currentMonth, previousMonth) {
  const current = summary.months[currentMonth] || { started:[], completed:[] };
  const previous = summary.months[previousMonth] || { started:[], completed:[] };
  const monthLabel = month => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short', year:'numeric' });
  const bookPills = books => books.length ? books.map(book => `<span class="book-pill" title="${esc(book.title)}">${esc(book.title)}${book.rating ? ` · ${'★'.repeat(book.rating)}` : ''}</span>`).join('') : '<p class="empty-state">No book titles logged.</p>';
  return `<div class="reading-summary-grid">
    <div class="reading-month-card current"><span>${monthLabel(currentMonth)}</span><b>${current.completed.length}</b><small>completed · ${current.started.length} started</small><div>${bookPills(current.completed)}</div></div>
    <div class="reading-month-card"><span>${monthLabel(previousMonth)}</span><b>${previous.completed.length}</b><small>completed · ${previous.started.length} started</small><div>${bookPills(previous.completed)}</div></div>
  </div>`;
}

function renderHabitManagePage() {
  const habits = (data.habits || []).slice().sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name));
  const activeCount = habits.filter(habit => habit.active !== false).length;
  const pausedCount = habits.length - activeCount;
  const checkinCount = (data.habitLogs || []).length;
  return `<section class="habits-shell habit-manager-page">
    <article class="panel habits-hero habit-manager-hero">
      <div class="habit-manager-hero-copy"><span class="habit-manager-hero-icon">${richIcon('habit-patterns')}</span><div><p class="panel-kicker">HABIT ADMIN</p><h3>Manage habits</h3><p class="subtitle">Shape your routines, adjust goals and pause habits without losing history.</p></div></div>
      <div class="habit-hero-actions"><button class="ghost-button" data-page="habits" type="button">Back to habits</button><button class="primary-button" data-action="open-habit-modal" type="button">＋ Add habit</button></div>
    </article>

    <section class="habit-manager-summary" aria-label="Habit management summary">
      <article><span>${richIcon('habits')}</span><div><p>Total habits</p><strong>${habits.length}</strong><small>Created routines</small></div></article>
      <article><span class="teal">${richIcon('habit-progress')}</span><div><p>Active</p><strong>${activeCount}</strong><small>Currently tracking</small></div></article>
      <article><span class="amber">${richIcon('habit-history')}</span><div><p>Paused</p><strong>${pausedCount}</strong><small>History preserved</small></div></article>
      <article><span class="blue">${richIcon('habit-weekly')}</span><div><p>Check-ins</p><strong>${checkinCount}</strong><small>All recorded entries</small></div></article>
    </section>

    <article class="panel habit-manager-panel">
      <div class="panel-heading"><div><p class="panel-kicker">ALL HABITS</p><h3>Habit settings</h3><p class="subtitle">Update goals, milestones, appearance and tracking status.</p></div><span class="tag">${habits.length} total</span></div>
      <div class="habit-manager-grid">${habits.map(habit => {
        const active = habit.active !== false;
        const milestoneTarget = Number(habit.milestoneTarget || 30);
        const milestoneLabel = habit.milestoneType === 'total' ? `${milestoneTarget.toLocaleString('en-IN')} ${esc(habit.unit || 'total')}` : `${milestoneTarget} completed days`;
        return `<article class="habit-manager-card ${active ? '' : 'inactive'}">
          <header><span class="habit-manager-icon ${habit.color || 'purple-bg'}">${richIcon(habitDashboardIconName(habit))}</span><div><b>${esc(habit.name)}</b><small>${esc(habit.description || 'Daily routine')}</small></div><em class="${active ? 'active' : 'paused'}">${active ? 'Active' : 'Paused'}</em></header>
          <div class="habit-manager-details"><span><small>Daily goal</small><b>${esc(habitTargetText(habit))}</b></span><span><small>Starts</small><b>${esc(habitStartDate(habit))}</b></span><span><small>Milestone</small><b>${milestoneLabel}</b></span></div>
          <footer><button class="mini-button" data-action="edit-habit" data-id="${habit.id}" type="button">${richIcon('timeline-edit')}<span>Edit</span></button><button class="mini-button" data-action="toggle-habit-active" data-id="${habit.id}" type="button">${richIcon('habit-history')}<span>${active ? 'Pause' : 'Activate'}</span></button><button class="mini-button warn" data-action="confirm-delete-habit" data-id="${habit.id}" type="button">${richIcon('timeline-delete')}<span>Delete</span></button></footer>
        </article>`;
      }).join('') || `<div class="habit-manager-empty"><span>${richIcon('habits')}</span><b>No habits yet</b><p>Add a habit to begin building your routine.</p><button class="primary-button" data-action="open-habit-modal" type="button">＋ Add habit</button></div>`}</div>
    </article>
  </section>`;
}

function habitHistoryCompleted(habit, log) {
  return isReadingHabit(habit) ? log.bookStatus === 'completed' || !!log.completed : !!log.completed;
}

function habitHistoryStatus(habit, log) {
  return isReadingHabit(habit) ? readingStatusLabel(log.bookStatus) : log.completed ? 'Goal met' : 'Not completed';
}

function habitHistoryValue(habit, log) {
  if (isReadingHabit(habit)) {
    const rating = Math.max(0, Math.min(5, Number(log.bookRating || 0)));
    return `<strong>${esc(log.bookTitle || 'Reading')}</strong><small>${Number(log.value || 0).toLocaleString('en-IN')} pages${rating ? ` · ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : ''}</small>`;
  }
  if (isSleepHabit(habit)) return `<strong>${esc(sleepLogText(log))}</strong><small>Sleep logged</small>`;
  if (habit.goalType === 'checkbox') return `<strong>${log.completed ? 'Completed' : 'Not completed'}</strong><small>Daily check</small>`;
  return `<strong>${Number(log.value || 0).toLocaleString('en-IN')} ${esc(habit.unit || '')}</strong><small>Target: ${esc(habitTargetText(habit))}</small>`;
}

function habitHistoryNote(log) {
  const notes = [];
  if (log.bookNote) notes.push(`<span><b>Book note</b>${esc(log.bookNote)}</span>`);
  if (log.note) notes.push(`<span>${esc(log.note)}</span>`);
  return notes.length ? `<div class="habit-history-note">${notes.join('')}</div>` : '';
}

function habitHistoryDayLabel(date, currentDate) {
  const yesterday = dateKey(addDays(new Date(`${currentDate}T00:00:00`), -1));
  if (date === currentDate) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'long' });
}

function renderHabitHistoryEntry({ habit, log }) {
  const completed = habitHistoryCompleted(habit, log);
  return `<article class="habit-history-entry ${completed ? 'completed' : ''}">
    <div class="habit-history-entry-head">
      <span class="habit-dashboard-habit-icon">${richIcon(habitDashboardIconName(habit))}</span>
      <div><b>${esc(habit.name)}</b><span class="habit-history-status ${completed ? 'completed' : ''}">${habitHistoryStatus(habit, log)}</span></div>
      <div class="habit-history-value">${habitHistoryValue(habit, log)}</div>
    </div>
    ${habitHistoryNote(log)}
    <div class="habit-history-actions">
      <button class="mini-button" data-action="open-habit-checkin" data-date="${esc(log.date)}" data-id="${esc(habit.id)}" type="button">${richIcon('timeline-edit')}<span>Edit</span></button>
      <button class="mini-button warn" data-action="delete-habit-log" data-id="${esc(habit.id)}" data-date="${esc(log.date)}" type="button">${richIcon('timeline-delete')}<span>Delete</span></button>
    </div>
  </article>`;
}

function renderHabitHistoryDay(date, dayRows, currentDate) {
  const day = new Date(`${date}T00:00:00`);
  const completed = dayRows.filter(({ habit, log }) => habitHistoryCompleted(habit, log)).length;
  const fullDate = day.toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
  return `<section class="habit-history-day-card">
    <header class="habit-history-day-head">
      <span class="habit-history-date-tile"><strong>${String(day.getDate()).padStart(2, '0')}</strong><small>${day.toLocaleDateString('en-IN', { month:'short' }).toUpperCase()}</small></span>
      <div><p>${habitHistoryDayLabel(date, currentDate)}</p><small>${fullDate}</small></div>
      <span class="habit-history-day-total">${dayRows.length} check-in${dayRows.length === 1 ? '' : 's'}<small>${completed} goal${completed === 1 ? '' : 's'} met</small></span>
    </header>
    <div class="habit-history-entry-grid">${dayRows.map(renderHabitHistoryEntry).join('')}</div>
  </section>`;
}

function renderHabitCheckinsPage() {
  const historyEnd = today();
  const historyStart = dateKey(addDays(new Date(`${historyEnd}T00:00:00`), -29));
  const logs = (data.habitLogs || [])
    .filter(log => log.date >= historyStart && log.date <= historyEnd)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.habitId.localeCompare(b.habitId));
  const rows = logs.map(log => ({ log, habit:data.habits.find(habit => habit.id === log.habitId) })).filter(row => row.habit);
  const groupedRows = rows.reduce((groups, row) => {
    if (!groups.has(row.log.date)) groups.set(row.log.date, []);
    groups.get(row.log.date).push(row);
    return groups;
  }, new Map());
  const completedCount = rows.filter(({ habit, log }) => habitHistoryCompleted(habit, log)).length;
  const completionRate = rows.length ? Math.round(completedCount / rows.length * 100) : 0;
  const historyRange = `${new Date(`${historyStart}T00:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short' })} – ${new Date(`${historyEnd}T00:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`;
  return `<section class="habit-history-page">
    <article class="panel habit-history-hero">
      <div class="habit-history-hero-copy"><span class="habit-history-hero-icon">${richIcon('habit-history')}</span><div><p class="panel-kicker">HABIT HISTORY</p><h3>Check-in history</h3><p class="subtitle">Your recent routines, grouped by day for a clearer view.</p></div></div>
      <div class="habit-hero-actions"><button class="primary-button" data-action="open-habit-checkin" type="button">${richIcon('habit-progress')}<span>Add check-in</span></button><button class="ghost-button" data-page="habits" type="button">Back to habits</button></div>
    </article>
    <section class="habit-history-metrics" aria-label="History summary">
      <article class="habit-history-metric featured"><span>${richIcon('habit-progress')}</span><div><p>Check-ins</p><strong>${rows.length}</strong><small>Recorded in this window</small></div></article>
      <article class="habit-history-metric"><span class="teal">${richIcon('habit-weekly')}</span><div><p>Active days</p><strong>${groupedRows.size}<em>/ 30</em></strong><small>Days with at least one entry</small></div></article>
      <article class="habit-history-metric"><span class="amber">${richIcon('habit-streak')}</span><div><p>Goals met</p><strong>${completionRate}%</strong><small>${completedCount} of ${rows.length} check-ins</small></div></article>
    </section>
    <article class="panel habit-history-board">
      <div class="panel-heading"><div><p class="panel-kicker">LAST 30 DAYS</p><h3>Daily history</h3><p class="subtitle">${historyRange}</p></div><span class="tag">${groupedRows.size} active days</span></div>
      <div class="habit-history-day-list">${groupedRows.size ? [...groupedRows].map(([date, dayRows]) => renderHabitHistoryDay(date, dayRows, historyEnd)).join('') : '<div class="habit-history-empty"><span>' + richIcon('habit-history') + '</span><b>No recent check-ins</b><p>Add a check-in to start building your 30-day history.</p></div>'}</div>
    </article>
  </section>`;
}
