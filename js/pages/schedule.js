function renderSchedulePage() {
  const meta = {
    expense:{ icon:'bag', color:'purple-bg', label:'Expense', tab:'Expenses' },
    loan:{ icon:'receipt', color:'amber-bg', label:'Loan outflow', tab:'Loans' },
    investment:{ icon:'pie', color:'teal-bg', label:'Investment outflow', tab:'Investments' }
  };
  const scheduleAmount = (type) => data.schedules.filter(schedule => schedule.type === type).reduce((sum, schedule) => sum + scheduleMonthlyAmount(schedule), 0);
  const expenseTotal = scheduleAmount('expense');
  const loanTotal = scheduleAmount('loan');
  const investmentTotal = scheduleAmount('investment');
  const scheduledTotal = expenseTotal + loanTotal + investmentTotal;
  const filtered = data.schedules.filter(schedule => schedule.type === scheduleTab);
  const tabButtons = ['expense','loan','investment'].map(type => `<button class="schedule-tab ${scheduleTab === type ? 'active' : ''}" data-action="schedule-tab" data-tab="${type}" type="button"><span>${meta[type].tab}</span><small>${data.schedules.filter(schedule => schedule.type === type).length}</small></button>`).join('');
  const summaryCards = `<div class="schedule-total-grid"><div class="schedule-total-card featured"><span>Scheduled outflow</span><strong>${money(scheduledTotal)}</strong><small>Expenses + loans + investments</small></div><div class="schedule-total-card"><span>Expenses</span><strong>${money(expenseTotal)}</strong><small>Counted in real expenses</small></div><div class="schedule-total-card"><span>Loans</span><strong>${money(loanTotal)}</strong><small>Excluded commitment</small></div><div class="schedule-total-card"><span>Investments</span><strong>${money(investmentTotal)}</strong><small>Wealth movement</small></div></div>`;
  const cards = filtered.map(schedule => `<div class="schedule-card"><div class="schedule-card-heading"><span class="upcoming-icon ${meta[schedule.type].color}">${svgIcon(meta[schedule.type].icon)}</span><span class="tag">${schedule.autoAdd ? 'Auto-add' : 'Manual'}</span></div><h4>${schedule.subcategory}</h4><p>${scheduleWhen(schedule)}${schedule.endDate ? ` · ends ${schedule.endDate}` : ' · no end date'}</p><div class="schedule-meta"><strong>${money(schedule.amount)}</strong></div>${scheduleSummary(schedule)}<div class="schedule-actions"><button class="mini-button" data-action="edit-schedule" data-id="${schedule.id}">Edit</button><button class="mini-button warn" data-action="skip-schedule" data-id="${schedule.id}">Skip once</button></div></div>`).join('');
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">AUTO-ADD ON DUE DATE</p><h3>Scheduled payments</h3></div><button class="primary-button" data-action="open-schedule">＋ Add schedule</button></div>${summaryCards}<div class="schedule-tabs" role="tablist" aria-label="Schedule type">${tabButtons}</div>${filtered.length ? `<div class="schedule-grid">${cards}</div>` : `<p class="empty-state">No ${meta[scheduleTab].tab.toLowerCase()} schedules yet.</p>`}</article>`;
}
