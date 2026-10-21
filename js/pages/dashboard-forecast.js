let dashboardForecastHistoryMonths = 6;
let dashboardForecastIncludeInvestments = true;
const dashboardDefaultMinimumExpenseReasons = ['essential', 'recurring', 'emergency'];

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
  if (schedule.archived === true) return [];
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

function dashboardScheduledRemaining(transactions, schedules, month, cutoffKey, types = ['expense'], options = {}) {
  const allowedTypes = new Set(types);
  const expenseReasons = options.expenseReasons instanceof Set ? options.expenseReasons : null;
  const byCategory = {};
  const items = [];
  let total = 0;
  (schedules || []).forEach(schedule => {
    if (!allowedTypes.has(schedule.type)) return;
    if (schedule.type === 'expense' && expenseReasons && !expenseReasons.has(String(schedule.expenseReason || ''))) return;
    dashboardScheduleDatesInMonth(schedule, month).filter(date => date > cutoffKey).forEach(date => {
      if ((schedule.skippedMonths || []).includes(date)) return;
      const recurringMatchAllowed = !['Daily', 'Weekly', 'BiMonthly'].includes(schedule.frequency || 'Monthly');
      const scheduleNames = [schedule.title, schedule.subcategory, schedule.category].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
      const posted = transactions.some(transaction => {
        if (transaction.scheduleId === schedule.id && (transaction.periodKey === date || transaction.date === date)) return true;
        if (!recurringMatchAllowed || transaction.type !== schedule.type || !String(transaction.date || '').startsWith(month)) return false;
        if (Math.abs(Number(transaction.amount || 0) - Number(schedule.amount || 0)) >= .01) return false;
        const transactionNames = [transaction.subcategory, transaction.category].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
        return scheduleNames.some(name => transactionNames.includes(name));
      });
      if (posted) return;
      const amount = Number(schedule.amount || 0);
      const category = schedule.category || 'Other';
      total += amount;
      byCategory[category] = (byCategory[category] || 0) + amount;
      items.push({ schedule, date, amount, category });
    });
  });
  return { total, byCategory, items:items.sort((a, b) => a.date.localeCompare(b.date)) };
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
  const minimumExpenseReasons = new Set((Array.isArray(options.minimumExpenseReasons) ? options.minimumExpenseReasons : dashboardDefaultMinimumExpenseReasons).map(value => String(value || '')));
  const minimumBufferMode = ['none','percentage','fixed'].includes(options.minimumBufferMode) ? options.minimumBufferMode : 'none';
  const minimumBufferValue = minimumBufferMode === 'percentage' ? Math.min(100, Math.max(0, Number(options.minimumBufferValue || 0))) : Math.max(0, Number(options.minimumBufferValue || 0));
  const monthDays = dashboardForecastMonthDays(month);
  const isCurrentMonth = asOf.startsWith(month);
  const cutoffDay = isCurrentMonth ? Math.min(monthDays, Number(asOf.slice(8, 10)) || 1) : monthDays;
  const cutoffKey = `${month}-${String(cutoffDay).padStart(2, '0')}`;
  const realRows = dashboardForecastRealRows(transactions);
  const datedRows = transactions.filter(transaction => /^\d{4}-\d{2}-\d{2}$/.test(String(transaction.date || '')));
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
  const scheduledLoans = dashboardScheduledRemaining(transactions, schedules, month, cutoffKey, ['loan']);
  const scheduledInvestments = dashboardScheduledRemaining(transactions, schedules, month, cutoffKey, ['investment']);
  const minimumScheduledExpenses = dashboardScheduledRemaining(transactions, schedules, month, cutoffKey, ['expense'], { expenseReasons:minimumExpenseReasons });
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
  const isMinimumExpense = row => minimumExpenseReasons.has(String(row.expenseReason || ''));
  const minimumHistorySamples = historyMonths.map(historyMonth => dashboardForecastSum(historyRows[historyMonth].filter(isMinimumExpense)));
  const minimumExpenseActual = dashboardForecastSum(currentRows.filter(isMinimumExpense));
  const minimumExpenseHistorical = dashboardForecastMedian(minimumHistorySamples);
  const minimumExpenseCurrent = minimumExpenseActual + minimumScheduledExpenses.total;
  const minimumExpenses = Math.max(minimumExpenseCurrent, minimumExpenseHistorical);
  const postedLoans = dashboardForecastSum(datedRows.filter(row => row.type === 'loan' && row.date.startsWith(month) && row.date <= cutoffKey));
  const postedInvestments = dashboardForecastSum(datedRows.filter(row => row.type === 'investment' && row.date.startsWith(month) && row.date <= cutoffKey));
  const minimumLoanCurrent = postedLoans + scheduledLoans.total;
  const minimumInvestmentCurrent = postedInvestments + scheduledInvestments.total;
  const minimumLoanHistorical = dashboardForecastMedian(historyMonths.map(historyMonth => dashboardForecastSum(datedRows.filter(row => row.type === 'loan' && row.date.startsWith(historyMonth)))));
  const minimumInvestmentHistorical = dashboardForecastMedian(historyMonths.map(historyMonth => dashboardForecastSum(datedRows.filter(row => row.type === 'investment' && row.date.startsWith(historyMonth)))));
  const minimumLoans = Math.max(minimumLoanCurrent, minimumLoanHistorical);
  const minimumInvestments = Math.max(minimumInvestmentCurrent, minimumInvestmentHistorical);
  const minimumRequiredBeforeBuffer = minimumExpenses + minimumLoans;
  const minimumBuffer = minimumBufferMode === 'percentage' ? minimumRequiredBeforeBuffer * minimumBufferValue / 100 : minimumBufferMode === 'fixed' ? minimumBufferValue : 0;
  const minimumRequired = minimumRequiredBeforeBuffer + minimumBuffer;
  const minimumWithInvestments = minimumRequired + minimumInvestments;
  const projectedRequiredOutflow = Math.max(projectedTotal, minimumExpenses) + minimumLoans;
  const projectedOutflowWithInvestments = projectedRequiredOutflow + minimumInvestments;
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
    upcomingCommitments:[...scheduled.items, ...scheduledLoans.items, ...scheduledInvestments.items].sort((a, b) => a.date.localeCompare(b.date)),
    minimum: {
      reasons:[...minimumExpenseReasons],
      bufferMode:minimumBufferMode,
      bufferValue:minimumBufferValue,
      buffer:minimumBuffer,
      requiredBeforeBuffer:minimumRequiredBeforeBuffer,
      expenses:minimumExpenses,
      expenseActual:minimumExpenseActual,
      expenseCurrent:minimumExpenseCurrent,
      expenseHistorical:minimumExpenseHistorical,
      loans:minimumLoans,
      loanCurrent:minimumLoanCurrent,
      loanHistorical:minimumLoanHistorical,
      investments:minimumInvestments,
      investmentCurrent:minimumInvestmentCurrent,
      investmentHistorical:minimumInvestmentHistorical,
      required:minimumRequired,
      withInvestments:minimumWithInvestments,
      projectedRequiredOutflow,
      projectedOutflowWithInvestments,
      actualOutflowToDate:actualToDate + postedLoans + postedInvestments
    },
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

function buildDashboardSpendingTraps(transactions = [], options = {}) {
  const month = options.month || currentMonthKey();
  const asOf = options.asOf || today();
  const historyLimit = Math.max(3, Math.min(12, Number(options.historyMonths) || 6));
  const cutoffDay = asOf.startsWith(month) ? Math.min(dashboardForecastMonthDays(month), Number(asOf.slice(8, 10)) || 1) : dashboardForecastMonthDays(month);
  const cutoffKey = `${month}-${String(cutoffDay).padStart(2, '0')}`;
  const realRows = dashboardForecastRealRows(transactions);
  const currentRows = realRows.filter(row => row.date.startsWith(month) && row.date <= cutoffKey);
  const currentTotal = dashboardForecastSum(currentRows);
  const historyCandidates = Array.from({ length:historyLimit }, (_, index) => dashboardForecastShiftMonth(month, -(index + 1)));
  const historyRows = Object.fromEntries(historyCandidates.map(historyMonth => [historyMonth, realRows.filter(row => row.date.startsWith(historyMonth))]));
  const historyMonths = historyCandidates.filter(historyMonth => historyRows[historyMonth].length);
  const impulseRows = currentRows.filter(row => row.expenseReason === 'impulse');
  const avoidableTotal = dashboardForecastSum(impulseRows);
  const categories = [...new Set([...currentRows.map(row => row.category || 'Other'), ...historyMonths.flatMap(historyMonth => historyRows[historyMonth].map(row => row.category || 'Other'))])];
  const categorySpikes = categories.map(category => {
    const current = dashboardForecastSum(currentRows.filter(row => (row.category || 'Other') === category));
    const samples = historyMonths.map(historyMonth => {
      const comparisonDay = Math.min(cutoffDay, dashboardForecastMonthDays(historyMonth));
      const comparisonKey = `${historyMonth}-${String(comparisonDay).padStart(2, '0')}`;
      return dashboardForecastSum(historyRows[historyMonth].filter(row => (row.category || 'Other') === category && row.date <= comparisonKey));
    });
    const typical = dashboardForecastMedian(samples);
    return { category, current, typical, delta:current - typical };
  }).filter(row => historyMonths.length >= 2 && row.delta >= Math.max(500, row.typical * .25)).sort((a, b) => b.delta - a.delta);
  const smallPurchaseGroups = currentRows.filter(row => Number(row.amount || 0) <= 1000).reduce((groups, row) => {
    const key = row.subcategory || row.category || 'Small purchases';
    const group = groups[key] ||= { label:key, count:0, total:0 };
    group.count += 1;
    group.total += Number(row.amount || 0);
    return groups;
  }, {});
  const repeatedSmall = Object.values(smallPurchaseGroups).filter(group => group.count >= 3 && group.total >= 500).sort((a, b) => b.total - a.total)[0] || null;
  const weekendImpulse = impulseRows.filter(row => {
    const day = new Date(`${row.date}T00:00:00`).getDay();
    return day === 0 || day === 6;
  });
  const weekendImpulseTotal = dashboardForecastSum(weekendImpulse);
  const remainderRisks = categories.map(category => {
    const samples = historyMonths.map(historyMonth => {
      const comparisonDay = Math.min(cutoffDay, dashboardForecastMonthDays(historyMonth));
      const comparisonKey = `${historyMonth}-${String(comparisonDay).padStart(2, '0')}`;
      return dashboardForecastSum(historyRows[historyMonth].filter(row => (row.category || 'Other') === category && row.date > comparisonKey));
    });
    const positiveMonths = samples.filter(value => value > 0).length;
    return { category, typical:dashboardForecastMedian(samples), positiveMonths };
  }).filter(row => row.typical > 0 && row.positiveMonths >= Math.min(2, historyMonths.length)).sort((a, b) => b.typical - a.typical);
  const historicalImpulseCategories = historyMonths.flatMap(historyMonth => historyRows[historyMonth]).filter(row => row.expenseReason === 'impulse').reduce((totals, row) => {
    const key = row.category || 'Other';
    totals[key] = (totals[key] || 0) + Number(row.amount || 0);
    return totals;
  }, {});
  const nextMonthCategory = Object.entries(historicalImpulseCategories).sort((a, b) => b[1] - a[1])[0] || null;
  const patterns = [];
  if (avoidableTotal > 0) patterns.push({ tone:'alert', icon:'insight-alert', title:`${money(avoidableTotal)} in impulse spending`, detail:`${impulseRows.length} tagged purchase${impulseRows.length === 1 ? '' : 's'} · ${Math.round(avoidableTotal / Math.max(1, currentTotal) * 100)}% of real expenses.` });
  const spike = categorySpikes[0];
  if (spike) patterns.push({ tone:'rise', icon:dashboardForecastCategoryIcon(spike.category), title:`${spike.category} is ${money(spike.delta)} above typical`, detail:`Compared with the same point across ${historyMonths.length} recent month${historyMonths.length === 1 ? '' : 's'}.` });
  if (repeatedSmall) patterns.push({ tone:'repeat', icon:'transactions', title:`${repeatedSmall.count} small ${repeatedSmall.label} purchases added up`, detail:`Together they account for ${money(repeatedSmall.total)} this month.` });
  if (patterns.length < 3 && weekendImpulseTotal > 0 && weekendImpulse.length >= 2) patterns.push({ tone:'weekend', icon:'schedule-overview', title:`Weekends account for ${money(weekendImpulseTotal)} of impulse spend`, detail:`${Math.round(weekendImpulseTotal / Math.max(1, avoidableTotal) * 100)}% of this month's impulse-tagged expenses.` });
  const lateMonthRisk = remainderRisks[0] || null;
  if (patterns.length < 3 && lateMonthRisk) patterns.push({ tone:'watch', icon:dashboardForecastCategoryIcon(lateMonthRisk.category), title:`Watch ${lateMonthRisk.category} after the ${cutoffDay}${dashboardForecastOrdinal(cutoffDay)}`, detail:`It typically adds ${money(lateMonthRisk.typical)} before month-end.` });
  const projectedImpact = Math.max(0, Number(options.projectedTotal || currentTotal) - avoidableTotal);
  return { month, cutoffDay, currentTotal, avoidableTotal, projectedImpact, historyMonths, patterns:patterns.slice(0, 3), lateMonthRisk, nextMonthCategory };
}

function renderDashboardSpendingTraps() {
  const target = document.querySelector('#spendingTraps');
  if (!target) return;
  const forecast = buildDashboardForecast(data.transactions || [], data.schedules || [], { month:currentMonthKey(), historyMonths:dashboardForecastHistoryMonths, asOf:today(), minimumExpenseReasons:normalizeSettings(data.settings).bareMinimumExpenseReasons, minimumBufferMode:normalizeSettings(data.settings).bareMinimumBufferMode, minimumBufferValue:normalizeSettings(data.settings).bareMinimumBufferValue });
  const traps = buildDashboardSpendingTraps(data.transactions || [], { month:currentMonthKey(), historyMonths:dashboardForecastHistoryMonths, asOf:today(), projectedTotal:forecast.projectedTotal });
  const avoidableShare = traps.currentTotal ? Math.round(traps.avoidableTotal / traps.currentTotal * 100) : 0;
  const rangeLabel = dashboardForecastHistoryMonths === 12 ? '12-month' : `${dashboardForecastHistoryMonths}-month`;
  const patterns = traps.patterns.length ? traps.patterns.map(pattern => `<article class="spending-trap-row ${pattern.tone}"><span>${richIcon(pattern.icon)}</span><div><b>${esc(pattern.title)}</b><small>${esc(pattern.detail)}</small></div></article>`).join('') : `<div class="spending-traps-empty"><span>${richIcon('credit-paid')}</span><div><b>No strong spending trap detected yet</b><small>Keep tagging expense reasons to make this warning more precise.</small></div></div>`;
  const currentWatch = traps.lateMonthRisk ? `<div><small>Current watch</small><b>${esc(traps.lateMonthRisk.category)}</b><span>Typically ${money(traps.lateMonthRisk.typical)} after day ${traps.cutoffDay}</span></div>` : `<div><small>Current watch</small><b>No late-month pattern yet</b><span>More history will make this signal clearer.</span></div>`;
  const nextWatch = traps.nextMonthCategory ? `<div><small>Next month</small><b>${esc(traps.nextMonthCategory[0])}</b><span>Largest impulse category in the ${rangeLabel} history.</span></div>` : `<div><small>Next month</small><b>Keep tagging reasons</b><span>Impulse history is not strong enough yet.</span></div>`;
  target.innerHTML = `<div class="spending-traps-heading"><div><p class="panel-kicker">EARLY WARNING</p><h3 id="spendingTrapsTitle">Spending traps</h3><p class="panel-caption">Patterns that may push this and next month higher.</p></div><button class="ghost-button" type="button" data-action="dashboard-view-insights">Review</button></div>
    <div class="spending-traps-summary"><div><small>Potentially avoidable</small><strong>${money(traps.avoidableTotal)}</strong><span>${traps.avoidableTotal ? `${avoidableShare}% of real expenses` : 'No impulse expenses tagged'}</span></div><div class="spending-traps-impact"><small>${traps.avoidableTotal ? 'If avoided' : 'Projected finish'}</small><b>${money(traps.projectedImpact)}</b><span>projected real spend</span></div></div>
    <div class="spending-trap-list">${patterns}</div>
    <div class="spending-traps-watch">${currentWatch}${nextWatch}</div>
    <p class="spending-traps-method">Potentially avoidable includes impulse-tagged real expenses. Pattern comparisons use the same day of month across ${traps.historyMonths.length || 0} month${traps.historyMonths.length === 1 ? '' : 's'} with data.</p>`;
}

function dashboardForecastChart(forecast, budget, expenseFloor) {
  const width = 820, height = 270, left = 58, right = 22, top = 22, bottom = 222;
  const chartMax = Math.max(1, budget, expenseFloor, forecast.highEstimate, forecast.projectedTotal) * 1.12;
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
  const budgetPoints = Array.from({ length:forecast.monthDays }, (_, index) => ({ day:index + 1, amount:budget * (index + 1) / forecast.monthDays }));
  const floorPoints = [{ day:1, amount:expenseFloor }, { day:forecast.monthDays, amount:expenseFloor }];
  const grid = Array.from({ length:4 }, (_, index) => {
    const amount = chartMax * index / 3;
    return `<line class="forecast-chart-grid" x1="${left}" x2="${width - right}" y1="${y(amount).toFixed(1)}" y2="${y(amount).toFixed(1)}"/><text class="forecast-chart-axis" x="4" y="${(y(amount) + 4).toFixed(1)}">${compactMoney(amount)}</text>`;
  }).join('');
  const monthLabel = new Date(`${forecast.month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short' });
  const ticks = [...new Set([1, Math.ceil(forecast.monthDays / 2), forecast.cutoffDay, forecast.monthDays])].sort((a, b) => a - b).map(day => `<text class="forecast-chart-axis" x="${x(day).toFixed(1)}" y="258" text-anchor="${day === 1 ? 'start' : day === forecast.monthDays ? 'end' : 'middle'}">${day} ${monthLabel}</text>`).join('');
  const actualHits = actualPoints.map(point => `<circle class="forecast-hover-hit" cx="${x(point.day).toFixed(1)}" cy="${y(point.amount).toFixed(1)}" r="8"><title>${point.day} ${monthLabel}: ${money(point.amount)} cumulative real spend</title></circle>`).join('');
  const forecastHits = forecastPoints.filter((point, index) => index % 2 === 0 || point.day === forecast.monthDays).map(point => `<circle class="forecast-hover-hit" cx="${x(point.day).toFixed(1)}" cy="${y(point.amount).toFixed(1)}" r="8"><title>${point.day} ${monthLabel}: ${money(point.amount)} projected real spend</title></circle>`).join('');
  return `<div class="forecast-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Real expenses ${money(forecast.actualToDate)} through ${forecast.cutoffDay} ${monthLabel}, projected to ${money(forecast.projectedTotal)} against a ${money(budget)} expense budget"><defs><linearGradient id="forecastActualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b43f6" stop-opacity=".27"/><stop offset="1" stop-color="#7b43f6" stop-opacity=".01"/></linearGradient></defs>${grid}${bandPath ? `<path class="forecast-confidence-band" d="${bandPath}"/>` : ''}<path class="forecast-budget-line" d="${pointsPath(budgetPoints)}"/><path class="forecast-floor-line" d="${pointsPath(floorPoints)}"/><path class="forecast-actual-area" d="${pointsPath(actualPoints)} L${x(forecast.cutoffDay).toFixed(1)} ${bottom} L${left} ${bottom}Z"/><path class="forecast-actual-line" d="${pointsPath(actualPoints)}"/><path class="forecast-projected-line" d="${pointsPath(forecastPoints)}"/><line class="forecast-today-line" x1="${x(forecast.cutoffDay).toFixed(1)}" x2="${x(forecast.cutoffDay).toFixed(1)}" y1="${top}" y2="${bottom}"/>${actualHits}${forecastHits}<circle class="forecast-current-point" cx="${x(forecast.cutoffDay).toFixed(1)}" cy="${y(forecast.actualToDate).toFixed(1)}" r="5"><title>${forecast.cutoffDay} ${monthLabel}: ${money(forecast.actualToDate)} actual real spend</title></circle>${ticks}</svg><div class="forecast-chart-legend"><span><i class="actual"></i>Actual</span><span><i class="projected"></i>Forecast</span><span><i class="budget"></i>Expense budget</span><span><i class="floor"></i>Must-pay floor</span></div></div>`;
}

function renderDashboardForecast() {
  const target = document.querySelector('#dashboardForecast');
  if (!target) return;
  const dashboardSettings = normalizeSettings(data.settings);
  const forecast = buildDashboardForecast(data.transactions || [], data.schedules || [], { month:currentMonthKey(), historyMonths:dashboardForecastHistoryMonths, asOf:today(), minimumExpenseReasons:dashboardSettings.bareMinimumExpenseReasons, minimumBufferMode:dashboardSettings.bareMinimumBufferMode, minimumBufferValue:dashboardSettings.bareMinimumBufferValue });
  const monthLabel = new Date(`${forecast.month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'long' });
  const previousLabel = new Date(`${forecast.previousMonth}-01T00:00:00`).toLocaleDateString('en-IN', { month:'long' });
  const confidenceClass = forecast.confidence.toLowerCase();
  const minimum = forecast.minimum;
  const selectedMinimum = dashboardForecastIncludeInvestments ? minimum.withInvestments : minimum.required;
  const selectedProjectedOutflow = dashboardForecastIncludeInvestments ? minimum.projectedOutflowWithInvestments : minimum.projectedRequiredOutflow;
  const minimumDifference = minimum.actualOutflowToDate - selectedMinimum;
  const projectedMinimumDifference = selectedProjectedOutflow - selectedMinimum;
  const minimumDifferenceTone = Math.abs(minimumDifference) < .5 ? 'neutral' : minimumDifference > 0 ? 'over' : 'under';
  const minimumDifferenceText = Math.abs(minimumDifference) < .5
    ? 'Spending matches your baseline'
    : minimumDifference > 0
      ? `${money(minimumDifference)} spent above baseline`
      : `${money(Math.abs(minimumDifference))} remains before baseline`;
  const forecastRangeLabel = dashboardForecastHistoryMonths === 3 ? 'last 3 months' : dashboardForecastHistoryMonths === 12 ? 'last 1 year' : 'last 6 months';
  const forecastHistoryAvailability = forecast.monthsUsed ? `${forecast.monthsUsed} with data` : 'no completed months yet';
  const budget = budgetForMonth(forecast.month);
  const safeToSpend = Math.max(0, budget - forecast.actualToDate - forecast.scheduledRemaining);
  const forecastBudgetDelta = forecast.projectedTotal - budget;
  const status = !budget
    ? { key:'neutral', label:'Set a budget' }
    : forecastBudgetDelta > 0 || minimumDifference > 0
      ? { key:'watch', label:'Watch closely' }
      : { key:'on-track', label:'On track' };
  const attentionEnd = new Date(`${today()}T00:00:00`);
  attentionEnd.setDate(attentionEnd.getDate() + 10);
  const attentionEndKey = `${attentionEnd.getFullYear()}-${String(attentionEnd.getMonth() + 1).padStart(2, '0')}-${String(attentionEnd.getDate()).padStart(2, '0')}`;
  const dueSoon = forecast.upcomingCommitments.filter(item => item.date <= attentionEndKey);
  const dueSoonTotal = dashboardForecastSum(dueSoon);
  const topDriver = forecast.drivers.find(driver => driver.delta > 0) || forecast.drivers[0];
  const requiredGap = minimum.actualOutflowToDate - minimum.required;
  const expenseFloorWidth = selectedMinimum ? minimum.expenses / selectedMinimum * 100 : 0;
  const loanFloorWidth = selectedMinimum ? minimum.loans / selectedMinimum * 100 : 0;
  const bufferFloorWidth = selectedMinimum ? minimum.buffer / selectedMinimum * 100 : 0;
  const investmentFloorWidth = dashboardForecastIncludeInvestments && selectedMinimum ? minimum.investments / selectedMinimum * 100 : 0;
  const reasonLabels = { essential:'Essential', planned:'Planned purchase', holiday:'Holiday', impulse:'Impulse purchase', recurring:'Recurring commitment', emergency:'Emergency', gift:'Gift or support', other:'Other' };
  const minimumReasonSummary = minimum.reasons.length ? minimum.reasons.map(reason => reasonLabels[reason] || reason).join(', ') : 'no expense reasons';
  const bufferLabel = minimum.bufferMode === 'percentage' ? `${minimum.bufferValue}% buffer` : minimum.bufferMode === 'fixed' ? 'Fixed buffer' : 'No buffer';
  target.innerHTML = `<div class="dashboard-forecast-grid outlook-grid">
    <article class="panel forecast-panel outlook-panel">
      <div class="outlook-heading"><div><p class="panel-kicker">THIS MONTH</p><h3>Monthly outlook</h3></div><div class="outlook-heading-actions"><label class="forecast-range-control"><span class="sr-only">Forecast history</span><select id="dashboardForecastRange" aria-label="Forecast history"><option value="3" ${dashboardForecastHistoryMonths === 3 ? 'selected' : ''}>Last 3 months</option><option value="6" ${dashboardForecastHistoryMonths === 6 ? 'selected' : ''}>Last 6 months</option><option value="12" ${dashboardForecastHistoryMonths === 12 ? 'selected' : ''}>Last 1 year</option></select></label><span class="outlook-status ${status.key}">${status.label}</span></div></div>
      <div class="outlook-spend-summary"><strong>${money(forecast.actualToDate)}</strong><span>real expenses through ${forecast.cutoffDay} ${monthLabel.slice(0, 3)}</span><em class="forecast-confidence ${confidenceClass}">${forecast.confidence} confidence</em><small>${forecast.monthsUsed ? `${forecast.monthsUsed} completed month${forecast.monthsUsed === 1 ? '' : 's'} inform the forecast` : 'The projection is still learning'}</small></div>
      <div class="outlook-kpis">
        <article class="projected"><span>${richIcon('insight-pattern')}</span><div><small>Projected finish</small><strong>${money(forecast.projectedTotal)}</strong><p>${forecastBudgetDelta > 0 ? `${money(forecastBudgetDelta)} above` : `${money(Math.abs(forecastBudgetDelta))} below`} expense budget</p></div></article>
        <article class="budget"><span>${richIcon('insight-pace')}</span><div><small>Expense budget</small><strong>${money(budget)}</strong><p>${budget ? `${Math.round(forecast.actualToDate / budget * 100)}% used so far` : 'Add a monthly target'}</p></div></article>
        <article class="minimum"><span>${richIcon('credit-paid')}</span><div><small>Bare minimum</small><strong>${money(selectedMinimum)}</strong><p>${dashboardForecastIncludeInvestments ? 'Includes optional investing' : 'Essentials and loans only'}</p></div></article>
        <article class="safe"><span>${richIcon('real-expenses')}</span><div><small>Safe to spend</small><strong>${money(safeToSpend)}</strong><p>${forecast.scheduledRemaining ? `After ${money(forecast.scheduledRemaining)} still due` : 'Within expense budget'}</p></div></article>
      </div>
      ${dashboardForecastChart(forecast, budget, minimum.expenses)}
      <section class="forecast-minimum" aria-labelledby="forecastMinimumTitle">
        <div class="forecast-minimum-heading"><div><p class="panel-kicker">MONTHLY FLOOR</p><h4 id="forecastMinimumTitle">Bare minimum needed</h4><p>Projected from the ${forecastRangeLabel} (${forecastHistoryAvailability}) using ${esc(minimumReasonSummary)}.</p></div><div class="forecast-minimum-total"><small>${dashboardForecastIncludeInvestments ? 'With investments' : 'Required baseline'}</small><strong>${money(selectedMinimum)}</strong><span class="${minimumDifferenceTone}">${minimumDifferenceText}</span></div></div>
        <div class="outlook-floor-track" aria-label="Bare minimum split"><i class="expense" style="width:${expenseFloorWidth}%"></i><i class="loan" style="width:${loanFloorWidth}%"></i>${minimum.buffer ? `<i class="buffer" style="width:${bufferFloorWidth}%"></i>` : ''}${dashboardForecastIncludeInvestments ? `<i class="investment" style="width:${investmentFloorWidth}%"></i>` : ''}</div>
        <div class="forecast-minimum-parts">
          <article><span class="forecast-minimum-icon expense">${richIcon('real-expenses')}</span><div><small>Must-pay expenses</small><strong>${money(minimum.expenses)}</strong><p>Typical ${money(minimum.expenseHistorical)} · current floor ${money(minimum.expenseCurrent)}</p></div></article>
          <article><span class="forecast-minimum-icon loan">${richIcon('loans')}</span><div><small>Loan commitments</small><strong>${money(minimum.loans)}</strong><p>Typical ${money(minimum.loanHistorical)} · current floor ${money(minimum.loanCurrent)}</p></div></article>
          <article><span class="forecast-minimum-icon buffer">${richIcon('insight-pace')}</span><div><small>Real-life buffer</small><strong>${money(minimum.buffer)}</strong><p>${bufferLabel} on ${money(minimum.requiredBeforeBuffer)}</p></div></article>
          <article class="optional"><span class="forecast-minimum-icon investment">${richIcon('investments')}</span><div><small>Continue investing <em>Optional</em></small><strong>${money(minimum.investments)}</strong><p>Typical ${money(minimum.investmentHistorical)} · current floor ${money(minimum.investmentCurrent)}</p></div><button type="button" role="switch" aria-label="Include monthly investments in the baseline" aria-checked="${dashboardForecastIncludeInvestments}" data-action="dashboard-toggle-investments"><i></i><span>${dashboardForecastIncludeInvestments ? 'Included' : 'Add'}</span></button></article>
        </div>
        <div class="forecast-minimum-footer"><span>Total outflow so far <b>${money(minimum.actualOutflowToDate)}</b></span><span>Projected all-outflow <b>${money(selectedProjectedOutflow)}</b> <em class="${projectedMinimumDifference > 0 ? 'over' : projectedMinimumDifference < 0 ? 'under' : 'neutral'}">${projectedMinimumDifference > 0 ? '+' : projectedMinimumDifference < 0 ? '−' : ''}${money(Math.abs(projectedMinimumDifference))}</em></span></div>
      </section>
    </article>
    <aside class="panel outlook-attention-panel">
      <div class="panel-heading"><div><p class="panel-kicker">ACTION CENTRE</p><h3>What needs attention</h3><p class="panel-caption">The most useful signals for ${monthLabel}.</p></div></div>
      <div class="outlook-attention-list">
        <button type="button" class="outlook-attention-item ${minimumDifference > 0 ? 'alert' : 'positive'}" data-action="dashboard-view-transactions"><span>${richIcon(minimumDifference > 0 ? 'insight-alert' : 'credit-paid')}</span><div><b>${minimumDifference > 0 ? `${money(minimumDifference)} above your baseline` : `${money(Math.abs(minimumDifference))} remaining before baseline`}</b><small>${minimumDifference > 0 ? 'Total outflow has moved beyond your selected monthly floor.' : 'Your outflow remains below the selected monthly floor.'}</small></div><i>›</i></button>
        <button type="button" class="outlook-attention-item due" data-action="dashboard-view-schedule"><span>${richIcon('schedule-overview')}</span><div><b>${dueSoon.length ? `${money(dueSoonTotal)} due in the next 10 days` : 'No commitments due in the next 10 days'}</b><small>${dueSoon.length ? `${dueSoon.length} upcoming commitment${dueSoon.length === 1 ? '' : 's'}, starting ${new Date(`${dueSoon[0].date}T00:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}.` : 'Your current schedule is clear for the next ten days.'}</small></div><i>›</i></button>
        ${topDriver ? `<button type="button" class="outlook-attention-item driver" data-action="dashboard-driver" data-category="${esc(topDriver.category)}"><span>${richIcon(dashboardForecastCategoryIcon(topDriver.category))}</span><div><b>${esc(topDriver.category)} is ${money(Math.abs(topDriver.delta))} ${topDriver.delta > 0 ? 'higher' : 'lower'} than ${previousLabel}</b><small>${esc(topDriver.note)}</small></div><i>›</i></button>` : `<button type="button" class="outlook-attention-item driver" data-action="dashboard-view-insights"><span>${richIcon('insight-pattern')}</span><div><b>Your spending pattern is steady</b><small>Add more activity to reveal meaningful monthly changes.</small></div><i>›</i></button>`}
      </div>
      <button class="outlook-review-button" type="button" data-action="dashboard-view-transactions">Review spending <span>→</span></button>
      <section class="outlook-upcoming" aria-labelledby="dashboardUpcomingTitle">
        <div class="outlook-upcoming-heading"><div><p class="panel-kicker">AUTO-ADDED ON DUE DATE</p><h4 id="dashboardUpcomingTitle">Upcoming</h4></div><button type="button" class="ghost-button" data-action="dashboard-view-schedule">Manage</button></div>
        <div id="upcomingList" class="upcoming-list outlook-upcoming-list"></div>
      </section>
      <div class="outlook-coverage ${requiredGap >= 0 ? 'covered' : 'pending'}"><span>${richIcon(requiredGap >= 0 ? 'credit-paid' : 'insight-alert')}</span><div><b>${requiredGap >= 0 ? 'Required baseline is covered' : `${money(Math.abs(requiredGap))} still needed for the required baseline`}</b><small>${requiredGap >= 0 ? 'Your current outflow covers must-pay expenses, loans, and the selected buffer.' : 'Keep enough available for must-pay expenses, loans, and the selected buffer.'}</small></div></div>
    </aside>
  </div>`;
}
