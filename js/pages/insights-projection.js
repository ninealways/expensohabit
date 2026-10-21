function projectionAmount(rows = []) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function projectionMonthLabel(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'long', year:'numeric' });
}

function projectionTone(value, watchAt, highAt) {
  if (!value) return 'low';
  if (value >= highAt && highAt > 0) return 'high';
  if (value >= watchAt && watchAt > 0) return 'watch';
  return 'low';
}

function projectionTopCategory(rows = []) {
  const totals = rows.reduce((result, row) => {
    const category = row.category || 'Other';
    result[category] = (result[category] || 0) + Number(row.amount || 0);
    return result;
  }, {});
  return Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || ['General spending', 0];
}

function projectionRangeLabel(start, end) {
  return start === end ? String(start) : `${start}–${end}`;
}

function buildInsightsProjection(options = {}) {
  const month = options.month || currentMonthKey();
  const historyLimit = Math.max(3, Math.min(12, Number(options.historyMonths) || 6));
  const asOf = options.asOf || today();
  const monthDays = dashboardForecastMonthDays(month);
  const cutoffDay = asOf.startsWith(month) ? Math.min(monthDays, Number(asOf.slice(8, 10)) || 1) : monthDays;
  const realRows = dashboardForecastRealRows(data.transactions || []);
  const currentRows = realRows.filter(row => row.date.startsWith(month));
  const historyCandidates = Array.from({ length:historyLimit }, (_, index) => dashboardForecastShiftMonth(month, -(index + 1)));
  const historyRows = Object.fromEntries(historyCandidates.map(historyMonth => [historyMonth, realRows.filter(row => row.date.startsWith(historyMonth))]));
  const historyMonths = historyCandidates.filter(historyMonth => historyRows[historyMonth].length);
  const settings = normalizeSettings(data.settings);
  const forecast = buildDashboardForecast(data.transactions || [], data.schedules || [], { month, historyMonths:historyLimit, asOf, minimumExpenseReasons:settings.bareMinimumExpenseReasons, minimumBufferMode:settings.bareMinimumBufferMode, minimumBufferValue:settings.bareMinimumBufferValue });
  const traps = buildDashboardSpendingTraps(data.transactions || [], { month, historyMonths:historyLimit, asOf, projectedTotal:forecast.projectedTotal });
  const scheduledByDay = forecast.upcomingCommitments.reduce((totals, item) => {
    const day = Number(item.date.slice(8, 10));
    totals[day] = (totals[day] || 0) + Number(item.amount || item.schedule?.amount || 0);
    return totals;
  }, {});
  const dayRows = Array.from({ length:monthDays }, (_, index) => {
    const day = index + 1;
    const historicalSamples = historyMonths.map(historyMonth => projectionAmount(historyRows[historyMonth].filter(row => Number(row.date.slice(8, 10)) === day)));
    const typical = dashboardForecastMedian(historicalSamples);
    const actual = projectionAmount(currentRows.filter(row => Number(row.date.slice(8, 10)) === day));
    const scheduled = scheduledByDay[day] || 0;
    const expected = day <= cutoffDay ? actual : Math.max(typical, scheduled);
    return { day, typical, actual, scheduled, expected };
  });
  const positiveDayValues = dayRows.map(row => row.expected || row.typical).filter(Boolean);
  const dayWatchAt = dashboardForecastQuantile(positiveDayValues, .55);
  const dayHighAt = dashboardForecastQuantile(positiveDayValues, .8);
  dayRows.forEach(row => { row.tone = projectionTone(row.expected || row.typical, dayWatchAt, dayHighAt); });

  const ranges = [
    [1, 5],
    [6, 12],
    [13, 18],
    [19, 23],
    [24, Math.min(30, monthDays)],
    ...(monthDays > 30 ? [[31, monthDays]] : [])
  ].filter(([start, end]) => start <= end);
  const segmentSeeds = ranges.map(([start, end]) => {
    const days = dayRows.filter(row => row.day >= start && row.day <= end);
    const average = days.reduce((sum, row) => sum + (row.expected || row.typical), 0) / Math.max(1, days.length);
    const historicalForRange = historyMonths.flatMap(historyMonth => historyRows[historyMonth].filter(row => {
      const day = Number(row.date.slice(8, 10));
      return day >= start && day <= end;
    }));
    const [topCategory] = projectionTopCategory(historicalForRange);
    const commitment = forecast.upcomingCommitments.filter(item => {
      const day = Number(item.date.slice(8, 10));
      return day >= start && day <= end;
    }).reduce((sum, item) => sum + Number(item.amount || item.schedule?.amount || 0), 0);
    const samples = historyMonths.map(historyMonth => projectionAmount(historyRows[historyMonth].filter(row => {
      const day = Number(row.date.slice(8, 10));
      return day >= start && day <= end;
    })));
    return { start, end, days, average, topCategory, commitment, samples };
  });
  const segmentAverages = segmentSeeds.map(segment => segment.average).filter(Boolean);
  const segmentWatchAt = dashboardForecastQuantile(segmentAverages, .5);
  const segmentHighAt = dashboardForecastQuantile(segmentAverages, .78);
  const minimumSegmentAverage = segmentAverages.length ? Math.min(...segmentAverages) : 0;
  const segments = segmentSeeds.map(segment => {
    const tone = projectionTone(segment.average, segmentWatchAt, segmentHighAt);
    const label = segment.commitment > 0 && segment.commitment >= segment.average * Math.max(1, segment.end - segment.start + 1) * .45
      ? 'Commitment pressure'
      : tone === 'low'
        ? segment.average <= minimumSegmentAverage ? 'Best saving window' : 'Calm window'
        : `${segment.topCategory} pressure`;
    return { ...segment, tone, label, event:segment.commitment ? `${money(segment.commitment)} due` : segment.topCategory };
  });

  const weekTotals = {};
  historyMonths.flatMap(historyMonth => historyRows[historyMonth]).forEach(row => {
    const date = new Date(`${row.date}T00:00:00`);
    const weekday = (date.getDay() + 6) % 7;
    const week = Math.min(5, Math.floor((Number(row.date.slice(8, 10)) - 1) / 7) + 1);
    const key = `${week}-${weekday}`;
    weekTotals[key] = (weekTotals[key] || 0) + Number(row.amount || 0) / Math.max(1, historyMonths.length);
  });
  const weekValues = Object.values(weekTotals).filter(Boolean);
  const weekWatchAt = dashboardForecastQuantile(weekValues, .55);
  const weekHighAt = dashboardForecastQuantile(weekValues, .8);
  const weekCells = Array.from({ length:5 }, (_, weekIndex) => Array.from({ length:7 }, (_, weekday) => {
    const value = weekTotals[`${weekIndex + 1}-${weekday}`] || 0;
    return { week:weekIndex + 1, weekday, value, tone:projectionTone(value, weekWatchAt, weekHighAt) };
  }));

  const historicalAll = historyMonths.flatMap(historyMonth => historyRows[historyMonth]);
  const lateRows = historicalAll.filter(row => Number(row.date.slice(8, 10)) >= 20);
  const [lateCategory, lateTotal] = projectionTopCategory(lateRows);
  const lateMonthsSeen = historyMonths.filter(historyMonth => historyRows[historyMonth].some(row => Number(row.date.slice(8, 10)) >= 20 && (row.category || 'Other') === lateCategory)).length;
  const weekendRows = historicalAll.filter(row => {
    const weekday = new Date(`${row.date}T00:00:00`).getDay();
    return weekday === 0 || weekday === 6;
  });
  const [weekendCategory, weekendTotal] = projectionTopCategory(weekendRows);
  const weekendMonthsSeen = historyMonths.filter(historyMonth => historyRows[historyMonth].some(row => {
    const weekday = new Date(`${row.date}T00:00:00`).getDay();
    return (weekday === 0 || weekday === 6) && (row.category || 'Other') === weekendCategory;
  })).length;
  const upcoming = forecast.upcomingCommitments.slice().sort((a, b) => a.date.localeCompare(b.date));
  const commitmentTotal = upcoming.reduce((sum, item) => sum + Number(item.amount || item.schedule?.amount || 0), 0);
  const commitmentRange = upcoming.length ? `${Number(upcoming[0].date.slice(8, 10))}–${Number(upcoming.at(-1).date.slice(8, 10))} ${projectionMonthLabel(month).split(' ')[0].slice(0, 3)}` : 'No dates';
  const patterns = [
    { icon:'real-expenses', from:'After day 20', step:`${lateCategory} leads`, result:`${money(lateTotal / Math.max(1, historyMonths.length))} typical`, seen:lateMonthsSeen },
    { icon:'insight-category', from:'Friday evening', step:'Weekend', result:`${weekendCategory} is highest`, seen:weekendMonthsSeen },
    { icon:'schedule-overview', from:'Scheduled dates', step:`${upcoming.length} commitments`, result:commitmentTotal ? `${money(commitmentTotal)} due` : 'No pressure due', seen:historyMonths.length }
  ];

  const enrichedSegments = segments.map(segment => {
    const median = dashboardForecastMedian(segment.samples);
    const low = dashboardForecastQuantile(segment.samples, .25);
    const high = dashboardForecastQuantile(segment.samples, .75);
    const seen = segment.samples.filter(value => value > 0).length;
    return { ...segment, median, low, high, seen };
  });
  const riskWindows = enrichedSegments.filter(segment => segment.tone !== 'low').sort((a, b) => b.average - a.average).slice(0, 3);
  const calmSegments = enrichedSegments.filter(segment => segment.tone === 'low' && !segment.commitment);
  const opportunityWindows = (calmSegments.length ? calmSegments : enrichedSegments)
    .slice()
    .sort((a, b) => a.average - b.average)
    .slice(0, 2);
  return { month, monthDays, cutoffDay, historyLimit, historyMonths, forecast, traps, dayRows, weekCells, segments, patterns, riskWindows, opportunityWindows, commitmentRange };
}

function renderProjectionFingerprint(model) {
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const tabs = `<div class="projection-fingerprint-tabs" role="tablist" aria-label="Pattern fingerprint view"><button type="button" role="tab" aria-selected="${insightProjectionFingerprint === 'week'}" class="${insightProjectionFingerprint === 'week' ? 'active' : ''}" data-projection-fingerprint="week">Week pattern</button><button type="button" role="tab" aria-selected="${insightProjectionFingerprint === 'date'}" class="${insightProjectionFingerprint === 'date' ? 'active' : ''}" data-projection-fingerprint="date">Date pattern</button></div>`;
  let grid = '';
  if (insightProjectionFingerprint === 'week') {
    grid = `<div class="projection-week-grid"><div></div>${weekdays.map(day => `<b>${day}</b>`).join('')}${model.weekCells.map((week, index) => `<strong>Week ${index + 1}</strong>${week.map(cell => `<span class="${cell.tone}" title="Week ${cell.week}, ${weekdays[cell.weekday]}: ${money(cell.value)} typical"><i>${cell.value ? compactMoney(cell.value) : '—'}</i></span>`).join('')}`).join('')}</div>`;
  } else {
    const firstWeekday = (new Date(`${model.month}-01T00:00:00`).getDay() + 6) % 7;
    const blanks = Array.from({ length:firstWeekday }, () => '<span class="blank"></span>').join('');
    grid = `<div class="projection-date-grid">${weekdays.map(day => `<b>${day}</b>`).join('')}${blanks}${model.dayRows.map(row => `<span class="${row.tone} ${row.day === model.cutoffDay ? 'today' : ''}" title="${projectionMonthLabel(model.month).split(' ')[0]} ${row.day}: ${money(row.expected || row.typical)} expected"><i>${row.day}</i><small>${row.expected || row.typical ? compactMoney(row.expected || row.typical) : '—'}</small></span>`).join('')}</div>`;
  }
  const findings = model.riskWindows.slice(0, 3).map((window, index) => `<article class="projection-finding ${window.tone}"><span>${richIcon([dashboardForecastCategoryIcon(window.topCategory),'schedule-overview','insight-category'][index] || 'insight-pattern')}</span><div><b>${projectionRangeLabel(window.start, window.end)} ${projectionMonthLabel(model.month).split(' ')[0].slice(0, 3)}</b><strong>${esc(window.label)}</strong><small>${window.seen} of ${model.historyMonths.length || 0} months recorded activity here.</small></div></article>`).join('');
  return `<section class="panel projection-fingerprint-panel"><div class="projection-section-heading"><div class="projection-title-with-icon"><span>${richIcon('insight-pattern')}</span><div><h3>Pattern fingerprint</h3><p>Where spending pressure tends to appear.</p></div></div>${tabs}</div><div class="projection-fingerprint-body"><div><div class="projection-risk-legend"><span class="low">Low</span><span class="watch">Watch</span><span class="high">High</span></div>${grid}</div><aside><p class="panel-kicker">KEY FINDINGS</p>${findings || '<p class="empty-state">More history is needed to identify repeated risk windows.</p>'}</aside></div></section>`;
}

function renderInsightsProjectionPage(tabs = renderInsightsTopTabs()) {
  const model = buildInsightsProjection({ historyMonths:Number(insightProjectionRange) || 6 });
  const monthLabel = projectionMonthLabel(model.month);
  const currentSegment = model.segments.find(segment => model.cutoffDay >= segment.start && model.cutoffDay <= segment.end);
  const route = model.segments.map(segment => `<article class="projection-route-stop ${segment.tone} ${segment === currentSegment ? 'current' : ''}"><div class="projection-route-node"><i></i></div><b>${projectionRangeLabel(segment.start, segment.end)}</b><strong>${esc(segment.label)}</strong><small>${segment.event ? esc(segment.event) : 'No recurring pressure'}</small>${segment === currentSegment ? `<em>You are here · ${model.cutoffDay} ${monthLabel.split(' ')[0].slice(0, 3)}</em>` : ''}</article>`).join('');
  const patterns = model.patterns.map(pattern => `<article class="projection-sequence"><span>${richIcon(pattern.icon)}</span><div><b>${esc(pattern.from)}</b><small>Observed trigger</small></div><i>→</i><div><b>${esc(pattern.step)}</b><small>Typical next step</small></div><i>→</i><div><b>${esc(pattern.result)}</b><small>${pattern.seen} of ${model.historyMonths.length || 0} months</small></div></article>`).join('');
  const riskWindows = model.riskWindows.map(window => `<article class="projection-risk-card ${window.tone}"><div><span>${projectionRangeLabel(window.start, window.end)} ${monthLabel.split(' ')[0].slice(0, 3)}</span><em>${window.tone === 'high' ? 'High' : 'Watch'}</em></div><h4>${esc(window.label)}</h4><dl><div><dt>Expected range</dt><dd>${money(window.low)}–${money(window.high)}</dd></div><div><dt>Past evidence</dt><dd>${window.seen} of ${model.historyMonths.length || 0} months active</dd></div><div><dt>Main driver</dt><dd>${esc(window.topCategory)}</dd></div></dl></article>`).join('');
  const opportunities = model.opportunityWindows.map(window => `<article><span>${richIcon('investments')}</span><div><b>${projectionRangeLabel(window.start, window.end)} ${monthLabel.split(' ')[0].slice(0, 3)}</b><strong>${esc(window.label)}</strong><small>Typical range ${money(window.low)}–${money(window.high)}</small></div></article>`).join('');
  const routeTarget = budgetForMonth(model.month);
  return `<article class="insights-shell projection-shell">${tabs}<div id="insightsProjectionPanel" role="tabpanel" aria-labelledby="insightsProjectionTab" class="insights-page-panel projection-page">
    <section class="projection-header panel"><div><p class="panel-kicker">MONTH MISSION CONTROL</p><h3>Your ${monthLabel.split(' ')[0]} route</h3><p>Navigate the month before old patterns repeat.</p></div><div class="projection-header-controls"><label><span>History</span><select id="insightProjectionRange" aria-label="Projection history"><option value="3" ${insightProjectionRange === '3' ? 'selected' : ''}>Last 3 months</option><option value="6" ${insightProjectionRange === '6' ? 'selected' : ''}>Last 6 months</option><option value="12" ${insightProjectionRange === '12' ? 'selected' : ''}>Last 1 year</option></select></label><span class="projection-month">${monthLabel}</span></div></section>
    <section class="panel projection-route-panel"><div class="projection-route-summary"><div><span>${richIcon('insight-alert')}</span><small>If past patterns repeat</small><strong>${money(model.forecast.projectedTotal)}</strong></div><i>→</i><div class="target"><span>${richIcon('credit-paid')}</span><small>Expense target</small><strong>${money(routeTarget)}</strong></div></div><div class="projection-route-heading"><div><span>${richIcon('timeline')}</span><h3>Your ${monthLabel.split(' ')[0]} route</h3></div><div class="projection-risk-legend"><span class="low">On track</span><span class="watch">Watch</span><span class="high">High risk</span></div></div><div class="projection-route-track">${route}</div></section>
    <section class="projection-middle-grid">${renderProjectionFingerprint(model)}<section class="panel projection-sequence-panel"><div class="projection-title-with-icon"><span>${richIcon('insight-flow')}</span><div><h3>What usually happens next</h3><p>Sequences observed across the selected history.</p></div></div><div class="projection-sequence-list">${patterns}</div><p class="projection-method">These are recurring sequences, not proof that one event causes another.</p></section></section>
    <section class="projection-bottom-grid"><section class="panel projection-risk-panel"><div class="projection-title-with-icon"><span>${richIcon('insight-alert')}</span><div><h3>Risk windows</h3><p>Periods to watch based on comparable past months.</p></div></div><div class="projection-risk-cards">${riskWindows || '<p class="empty-state">No repeated high-pressure window was found.</p>'}</div></section><section class="panel projection-opportunity-panel"><div class="projection-title-with-icon"><span>${richIcon('investments')}</span><div><h3>Opportunity windows</h3><p>Historically calmer parts of the month.</p></div></div><div class="projection-opportunity-list">${opportunities}</div><button type="button" class="ghost-button" data-page="calendar">See full calendar →</button></section></section>
    <p class="projection-footnote">Projection uses ${model.historyMonths.length} month${model.historyMonths.length === 1 ? '' : 's'} with data, same-date spending patterns, and current scheduled commitments. Amounts are estimates, not guarantees.</p>
  </div></article>`;
}
