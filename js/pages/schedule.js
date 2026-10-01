function renderSchedulePage() {
  const meta = {
    expense:{ icon:'real-expenses', color:'purple-bg', label:'Expense', tab:'Expenses', note:'Counted in real expenses' },
    loan:{ icon:'loans', color:'amber-bg', label:'Loan outflow', tab:'Loans', note:'Excluded commitment' },
    investment:{ icon:'investments', color:'teal-bg', label:'Investment outflow', tab:'Investments', note:'Wealth movement' }
  };
  const activeSchedules = data.schedules.filter(schedule => schedule.archived !== true);
  const scheduleAmount = (type) => activeSchedules.filter(schedule => schedule.type === type).reduce((sum, schedule) => sum + scheduleMonthlyAmount(schedule), 0);
  const expenseTotal = scheduleAmount('expense');
  const loanTotal = scheduleAmount('loan');
  const investmentTotal = scheduleAmount('investment');
  const scheduledTotal = expenseTotal + loanTotal + investmentTotal;
  const filtered = data.schedules.filter(schedule => schedule.type === scheduleTab).sort((a, b) => Number(a.archived === true) - Number(b.archived === true) || (a.dueDay || 0) - (b.dueDay || 0));
  const tabButtons = ['expense','loan','investment'].map(type => `<button class="schedule-tab ${scheduleTab === type ? 'active' : ''}" data-action="schedule-tab" data-tab="${type}" type="button"><span class="schedule-tab-icon">${richIcon(meta[type].icon)}</span><span>${meta[type].tab}</span><small>${data.schedules.filter(schedule => schedule.type === type).length}</small></button>`).join('');
  const summaryRows = [
    { label:'Scheduled outflow', value:scheduledTotal, note:'Monthly equivalent across all plans', icon:'schedule-overview', featured:true },
    { label:'Expenses', value:expenseTotal, note:meta.expense.note, icon:'real-expenses' },
    { label:'Loans', value:loanTotal, note:meta.loan.note, icon:'loans' },
    { label:'Investments', value:investmentTotal, note:meta.investment.note, icon:'investments' }
  ];
  const summaryCards = `<section class="finance-kpi-grid schedule-total-grid" aria-label="Scheduled payment summary">${summaryRows.map(row => `<article class="finance-kpi schedule-total-card ${row.featured ? 'featured' : ''}"><span class="finance-kpi-icon">${richIcon(row.icon)}</span><div><span>${row.label}</span><strong>${money(row.value)}</strong><small>${row.note}</small></div></article>`).join('')}</section>`;
  const cards = filtered.map(schedule => `<article class="schedule-card schedule-plan-card ${schedule.archived === true ? 'archived' : ''}">
    <header class="schedule-plan-header"><span class="schedule-plan-icon ${meta[schedule.type].color}">${richIcon(meta[schedule.type].icon)}</span><div class="schedule-plan-copy"><h4>${esc(schedule.subcategory)}</h4><p>${scheduleWhen(schedule)}${schedule.endDate ? ` · ends ${esc(schedule.endDate)}` : ' · no end date'}${schedule.archived === true ? ' · paused' : ''}</p></div><span class="tag">${schedule.archived === true ? 'Archived' : schedule.autoAdd ? 'Auto-add' : 'Manual'}</span></header>
    ${scheduleSummary(schedule)}
    <footer class="schedule-plan-footer"><div class="schedule-plan-amount"><small>Scheduled amount</small><strong>${money(schedule.amount)}</strong></div><div class="schedule-actions"><button class="mini-button" data-action="edit-schedule" data-id="${esc(schedule.id)}">Edit</button><button class="mini-button ${schedule.archived === true ? '' : 'warn'}" data-action="toggle-schedule-archive" data-id="${esc(schedule.id)}">${schedule.archived === true ? 'Unarchive' : 'Archive'}</button>${schedule.archived === true ? '' : `<button class="mini-button warn" data-action="skip-schedule" data-id="${esc(schedule.id)}">Skip once</button>`}<button class="mini-button danger-mini" data-action="confirm-delete-schedule" data-id="${esc(schedule.id)}">Delete</button></div></footer>
  </article>`).join('');
  return `<article class="schedule-page finance-page">
    <section class="panel finance-page-hero schedule-page-hero"><div><p class="panel-kicker">RECURRING MONEY</p><h3>Scheduled payments</h3><p class="subtitle">Plan recurring expenses, loan payments and investments without losing sight of monthly outflow.</p></div><button class="primary-button" data-action="open-schedule">＋ Add schedule</button></section>
    ${summaryCards}
    <section class="panel schedule-workspace"><div class="panel-heading"><div><p class="panel-kicker">ACTIVE PLANS</p><h3>${meta[scheduleTab].tab} schedule</h3><p class="subtitle">${filtered.filter(schedule => schedule.archived !== true).length} active · ${filtered.filter(schedule => schedule.archived === true).length} archived</p></div></div><div class="schedule-tabs" role="tablist" aria-label="Schedule type">${tabButtons}</div>${filtered.length ? `<div class="schedule-grid">${cards}</div>` : `<div class="finance-empty"><span>${richIcon(meta[scheduleTab].icon)}</span><b>No ${meta[scheduleTab].tab.toLowerCase()} schedules yet</b><p>Add one to include it in your recurring money plan.</p></div>`}</section>
  </article>`;
}
