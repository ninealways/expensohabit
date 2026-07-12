function renderHabitsMockPage() {
  const habits = activeStartedHabits();
  const dates = weekDates();
  const weeklyHabits = activeHabits().filter(habit => habitDatesInRange(habit, dates).length);
  const dayLabels = dates.map(date => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'short' }));
  const completed = habits.filter(habit => habitCompleted(habit)).length;
  const weeklyChecks = weeklyHabits.reduce((sum, habit) => sum + habitDatesInRange(habit, dates).length, 0);
  const weeklyCompleted = weeklyHabits.reduce((sum, habit) => sum + habitDatesInRange(habit, dates).filter(date => habitCompleted(habit, date)).length, 0);
  const streakRows = habits.map(habit => ({ habit, streak:habitStreak(habit) })).sort((a, b) => b.streak - a.streak);
  const best = streakRows[0];
  const sleep = weeklyHabits.find(habit => habit.name.toLowerCase().includes('sleep'));
  const sleepLogs = sleep ? habitDatesInRange(sleep, dates).map(date => habitLog(sleep.id, date)).filter(Boolean) : [];
  const sleepAverage = sleepLogs.length ? sleepLogs.reduce((sum, log) => sum + Number(log.value || 0), 0) / sleepLogs.length : 0;
  const weakest = weeklyHabits.map(habit => { const validDates = habitDatesInRange(habit, dates); return { habit, total:validDates.length, done:validDates.filter(date => habitCompleted(habit, date)).length }; }).filter(row => row.total).sort((a, b) => (a.done / a.total) - (b.done / b.total))[0];
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

function renderHabitInsightsPage() {
  const habits = activeHabits();
  const allHabits = data.habits || [];
  const dates = weekDates();
  const monthDates = Array.from({ length:30 }, (_, index) => dateKey(addDays(new Date(), -29 + index)));
  const insightHabits = habits.filter(habit => habitDatesInRange(habit, monthDates).length);
  const rows = insightHabits.map(habit => {
    const validWeekDates = habitDatesInRange(habit, dates);
    const validMonthDates = habitDatesInRange(habit, monthDates);
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
  const dailyTotals = monthDates.map(date => { const eligible = habits.filter(habit => habitIsStarted(habit, date)); return { date, total:eligible.length, done:eligible.filter(habit => habitCompleted(habit, date)).length }; });
  const bestDay = dailyTotals.filter(day => day.total).slice().sort((a, b) => b.done - a.done)[0];
  const lowDays = dailyTotals.filter(day => day.total && day.done > 0 && day.done < Math.max(1, day.total / 2)).slice(-4);
  const noteLogs = (data.habitLogs || []).filter(log => { const habit = allHabits.find(item => item.id === log.habitId); return habit && log.note && monthDates.includes(log.date) && habitIsStarted(habit, log.date); }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const activeCount = activeStartedHabits().length;
  const inactiveCount = allHabits.filter(habit => habit.active === false).length;
  return `<section class="habits-shell">
    <article class="panel habits-hero">
      <div><p class="panel-kicker">HABIT INSIGHTS</p><h3>Routine report</h3><p class="subtitle">Patterns, streaks, and consistency for your habits.</p></div>
      <div class="habit-hero-actions"><button class="primary-button" data-action="open-habit-checkin" type="button">✓ Check in</button><button class="ghost-button" data-page="habitCheckins" type="button">History</button><button class="ghost-button" data-page="habits" type="button">Back to habits</button></div>
    </article>
    <section class="habit-summary-grid">
      <article class="habit-summary-card featured"><span class="map-icon purple-bg">${svgIcon('calendar')}</span><p>Best day this month</p><strong>${bestDay?.done || 0}/${bestDay?.total || activeCount}</strong><small>${bestDay ? new Date(`${bestDay.date}T00:00:00`).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : 'No check-ins yet'}</small></article>
      <article class="habit-summary-card"><span class="map-icon amber-bg">${svgIcon('bolt')}</span><p>Missed opportunities</p><strong>${rows.reduce((sum, row) => sum + row.misses, 0)}</strong><small>Unchecked habit-days in 30 days</small></article>
      <article class="habit-summary-card"><span class="map-icon teal-bg">${svgIcon('heart')}</span><p>Active habits</p><strong>${activeCount}</strong><small>${inactiveCount} paused</small></article>
      <article class="habit-summary-card"><span class="map-icon blue-bg">${svgIcon('book')}</span><p>Notes captured</p><strong>${noteLogs.length}</strong><small>Recent daily reflections</small></article>
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
      <div class="table-scroll"><table class="outflow-table habit-history-table"><thead><tr><th>Date</th><th>Habit</th><th>Status</th><th>Value</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(({ log, habit }) => `<tr><td>${log.date}</td><td>${esc(habit.name)}</td><td>${log.completed ? 'Done' : 'Not done'}</td><td>${habit.goalType === 'checkbox' ? '—' : `${Number(log.value || 0).toLocaleString('en-IN')} ${esc(habit.unit || '')}`}</td><td>${esc(log.note || '')}</td><td><button class="mini-button" data-action="open-habit-checkin" data-date="${log.date}" data-id="${habit.id}" type="button">Edit</button><button class="mini-button warn" data-action="delete-habit-log" data-id="${habit.id}" data-date="${log.date}" type="button">Delete</button></td></tr>`).join('') || '<tr><td colspan="6">No check-ins yet.</td></tr>'}</tbody></table></div>
    </article>
  </section>`;
}
