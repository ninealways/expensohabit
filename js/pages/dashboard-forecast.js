let dashboardForecastHistoryMonths = 6;

function dashboardForecastMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dashboardForecastShiftMonth(month, offset) {
  const [year, monthNumber] = month.split('-').map(Number);
  return dashboardForecastMonthKey(new Date(year, monthNumber - 1 + offset, 1));
}

function dashboardForecastMonthDays(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function dashboardForecastMedian(values = []) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function dashboardForecastQuantile(values = [], quantile = .5) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower + 1] === undefined ? sorted[lower] : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function dashboardForecastSum(rows = []) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function dashboardForecastOrdinal(day) {
  const value = Number(day);
  if (value % 100 >= 11 && value % 100 <= 13) return 'th';
  return value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th';
}

function dashboardForecastRealRows(transactions = []) {
  return transactions.filter(transaction => transaction.type === 'expense' && transaction.includeInReal !== false && /^\d{4}-\d{2}-\d{2}$/.test(String(transaction.date || '')));
}

function dashboardScheduleDatesInMonth(schedule, month) {
  if (schedule.type !== 'expense' || schedule.archived === true) return [];
  const monthDays = dashboardForecastMonthDays(month);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(monthDays).padStart(2, '0')}`;
  const startKey = schedule.startDate || monthStart;
  if (startKey > monthEnd || (schedule.endDate && schedule.endDate < monthStart)) return [];
  const start = new Date(`${startKey}T00:00:00`);
  const [year, monthNumber] = month.split('-').map(Number);
  const frequency = schedule.frequency || 'Monthly';
  const dates = [];
  const addDate = date => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (key >= monthStart && key <= monthEnd && key >= startKey && (!schedule.endDate || key <= schedule.endDate)) dates.push(key);
  };
  if (frequency === 'Daily') {
    for (let day = 1; day <= monthDays; day += 1) addDate(new Date(year, monthNumber - 1, day));
    return dates;
  }
  if (frequency === 'Weekly') {
    let cursor = new Date(start);
    while (cursor < new Date(`${monthStart}T00:00:00`)) cursor.setDate(cursor.getDate() + 7);
    while (cursor <= new Date(`${monthEnd}T00:00:00`)) {
      addDate(cursor);
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 7);
    }
    return dates;
  }
  const interval = frequency === 'Quarterly' ? 3 : frequency === 'Yearly' ? 12 : 1;
  const startMonthIndex = start.getFullYear() * 12 + start.getMonth();
  const monthIndex = year * 12 + monthNumber - 1;
  if (monthIndex < startMonthIndex || (monthIndex - startMonthIndex) % interval) return [];
  const dueDays = frequency === 'BiMonthly'
    ? (Array.isArray(schedule.dueDays) && schedule.dueDays.length ? schedule.dueDays : [schedule.dueDay, 15])
    : [schedule.dueDay || start.getDate()];
  [...new Set(dueDays.map(Number).filter(day => day >= 1 && day <= 31))].forEach(day => addDate(new Date(year, monthNumber - 1, Math.min(day, monthDays))));
  return dates.sort();
}

function dashboardScheduledRemaining(transactions, schedules, month, cutoffKey) {
  const byCategory = {};
  let total = 0;
  (schedules || []).forEach(schedule => {
    dashboardScheduleDatesInMonth(schedule, month).filter(date => date > cutoffKey).forEach(date => {
      if ((schedule.skippedMonths || []).includes(date)) return;
      const posted = transactions.some(transaction => transaction.scheduleId === schedule.id && (transaction.periodKey === date || transaction.date === date));
      if (posted) return;
      const amount = Number(schedule.amount || 0);
      const category = schedule.category || 'Other';
      total += amount;
      byCategory[category] = (byCategory[category] || 0) + amount;
    });
  });
  return { total, byCategory };
}

function dashboardForecastDriverNote(driver) {
  const reasonLabels = { essential:'Essential', planned:'Planned', holiday:'Holiday', impulse:'Impulse', recurring:'Recurring', emergency:'Emergency', gift:'Gift', other:'Other' };
  if (driver.delta > 0) {
    const reasonTotals = driver.currentRows.reduce((totals, row) => {
      if (row.expenseReason) totals[row.expenseReason] = (totals[row.expenseReason] || 0) + Number(row.amount || 0);
      return totals;
    }, {});
    const reason = Object.entries(reasonTotals).sort((a, b) => b[1] - a[1])[0];
    if (reason && reason[1] >= driver.current * .5) return `${reasonLabels[reason[0]] || 'Tagged'} spending drove the increase`;
    if (!driver.previous) return 'New spending in this period';
    if (driver.currentRows.length > driver.previousRows.length) return `${driver.currentRows.length - driver.previousRows.length} more transaction${driver.currentRows.length - driver.previousRows.length === 1 ? '' : 's'}`;
    const largest = Math.max(...driver.currentRows.map(row => Number(row.amount || 0)), 0);
    if (largest >= Math.abs(driver.delta) * .6) return 'Mostly driven by one large expense';
    return 'Average transaction value increased';
  }
  if (!driver.current) return 'No matching spend this month';
  if (driver.currentRows.length < driver.previousRows.length) return `${driver.previousRows.length - driver.currentRows.length} fewer transaction${driver.previousRows.length - driver.currentRows.length === 1 ? '' : 's'}`;
  return 'Average transaction value decreased';
}

function buildDashboardForecast(transactions = [], schedules = [], options = {}) {
  const month = options.month || new Date().toISOString().slice(0, 7);
  const asOf = options.asOf || new Date().toISOString().slice(0, 10);
  const historyLimit = Math.max(3, Math.min(12, Number(options.historyMonths) || 6));
  const monthDays = dashboardForecastMonthDays(month);
  const isCurrentMonth = asOf.startsWith(month);
  const cutoffDay = isCurrentMonth ? Math.min(monthDays, Number(asOf.slice(8, 10)) || 1) : monthDays;
  const cutoffKey = `${month}-${String(cutoffDay).padStart(2, '0')}`;
  const realRows = dashboardForecastRealRows(transactions);
  const currentRows = realRows.filter(row => row.date.startsWith(month) && row.date <= cutoffKey);
  const actualToDate = dashboardForecastSum(currentRows);
  const candidateHistoryMonths = Array.from({ length:historyLimit }, (_, index) => dashboardForecastShiftMonth(month, -(index + 1)));
  const candidateHistoryRows = Object.fromEntries(candidateHistoryMonths.map(historyMonth => [historyMonth, realRows.filter(row => row.date.startsWith(historyMonth))]));
  const historyMonths = candidateHistoryMonths.filter(historyMonth => dashboardForecastSum(candidateHistoryRows[historyMonth]) > 0);
  const historyRows = Object.fromEntries(historyMonths.map(historyMonth => [historyMonth, candidateHistoryRows[historyMonth]]));
  const remainingSamples = historyMonths.map(historyMonth => {
    const comparisonDay = Math.min(cutoffDay, dashboardForecastMonthDays(historyMonth));
    const comparisonKey = `${historyMonth}-${String(comparisonDay).padStart(2, '0')}`;
    return dashboardForecastSum(historyRows[historyMonth].filter(row => row.date > comparisonKey));
  });
  const fullMonthTotals = historyMonths.map(historyMonth => dashboardForecastSum(historyRows[historyMonth]));
  const scheduled = dashboardScheduledRemaining(transactions, schedules, month, cutoffKey);
  const typicalRemaining = dashboardForecastMedian(remainingSamples);
  const projectedTotal = actualToDate + Math.max(typicalRemaining, scheduled.total);
  const lowEstimate = Math.min(projectedTotal, actualToDate + Math.max(dashboardForecastQuantile(remainingSamples, .25), scheduled.total));
  const highEstimate = Math.max(projectedTotal, actualToDate + Math.max(dashboardForecastQuantile(remainingSamples, .75), scheduled.total));
  const averageTotal = fullMonthTotals.length ? fullMonthTotals.reduce((sum, value) => sum + value, 0) / fullMonthTotals.length : 0;
  const deviation = fullMonthTotals.length && averageTotal ? Math.sqrt(fullMonthTotals.reduce((sum, value) => sum + Math.pow(value - averageTotal, 2), 0) / fullMonthTotals.length) / averageTotal : 1;
  const confidence = historyMonths.length < 3 ? 'Learning' : historyMonths.length >= 5 && deviation <= .35 ? 'High' : deviation > .75 ? 'Low' : 'Medium';
  const previousMonth = dashboardForecastShiftMonth(month, -1);
  const previousMonthDays = dashboardForecastMonthDays(previousMonth);
  const previousCutoff = `${previousMonth}-${String(Math.min(cutoffDay, previousMonthDays)).padStart(2, '0')}`;
  const previousRowsToDate = realRows.filter(row => row.date.startsWith(previousMonth) && row.date <= previousCutoff);
  const previousMonthTotal = dashboardForecastSum(realRows.filter(row => row.date.startsWith(previousMonth)));
  const currentByCategory = {};
  const previousByCategory = {};
  currentRows.forEach(row => { const key = row.category || 'Other'; (currentByCategory[key] ||= []).push(row); });
  previousRowsToDate.forEach(row => { const key = row.category || 'Other'; (previousByCategory[key] ||= []).push(row); });
  const drivers = [...new Set([...Object.keys(currentByCategory), ...Object.keys(previousByCategory)])].map(category => {
    const categoryCurrentRows = currentByCategory[category] || [];
    const categoryPreviousRows = previousByCategory[category] || [];
    const current = dashboardForecastSum(categoryCurrentRows);
    const previous = dashboardForecastSum(categoryPreviousRows);
    const driver = { category, current, previous, delta:current - previous, currentRows:categoryCurrentRows, previousRows:categoryPreviousRows };
    return { ...driver, note:dashboardForecastDriverNote(driver) };
  }).filter(driver => Math.abs(driver.delta) >= .5).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const categories = [...new Set([
    ...currentRows.map(row => row.category || 'Other'),
    ...historyMonths.flatMap(historyMonth => historyRows[historyMonth].map(row => row.category || 'Other')),
    ...Object.keys(scheduled.byCategory)
  ])];
  const categoryForecasts = categories.map(category => {
    const current = dashboardForecastSum(currentRows.filter(row => (row.category || 'Other') === category));
    const categoryRemainders = historyMonths.map(historyMonth => {
      const comparisonDay = Math.min(cutoffDay, dashboardForecastMonthDays(historyMonth));
      const comparisonKey = `${historyMonth}-${String(comparisonDay).padStart(2, '0')}`;
      return dashboardForecastSum(historyRows[historyMonth].filter(row => (row.category || 'Other') === category && row.date > comparisonKey));
    });
    const scheduledRemaining = scheduled.byCategory[category] || 0;
    return { category, current, scheduledRemaining, projected:current + Math.max(dashboardForecastMedian(categoryRemainders), scheduledRemaining) };
  }).filter(row => row.projected > 0).sort((a, b) => b.projected - a.projected);
  const dailyActual = Array.from({ length:cutoffDay }, (_, index) => dashboardForecastSum(currentRows.filter(row => Number(row.date.slice(8, 10)) <= index + 1)));
  const typicalCumulative = Array.from({ length:monthDays }, (_, index) => dashboardForecastMedian(historyMonths.map(historyMonth => {
    const comparisonDay = Math.min(index + 1, dashboardForecastMonthDays(historyMonth));
    const comparisonKey = `${historyMonth}-${String(comparisonDay).padStart(2, '0')}`;
    return dashboardForecastSum(historyRows[historyMonth].filter(row => row.date <= comparisonKey));
  })));
  return {
    month,
    cutoffDay,
    monthDays,
    actualToDate,
    scheduledRemaining:scheduled.total,
    typicalRemaining,
    projectedTotal,
    lowEstimate,
    highEstimate,
    confidence,
    monthsUsed:historyMonths.length,
    previousMonth,
    previousMonthTotal,
    previousToDate:dashboardForecastSum(previousRowsToDate),
    projectedChange:projectedTotal - previousMonthTotal,
    toDateChange:actualToDate - dashboardForecastSum(previousRowsToDate),
    drivers,
    categoryForecasts,
    dailyActual,
    typicalCumulative
  };
}

function dashboardForecastCategoryIcon(category = '') {
  const value = category.toLowerCase();
  if (/travel|holiday|flight/.test(value)) return 'timeline-travel';
  if (/bill|utility|electric|insurance|rent/.test(value)) return 'schedule-overview';
  if (/health|medical|fitness/.test(value)) return 'timeline-health';
  if (/invest/.test(value)) return 'investments';
  return 'real-expenses';
}

function dashboardForecastChart(forecast) {
  if (!forecast.monthsUsed && !forecast.actualToDate && !forecast.scheduledRemaining) {
    return `<div class="forecast-chart forecast-chart-empty"><span>${richIcon('insight-pattern')}</span><b>Your projection is learning</b><small>Add expenses over time and this chart will compare your current pace with previous months.</small></div>`;
  }
  const width = 720, height = 252, left = 55, right = 16, top = 18, bottom = 208;
  const chartMax = Math.max(1, forecast.highEstimate, forecast.projectedTotal, ...forecast.typicalCumulative) * 1.12;
  const x = day => left + (width - left - right) * (day - 1) / Math.max(1, forecast.monthDays - 1);
  const y = value => bottom - value / chartMax * (bottom - top);
  const pointsPath = points => points.map((value, index) => `${index ? 'L' : 'M'}${x(value.day).toFixed(1)} ${y(value.amount).toFixed(1)}`).join(' ');
  const actualPoints = forecast.dailyActual.map((amount, index) => ({ day:index + 1, amount }));
  const forecastPoints = Array.from({ length:Math.max(1, forecast.monthDays - forecast.cutoffDay + 1) }, (_, index) => {
    const day = Math.min(forecast.monthDays, forecast.cutoffDay + index);
    const ratio = (day - forecast.cutoffDay) / Math.max(1, forecast.monthDays - forecast.cutoffDay);
    return { day, amount:forecast.actualToDate + (forecast.projectedTotal - forecast.actualToDate) * ratio };
  });
  const lowPoints = forecastPoints.map(point => ({ day:point.day, amount:forecast.actualToDate + (forecast.lowEstimate - forecast.actualToDate) * ((point.day - forecast.cutoffDay) / Math.max(1, forecast.monthDays - forecast.cutoffDay)) }));
  const highPoints = forecastPoints.map(point => ({ day:point.day, amount:forecast.actualToDate + (forecast.highEstimate - forecast.actualToDate) * ((point.day - forecast.cutoffDay) / Math.max(1, forecast.monthDays - forecast.cutoffDay)) }));
  const bandPath = highPoints.length > 1 ? `${pointsPath(highPoints)} ${pointsPath([...lowPoints].reverse()).replace(/^M/, 'L')} Z` : '';
  const typicalPoints = forecast.typicalCumulative.map((amount, index) => ({ day:index + 1, amount }));
  const grid = Array.from({ length:4 }, (_, index) => {
    const amount = chartMax * index / 3;
    return `<line class="forecast-chart-grid" x1="${left}" x2="${width - right}" y1="${y(amount).toFixed(1)}" y2="${y(amount).toFixed(1)}"/><text class="forecast-chart-axis" x="4" y="${(y(amount) + 4).toFixed(1)}">${compactMoney(amount)}</text>`;
  }).join('');
  const monthLabel = new Date(`${forecast.month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short' });
  const ticks = [...new Set([1, forecast.cutoffDay, forecast.monthDays])].map(day => `<text class="forecast-chart-axis" x="${x(day).toFixed(1)}" y="244" text-anchor="${day === 1 ? 'start' : day === forecast.monthDays ? 'end' : 'middle'}">${day} ${monthLabel}</text>`).join('');
  return `<div class="forecast-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Actual real expenses ${money(forecast.actualToDate)} through ${forecast.cutoffDay} ${monthLabel}; projected month end ${money(forecast.projectedTotal)}"><defs><linearGradient id="forecastActualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b43f6" stop-opacity=".23"/><stop offset="1" stop-color="#7b43f6" stop-opacity=".01"/></linearGradient></defs>${grid}${bandPath ? `<path class="forecast-confidence-band" d="${bandPath}"/>` : ''}<path class="forecast-typical-line" d="${pointsPath(typicalPoints)}"/><path class="forecast-actual-area" d="${pointsPath(actualPoints)} L${x(forecast.cutoffDay).toFixed(1)} ${bottom} L${left} ${bottom}Z"/><path class="forecast-actual-line" d="${pointsPath(actualPoints)}"/><path class="forecast-projected-line" d="${pointsPath(forecastPoints)}"/><line class="forecast-today-line" x1="${x(forecast.cutoffDay).toFixed(1)}" x2="${x(forecast.cutoffDay).toFixed(1)}" y1="${top}" y2="${bottom}"/><circle class="forecast-current-point" cx="${x(forecast.cutoffDay).toFixed(1)}" cy="${y(forecast.actualToDate).toFixed(1)}" r="5"><title>${money(forecast.actualToDate)} spent through ${forecast.cutoffDay} ${monthLabel}</title></circle>${ticks}</svg><div class="forecast-chart-legend"><span><i class="actual"></i>Actual</span><span><i class="projected"></i>Forecast</span><span><i class="typical"></i>Typical range</span></div></div>`;
}

function renderDashboardForecast() {
  const target = document.querySelector('#dashboardForecast');
  if (!target) return;
  const forecast = buildDashboardForecast(data.transactions || [], data.schedules || [], { month:currentMonthKey(), historyMonths:dashboardForecastHistoryMonths, asOf:today() });
  const monthLabel = new Date(`${forecast.month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'long' });
  const previousLabel = new Date(`${forecast.previousMonth}-01T00:00:00`).toLocaleDateString('en-IN', { month:'long' });
  const changeUp = forecast.projectedChange > 0;
  const changeNeutral = Math.abs(forecast.projectedChange) < .5;
  const changeText = !forecast.monthsUsed && !forecast.projectedTotal ? 'Add expenses to build a projection' : !forecast.previousMonthTotal && forecast.projectedTotal ? 'New projected spending' : changeNeutral ? `In line with ${previousLabel}` : `${money(Math.abs(forecast.projectedChange))} ${changeUp ? 'above' : 'below'} ${previousLabel}`;
  const confidenceClass = forecast.confidence.toLowerCase();
  const topDrivers = forecast.drivers.slice(0, 4);
  const maxDriver = Math.max(...topDrivers.map(driver => Math.abs(driver.delta)), 1);
  const categoryRows = forecast.categoryForecasts.slice(0, 4);
  const maxCategory = Math.max(...categoryRows.map(row => row.projected), 1);
  target.innerHTML = `<div class="dashboard-forecast-grid">
    <article class="panel forecast-panel">
      <div class="panel-heading forecast-heading"><div><p class="panel-kicker">SPEND OUTLOOK</p><h3>Expected month spend</h3></div><label class="forecast-range-control"><span class="sr-only">Forecast history</span><select id="dashboardForecastRange" aria-label="Forecast history"><option value="3" ${dashboardForecastHistoryMonths === 3 ? 'selected' : ''}>Last 3 months</option><option value="6" ${dashboardForecastHistoryMonths === 6 ? 'selected' : ''}>Last 6 months</option><option value="12" ${dashboardForecastHistoryMonths === 12 ? 'selected' : ''}>Last 1 year</option></select></label></div>
      <div class="forecast-content"><div class="forecast-primary"><strong>${money(forecast.projectedTotal)} <small>projected</small></strong><p>${money(forecast.actualToDate)} spent through ${forecast.cutoffDay} ${monthLabel.slice(0, 3)}</p><span class="forecast-confidence ${confidenceClass}">${forecast.confidence} confidence</span><small>${forecast.monthsUsed ? `Likely range ${money(forecast.lowEstimate)}–${money(forecast.highEstimate)} · ${forecast.monthsUsed} month${forecast.monthsUsed === 1 ? '' : 's'} used` : 'Add three completed months to establish a reliable range'}</small>${forecast.scheduledRemaining ? `<em>${money(forecast.scheduledRemaining)} in scheduled expenses still due</em>` : ''}</div>${dashboardForecastChart(forecast)}</div>
      <button class="forecast-change-callout ${changeNeutral ? 'neutral' : changeUp ? 'up' : 'down'}" type="button" data-action="dashboard-view-transactions"><span>${changeNeutral ? '→' : changeUp ? '↑' : '↓'}</span><b>${changeText}</b><i>›</i></button>
    </article>
    <article class="panel forecast-drivers-panel">
      <div class="panel-heading"><div><p class="panel-kicker">MONTHLY DRIVERS</p><h3>What changed this month?</h3><p class="panel-caption">${monthLabel} vs ${previousLabel} through ${forecast.cutoffDay}${dashboardForecastOrdinal(forecast.cutoffDay)}</p></div></div>
      <div class="forecast-driver-list">${topDrivers.length ? topDrivers.map(driver => `<button type="button" class="forecast-driver ${driver.delta > 0 ? 'increase' : 'decrease'}" data-action="dashboard-driver" data-category="${esc(driver.category)}"><span class="forecast-driver-icon">${richIcon(dashboardForecastCategoryIcon(driver.category))}</span><p><b>${esc(driver.category)}</b><small>${esc(driver.note)}</small></p><i><em style="width:${Math.max(9, Math.abs(driver.delta) / maxDriver * 100)}%"></em></i><strong>${driver.delta > 0 ? '+' : '−'}${money(Math.abs(driver.delta))}</strong></button>`).join('') : `<div class="forecast-empty"><span>${richIcon('insight-pattern')}</span><b>No monthly change yet</b><small>Add expenses this month to compare them with ${previousLabel}.</small></div>`}</div>
      <div class="forecast-driver-total"><span>Net change</span><strong class="${forecast.toDateChange > 0 ? 'increase' : 'decrease'}">${forecast.toDateChange > 0 ? '+' : forecast.toDateChange < 0 ? '−' : ''}${money(Math.abs(forecast.toDateChange))}</strong><button type="button" data-action="dashboard-view-transactions">View transactions →</button></div>
    </article>
  </div>
  <article class="panel forecast-category-panel"><div class="panel-heading"><div><p class="panel-kicker">CATEGORY OUTLOOK</p><h3>Forecast by category</h3><p class="panel-caption">Historical pattern and expenses still scheduled this month.</p></div><button class="ghost-button" type="button" data-action="dashboard-view-insights">View insights</button></div><div class="forecast-category-list">${categoryRows.length ? categoryRows.map(row => `<button type="button" class="forecast-category" data-action="dashboard-driver" data-category="${esc(row.category)}"><span class="forecast-category-icon">${richIcon(dashboardForecastCategoryIcon(row.category))}</span><p><b>${esc(row.category)}</b><strong>${money(row.projected)}</strong></p><i><em style="width:${Math.max(8, row.projected / maxCategory * 100)}%"></em></i></button>`).join('') : '<p class="forecast-category-empty">Category forecasts will appear after expense history is available.</p>'}</div></article>`;
}
