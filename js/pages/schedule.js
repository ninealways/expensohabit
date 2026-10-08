function scheduleLoanIsClosed(schedule, asOf = today()) {
  if (schedule?.type !== 'loan') return false;
  if (schedule.loanClosed === true) return true;
  if (schedule.loanClosed === false) return false;
  const hasRemainingPrincipal = schedule.remainingPrincipal !== undefined && schedule.remainingPrincipal !== null && schedule.remainingPrincipal !== '';
  if (hasRemainingPrincipal && Number(schedule.remainingPrincipal) <= 0) return true;
  return Boolean(schedule.endDate && schedule.endDate < asOf);
}

function scheduleStatus(schedule) {
  if (schedule.archived === true) return { key:'archived', label:'Archived' };
  if (scheduleLoanIsClosed(schedule)) return { key:'closed', label:'Closed' };
  return { key:'active', label:schedule.autoAdd ? 'Auto-add' : 'Manual' };
}

function scheduleSortValue(schedule) {
  if (schedule.archived === true) return 2;
  if (scheduleLoanIsClosed(schedule)) return 1;
  return 0;
}

function scheduleDateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return value || '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function schedulePlanInsight(schedule) {
  if (schedule.type === 'expense') return '';
  if (schedule.type === 'loan') {
    const projection = loanProjection(schedule);
    if (!projection) return '';
    return `<div class="schedule-plan-insight loan-insight"><div><small>Principal left</small><b>${money(schedule.remainingPrincipal || projection.principalPaid)}</b></div><div><small>Est. interest</small><b>${money(projection.interest)}</b></div><div><small>Remaining term</small><b>${projection.months} months</b></div><div><small>Rate type</small><b>${schedule.interestType === 'floating' ? 'Floating' : 'Fixed'}</b></div></div>`;
  }
  const projection = investmentProjection(schedule);
  if (!projection) return '';
  const gainClass = projection.gain >= 0 ? 'positive' : 'negative';
  return `<div class="schedule-plan-insight investment-insight"><div><small>Invested</small><b>${money(projection.invested)}</b></div><div><small>Net value</small><b>${money(projection.netValue)}</b></div><div><small>${projection.gain >= 0 ? 'Gain' : 'Loss'}</small><b class="${gainClass}">${projection.gain >= 0 ? '+' : '−'}${money(Math.abs(projection.gain))}</b></div><div><small>${projection.projected ? `Projected · ${projection.projectionEndDate}` : 'Valuation date'}</small><b>${projection.projected ? money(projection.futureValue) : projection.valuationDate}</b></div></div>`;
}

function renderSchedulePage() {
  const meta = {
    expense:{ icon:'real-expenses', color:'purple-bg', label:'Expense', tab:'Expenses', note:'Counted in real expenses' },
    loan:{ icon:'loans', color:'amber-bg', label:'Loan outflow', tab:'Loans', note:'Excluded commitment' },
    investment:{ icon:'investments', color:'teal-bg', label:'Investment outflow', tab:'Investments', note:'Wealth movement' }
  };
  const activeSchedules = data.schedules.filter(schedule => schedule.archived !== true && !scheduleLoanIsClosed(schedule));
  const scheduleAmount = (type) => activeSchedules.filter(schedule => schedule.type === type).reduce((sum, schedule) => sum + scheduleMonthlyAmount(schedule), 0);
  const expenseTotal = scheduleAmount('expense');
  const loanTotal = scheduleAmount('loan');
  const investmentTotal = scheduleAmount('investment');
  const scheduledTotal = expenseTotal + loanTotal + investmentTotal;
  const filtered = data.schedules.filter(schedule => schedule.type === scheduleTab).sort((a, b) => scheduleSortValue(a) - scheduleSortValue(b) || (a.dueDay || 0) - (b.dueDay || 0) || String(a.subcategory || '').localeCompare(String(b.subcategory || '')));
  const tabButtons = ['expense','loan','investment'].map(type => `<button class="schedule-tab ${scheduleTab === type ? 'active' : ''}" data-action="schedule-tab" data-tab="${type}" type="button"><span class="schedule-tab-icon">${richIcon(meta[type].icon)}</span><span>${meta[type].tab}</span><small>${data.schedules.filter(schedule => schedule.type === type).length}</small></button>`).join('');
  const summaryRows = [
    { label:'Scheduled outflow', value:scheduledTotal, note:'Monthly equivalent across all plans', icon:'schedule-overview', featured:true },
    { label:'Expenses', value:expenseTotal, note:meta.expense.note, icon:'real-expenses' },
    { label:'Loans', value:loanTotal, note:meta.loan.note, icon:'loans' },
    { label:'Investments', value:investmentTotal, note:meta.investment.note, icon:'investments' }
  ];
  const summaryCards = `<section class="finance-kpi-grid schedule-total-grid" aria-label="Scheduled payment summary">${summaryRows.map(row => `<article class="finance-kpi schedule-total-card ${row.featured ? 'featured' : ''}"><span class="finance-kpi-icon">${richIcon(row.icon)}</span><div><span>${row.label}</span><strong>${money(row.value)}</strong><small>${row.note}</small></div></article>`).join('')}</section>`;
  const cards = filtered.map(schedule => {
    const status = scheduleStatus(schedule);
    const closed = status.key === 'closed';
    const archived = status.key === 'archived';
    const nextDate = status.key === 'active' ? nextScheduleOccurrence(schedule) : null;
    const supportingCopy = closed
      ? `Completed${schedule.loanClosedAt ? ` ${scheduleDateLabel(schedule.loanClosedAt)}` : schedule.endDate ? ` after ${scheduleDateLabel(schedule.endDate)}` : ''} · no future auto-adds`
      : archived ? 'Paused · excluded from active totals' : nextDate ? `Next ${scheduleDateLabel(dateKey(nextDate))}` : 'No future payment scheduled';
    return `<article class="schedule-card schedule-plan-card ${archived ? 'archived' : ''} ${closed ? 'closed' : ''}">
      <header class="schedule-plan-header"><span class="schedule-plan-icon ${closed ? 'closed-icon' : meta[schedule.type].color}">${richIcon(closed ? 'credit-paid' : meta[schedule.type].icon)}</span><div class="schedule-plan-copy"><h4>${esc(schedule.subcategory)}</h4><p>${scheduleWhen(schedule)}${schedule.endDate ? ` · ends ${scheduleDateLabel(schedule.endDate)}` : ' · ongoing'}</p></div><span class="schedule-status-pill ${status.key}">${status.label}</span></header>
      <div class="schedule-plan-body"><div class="schedule-plan-amount"><small>${closed ? 'Final scheduled amount' : 'Scheduled amount'}</small><strong>${money(schedule.amount)}</strong></div><div class="schedule-plan-next"><small>${closed ? 'Loan status' : archived ? 'Plan status' : 'Next activity'}</small><strong>${supportingCopy}</strong></div></div>
      ${closed ? `<div class="schedule-closed-note"><span>${richIcon('credit-paid')}</span><div><b>Loan closed</b><small>Kept here for history and moved below active loans.</small></div></div>` : schedulePlanInsight(schedule)}
      <footer class="schedule-plan-footer"><div class="schedule-actions"><button class="mini-button" data-action="edit-schedule" data-id="${esc(schedule.id)}">Edit</button>${schedule.type === 'loan' && !archived ? `<button class="mini-button ${closed ? 'reopen' : 'close-loan'}" data-action="toggle-loan-closed" data-id="${esc(schedule.id)}" data-closed="${closed}">${closed ? 'Reopen loan' : 'Mark closed'}</button>` : ''}<button class="mini-button ${archived ? '' : 'warn'}" data-action="toggle-schedule-archive" data-id="${esc(schedule.id)}">${archived ? 'Unarchive' : 'Archive'}</button>${archived || closed ? '' : `<button class="mini-button warn" data-action="skip-schedule" data-id="${esc(schedule.id)}">Skip once</button>`}<button class="mini-button danger-mini" data-action="confirm-delete-schedule" data-id="${esc(schedule.id)}">Delete</button></div></footer>
    </article>`;
  }).join('');
  const openCount = filtered.filter(schedule => schedule.archived !== true && !scheduleLoanIsClosed(schedule)).length;
  const closedCount = filtered.filter(schedule => schedule.archived !== true && scheduleLoanIsClosed(schedule)).length;
  const archivedCount = filtered.filter(schedule => schedule.archived === true).length;
  const workspaceSummary = scheduleTab === 'loan' ? `${openCount} open · ${closedCount} closed · ${archivedCount} archived` : `${openCount} active · ${archivedCount} archived`;
  return `<article class="schedule-page finance-page">
    <section class="panel finance-page-hero schedule-page-hero"><div><p class="panel-kicker">RECURRING MONEY</p><h3>Scheduled payments</h3><p class="subtitle">Plan recurring expenses, loan payments and investments without losing sight of monthly outflow.</p></div><button class="primary-button" data-action="open-schedule">＋ Add schedule</button></section>
    ${summaryCards}
    <section class="panel schedule-workspace"><div class="panel-heading"><div><p class="panel-kicker">ACTIVE PLANS</p><h3>${meta[scheduleTab].tab} schedule</h3><p class="subtitle">${workspaceSummary}</p></div></div><div class="schedule-tabs" role="tablist" aria-label="Schedule type">${tabButtons}</div>${filtered.length ? `<div class="schedule-grid">${cards}</div>` : `<div class="finance-empty"><span>${richIcon(meta[scheduleTab].icon)}</span><b>No ${meta[scheduleTab].tab.toLowerCase()} schedules yet</b><p>Add one to include it in your recurring money plan.</p></div>`}</section>
  </article>`;
}
