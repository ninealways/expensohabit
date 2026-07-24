// Insights page renderer. Depends on shared helpers from app.js.

function donutPoint(cx, cy, radius, angle) { const radians = (angle - 90) * Math.PI / 180; return { x:cx + radius * Math.cos(radians), y:cy + radius * Math.sin(radians) }; }
function donutArc(cx, cy, radius, startAngle, endAngle) { const start = donutPoint(cx, cy, radius, endAngle); const end = donutPoint(cx, cy, radius, startAngle); const largeArc = endAngle - startAngle <= 180 ? 0 : 1; return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`; }
function renderCategoryDonut(rows, total) {
  if (!rows.length || !total) return '<p class="empty-state">No real expenses in this range.</p>';
  const palette = ['#3f64b7','#7857f4','#9a4fd1','#e84579','#ff715c','#f4b845','#35bfa9'];
  let angle = -18;
  const chart = { width:420, height:270, cx:210, cy:132, ringRadius:68, calloutInner:92, calloutOuter:126, minY:30, maxY:240 };
  const segments = rows.map(([category, value], index) => {
    const span = Math.max(2, value / total * 360);
    const start = angle;
    const end = angle + span;
    angle = end;
    return { category, value, start, end, mid:start + span / 2, color:palette[index % palette.length] };
  });
  const labelSeed = segments.map(segment => {
    const side = Math.cos((segment.mid - 90) * Math.PI / 180) >= 0 ? 'right' : 'left';
    const p2 = donutPoint(chart.cx, chart.cy, chart.calloutOuter, segment.mid);
    return { segment, side, naturalY:Math.max(chart.minY, Math.min(chart.maxY, p2.y)) };
  });
  const spreadLabelYs = (items) => {
    const ordered = items.slice().sort((a, b) => a.naturalY - b.naturalY);
    const gap = 34;
    ordered.forEach((item, index) => {
      item.y = index ? Math.max(item.naturalY, ordered[index - 1].y + gap) : item.naturalY;
    });
    const overflow = ordered.length ? ordered[ordered.length - 1].y - chart.maxY : 0;
    if (overflow > 0) ordered.forEach(item => { item.y -= overflow; });
    for (let index = ordered.length - 2; index >= 0; index -= 1) {
      ordered[index].y = Math.min(ordered[index].y, ordered[index + 1].y - gap);
    }
    ordered.forEach(item => { item.y = Math.max(chart.minY, Math.min(chart.maxY, item.y)); });
    return ordered;
  };
  const labelLayouts = [...spreadLabelYs(labelSeed.filter(label => label.side === 'left')), ...spreadLabelYs(labelSeed.filter(label => label.side === 'right'))];
  const labels = labelLayouts.map(({ segment, side, y }) => {
    const p1 = donutPoint(chart.cx, chart.cy, chart.calloutInner, segment.mid);
    const p2 = donutPoint(chart.cx, chart.cy, chart.calloutOuter, segment.mid);
    const endX = side === 'right' ? 366 : 54;
    const textX = side === 'right' ? 376 : 44;
    const anchor = side === 'right' ? 'start' : 'end';
    return `<g class="donut-callout ${side}"><path d="M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${y.toFixed(1)} L ${endX} ${y.toFixed(1)}" stroke="${segment.color}" /><text x="${textX}" y="${(y - 6).toFixed(1)}" text-anchor="${anchor}" class="callout-amount">${money(segment.value)}</text><text x="${textX}" y="${(y + 11).toFixed(1)}" text-anchor="${anchor}" class="callout-name">${segment.category}</text></g>`;
  }).join('');
  return `<div class="category-donut-wrap"><svg class="category-donut-svg" viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="Category-wise expense donut chart">${segments.map(segment => `<path d="${donutArc(chart.cx, chart.cy, chart.ringRadius, segment.start, segment.end)}" stroke="${segment.color}" />`).join('')}<circle cx="${chart.cx}" cy="${chart.cy}" r="41" class="donut-hole" /><text x="${chart.cx}" y="${chart.cy - 6}" text-anchor="middle" class="donut-center-label">Real spend</text><text x="${chart.cx}" y="${chart.cy + 17}" text-anchor="middle" class="donut-center-value">${money(total)}</text>${labels}</svg></div>`;
}
function categoryChartRows(entries, limit = 7) {
  const otherTotal = entries
    .filter(([category]) => category === 'Other')
    .reduce((sum, [, value]) => sum + value, 0);
  const primaryEntries = entries.filter(([category]) => category !== 'Other').slice(0, limit - 1);
  const rolledOtherTotal = entries
    .filter(([category]) => category !== 'Other')
    .slice(limit - 1)
    .reduce((sum, [, value]) => sum + value, 0);
  const combinedOther = otherTotal + rolledOtherTotal;
  return combinedOther ? [...primaryEntries, ['Other', combinedOther]] : entries.filter(([category]) => category !== 'Other').slice(0, limit);
}
function renderCategoryAmountPills(entries, total) {
  if (!entries.length || !total) return '';
  return `<div class="category-amount-pills">${entries.map(([category, value]) => `<span title="${category}: ${money(value)}"><b>${category}</b><strong>${money(value)}</strong><em>${percent(value, total)}%</em></span>`).join('')}</div>`;
}
function renderSpendPriorityChart(items) {
  const totals = items.reduce((acc, item) => {
    const key = categorySpendGroup(item.category);
    acc[key] = (acc[key] || 0) + Number(item.amount || 0);
    return acc;
  }, {});
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const rows = Object.entries(spendGroups).map(([key, group]) => ({ key, ...group, value:totals[key] || 0 })).filter(row => row.value > 0).sort((a, b) => b.value - a.value);
  if (!rows.length || !total) return '<p class="empty-state">Classify expense categories to see spend priority.</p>';
  const optional = (totals.goodToHave || 0) + (totals.leisure || 0);
  const essential = (totals.need || 0) + (totals.commitment || 0);
  return `<div class="priority-chart"><div class="priority-stack">${rows.map(row => `<span style="--w:${row.value / total * 100}%;--c:${row.color}" title="${row.label}: ${money(row.value)}"></span>`).join('')}</div><div class="priority-summary"><div><small>Essential</small><b>${money(essential)}</b><em>${percent(essential, total)}%</em></div><div><small>Optional</small><b>${money(optional)}</b><em>${percent(optional, total)}%</em></div><div><small>Growth</small><b>${money(totals.growth || 0)}</b><em>${percent(totals.growth || 0, total)}%</em></div></div><div class="priority-list">${rows.map(row => `<div><span style="--c:${row.color}">${svgIcon(row.icon)}</span><b>${row.label}</b><strong>${money(row.value)}</strong><em>${percent(row.value, total)}%</em></div>`).join('')}</div></div>`;
}
function daysBetweenInclusive(from, to) { return Math.max(1, Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1); }
function budgetForMonth(month) {
  const settings = normalizeSettings(data.settings);
  return Number(settings.monthlyBudgetOverrides?.[month]) || settings.monthlyExpenseBudget;
}
function budgetForRange(range) {
  const months = monthKeysBetween(range.from, range.to);
  const totalBudget = months.reduce((sum, month) => sum + budgetForMonth(month), 0);
  return { months, totalBudget, averageMonthlyBudget:totalBudget / Math.max(1, months.length) };
}
function spendVelocity(range, value) {
  const todayKey = today();
  const periodDays = daysBetweenInclusive(range.from, range.to);
  const elapsedTo = todayKey >= range.from && todayKey <= range.to ? todayKey : range.to;
  const elapsedDays = todayKey < range.from ? 0 : daysBetweenInclusive(range.from, elapsedTo);
  const projected = elapsedDays && elapsedDays < periodDays ? value / elapsedDays * periodDays : value;
  const pace = Math.min(100, Math.round(elapsedDays / periodDays * 100));
  const budget = budgetForRange(range);
  const expectedToDate = budget.totalBudget / periodDays * Math.max(1, elapsedDays || periodDays);
  const dailyBudget = budget.totalBudget / periodDays;
  const variance = projected - budget.totalBudget;
  const status = variance > 0 ? `Projected ${money(variance)} above target` : `${money(Math.abs(variance))} under target at current pace`;
  return { periodDays, elapsedDays, pace, projected, daily:value / Math.max(1, elapsedDays || periodDays), dailyBudget, expectedToDate, target:budget.totalBudget, averageMonthlyBudget:budget.averageMonthlyBudget, months:budget.months.length, variance, status, statusTone:variance > 0 ? 'over' : 'under' };
}
function monthKeysBetween(from, to) {
  const keys = [];
  for (let date = new Date(`${from.slice(0, 7)}-01T00:00:00`); monthInputKey(date) <= to.slice(0, 7); date = addMonthsToDate(date, 1)) keys.push(monthInputKey(date));
  return keys;
}
function sparklinePath(values, width = 120, height = 34) {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values.map((value, index) => `${index ? 'L' : 'M'} ${(index * step).toFixed(1)} ${(height - value / max * height).toFixed(1)}`).join(' ');
}
function renderCategoryTrends(items, range, currentCats) {
  const months = monthKeysBetween(range.from, range.to);
  const topCategories = Object.entries(currentCats).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([category]) => category);
  if (!topCategories.length) return '<p class="empty-state">No category trend yet.</p>';
  return `<div class="trend-list">${topCategories.map(category => { const values = months.map(month => sumAmount(items.filter(item => item.category === category && item.date.slice(0, 7) === month))); const first = values[0] || 0; const last = values[values.length - 1] || 0; const change = last - first; return `<div class="trend-item"><div><b>${category}</b><small>${months[0]} → ${months[months.length - 1]}</small></div><svg viewBox="0 0 120 34" preserveAspectRatio="none"><path d="${sparklinePath(values)}" /></svg><strong class="${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '▲' : '▼'} ${money(Math.abs(change))}</strong></div>`; }).join('')}</div>`;
}
function insightTransactions(filter = insightFilter) { const range = insightRange(filter); return data.transactions.filter(t => t.date >= range.from && t.date <= range.to); }

function renderInsightFilters(filter = insightFilter) {
  const fromMonth = filter.fromMonth || currentMonthKey();
  const toMonth = filter.toMonth || fromMonth;
  const fromYear = filter.fromYear || currentYear();
  const toYear = filter.toYear || fromYear;
  return `<form id="insightFilters" class="insight-range-control">
    <button type="button" class="${filter.mode === 'thisMonth' ? 'active' : ''}" data-insight-preset="thisMonth">This month</button>
    <label class="${filter.mode === 'monthRange' ? 'active' : ''}">Month range<input name="fromMonth" type="text" data-picker="month" value="${fromMonth}" placeholder="From month" /><span>to</span><input name="toMonth" type="text" data-picker="month" value="${toMonth}" placeholder="To month" /><button type="submit" data-insight-mode="monthRange">Apply</button></label>
    <label class="${filter.mode === 'yearRange' ? 'active' : ''}">Year range<select name="fromYear">${insightYearOptions(fromYear)}</select><span>to</span><select name="toYear">${insightYearOptions(toYear)}</select><button type="submit" data-insight-mode="yearRange">Apply</button></label>
  </form>`;
}
function buildKeyInsights(current, previous, sums, fixedTotal) {
  const currentCats = categoryTotals(current.filter(t => t.type === 'expense' && t.includeInReal !== false));
  const previousCats = categoryTotals(previous.filter(t => t.type === 'expense' && t.includeInReal !== false));
  const movers = Object.keys({ ...currentCats, ...previousCats }).map(category => ({ category, current:currentCats[category] || 0, previous:previousCats[category] || 0, change:(currentCats[category] || 0) - (previousCats[category] || 0) })).sort((a,b) => Math.abs(b.change) - Math.abs(a.change));
  const dayTotals = current.reduce((acc, item) => { acc[item.date] = (acc[item.date] || 0) + item.amount; return acc; }, {});
  const biggestDay = Object.entries(dayTotals).sort((a,b) => b[1] - a[1])[0];
  const smallRepeated = Object.entries(subcategoryTotals(current.filter(t => t.type === 'expense' && t.amount <= 1000))).sort((a,b) => b[1] - a[1])[0];
  const topMover = movers[0];
  return [
    topMover ? `${topMover.category} ${topMover.change >= 0 ? 'up' : 'down'} ${money(Math.abs(topMover.change))} vs previous period` : 'Add more transactions to compare category movement',
    `${percent(fixedTotal, sums.total)}% of total outflow is fixed or recurring`,
    biggestDay ? `${biggestDay[0]} had the highest outflow at ${money(biggestDay[1])}` : 'No outflow recorded in this range',
    smallRepeated ? `${smallRepeated[0]} totals ${money(smallRepeated[1])}; review if this is a recurring leak` : 'No small repeated spend pattern found yet'
  ];
}
function renderInsightsPage(filter = insightFilter) {
  const range = insightRange(filter);
  const current = insightTransactions(filter);
  const previousRange = previousInsightRange(filter, range);
  const previous = data.transactions.filter(t => t.date >= previousRange.from && t.date <= previousRange.to);
  const groups = { expense:current.filter(t => t.type === 'expense'), loan:current.filter(t => t.type === 'loan'), investment:current.filter(t => t.type === 'investment') };
  const sums = { expense:sumAmount(groups.expense), real:sumAmount(groups.expense.filter(t => t.includeInReal !== false)), loan:sumAmount(groups.loan), investment:sumAmount(groups.investment) };
  sums.total = sums.expense + sums.loan + sums.investment;
  const fixedTotal = sumAmount(current.filter(t => t.scheduleId || t.type === 'loan' || t.type === 'investment'));
  const variableTotal = Math.max(0, sums.total - fixedTotal);
  const moneyFlowRows = [
    { label:'Real expenses', value:sums.real, cls:'purple', note:'Day-to-day spend' },
    { label:'Loans', value:sums.loan, cls:'amber', note:'Excluded from top categories' },
    { label:'Investments', value:sums.investment, cls:'teal', note:'Portfolio outflow' },
    { label:'Fixed commitments', value:fixedTotal, cls:'blue', note:'Scheduled and recurring outflow' }
  ];
  const keyInsights = buildKeyInsights(current, previous, sums, fixedTotal);
  const currentCats = categoryTotals(groups.expense.filter(t => t.includeInReal !== false));
  const categoryEntries = Object.entries(currentCats).sort((a,b) => b[1] - a[1]);
  const categoryChartTotal = categoryEntries.reduce((sum, [, value]) => sum + value, 0);
  const categoryRows = categoryChartRows(categoryEntries);
  const previousCats = categoryTotals(previous.filter(t => t.type === 'expense' && t.includeInReal !== false));
  const topMovers = Object.keys({ ...currentCats, ...previousCats }).map(category => ({ category, current:currentCats[category] || 0, previous:previousCats[category] || 0, change:(currentCats[category] || 0) - (previousCats[category] || 0) })).sort((a,b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5);
  const velocity = spendVelocity(range, sums.real);
  const velocityTargetPct = percent(sums.real, velocity.target);
  const expenseItems = groups.expense.filter(t => t.includeInReal !== false);
  const transactionsByDay = expenseItems.reduce((acc, item) => {
    acc[item.date] = acc[item.date] || [];
    acc[item.date].push(item);
    return acc;
  }, {});
  const dayTotals = Object.fromEntries(Object.entries(transactionsByDay).map(([date, items]) => [date, sumAmount(items)]));
  const averageDay = Object.values(dayTotals).reduce((sum, value) => sum + value, 0) / Math.max(1, Object.keys(dayTotals).length);
  const unusualCategoryAlerts = Object.keys({ ...currentCats, ...previousCats }).map(category => {
    const value = currentCats[category] || 0;
    const previousValue = previousCats[category] || 0;
    const biggestItem = expenseItems.filter(t => t.category === category).sort((a,b) => b.amount - a.amount)[0];
    return {
      type:'Category spike',
      title:category,
      value,
      delta:value - previousValue,
      reason:`${money(value - previousValue)} above ${previousRange.label} baseline of ${money(previousValue)}.`,
      detail:biggestItem ? `Largest item: ${biggestItem.subcategory || biggestItem.category} on ${biggestItem.date} for ${money(biggestItem.amount)}.` : `Happened during ${range.label}.`,
      action:'Check if this was one-time; if yes, keep it separate from recurring budgets.'
    };
  }).filter(item => item.delta >= 1000 && item.value > (previousCats[item.title] || 0) * 1.5).sort((a,b) => b.delta - a.delta).slice(0, 2);
  const unusualDayAlerts = Object.entries(dayTotals).filter(([, value]) => value > averageDay * 1.8 && value >= 1000).sort((a,b) => b[1] - a[1]).slice(0, 2).map(([date, value]) => {
    const biggestItem = (transactionsByDay[date] || []).slice().sort((a,b) => b.amount - a.amount)[0];
    const multiple = averageDay ? Math.round((value / averageDay) * 10) / 10 : 0;
    return {
      type:'High-spend day',
      title:date,
      value,
      delta:value - averageDay,
      reason:`${multiple}× the selected-range daily average of ${money(averageDay)}.`,
      detail:biggestItem ? `Largest expense: ${biggestItem.subcategory || biggestItem.category} in ${biggestItem.category} for ${money(biggestItem.amount)}.` : 'No single expense detail available.',
      action:'Review expenses on this date and mark expected recurring expenses as schedules.'
    };
  });
  const unusualAlerts = [...unusualCategoryAlerts, ...unusualDayAlerts].slice(0, 4);
  const heatCategories = Object.entries(currentCats).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([category]) => category);
  const heatValues = {};
  groups.expense.filter(t => t.includeInReal !== false).forEach(t => { const key = `${t.category}-${weekOfMonth(t.date)}`; heatValues[key] = (heatValues[key] || 0) + t.amount; });
  const heatMax = Math.max(...Object.values(heatValues), 1);
  const scheduled = data.schedules.slice().sort((a,b) => (a.dueDay || 31) - (b.dueDay || 31)).slice(0, 5);
  return `<article class="insights-shell">
    <section class="insights-hero panel">
      <div><p class="panel-kicker">SPEND ANALYSIS</p><h3>Spend Insights</h3><p class="subtitle">Where your money is flowing for ${range.label}. Compared with ${previousRange.label}.</p></div>
      ${renderInsightFilters(filter)}
    </section>
    <section class="insights-grid-main">
      <div class="panel money-flow-panel"><div class="panel-heading"><div><p class="panel-kicker">MONEY FLOW</p><h3>Money flow</h3><p class="subtitle">How your money is distributed</p></div><button class="ghost-button" data-page="outflow">View report</button></div><div class="flow-stage radial-split"><div class="flow-total"><small>Total outflow</small><strong>${money(sums.total)}</strong></div><div class="flow-lines">${moneyFlowRows.map((row, index) => `<div class="flow-row ${row.cls}"><span class="flow-row-icon">${svgIcon(['bag','receipt','pie','lock'][index])}</span><div class="flow-row-text"><b>${row.label}</b><small>${row.note}</small></div><strong>${money(row.value)}</strong><em>${percent(row.value, sums.total)}%</em></div>`).join('')}</div></div><p class="flow-note"><span>ⓘ</span> Loans and investments are shown in the flow but excluded from real-expense ranking.</p></div>
      <div class="panel category-chart-panel"><div class="panel-heading"><div><p class="panel-kicker">SELECTED RANGE</p><h3>Category chart</h3><p class="subtitle">Real expense categories for ${range.label}</p></div></div>${renderCategoryDonut(categoryRows, categoryChartTotal)}${renderCategoryAmountPills(categoryEntries, categoryChartTotal)}</div>
    </section>
    <section class="insights-lower-grid">
      <div class="panel heatmap-panel"><div class="panel-heading"><div><p class="panel-kicker">WEEKLY PATTERN</p><h3>Category heatmap</h3></div></div><div class="heatmap-head"><span></span><span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span></div>${heatCategories.length ? heatCategories.map(category => `<div class="heatmap-row"><b>${category}</b>${[1,2,3,4,5].map(week => { const value = heatValues[`${category}-${week}`] || 0; return `<span title="${category} week ${week}: ${money(value)}" style="opacity:${value ? Math.max(.25, value / heatMax) : .12}"></span>`; }).join('')}</div>`).join('') : '<p class="empty-state">Add real expenses to populate the heatmap.</p>'}<div class="heatmap-scale"><small>Low</small><i></i><small>High</small></div></div>
      <div class="panel split-panel"><div class="panel-heading"><div><p class="panel-kicker">STRUCTURE</p><h3>Fixed vs variable</h3></div></div><div class="donut" style="--fixed:${percent(fixedTotal, sums.total) * 3.6}deg"><div><strong>${percent(fixedTotal, sums.total)}%</strong><small>Fixed</small></div></div><div class="split-legend"><span><i class="legend-dot purple"></i>Fixed / recurring <b>${money(fixedTotal)}</b></span><span><i class="legend-dot amber"></i>Variable <b>${money(variableTotal)}</b></span></div></div>
      <div class="panel velocity-panel"><div class="panel-heading"><div><p class="panel-kicker">SPEND VELOCITY</p><h3>Pace check</h3></div></div><div class="velocity-meter"><div class="velocity-ring" style="--pace:${Math.min(100, velocityTargetPct) * 3.6}deg"><strong>${velocityTargetPct}%</strong><small>of target</small></div><div class="velocity-copy"><p class="velocity-status ${velocity.statusTone}">${velocity.status}</p><b>${money(sums.real)}</b><div class="velocity-detail-list"><span><i>${svgIcon('bag')}</i><span class="velocity-text">Actual real spend so far <b>${money(sums.real)}</b></span></span><span><i>${svgIcon('insights')}</i><span class="velocity-text">Projected month-end <b class="${velocity.statusTone}">${money(velocity.projected)}</b></span></span><span><i>${svgIcon('tag')}</i><span class="velocity-text">Target <b>${money(velocity.target)}</b>${velocity.months > 1 ? ` · Avg monthly <b>${money(velocity.averageMonthlyBudget)}</b>` : ''}</span></span><span><i>${svgIcon('bolt')}</i><span class="velocity-text">Daily budget <b>${money(velocity.dailyBudget)}</b><small>Actual <b>${money(velocity.daily)}</b> per active day</small></span></span></div></div></div></div>
      <div class="panel priority-panel"><div class="panel-heading"><div><p class="panel-kicker">SPEND PRIORITY</p><h3>Need vs optional</h3><p class="subtitle">Only real expenses. Loans and investments are excluded.</p></div><button class="ghost-button" data-page="settings">Classify</button></div>${renderSpendPriorityChart(expenseItems)}</div>
      <div class="panel movers-panel"><div class="panel-heading"><div><p class="panel-kicker">CHANGE</p><h3>Top movers</h3></div></div><table class="outflow-table"><thead><tr><th>Category</th><th>This period</th><th>Change</th></tr></thead><tbody>${topMovers.length ? topMovers.map(item => `<tr><td>${item.category}</td><td>${money(item.current)}</td><td><span class="change-chip ${item.change >= 0 ? 'up' : 'down'}">${item.change >= 0 ? '▲' : '▼'} ${money(Math.abs(item.change))}</span></td></tr>`).join('') : '<tr><td colspan="3">No comparison yet.</td></tr>'}</tbody></table></div>
      <div class="panel recurring-panel"><div class="panel-heading"><div><p class="panel-kicker">COMMITMENTS</p><h3>Recurring commitments</h3></div><button class="ghost-button" data-page="schedule">Manage</button></div><div class="commitment-list">${scheduled.length ? scheduled.map(schedule => `<div class="commitment-item"><span class="upcoming-icon ${schedule.type === 'loan' ? 'amber-bg' : schedule.type === 'investment' ? 'teal-bg' : 'purple-bg'}">${svgIcon(schedule.type === 'loan' ? 'receipt' : schedule.type === 'investment' ? 'pie' : 'bag')}</span><div><b>${schedule.subcategory}</b><small>${scheduleWhen(schedule)}</small></div><strong>${money(schedule.amount)}</strong></div>`).join('') : '<p class="empty-state">No schedules configured.</p>'}</div></div>
    </section>
    <section class="insights-extra-grid">
      <div class="panel alerts-panel"><div class="panel-heading"><div><p class="panel-kicker">UNUSUAL SPEND</p><h3>Alerts</h3></div></div><div class="alert-list">${unusualAlerts.length ? unusualAlerts.map(alert => `<div class="alert-item"><div><span>${alert.type}</span><b>${alert.title}</b></div><strong>${money(alert.value)}</strong><small>${alert.reason}</small><small>${alert.detail}</small><em>${alert.action}</em></div>`).join('') : '<p class="empty-state">No unusual category or day spikes found for this range.</p>'}</div></div>
      <div class="panel trend-panel"><div class="panel-heading"><div><p class="panel-kicker">MONTHLY TREND</p><h3>Category trend</h3></div></div>${renderCategoryTrends(groups.expense.filter(t => t.includeInReal !== false), range, currentCats)}</div>
      <div class="panel insight-list-panel"><div class="panel-heading"><div><p class="panel-kicker">ACTIONABLE</p><h3>Key insights</h3></div></div><div class="key-insight-list">${keyInsights.map((text, index) => `<div class="key-insight"><span>${svgIcon(['fork','calendar','car','tag'][index])}</span><p>${text}</p></div>`).join('')}</div><button class="primary-button insight-wide-button" data-page="investments">View investments</button></div>
    </section>
  </article>`;
}
