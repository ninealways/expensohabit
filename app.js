let data = { transactions: [], schedules: [], categories: [], habits: [], habitLogs: [], settings: { monthlyExpenseBudget: 60000, monthlyBudgetOverrides: {} } };
let activePage = 'dashboard';
let activeType = 'expense';
let authMode = 'login';
let editingTransactionId = null;
let editingScheduleId = null;
let dashboardView = 'all';
let chartRange = 'last7';
let currentUser = null;
let insightFilter = { mode:'thisMonth' };
let privacyMode = localStorage.getItem('dailyExpensesPrivacy') !== 'shown';
let scheduleTab = 'expense';
let transactionFilter = { mode:'thisMonth', type:'all', category:'all', search:'', sort:'dateDesc' };
let activeWorkspace = 'expense';
let editingHabitId = null;
let pendingHabitDeleteId = null;
let habitCheckinDate = '';
let mobileStartupTransactionModalOpened = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const hiddenMoney = () => '₹••••';
const money = (value) => privacyMode ? hiddenMoney() : `₹${Math.round(value).toLocaleString('en-IN')}`;
const compactMoney = (value) => privacyMode ? hiddenMoney() : value >= 100000 ? `₹${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L` : value >= 1000 ? `₹${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : money(value);
const svgIcon = (name) => `<svg class="svg-icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const isMobileViewport = () => window.matchMedia('(max-width: 640px)').matches;
const today = () => new Date().toISOString().slice(0, 10);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const longDateLabel = (date = new Date()) => date.toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }).toUpperCase();
const addDays = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const addMonthsToDate = (date, months) => { const next = new Date(date); next.setMonth(next.getMonth() + months); return next; };
const monthInputKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
const currentMonthKey = () => monthInputKey(new Date());
const currentYear = () => String(new Date().getFullYear());
const monthName = (date) => date.toLocaleString('en-IN', { month:'short' }).toUpperCase();
function normalizeMonthValue(value, fallbackDate = null) {
  if (/^\d{4}-\d{2}$/.test(String(value || ''))) return String(value);
  if (fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())) return monthInputKey(fallbackDate);
  const match = String(value || '').trim().match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (!match) return '';
  const monthIndex = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[1].slice(0, 3).toLowerCase());
  return monthIndex >= 0 ? `${match[2]}-${String(monthIndex + 1).padStart(2, '0')}` : '';
}
const dayList = (schedule) => (schedule.dueDays?.length ? schedule.dueDays : [schedule.dueDay]).filter(Boolean).map(Number).sort((a,b) => a - b);
const scheduleWhen = (schedule) => schedule.frequency === 'BiMonthly' ? `Bi-monthly · due on ${dayList(schedule).map(day => `${day}${ordinal(day)}`).join(' and ')}` : `${schedule.frequency || 'Monthly'} · due on ${schedule.dueDay}${ordinal(schedule.dueDay)}`;
function scheduleMonthlyMultiplier(schedule) { const frequency = schedule.frequency || 'Monthly'; if (frequency === 'Daily') return 365 / 12; if (frequency === 'Weekly') return 52 / 12; if (frequency === 'BiMonthly') return Math.max(1, dayList(schedule).length); if (frequency === 'Quarterly') return 1 / 3; if (frequency === 'Yearly') return 1 / 12; return 1; }
function scheduleMonthlyAmount(schedule) { return (Number(schedule.amount) || 0) * scheduleMonthlyMultiplier(schedule); }
const activeHabits = () => (data.habits || []).filter(habit => habit.active !== false);
const habitLog = (habitId, date = today()) => (data.habitLogs || []).find(log => log.habitId === habitId && log.date === date);
const habitTargetText = (habit) => habit.goalType === 'checkbox' ? 'Done' : `${Number(habit.target || 0).toLocaleString('en-IN')} ${habit.unit || ''}`.trim();
const habitValueText = (habit, log = habitLog(habit.id)) => habit.goalType === 'checkbox' ? (log?.completed ? 'Done' : 'Not done') : `${Number(log?.value || 0).toLocaleString('en-IN')} / ${habitTargetText(habit)}`;
const habitCompleted = (habit, date = today()) => { const log = habitLog(habit.id, date); if (!log) return false; return habit.goalType === 'checkbox' ? !!log.completed : !!log.completed || Number(log.value || 0) >= Number(habit.target || 1); };
function weekDates(anchor = new Date()) { const start = new Date(anchor); const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); return Array.from({ length:7 }, (_, index) => dateKey(addDays(start, index))); }
function habitStreak(habit) { let streak = 0; for (let date = new Date(); streak < 730; date = addDays(date, -1)) { if (!habitCompleted(habit, dateKey(date))) break; streak += 1; } return streak; }
const defaultSettings = { monthlyExpenseBudget: 60000, monthlyBudgetOverrides: {} };

function saveData() { $('#syncLabel').textContent = 'Synced'; }
function normalizeSettings(settings = {}) {
  const monthlyExpenseBudget = Number(settings.monthlyExpenseBudget || defaultSettings.monthlyExpenseBudget);
  return {
    monthlyExpenseBudget,
    monthlyBudgetOverrides: settings.monthlyBudgetOverrides && typeof settings.monthlyBudgetOverrides === 'object' ? settings.monthlyBudgetOverrides : {}
  };
}

async function loadData() {
  const response = await fetch('/api/data');
  if (!response.ok) throw new Error('Could not load synced data');
  data = await response.json();
  data.habits = data.habits || [];
  data.habitLogs = data.habitLogs || [];
  data.settings = normalizeSettings(data.settings);
  $('#syncLabel').textContent = 'Synced';
}

async function refreshData() {
  const button = $('#refreshButton');
  try {
    button.disabled = true;
    button.classList.add('spinning');
    $('#syncLabel').textContent = 'Refreshing...';
    await loadData();
    updateCategoryOptions();
    if (activePage === 'dashboard') renderDashboard();
    else navigate(activePage, false);
    toast('Data refreshed');
  } catch (error) {
    console.error(error);
    $('#syncLabel').textContent = 'Refresh failed';
    toast('Could not refresh data');
  } finally {
    button.disabled = false;
    button.classList.remove('spinning');
  }
}

function updatePrivacyButton() {
  const button = $('#privacyButton');
  if (!button) return;
  button.innerHTML = svgIcon(privacyMode ? 'eye-off' : 'eye');
  button.setAttribute('aria-label', privacyMode ? 'Show amounts' : 'Hide amounts');
  button.title = privacyMode ? 'Show amounts' : 'Hide amounts';
  button.classList.toggle('active', privacyMode);
  document.body.classList.toggle('privacy-mode', privacyMode);
}

function rerenderCurrentPage() {
  if (activePage === 'dashboard') renderDashboard();
  else navigate(activePage, false);
}

function togglePrivacy() {
  privacyMode = !privacyMode;
  localStorage.setItem('dailyExpensesPrivacy', privacyMode ? 'hidden' : 'shown');
  updatePrivacyButton();
  rerenderCurrentPage();
  toast(privacyMode ? 'Amounts hidden' : 'Amounts visible');
}

function initializeDatePickers(root = document) {
  if (!window.flatpickr) return;
  root.querySelectorAll('[data-picker="date"]').forEach(input => {
    if (input._flatpickr) { input._flatpickr.setDate(input.value, false, 'Y-m-d'); return; }
    window.flatpickr(input, {
      dateFormat:'Y-m-d',
      altInput:true,
      altFormat:'d/m/Y',
      allowInput:true,
      disableMobile:true,
      nextArrow:'›',
      prevArrow:'‹'
    });
  });
  root.querySelectorAll('[data-picker="month"]').forEach(input => {
    if (input._flatpickr) { input._flatpickr.setDate(input.value, false, 'Y-m'); return; }
    const options = {
      dateFormat:'Y-m',
      altInput:true,
      altFormat:'M Y',
      allowInput:true,
      disableMobile:true,
      nextArrow:'›',
      prevArrow:'‹'
    };
    if (window.monthSelectPlugin) options.plugins = [new window.monthSelectPlugin({ shorthand:true, dateFormat:'Y-m', altFormat:'M Y' })];
    window.flatpickr(input, options);
  });
}

async function checkAuth() { const response = await fetch('/api/auth/me'); if (!response.ok) throw new Error('Authentication service unavailable'); return response.json(); }
function showAuthGate() { $('#authGate').hidden = false; }
function displayName() { return currentUser?.name || currentUser?.email?.split('@')[0] || 'there'; }
function dashboardGreeting() { return `Good morning, ${displayName()} <span class="title-icon">${svgIcon('insights')}</span>`; }
function setAuthMode(mode) { authMode=mode; const isLogin=mode==='login'; $('#authTitle').textContent=isLogin?'Welcome back':'Create your account'; $('#authSubtitle').textContent=isLogin?'Sign in to access your money and habit dashboard.':'Create a secure account for your money and habit data.'; $('#authSubmit').textContent=isLogin?'Sign in':'Create account'; $('#authToggle').textContent=isLogin?'Create a new account':'I already have an account'; $('#authPassword').autocomplete=isLogin?'current-password':'new-password'; $('#authNameRow').hidden=isLogin; $('#authName').required=!isLogin; $('#inviteCodeRow').hidden=isLogin; $('#inviteCode').required=!isLogin; $('#authError').textContent=''; }
async function submitAuth(event) { event.preventDefault(); const payload={ email:$('#authEmail').value, password:$('#authPassword').value }; if (authMode === 'register') { payload.name = $('#authName').value; payload.inviteCode = $('#inviteCode').value; } const response=await fetch(authMode==='login'?'/api/auth/login':'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const result=await response.json(); if(!response.ok){$('#authError').textContent=result.error||'Authentication failed';return;} currentUser=result; $('#authGate').hidden=true; await loadData(); updateCategoryOptions(); renderDashboard(); navigate(pageForRoute[location.pathname] || 'dashboard', false); maybeOpenMobileStartupTransactionModal(); toast(authMode==='login'?'Signed in':'Account created'); }
async function logout() { const response = await fetch('/api/auth/logout', { method:'POST' }); if (!response.ok) { toast('Could not log out'); return; } currentUser = null; data = { transactions: [], schedules: [], categories: [], settings:defaultSettings }; $('#authGate').hidden = false; $('#authForm').reset(); setAuthMode('login'); history.pushState({ page:'dashboard' }, '', '/dashboard'); toast('Logged out'); }

function totals() {
  const transactions = dashboardMonthTransactions();
  const expenses = transactions.filter(t => t.type === 'expense');
  const expenseTotal = expenses.reduce((sum, t) => sum + t.amount, 0);
  const real = expenses.filter(t => t.includeInReal !== false).reduce((sum, t) => sum + t.amount, 0);
  const loan = transactions.filter(t => t.type === 'loan').reduce((sum, t) => sum + t.amount, 0);
  const investment = transactions.filter(t => t.type === 'investment').reduce((sum, t) => sum + t.amount, 0);
  return { expenseTotal, real, loan, investment, total: expenseTotal + loan + investment, expenses };
}

function renderDashboard() {
  $('#currentDateLabel').textContent = longDateLabel();
  const t = totals();
  $('#totalOutflow').textContent = money(t.total); $('#realExpenses').textContent = money(t.real); $('#loanTotal').textContent = money(t.loan); $('#investmentTotal').textContent = money(t.investment);
  $('#summaryExpense').textContent = money(t.expenseTotal); $('#summaryLoan').textContent = money(t.loan); $('#summaryInvestment').textContent = money(t.investment);
  $('#summaryExpensePct').textContent = `${percent(t.expenseTotal, t.total)}%`;
  $('#summaryLoanPct').textContent = `${percent(t.loan, t.total)}%`;
  $('#summaryInvestmentPct').textContent = `${percent(t.investment, t.total)}%`;
  $('#formulaExpense').textContent = money(t.expenseTotal); $('#formulaLoan').textContent = money(t.loan); $('#formulaInvestment').textContent = money(t.investment); $('#formulaTotal').textContent = money(t.total);
  renderCategories(dashboardView); renderUpcoming(); renderChart(dashboardView);
}

function dashboardMonthTransactions() {
  const month = currentMonthKey();
  return data.transactions.filter(t => t.date?.startsWith(month));
}

function dashboardTransactions(view = dashboardView, source = data.transactions) {
  if (view === 'real') return source.filter(t => t.type === 'expense' && t.includeInReal !== false);
  return source;
}

function renderCategories(view = dashboardView) {
  const monthTransactions = dashboardMonthTransactions();
  const transactions = view === 'real' ? dashboardTransactions('real', monthTransactions) : monthTransactions.filter(t => t.type === 'expense');
  const denominator = transactions.reduce((sum, t) => sum + t.amount, 0) || 1;
  const totalsByCategory = transactions.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
  const list = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]); const max = list[0]?.[1] || 1;
  const icons = {'Food & Dining':'fork','Transport':'car','Shopping':'shopping','Bills & Utilities':'bolt','Entertainment':'film','Health':'heart'};
  $('#categoryList').innerHTML = list.slice(0, 6).map(([name, value], index) => `<div class="category-item"><span class="category-icon ${index % 2 ? 'teal-bg' : 'purple-bg'}">${svgIcon(icons[name] || 'tag')}</span><div><div class="category-name"><span>${name}</span><span>${money(value)}</span></div><div class="category-bar"><i style="width:${Math.max(15, value / max * 100)}%"></i></div></div><span class="category-percent">${Math.round(value / denominator * 100)}%</span></div>`).join('') || '<p class="subtitle">Add an expense to see categories.</p>';
}

function renderUpcoming() {
  const icon = { loan:'receipt', investment:'pie', expense:'bag' };
  const color = { loan:'amber-bg', investment:'teal-bg', expense:'purple-bg' };
  $('#upcomingList').innerHTML = data.schedules.slice(0, 4).map(s => `<div class="upcoming-item"><span class="upcoming-icon ${color[s.type]}">${svgIcon(icon[s.type])}</span><div class="upcoming-text"><b>${s.subcategory}</b><small>${scheduleWhen(s)}</small></div><div class="upcoming-right"><b>${money(s.amount)}</b><span class="tag">${s.autoAdd ? 'Auto-add' : 'Manual'}</span></div></div>`).join('');
}

function chartBuckets(range = chartRange) {
  const now = new Date();
  if (range === 'last7') {
    const start = addDays(now, -6);
    return Array.from({ length:7 }, (_, i) => { const date = addDays(start, i); return { label:String(date.getDate()).padStart(2,'0'), from:dateKey(date), to:dateKey(date) }; });
  }
  const monthStart = range === 'lastMonth' ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = range === 'lastMonth' ? new Date(now.getFullYear(), now.getMonth(), 0) : now;
  const buckets = [];
  for (let start = new Date(monthStart); start <= monthEnd; start = addDays(start, 7)) {
    const end = addDays(start, 6) > monthEnd ? monthEnd : addDays(start, 6);
    buckets.push({ label:`${String(start.getDate()).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`, from:dateKey(start), to:dateKey(end) });
  }
  return buckets;
}

function renderChart(view = dashboardView) {
  const buckets = chartBuckets();
  const source = dashboardTransactions(view, data.transactions);
  const values = buckets.map(bucket => source.filter(t => t.date >= bucket.from && t.date <= bucket.to).reduce((sum, t) => sum + t.amount, 0));
  const max = Math.max(...values, 1);
  const labels = { last7:'LAST 7 DAYS', thisMonth:`THIS MONTH · ${monthName(new Date())}`, lastMonth:`LAST MONTH · ${monthName(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1))}` };
  $('#chartRangeLabel').textContent = labels[chartRange];
  $('#chartTotal').textContent = money(values.reduce((sum, value) => sum + value, 0));
  $('#chart').innerHTML = values.map((value, i) => `<div class="bar-wrap"><span class="bar-value">${value ? compactMoney(value) : ''}</span><div class="bar" style="height:${Math.max(8, value / max * 100)}%" title="${money(value)}"></div><span class="bar-label">${buckets[i].label}</span></div>`).join('');
}

function ordinal(n) { const s = ['th','st','nd','rd']; const v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; }
function remainingMonths(endDate) { if (!endDate) return 0; const end = new Date(`${endDate}T00:00:00`); const now = new Date(); let months = (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth(); if (end.getDate() >= now.getDate()) months += 1; return Math.max(0, months); }
function loanProjection(schedule) { const principal = Number(schedule.remainingPrincipal); const annualRate = Number(schedule.annualRate); const months = remainingMonths(schedule.endDate); if (!principal || !months || !Number.isFinite(annualRate)) return null; const rate = annualRate / 1200; let balance = principal; const payment = Number(schedule.amount) || (rate ? principal * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1) : principal / months); let interest = 0; let principalPaid = 0; for (let i = 0; i < months && balance > 0; i += 1) { const monthInterest = rate ? balance * rate : 0; const monthPrincipal = Math.min(balance, Math.max(0, payment - monthInterest)); interest += monthInterest; principalPaid += monthPrincipal; balance -= monthPrincipal; if (monthPrincipal === 0) break; } return { months, payment, principalPaid, interest, balance }; }
function investmentProjection(schedule) { const invested = Number(schedule.amountInvestedToDate) || 0; const currentValue = Number(schedule.currentValue) || invested; const withdrawn = Number(schedule.amountWithdrawn) || 0; const netValue = Math.max(0, currentValue - withdrawn); const months = Number(schedule.projectionMonths) || 0; const rate = Number(schedule.expectedAnnualRate); const monthlyContribution = scheduleMonthlyAmount(schedule); const gain = netValue - invested; if (!months || !Number.isFinite(rate)) return { invested, currentValue, withdrawn, netValue, gain, projected:false }; const monthlyRate = rate / 1200; const growth = Math.pow(1 + monthlyRate, months); const contributionsFuture = monthlyRate ? monthlyContribution * ((growth - 1) / monthlyRate) : monthlyContribution * months; return { invested, currentValue, withdrawn, netValue, gain, projected:true, months, futureValue:netValue * growth + contributionsFuture, futureContributions:monthlyContribution * months }; }
function scheduleSummary(schedule) { if (schedule.type === 'expense') return ''; if (schedule.type === 'loan') { const projection = loanProjection(schedule); return projection ? `<div class="schedule-summary"><b>Estimated remaining · ${schedule.interestType === 'floating' ? 'Floating' : 'Fixed'}</b><br>${money(projection.principalPaid)} principal + <strong>${money(projection.interest)}</strong> interest<br><small>${projection.months} months · approx. EMI ${money(projection.payment)}${schedule.interestType === 'floating' ? ' · uses current rate' : ''}</small></div>` : ''; } const projection = investmentProjection(schedule); if (!projection) return ''; if (!projection.projected) return `<div class="schedule-summary"><b>Current position</b><br>Invested ${money(projection.invested)} · Gross ${money(projection.currentValue)} · Withdrawn ${money(projection.withdrawn)}<br>Net value <strong>${money(projection.netValue)}</strong><br><small class="${projection.gain >= 0 ? 'positive' : 'negative'}">${projection.gain >= 0 ? 'Gain' : 'Loss'} ${money(Math.abs(projection.gain))} · no return assumption</small></div>`; return `<div class="schedule-summary"><b>Net current value ${money(projection.netValue)}</b><br>Projected value <strong>${money(projection.futureValue)}</strong><br><small>${projection.months} months · withdrawn ${money(projection.withdrawn)} · contributions ${money(projection.futureContributions)} · expected return ${schedule.expectedAnnualRate}%</small></div>`; }

function openModal(type = 'expense', transaction = null) { editingTransactionId = transaction?.id || null; editingScheduleId = null; activeType = type; $('#modalBackdrop').hidden = false; $('#transactionForm').reset(); $('input[name="date"]').value = today(); setType(type); updateCategoryOptions(); $('#modalTitle').textContent = editingTransactionId ? 'Edit transaction' : 'Add transaction'; $('#transactionForm button[type="submit"]').textContent = editingTransactionId ? 'Save changes' : 'Save transaction'; updateDetailSections(); if (transaction) { $('input[name="amount"]').value=transaction.amount; $('input[name="subcategory"]').value=transaction.subcategory || ''; $('input[name="date"]').value=transaction.date; $('input[name="note"]').value=transaction.note || ''; $('input[name="includeInReal"]').checked=transaction.includeInReal !== false; $('#categoryInput').value=transaction.category; } initializeDatePickers($('#transactionForm')); }
function setField(name, value) { const field = $(`[name="${name}"]`); if (field) field.value = value ?? ''; }
function openScheduleModal(schedule) { const now = new Date(); const dueDate = schedule.startDate || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(schedule.dueDay).padStart(2,'0')}`; const days = dayList(schedule); openModal(schedule.type); editingScheduleId = schedule.id; $('#modalTitle').textContent='Edit schedule'; $('#transactionForm button[type="submit"]').textContent='Save schedule'; setField('amount', schedule.amount); setField('subcategory', schedule.subcategory); setField('date', dueDate); setField('frequency', schedule.frequency || 'Monthly'); setField('biMonthlyDayOne', days[0] || schedule.dueDay); setField('biMonthlyDayTwo', days[1] || ''); setField('endDate', schedule.endDate); setField('originalAmount', schedule.originalAmount); setField('remainingPrincipal', schedule.remainingPrincipal); setField('annualRate', schedule.annualRate); setField('interestType', schedule.interestType || 'fixed'); setField('amountInvestedToDate', schedule.amountInvestedToDate); setField('currentValue', schedule.currentValue); setField('amountWithdrawn', schedule.amountWithdrawn); setField('expectedAnnualRate', schedule.expectedAnnualRate); setField('projectionMonths', schedule.projectionMonths); const recurring = $('[name="recurring"]'); if (recurring) recurring.checked = schedule.autoAdd !== false; if ($('#categoryInput')) $('#categoryInput').value=schedule.category; updateDetailSections(); initializeDatePickers($('#transactionForm')); }
function closeModal() { $('#modalBackdrop').hidden = true; }
function maybeOpenMobileStartupTransactionModal() {
  if (mobileStartupTransactionModalOpened || !isMobileViewport() || activeWorkspace !== 'expense') return;
  if (!$('#authGate').hidden || !$('#modalBackdrop').hidden) return;
  mobileStartupTransactionModalOpened = true;
  setTimeout(() => { if ($('#authGate').hidden && $('#modalBackdrop').hidden) openModal('expense'); }, 350);
}
function setType(type) { activeType = type; $$('.type-tabs button').forEach(button => button.classList.toggle('active', button.dataset.type === type)); $('input[name="includeInReal"]').checked = type === 'expense'; if (type !== 'expense' && !editingScheduleId) $('input[name="recurring"]').checked = false; updateDetailSections(); }
function updateDetailSections() { const showDetails = editingScheduleId || $('input[name="recurring"]').checked; const isBiMonthly = $('[name="frequency"]')?.value === 'BiMonthly'; $('#scheduleFrequencyRow').hidden = editingTransactionId || !showDetails; $('#biMonthlyDetails').hidden = editingTransactionId || !showDetails || !isBiMonthly; if (showDetails && isBiMonthly) { if (!$('[name="biMonthlyDayOne"]').value) $('[name="biMonthlyDayOne"]').value = Number($('[name="date"]').value.slice(-2)) || 1; if (!$('[name="biMonthlyDayTwo"]').value) $('[name="biMonthlyDayTwo"]').value = 15; } $('#scheduleEndDateRow').hidden = editingTransactionId || !showDetails; $('#loanDetails').hidden = !(showDetails && activeType === 'loan'); $('#investmentDetails').hidden = !(showDetails && activeType === 'investment'); }
function updateCategoryOptions() { const categories = data.categories.filter(category => category.active !== false && category.kind === activeType).map(category => category.name).sort((a, b) => a.localeCompare(b)); $('#categoryInput').innerHTML = (categories.length ? categories : [activeType === 'loan' ? 'Loans' : activeType === 'investment' ? 'Investments' : 'Other']).map(c => `<option>${c}</option>`).join(''); }

async function addTransaction(event) {
  event.preventDefault(); const form = new FormData(event.target); const amount = Number(form.get('amount')); if (!amount) return;
  const item = { id: `t-${Date.now()}`, type: activeType, amount, category: form.get('category'), subcategory: form.get('subcategory') || form.get('category'), date: form.get('date'), note: form.get('note'), includeInReal: form.get('includeInReal') === 'on' };
  const frequency = form.get('frequency') || 'Monthly';
  const dueDays = frequency === 'BiMonthly' ? [Number(form.get('biMonthlyDayOne')), Number(form.get('biMonthlyDayTwo'))].filter(day => day >= 1 && day <= 31).sort((a,b) => a - b) : [Number(item.date.slice(-2))];
  if (frequency === 'BiMonthly' && dueDays.length < 2) { toast('Select two bi-monthly dates'); return; }
  const scheduleFields = { amount, category:item.category, subcategory:item.subcategory, startDate:item.date, dueDay:dueDays[0], dueDays, frequency, autoAdd:form.get('recurring') === 'on', endDate:form.get('endDate') || null, originalAmount:form.get('originalAmount') || null, remainingPrincipal:form.get('remainingPrincipal') || null, annualRate:form.get('annualRate') || null, interestType:form.get('interestType') || 'fixed', amountInvestedToDate:form.get('amountInvestedToDate') || null, currentValue:form.get('currentValue') || null, amountWithdrawn:form.get('amountWithdrawn') || null, expectedAnnualRate:form.get('expectedAnnualRate') || null, projectionMonths:form.get('projectionMonths') || null };
  const response = editingScheduleId ? await fetch(`/api/schedules/${editingScheduleId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(scheduleFields) }) : editingTransactionId ? await fetch(`/api/transactions/${editingTransactionId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(item) }) : await fetch('/api/transactions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ transaction:item, recurring:form.get('recurring') === 'on', frequency, dueDays, endDate:form.get('endDate') || null, originalAmount:form.get('originalAmount') || null, remainingPrincipal:form.get('remainingPrincipal') || null, annualRate:form.get('annualRate') || null, interestType:form.get('interestType') || 'fixed', amountInvestedToDate:form.get('amountInvestedToDate') || null, currentValue:form.get('currentValue') || null, amountWithdrawn:form.get('amountWithdrawn') || null, expectedAnnualRate:form.get('expectedAnnualRate') || null, projectionMonths:form.get('projectionMonths') || null }) });
  if (!response.ok) { toast('Could not save data'); return; }
  data = await (await fetch('/api/data')).json(); saveData(); closeModal(); if (activePage === 'dashboard') renderDashboard(); else navigate(activePage, false); toast(editingScheduleId ? 'Schedule updated' : editingTransactionId ? 'Transaction updated' : 'Transaction saved'); editingTransactionId = null; editingScheduleId = null;
}

function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); }
const routeForPage = { dashboard:'/dashboard', transactions:'/transactions', schedule:'/schedule', settings:'/settings', outflow:'/outflow', investments:'/investments', insights:'/insights', profile:'/profile', habits:'/habits' };
routeForPage.habitInsights = '/habit-insights';
routeForPage.habitManage = '/habit-manage';
routeForPage.habitCheckins = '/habit-checkins';
const pageForRoute = { '/':'dashboard', '/dashboard':'dashboard', '/transactions':'transactions', '/schedule':'schedule', '/settings':'settings', '/outflow':'outflow', '/investments':'investments', '/insights':'insights', '/profile':'profile', '/habits':'habits', '/habit-insights':'habitInsights', '/habit-manage':'habitManage', '/habit-checkins':'habitCheckins' };
const pageTitles = { transactions:'Your transactions', schedule:'Plan your payments', outflow:'Outflow report', investments:'Investments', insights:'Spend insights', profile:'Profile', settings:'Keep your data yours', habits:'Habit tracker', habitInsights:'Habit insights', habitManage:'Manage habits', habitCheckins:'Habit check-ins' };

function navigate(page, updateUrl = true) {
  activePage = page; activeWorkspace = ['habits','habitInsights','habitManage','habitCheckins'].includes(page) ? 'habits' : 'expense'; if (updateUrl && routeForPage[page] && location.pathname !== routeForPage[page]) history.pushState({ page }, '', routeForPage[page]); document.body.classList.toggle('dashboard-mode', page === 'dashboard'); document.body.classList.toggle('habits-mode', activeWorkspace === 'habits'); $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page)); $$('[data-workspace]').forEach(item => item.classList.toggle('active', item.dataset.workspace === activeWorkspace));
  const dashboardSections = $$('.hero-row,.summary-grid,.view-switch-row,.content-grid,.bottom-grid'); const subPage = $('#subPageView');
  if (page === 'habits') { dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderHabitsMockPage(); initializeDatePickers(subPage); return; }
  if (page === 'habitInsights') { dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderHabitInsightsPage(); initializeDatePickers(subPage); return; }
  if (page === 'habitManage') { dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderHabitManagePage(); initializeDatePickers(subPage); return; }
  if (page === 'habitCheckins') { dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderHabitCheckinsPage(); initializeDatePickers(subPage); return; }
  if (page === 'dashboard') { dashboardSections.forEach(section => section.hidden = false); subPage.hidden = true; $('#pageTitle').innerHTML = dashboardGreeting(); return; }
  dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderSubPage(page); $('#pageTitle').textContent = pageTitles[page] || pageTitles.settings; initializeDatePickers(subPage);
}

function renderHabitsMockPage() {
  const habits = activeHabits();
  const dates = weekDates();
  const dayLabels = dates.map(date => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'short' }));
  const completed = habits.filter(habit => habitCompleted(habit)).length;
  const weeklyChecks = habits.length * dates.length;
  const weeklyCompleted = habits.reduce((sum, habit) => sum + dates.filter(date => habitCompleted(habit, date)).length, 0);
  const streakRows = habits.map(habit => ({ habit, streak:habitStreak(habit) })).sort((a, b) => b.streak - a.streak);
  const best = streakRows[0];
  const sleep = habits.find(habit => habit.name.toLowerCase().includes('sleep'));
  const sleepLogs = sleep ? dates.map(date => habitLog(sleep.id, date)).filter(Boolean) : [];
  const sleepAverage = sleepLogs.length ? sleepLogs.reduce((sum, log) => sum + Number(log.value || 0), 0) / sleepLogs.length : 0;
  const weakest = habits.map(habit => ({ habit, done:dates.filter(date => habitCompleted(habit, date)).length })).sort((a, b) => a.done - b.done)[0];
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
        ${habits.map(habit => `<div class="habit-grid-row"><b>${habit.name}</b>${dates.map(date => `<span title="${habit.name} ${date}" class="${habitCompleted(habit, date) ? 'filled' : ''}"></span>`).join('')}</div>`).join('') || '<p class="empty-state">Weekly grid will show after habits are added.</p>'}
      </article>
    </section>
    <section class="habits-grid secondary">
      <article class="panel habit-card-panel">
        <div class="panel-heading"><div><p class="panel-kicker">ACTIVE HABITS</p><h3>Habit cards</h3></div></div>
        <div class="habit-card-list">${streakRows.map(({ habit, streak }) => `<div class="habit-mini-card"><span class="map-icon ${habit.color}">${svgIcon(habit.icon)}</span><div><b>${habit.name}</b><small>${habitTargetText(habit)} target</small></div><strong>${streak}d</strong></div>`).join('') || '<p class="empty-state">No active habits yet.</p>'}</div>
      </article>
      <article class="panel habit-insight-panel">
        <div class="panel-heading"><div><p class="panel-kicker">HABIT INSIGHTS</p><h3>Patterns</h3></div></div>
        <div class="habit-insight-list">
          <div><b>Strongest routine</b><span>${best ? `${best.habit.name} has the best current streak at ${best.streak} days.` : 'Add habits to see strongest routines.'}</span></div>
          <div><b>Needs attention</b><span>${weakest ? `${weakest.habit.name} has ${weakest.done}/${dates.length} checks this week.` : 'Missed patterns will appear here.'}</span></div>
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
  const rows = habits.map(habit => {
    const weekDone = dates.filter(date => habitCompleted(habit, date)).length;
    const monthDone = monthDates.filter(date => habitCompleted(habit, date)).length;
    const streak = habitStreak(habit);
    const logs = monthDates.map(date => habitLog(habit.id, date)).filter(Boolean);
    const avg = logs.length && habit.goalType !== 'checkbox' ? logs.reduce((sum, log) => sum + Number(log.value || 0), 0) / logs.length : 0;
    const misses = monthDates.length - monthDone;
    const bestDay = dates.map(date => ({ date, done:habitCompleted(habit, date) })).filter(item => item.done).at(-1)?.date;
    return { habit, weekDone, monthDone, misses, streak, avg, bestDay, weekRate:dates.length ? Math.round(weekDone / dates.length * 100) : 0, monthRate:Math.round(monthDone / monthDates.length * 100) };
  }).sort((a, b) => b.monthRate - a.monthRate);
  const dailyTotals = monthDates.map(date => ({ date, done:habits.filter(habit => habitCompleted(habit, date)).length }));
  const bestDay = dailyTotals.slice().sort((a, b) => b.done - a.done)[0];
  const lowDays = dailyTotals.filter(day => day.done > 0 && day.done < Math.max(1, habits.length / 2)).slice(-4);
  const noteLogs = (data.habitLogs || []).filter(log => log.note && monthDates.includes(log.date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const activeCount = habits.length;
  const inactiveCount = allHabits.filter(habit => habit.active === false).length;
  return `<section class="habits-shell">
    <article class="panel habits-hero">
      <div><p class="panel-kicker">HABIT INSIGHTS</p><h3>Routine report</h3><p class="subtitle">Patterns, streaks, and consistency for your habits.</p></div>
      <div class="habit-hero-actions"><button class="primary-button" data-action="open-habit-checkin" type="button">✓ Check in</button><button class="ghost-button" data-page="habitCheckins" type="button">History</button><button class="ghost-button" data-page="habits" type="button">Back to habits</button></div>
    </article>
    <section class="habit-summary-grid">
      <article class="habit-summary-card featured"><span class="map-icon purple-bg">${svgIcon('calendar')}</span><p>Best day this month</p><strong>${bestDay?.done || 0}/${activeCount}</strong><small>${bestDay ? new Date(`${bestDay.date}T00:00:00`).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : 'No check-ins yet'}</small></article>
      <article class="habit-summary-card"><span class="map-icon amber-bg">${svgIcon('bolt')}</span><p>Missed opportunities</p><strong>${rows.reduce((sum, row) => sum + row.misses, 0)}</strong><small>Unchecked habit-days in 30 days</small></article>
      <article class="habit-summary-card"><span class="map-icon teal-bg">${svgIcon('heart')}</span><p>Active habits</p><strong>${activeCount}</strong><small>${inactiveCount} paused</small></article>
      <article class="habit-summary-card"><span class="map-icon blue-bg">${svgIcon('book')}</span><p>Notes captured</p><strong>${noteLogs.length}</strong><small>Recent daily reflections</small></article>
    </section>
    <section class="habits-grid">
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">30-DAY CONSISTENCY</p><h3>Habit completion profile</h3></div></div>
        <div class="habit-breakdown-list">${rows.map(row => `<div class="habit-breakdown-item"><span class="map-icon ${row.habit.color}">${svgIcon(row.habit.icon)}</span><div><b>${esc(row.habit.name)}</b><small>${row.monthDone}/30 done · ${row.misses} missed · current streak ${row.streak}d</small><i><em style="width:${row.monthRate}%"></em></i></div><strong>${row.monthRate}%</strong></div>`).join('') || '<p class="empty-state">Add habits to see completion breakdown.</p>'}</div>
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">THIS WEEK</p><h3>Habit heatmap</h3></div></div>
        <div class="habit-grid-head"><span></span>${dates.map(date => `<b>${new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'short' })}</b>`).join('')}</div>
        ${habits.map(habit => `<div class="habit-grid-row"><b>${esc(habit.name)}</b>${dates.map(date => `<span class="${habitCompleted(habit, date) ? 'filled' : ''}" title="${esc(habit.name)}: ${date}"></span>`).join('')}</div>`).join('') || '<p class="empty-state">No habits yet.</p>'}
      </article>
    </section>
    <section class="habits-grid secondary">
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">LOW-COMPLETION DAYS</p><h3>Where routines slipped</h3></div></div>
        <div class="habit-insight-list">${lowDays.map(day => `<div><b>${new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' })}</b><span>${day.done}/${activeCount} habits checked. Review what changed that day and add notes in check-in history.</span></div>`).join('') || '<p class="empty-state">No low-completion days with check-ins in the last 30 days.</p>'}</div>
      </article>
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">NOTES</p><h3>Recent reflections</h3></div><button class="mini-button" data-page="habitCheckins" type="button">Edit history</button></div>
        <div class="habit-insight-list">${noteLogs.map(log => { const habit = data.habits.find(item => item.id === log.habitId); return `<div><b>${esc(habit?.name || 'Habit')} · ${log.date}</b><span>${esc(log.note)}</span></div>`; }).join('') || '<p class="empty-state">Daily notes will appear here after check-ins.</p>'}</div>
      </article>
    </section>
    <section class="habits-grid secondary">
      <article class="panel">
        <div class="panel-heading"><div><p class="panel-kicker">VALUE HABITS</p><h3>Logged averages vs target</h3></div></div>
        <div class="habit-insight-list">${rows.filter(row => row.habit.goalType !== 'checkbox').map(row => `<div><b>${esc(row.habit.name)}</b><span>30-day average: ${row.avg ? row.avg.toFixed(row.avg >= 10 ? 0 : 1) : '—'} ${esc(row.habit.unit || '')}. Target: ${habitTargetText(row.habit)}.</span></div>`).join('') || '<p class="empty-state">Duration/count habits will show averages here.</p>'}</div>
      </article>
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
        <div><b>${esc(habit.name)}</b><small>${habitTargetText(habit)} · ${habit.frequency || 'Daily'} · ${habit.active === false ? 'Inactive' : 'Active'}</small>${habit.description ? `<p>${esc(habit.description)}</p>` : ''}</div>
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

function renderSubPage(page) {
  if (page === 'transactions') return renderTransactionsPage();
  if (page === 'schedule') {
    const meta = { expense:{ icon:'bag', color:'purple-bg', label:'Expense', tab:'Expenses'}, loan:{ icon:'receipt', color:'amber-bg', label:'Loan outflow', tab:'Loans'}, investment:{ icon:'pie', color:'teal-bg', label:'Investment outflow', tab:'Investments'} };
    const scheduleAmount = (type) => data.schedules.filter(s => s.type === type).reduce((sum, s) => sum + scheduleMonthlyAmount(s), 0);
    const expenseTotal = scheduleAmount('expense');
    const loanTotal = scheduleAmount('loan');
    const investmentTotal = scheduleAmount('investment');
    const scheduledTotal = expenseTotal + loanTotal + investmentTotal;
    const filtered = data.schedules.filter(s => s.type === scheduleTab);
    const tabButtons = ['expense','loan','investment'].map(type => `<button class="schedule-tab ${scheduleTab === type ? 'active' : ''}" data-action="schedule-tab" data-tab="${type}" type="button"><span>${meta[type].tab}</span><small>${data.schedules.filter(s => s.type === type).length}</small></button>`).join('');
    const summaryCards = `<div class="schedule-total-grid"><div class="schedule-total-card featured"><span>Scheduled outflow</span><strong>${money(scheduledTotal)}</strong><small>Expenses + loans + investments</small></div><div class="schedule-total-card"><span>Expenses</span><strong>${money(expenseTotal)}</strong><small>Counted in real expenses</small></div><div class="schedule-total-card"><span>Loans</span><strong>${money(loanTotal)}</strong><small>Excluded commitment</small></div><div class="schedule-total-card"><span>Investments</span><strong>${money(investmentTotal)}</strong><small>Wealth movement</small></div></div>`;
    const cards = filtered.map(s => `<div class="schedule-card"><div class="schedule-card-heading"><span class="upcoming-icon ${meta[s.type].color}">${svgIcon(meta[s.type].icon)}</span><span class="tag">${s.autoAdd ? 'Auto-add' : 'Manual'}</span></div><h4>${s.subcategory}</h4><p>${scheduleWhen(s)}${s.endDate ? ` · ends ${s.endDate}` : ' · no end date'}</p><div class="schedule-meta"><strong>${money(s.amount)}</strong></div>${scheduleSummary(s)}<div class="schedule-actions"><button class="mini-button" data-action="edit-schedule" data-id="${s.id}">Edit</button><button class="mini-button warn" data-action="skip-schedule" data-id="${s.id}">Skip once</button></div></div>`).join('');
    return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">AUTO-ADD ON DUE DATE</p><h3>Scheduled payments</h3></div><button class="primary-button" data-action="open-schedule">＋ Add schedule</button></div>${summaryCards}<div class="schedule-tabs" role="tablist" aria-label="Schedule type">${tabButtons}</div>${filtered.length ? `<div class="schedule-grid">${cards}</div>` : `<p class="empty-state">No ${meta[scheduleTab].tab.toLowerCase()} schedules yet.</p>`}</article>`;
  }
  if (page === 'outflow') return renderOutflowReport();
  if (page === 'investments') return renderInvestmentsPage();
  if (page === 'insights') return renderInsightsPage();
  if (page === 'profile') return renderProfilePage();
  const categoryRows = ['expense','loan','investment'].map(kind => { const categories = data.categories.filter(c => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name)); return `<div class="category-group"><div class="category-group-heading"><b>${kind === 'expense' ? 'Expense categories' : kind === 'loan' ? 'Loan categories' : 'Investment categories'}</b><span>${categories.length}</span></div><div class="category-chip-grid">${categories.map(category => `<div class="category-chip ${category.active === false ? 'inactive' : ''}"><span>${category.name}</span><button class="mini-button" data-action="edit-category" data-id="${category.id}">Edit</button></div>`).join('') || '<p class="empty-state">No categories yet.</p>'}</div></div>`; }).join('');
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">SECURE SYNC</p><h3>Settings &amp; data</h3></div></div><div class="setting-row"><div><b>Storage</b><small>Your transactions, schedules, categories, and budget targets are saved to your account.</small></div><span class="tag">Synced</span></div>${renderBudgetSettings()}<div class="setting-row"><div><b>Backup</b><small>Export a JSON backup anytime and restore it later.</small></div><button class="mini-button" data-action="export">Export data</button></div><div class="category-editor"><div class="category-group-heading"><b>Manage categories</b><span>Add or rename categories</span></div><form id="categoryForm" class="category-form"><input name="name" placeholder="New category name" required /><select name="kind"><option value="expense">Expense</option><option value="loan">Loan</option><option value="investment">Investment</option></select><button class="primary-button" type="submit">＋ Add category</button></form>${categoryRows}</div><div class="setting-row"><div><b>Sync status</b><small>Latest data is loaded from your account when the app opens.</small></div><span class="tag">Synced</span></div></article>`;
}

function renderBudgetSettings() {
  const settings = normalizeSettings(data.settings);
  const overrides = Object.entries(settings.monthlyBudgetOverrides || {}).sort((a, b) => b[0].localeCompare(a[0]));
  const currentOverride = settings.monthlyBudgetOverrides?.[currentMonthKey()] || '';
  return `<div class="budget-editor"><div class="category-group-heading"><b>Monthly expense target</b><span>Used for Insights spend velocity</span></div><form id="budgetSettingsForm" class="budget-form"><label>Default monthly expense target<input name="monthlyExpenseBudget" type="number" min="0" step="1" value="${settings.monthlyExpenseBudget}" required /></label><label>Override month<input name="overrideMonth" type="text" data-picker="month" value="${currentMonthKey()}" /></label><label>Override amount<input name="overrideAmount" type="number" min="0" step="1" value="${currentOverride}" placeholder="Optional" /></label><button class="primary-button" type="submit">Save target</button></form><p class="budget-help">Insights compares real expenses against this target. Month overrides replace the default only for that month.</p>${overrides.length ? `<div class="budget-chip-grid">${overrides.map(([month, value]) => `<span class="budget-chip">${month}<b>${money(value)}</b></span>`).join('')}</div>` : '<p class="empty-state">No monthly overrides yet.</p>'}</div>`;
}

function reportDates() { const dates = data.transactions.map(t => t.date).sort(); const now = new Date(); return { from:dates[0] || `${now.getFullYear()}-01-01`, to:dates[dates.length - 1] || today() }; }
function monthRange(offset = 0) { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() + offset, 1); const end = offset === 0 ? now : new Date(now.getFullYear(), now.getMonth() + offset + 1, 0); return { from:dateKey(start), to:dateKey(end) }; }
function monthKeyRange(fromMonth, toMonth) {
  const from = fromMonth || currentMonthKey();
  const to = toMonth || from;
  const [startMonth, endMonth] = from <= to ? [from, to] : [to, from];
  const end = new Date(`${endMonth}-01T00:00:00`);
  return { from:`${startMonth}-01`, to:dateKey(new Date(end.getFullYear(), end.getMonth() + 1, 0)), label:startMonth === endMonth ? startMonth : `${startMonth} to ${endMonth}`, startMonth, endMonth };
}
function yearKeyRange(fromYear, toYear) {
  const from = Number(fromYear || currentYear());
  const to = Number(toYear || from);
  const startYear = Math.min(from, to);
  const endYear = Math.max(from, to);
  return { from:`${startYear}-01-01`, to:`${endYear}-12-31`, label:startYear === endYear ? String(startYear) : `${startYear} to ${endYear}`, startYear, endYear };
}
function monthSpanCount(startMonth, endMonth) {
  const start = new Date(`${startMonth}-01T00:00:00`);
  const end = new Date(`${endMonth}-01T00:00:00`);
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}
function insightRange(filter = insightFilter) {
  if (filter.mode === 'monthRange') return monthKeyRange(filter.fromMonth, filter.toMonth);
  if (filter.mode === 'yearRange') return yearKeyRange(filter.fromYear, filter.toYear);
  const range = monthKeyRange(currentMonthKey(), currentMonthKey());
  return { ...range, label:'This month' };
}
function previousInsightRange(filter = insightFilter, range = insightRange(filter)) {
  if (filter.mode === 'yearRange') {
    const span = range.endYear - range.startYear + 1;
    return yearKeyRange(range.startYear - span, range.startYear - 1);
  }
  const span = monthSpanCount(range.startMonth, range.endMonth);
  const previousEnd = addMonthsToDate(new Date(`${range.startMonth}-01T00:00:00`), -1);
  const previousStart = addMonthsToDate(previousEnd, -(span - 1));
  return monthKeyRange(monthInputKey(previousStart), monthInputKey(previousEnd));
}
function sumAmount(items) { return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0); }
function categoryTotals(items) { return items.reduce((acc, item) => { const key = item.category || 'Other'; acc[key] = (acc[key] || 0) + (Number(item.amount) || 0); return acc; }, {}); }
function subcategoryTotals(items) { return items.reduce((acc, item) => { const key = item.subcategory || item.category || 'Other'; acc[key] = (acc[key] || 0) + (Number(item.amount) || 0); return acc; }, {}); }
function percent(value, total) { return total ? Math.round(value / total * 100) : 0; }
function weekOfMonth(dateString) { const date = new Date(`${dateString}T00:00:00`); return Math.min(5, Math.ceil(date.getDate() / 7)); }
function donutPoint(cx, cy, radius, angle) { const radians = (angle - 90) * Math.PI / 180; return { x:cx + radius * Math.cos(radians), y:cy + radius * Math.sin(radians) }; }
function donutArc(cx, cy, radius, startAngle, endAngle) { const start = donutPoint(cx, cy, radius, endAngle); const end = donutPoint(cx, cy, radius, startAngle); const largeArc = endAngle - startAngle <= 180 ? 0 : 1; return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`; }
function renderCategoryDonut(rows, total) {
  if (!rows.length || !total) return '<p class="empty-state">No real expenses in this range.</p>';
  const palette = ['#3f64b7','#7857f4','#9a4fd1','#e84579','#ff715c','#f4b845','#35bfa9'];
  let angle = -18;
  const segments = rows.map(([category, value], index) => {
    const span = Math.max(2, value / total * 360);
    const start = angle;
    const end = angle + span;
    angle = end;
    return { category, value, start, end, mid:start + span / 2, color:palette[index % palette.length] };
  });
  const labels = segments.map((segment, index) => {
    const side = Math.cos((segment.mid - 90) * Math.PI / 180) >= 0 ? 'right' : 'left';
    const p1 = donutPoint(160, 124, 86, segment.mid);
    const p2 = donutPoint(160, 124, 112, segment.mid);
    const endX = side === 'right' ? 294 : 26;
    const textX = side === 'right' ? 302 : 18;
    const anchor = side === 'right' ? 'start' : 'end';
    const y = Math.max(24, Math.min(224, p2.y));
    return `<g class="donut-callout ${side}"><path d="M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${y.toFixed(1)} L ${endX} ${y.toFixed(1)}" stroke="${segment.color}" /><text x="${textX}" y="${(y - 6).toFixed(1)}" text-anchor="${anchor}" class="callout-amount">${money(segment.value)}</text><text x="${textX}" y="${(y + 11).toFixed(1)}" text-anchor="${anchor}" class="callout-name">${segment.category}</text></g>`;
  }).join('');
  return `<div class="category-donut-wrap"><svg class="category-donut-svg" viewBox="0 0 320 248" role="img" aria-label="Category-wise expense donut chart">${segments.map(segment => `<path d="${donutArc(160, 124, 64, segment.start, segment.end)}" stroke="${segment.color}" />`).join('')}<circle cx="160" cy="124" r="39" class="donut-hole" /><text x="160" y="118" text-anchor="middle" class="donut-center-label">Real spend</text><text x="160" y="140" text-anchor="middle" class="donut-center-value">${money(total)}</text>${labels}</svg></div>`;
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
function insightYearOptions(selectedYear) {
  const years = new Set([currentYear(), String(Number(currentYear()) - 1)]);
  data.transactions.forEach(transaction => { if (transaction.date) years.add(transaction.date.slice(0, 4)); });
  if (selectedYear) years.add(String(selectedYear));
  return [...years].sort((a, b) => Number(b) - Number(a)).map(year => `<option value="${year}" ${String(selectedYear) === year ? 'selected' : ''}>${year}</option>`).join('');
}
function transactionRange(filter = transactionFilter) {
  if (filter.mode === 'monthRange') return monthKeyRange(filter.fromMonth, filter.toMonth);
  if (filter.mode === 'yearRange') return yearKeyRange(filter.fromYear, filter.toYear);
  const range = monthKeyRange(currentMonthKey(), currentMonthKey());
  return { ...range, label:'This month' };
}
function transactionCategories() {
  return [...new Set(data.transactions.map(transaction => transaction.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
function filteredTransactions(filter = transactionFilter) {
  const range = transactionRange(filter);
  const query = (filter.search || '').trim().toLowerCase();
  const rows = data.transactions.filter(transaction => {
    const matchesRange = transaction.date >= range.from && transaction.date <= range.to;
    const matchesType = !filter.type || filter.type === 'all' || transaction.type === filter.type;
    const matchesCategory = !filter.category || filter.category === 'all' || transaction.category === filter.category;
    const text = `${transaction.subcategory || ''} ${transaction.category || ''} ${transaction.note || ''} ${transaction.type || ''}`.toLowerCase();
    return matchesRange && matchesType && matchesCategory && (!query || text.includes(query));
  });
  const sorters = {
    dateDesc:(a,b) => b.date.localeCompare(a.date) || (b.amount - a.amount),
    dateAsc:(a,b) => a.date.localeCompare(b.date) || (b.amount - a.amount),
    amountDesc:(a,b) => b.amount - a.amount || b.date.localeCompare(a.date),
    amountAsc:(a,b) => a.amount - b.amount || b.date.localeCompare(a.date),
    nameAsc:(a,b) => (a.subcategory || a.category || '').localeCompare(b.subcategory || b.category || '')
  };
  return rows.sort(sorters[filter.sort] || sorters.dateDesc);
}
function renderTransactionFilters(filter = transactionFilter) {
  const fromMonth = filter.fromMonth || currentMonthKey();
  const toMonth = filter.toMonth || fromMonth;
  const fromYear = filter.fromYear || currentYear();
  const toYear = filter.toYear || fromYear;
  const typeOptions = [['all','All types'],['expense','Expenses'],['loan','Loans'],['investment','Investments']].map(([value, label]) => `<option value="${value}" ${filter.type === value ? 'selected' : ''}>${label}</option>`).join('');
  const categoryOptions = `<option value="all">All categories</option>${transactionCategories().map(category => `<option value="${category}" ${filter.category === category ? 'selected' : ''}>${category}</option>`).join('')}`;
  const sortOptions = [['dateDesc','Newest first'],['dateAsc','Oldest first'],['amountDesc','Amount high to low'],['amountAsc','Amount low to high'],['nameAsc','Name A-Z']].map(([value, label]) => `<option value="${value}" ${filter.sort === value ? 'selected' : ''}>${label}</option>`).join('');
  return `<form id="transactionFilters" class="transaction-filter-panel">
    <div class="insight-range-control transaction-range-control">
      <button type="button" class="${filter.mode === 'thisMonth' ? 'active' : ''}" data-transaction-preset="thisMonth">This month</button>
      <label class="${filter.mode === 'monthRange' ? 'active' : ''}">Month range<input name="fromMonth" type="text" data-picker="month" value="${fromMonth}" placeholder="From month" /><span>to</span><input name="toMonth" type="text" data-picker="month" value="${toMonth}" placeholder="To month" /><button type="submit" data-transaction-mode="monthRange">Apply</button></label>
      <label class="${filter.mode === 'yearRange' ? 'active' : ''}">Year range<select name="fromYear">${insightYearOptions(fromYear)}</select><span>to</span><select name="toYear">${insightYearOptions(toYear)}</select><button type="submit" data-transaction-mode="yearRange">Apply</button></label>
    </div>
    <div class="transaction-table-tools">
      <label>Search<input name="search" type="search" value="${filter.search || ''}" placeholder="Name, note, category..." /></label>
      <label>Type<select name="type">${typeOptions}</select></label>
      <label>Category<select name="category">${categoryOptions}</select></label>
      <label>Sort<select name="sort">${sortOptions}</select></label>
    </div>
  </form>`;
}
function renderTransactionsPage() {
  const range = transactionRange();
  const rows = filteredTransactions();
  const total = sumAmount(rows);
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">${range.label}</p><h3>Transactions</h3><p class="subtitle">${rows.length} entries · ${money(total)} in selected results</p></div><button class="primary-button" data-action="open-add">＋ Add transaction</button></div>${renderTransactionFilters()}<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Amount</th><th></th></tr></thead><tbody>${rows.length ? rows.map(t => `<tr><td>${t.date}</td><td><b>${t.subcategory || t.category}</b><br><small>${t.note || 'No note'}</small></td><td><span class="type-badge ${t.type}">${t.type}</span></td><td>${t.category}</td><td>${money(t.amount)}</td><td><div class="row-actions"><button class="table-actions" data-action="edit" data-id="${t.id}">Edit</button><button class="table-actions delete-action" data-action="delete" data-id="${t.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="6"><p class="empty-state">No transactions match the selected range and filters.</p></td></tr>'}</tbody></table></div></article>`;
}
function applyTransactionFiltersFromForm(form, mode = transactionFilter.mode || 'thisMonth') {
  const data = new FormData(form);
  transactionFilter = { mode, fromMonth:data.get('fromMonth'), toMonth:data.get('toMonth'), fromYear:data.get('fromYear'), toYear:data.get('toYear'), search:data.get('search') || '', type:data.get('type') || 'all', category:data.get('category') || 'all', sort:data.get('sort') || 'dateDesc' };
  $('#subPageView').innerHTML = renderTransactionsPage();
}
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
  const otherCategoryTotal = categoryEntries.slice(6).reduce((sum, [, value]) => sum + value, 0);
  const categoryChartRows = otherCategoryTotal ? [...categoryEntries.slice(0, 6), ['Other', otherCategoryTotal]] : categoryEntries.slice(0, 7);
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
      <div class="panel category-chart-panel"><div class="panel-heading"><div><p class="panel-kicker">SELECTED RANGE</p><h3>Category chart</h3><p class="subtitle">Real expense categories for ${range.label}</p></div></div>${renderCategoryDonut(categoryChartRows, categoryChartTotal)}</div>
    </section>
    <section class="insights-lower-grid">
      <div class="panel heatmap-panel"><div class="panel-heading"><div><p class="panel-kicker">WEEKLY PATTERN</p><h3>Category heatmap</h3></div></div><div class="heatmap-head"><span></span><span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span></div>${heatCategories.length ? heatCategories.map(category => `<div class="heatmap-row"><b>${category}</b>${[1,2,3,4,5].map(week => { const value = heatValues[`${category}-${week}`] || 0; return `<span title="${category} week ${week}: ${money(value)}" style="opacity:${value ? Math.max(.25, value / heatMax) : .12}"></span>`; }).join('')}</div>`).join('') : '<p class="empty-state">Add real expenses to populate the heatmap.</p>'}<div class="heatmap-scale"><small>Low</small><i></i><small>High</small></div></div>
      <div class="panel split-panel"><div class="panel-heading"><div><p class="panel-kicker">STRUCTURE</p><h3>Fixed vs variable</h3></div></div><div class="donut" style="--fixed:${percent(fixedTotal, sums.total) * 3.6}deg"><div><strong>${percent(fixedTotal, sums.total)}%</strong><small>Fixed</small></div></div><div class="split-legend"><span><i class="legend-dot purple"></i>Fixed / recurring <b>${money(fixedTotal)}</b></span><span><i class="legend-dot amber"></i>Variable <b>${money(variableTotal)}</b></span></div></div>
      <div class="panel velocity-panel"><div class="panel-heading"><div><p class="panel-kicker">SPEND VELOCITY</p><h3>Pace check</h3></div></div><div class="velocity-meter"><div class="velocity-ring" style="--pace:${Math.min(100, velocityTargetPct) * 3.6}deg"><strong>${velocityTargetPct}%</strong><small>of target</small></div><div class="velocity-copy"><p class="velocity-status ${velocity.statusTone}">${velocity.status}</p><b>${money(sums.real)}</b><div class="velocity-detail-list"><span><i>${svgIcon('bag')}</i><span class="velocity-text">Actual real spend so far <b>${money(sums.real)}</b></span></span><span><i>${svgIcon('insights')}</i><span class="velocity-text">Projected month-end <b class="${velocity.statusTone}">${money(velocity.projected)}</b></span></span><span><i>${svgIcon('tag')}</i><span class="velocity-text">Target <b>${money(velocity.target)}</b>${velocity.months > 1 ? ` · Avg monthly <b>${money(velocity.averageMonthlyBudget)}</b>` : ''}</span></span><span><i>${svgIcon('bolt')}</i><span class="velocity-text">Daily budget <b>${money(velocity.dailyBudget)}</b><small>Actual <b>${money(velocity.daily)}</b> per active day</small></span></span></div></div></div></div>
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
function renderOutflowReport(from = reportDates().from, to = reportDates().to) { const filtered = data.transactions.filter(t => t.date >= from && t.date <= to).sort((a,b) => b.date.localeCompare(a.date)); const groups = { expense:filtered.filter(t => t.type === 'expense'), loan:filtered.filter(t => t.type === 'loan'), investment:filtered.filter(t => t.type === 'investment') }; const sums = { expense:groups.expense.reduce((s,t)=>s+t.amount,0), loan:groups.loan.reduce((s,t)=>s+t.amount,0), investment:groups.investment.reduce((s,t)=>s+t.amount,0) }; const total=sums.expense+sums.loan+sums.investment; return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">DATE-RANGE REPORT</p><h3>Total outflow</h3></div><div class="panel-actions"><button class="ghost-button" data-page="investments">View investments</button><button class="ghost-button" data-page="dashboard">Back home</button></div></div><form id="outflowFilters" class="outflow-filters"><label>From<input name="from" type="text" data-picker="date" value="${from}" placeholder="From date" /></label><label>To<input name="to" type="text" data-picker="date" value="${to}" placeholder="To date" /></label><div class="range-actions"><button type="button" data-range="this-month">This month</button><button type="button" data-range="all-time">All time</button></div></form><div class="outflow-summary"><div class="outflow-metric total"><p>Total outflow</p><strong>${money(total)}</strong></div><div class="outflow-metric"><p>Expenses</p><strong>${money(sums.expense)}</strong></div><div class="outflow-metric loan"><p>Loans paid</p><strong>${money(sums.loan)}</strong></div><div class="outflow-metric investment"><p>Investments made</p><strong>${money(sums.investment)}</strong></div></div>${['expense','loan','investment'].map(type => `<div class="outflow-group"><div class="outflow-group-heading"><b>${type === 'expense' ? 'All expenses' : type === 'loan' ? 'Loans paid' : 'Investments made'}</b><span>${groups[type].length} entries · ${money(sums[type])}</span></div>${groups[type].length ? `<table class="outflow-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>${groups[type].map(t=>`<tr><td>${t.date}</td><td>${t.subcategory || t.category}</td><td>${t.category}</td><td>${money(t.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">No entries in this range.</p>'}</div>`).join('')}</article>`; }
function renderInvestmentsPage() {
  const investments = data.schedules.filter(schedule => schedule.type === 'investment');
  const rows = investments.map(schedule => ({ schedule, projection:investmentProjection(schedule) }));
  const totals = rows.reduce((acc, item) => {
    acc.invested += item.projection.invested;
    acc.gross += item.projection.currentValue;
    acc.withdrawn += item.projection.withdrawn;
    acc.net += item.projection.netValue;
    return acc;
  }, { invested:0, gross:0, withdrawn:0, net:0 });
  const gain = totals.net - totals.invested;
  const cards = rows.map(({ schedule, projection }) => `<div class="investment-report-card"><div class="schedule-card-heading"><span class="upcoming-icon teal-bg">${svgIcon('pie')}</span><span class="tag">${schedule.autoAdd ? 'Auto-add' : 'Manual'}</span></div><h4>${schedule.subcategory}</h4><p>${money(schedule.amount)} contribution · ${scheduleWhen(schedule)}</p><div class="investment-card-grid"><span>Invested<b>${money(projection.invested)}</b></span><span>Gross value<b>${money(projection.currentValue)}</b></span><span>Withdrawn<b>${money(projection.withdrawn)}</b></span><span>Net value<b>${money(projection.netValue)}</b></span></div><div class="investment-gain ${projection.gain >= 0 ? 'positive' : 'negative'}">${projection.gain >= 0 ? 'Gain' : 'Loss'} ${money(Math.abs(projection.gain))}</div>${projection.projected ? `<small class="investment-note">Projected ${money(projection.futureValue)} in ${projection.months} months at ${schedule.expectedAnnualRate}% expected return.</small>` : '<small class="investment-note">No return projection set. Current gain/loss is shown only.</small>'}<div class="schedule-actions"><button class="mini-button" data-action="edit-schedule" data-id="${schedule.id}">Update value</button></div></div>`).join('');
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">PORTFOLIO VIEW</p><h3>Investment position</h3></div><button class="primary-button" data-action="open-add">＋ Add investment</button></div><div class="investment-report-summary"><div><p>Amount invested</p><strong>${money(totals.invested)}</strong></div><div><p>Gross current value</p><strong>${money(totals.gross)}</strong></div><div><p>Withdrawn</p><strong>${money(totals.withdrawn)}</strong></div><div class="net"><p>Net current value</p><strong>${money(totals.net)}</strong></div><div class="${gain >= 0 ? 'positive' : 'negative'}"><p>Net gain/loss</p><strong>${gain >= 0 ? '+' : '-'}${money(Math.abs(gain))}</strong></div></div>${investments.length ? `<div class="investment-report-grid">${cards}</div><div class="outflow-group"><div class="outflow-group-heading"><b>Investment breakdown</b><span>${investments.length} active items</span></div><table class="outflow-table"><thead><tr><th>Name</th><th>Invested</th><th>Gross value</th><th>Withdrawn</th><th>Net value</th><th>Gain/Loss</th></tr></thead><tbody>${rows.map(({ schedule, projection }) => `<tr><td>${schedule.subcategory}</td><td>${money(projection.invested)}</td><td>${money(projection.currentValue)}</td><td>${money(projection.withdrawn)}</td><td>${money(projection.netValue)}</td><td class="${projection.gain >= 0 ? 'positive' : 'negative'}">${projection.gain >= 0 ? '+' : '-'}${money(Math.abs(projection.gain))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state">Add an investment schedule to track current value, withdrawals, and gain/loss.</p>'}</article>`;
}
function renderProfilePage() { const user = currentUser || {}; const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'Current session'; return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">ACCOUNT</p><h3>Your profile</h3></div><button class="mini-button warn" data-action="logout">Logout</button></div><div class="profile-card"><div class="profile-avatar">${svgIcon('user')}</div><div><h4>${displayName()}</h4><p>${user.email || 'Signed-in user'} · Member since ${joined}</p></div></div><form id="profileForm" class="profile-form"><label>Display name<input name="name" value="${displayName()}" required /></label><button class="primary-button" type="submit">Save name</button></form><div class="profile-grid"><div class="outflow-metric"><p>Transactions</p><strong>${data.transactions.length}</strong></div><div class="outflow-metric"><p>Schedules</p><strong>${data.schedules.length}</strong></div><div class="outflow-metric"><p>Categories</p><strong>${data.categories.length}</strong></div><div class="outflow-metric total"><p>Storage</p><strong>Synced</strong></div></div><div class="setting-row"><div><b>Data sync</b><small>Refresh pulls the latest transactions, schedules, and categories from your account.</small></div><button class="mini-button" data-action="refresh-profile">Refresh</button></div><div class="setting-row"><div><b>Categories</b><small>Add or rename expense, loan, and investment categories.</small></div><button class="mini-button" data-page="settings">Settings</button></div><div class="setting-row"><div><b>Backup</b><small>Download a JSON backup of the data currently loaded in the app.</small></div><button class="mini-button" data-action="export">Export</button></div></article>`; }
function exportData() { const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'expensohabit-backup.json'; a.click(); URL.revokeObjectURL(url); toast('Backup exported'); }
function openHabitModal(habit = null) {
  editingHabitId = habit?.id || null;
  const form = $('#habitForm');
  form.reset();
  $('#habitModalTitle').textContent = habit ? 'Edit habit' : 'Add habit';
  form.name.value = habit?.name || '';
  form.description.value = habit?.description || '';
  form.goalType.value = habit?.goalType || 'checkbox';
  form.target.value = habit?.goalType === 'checkbox' ? '' : habit?.target || '';
  form.unit.value = habit?.unit || '';
  form.icon.value = habit?.icon || 'habit';
  form.color.value = habit?.color || 'purple-bg';
  form.active.checked = habit?.active !== false;
  $('#habitModalBackdrop').hidden = false;
}
function closeHabitModal() { editingHabitId = null; $('#habitModalBackdrop').hidden = true; $('#habitForm').reset(); $('#habitModalTitle').textContent = 'Add habit'; }
function renderHabitCheckinRows(date, focusHabitId = '') {
  const habits = activeHabits();
  return habits.map(habit => {
    const log = habitLog(habit.id, date);
    const checked = log?.completed || false;
    return `<div class="habit-checkin-row ${focusHabitId && focusHabitId !== habit.id ? 'muted' : ''}">
      <label class="habit-checkin-toggle"><input type="checkbox" name="completed-${habit.id}" ${checked ? 'checked' : ''} /><span class="map-icon ${habit.color}">${svgIcon(habit.icon)}</span><b>${esc(habit.name)}</b></label>
      ${habit.goalType !== 'checkbox' ? `<label>Value<input name="value-${habit.id}" type="number" step="0.1" min="0" value="${log?.value || ''}" placeholder="${habitTargetText(habit)}" /></label>` : `<input name="value-${habit.id}" type="hidden" value="${checked ? 1 : 0}" />`}
      <label>Note<textarea name="note-${habit.id}" rows="2" placeholder="Anything to remember for this day...">${esc(log?.note || '')}</textarea></label>
    </div>`;
  }).join('') || '<p class="empty-state">Add active habits before checking in.</p>';
}
function openHabitCheckinModal(date = today(), focusHabitId = '') {
  habitCheckinDate = date || today();
  const form = $('#habitCheckinForm');
  form.reset();
  form.date.value = habitCheckinDate;
  $('#habitCheckinList').innerHTML = renderHabitCheckinRows(habitCheckinDate, focusHabitId);
  $('#habitCheckinModalBackdrop').hidden = false;
  initializeDatePickers($('#habitCheckinModalBackdrop'));
}
function closeHabitCheckinModal() { $('#habitCheckinModalBackdrop').hidden = true; $('#habitCheckinForm').reset(); $('#habitCheckinList').innerHTML = ''; }
function openConfirmDeleteHabit(habit) {
  pendingHabitDeleteId = habit?.id || null;
  $('#confirmModalTitle').textContent = `Delete ${habit?.name || 'habit'}?`;
  $('#confirmModalCopy').textContent = 'This removes the habit and all of its check-in history. This action cannot be undone.';
  $('#confirmModalBackdrop').hidden = false;
}
function closeConfirmModal() { pendingHabitDeleteId = null; $('#confirmModalBackdrop').hidden = true; }
async function submitProfile(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const response = await fetch('/api/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:form.get('name') }) });
  const result = await response.json();
  if (!response.ok) { toast(result.error || 'Could not save name'); return; }
  currentUser = result;
  navigate('profile', false);
  toast('Name updated');
}
async function submitHabit(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const goalType = form.get('goalType') || 'checkbox';
  const payload = { name:form.get('name'), description:form.get('description'), goalType, target:form.get('target'), unit:form.get('unit'), icon:form.get('icon'), color:form.get('color'), frequency:'Daily', active:event.target.active.checked };
  const wasEditing = !!editingHabitId;
  const response = await fetch(editingHabitId ? `/api/habits/${editingHabitId}` : '/api/habits', { method:editingHabitId ? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) { toast(result.error || 'Could not save habit'); return; }
  closeHabitModal();
  await loadData();
  navigate(activePage === 'habitManage' ? 'habitManage' : 'habits', false);
  toast(wasEditing ? 'Habit updated' : 'Habit added');
}
async function saveHabitLog(habit, value, completed = null, date = today(), note = '') {
  const numericValue = habit.goalType === 'checkbox' ? (completed ? 1 : 0) : Number(value || 0);
  const payload = { habitId:habit.id, date, value:numericValue, completed:completed === null ? numericValue >= Number(habit.target || 1) : completed, note };
  const response = await fetch('/api/habit-logs', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) { toast(result.error || 'Could not update habit'); return; }
  await loadData();
  navigate(activePage, false);
  toast('Habit updated');
}
async function submitHabitCheckin(event) {
  event.preventDefault();
  const form = event.target;
  const date = form.date.value || today();
  const habits = activeHabits();
  for (const habit of habits) {
    const completed = !!form.elements[`completed-${habit.id}`]?.checked;
    const value = habit.goalType === 'checkbox' ? (completed ? 1 : 0) : form.elements[`value-${habit.id}`]?.value || 0;
    const note = form.elements[`note-${habit.id}`]?.value || '';
    const response = await fetch('/api/habit-logs', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ habitId:habit.id, date, value, completed:habit.goalType === 'checkbox' ? completed : completed || Number(value || 0) >= Number(habit.target || 1), note }) });
    if (!response.ok) { const result = await response.json(); toast(result.error || 'Could not save check-in'); return; }
  }
  closeHabitCheckinModal();
  await loadData();
  navigate(activePage, false);
  toast('Check-in saved');
}
async function deleteHabit() {
  if (!pendingHabitDeleteId) return;
  const response = await fetch(`/api/habits/${pendingHabitDeleteId}`, { method:'DELETE' });
  if (!response.ok) { toast('Could not delete habit'); return; }
  closeConfirmModal();
  await loadData();
  navigate('habitManage', false);
  toast('Habit deleted');
}

$('#heroAddButton').addEventListener('click', () => openModal()); $('#fabButton').addEventListener('click', () => openModal()); $('#topAddButton').addEventListener('click', () => openModal()); $('#closeModal').addEventListener('click', closeModal); $('#cancelModal').addEventListener('click', closeModal); $('#modalBackdrop').addEventListener('click', event => { if (event.target.id === 'modalBackdrop') closeModal(); }); $('#transactionForm').addEventListener('submit', addTransaction); $('#closeHabitModal').addEventListener('click', closeHabitModal); $('#cancelHabitModal').addEventListener('click', closeHabitModal); $('#habitModalBackdrop').addEventListener('click', event => { if (event.target.id === 'habitModalBackdrop') closeHabitModal(); }); $('#habitForm').addEventListener('submit', submitHabit); $('#closeHabitCheckinModal').addEventListener('click', closeHabitCheckinModal); $('#cancelHabitCheckinModal').addEventListener('click', closeHabitCheckinModal); $('#habitCheckinModalBackdrop').addEventListener('click', event => { if (event.target.id === 'habitCheckinModalBackdrop') closeHabitCheckinModal(); }); $('#habitCheckinForm').addEventListener('submit', submitHabitCheckin); $('#closeConfirmModal').addEventListener('click', closeConfirmModal); $('#cancelConfirmModal').addEventListener('click', closeConfirmModal); $('#confirmModalBackdrop').addEventListener('click', event => { if (event.target.id === 'confirmModalBackdrop') closeConfirmModal(); }); $('#confirmDeleteButton').addEventListener('click', deleteHabit); $('#refreshButton').addEventListener('click', refreshData); $('#privacyButton').addEventListener('click', togglePrivacy);
$('#authForm').addEventListener('submit', submitAuth); $('#authToggle').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
$('#transactionForm input[name="recurring"]').addEventListener('change', () => updateDetailSections());
$('#transactionForm select[name="frequency"]').addEventListener('change', () => updateDetailSections());
$$('.type-tabs button').forEach(button => button.addEventListener('click', () => { setType(button.dataset.type); updateCategoryOptions(); })); $$('[data-workspace]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.workspace === 'habits' ? 'habits' : 'dashboard'))); $$('.nav-item,[data-page]').forEach(button => button.addEventListener('click', async event => { if (button.matches('a')) event.preventDefault(); navigate(button.dataset.page); if (button.dataset.page === 'dashboard') await refreshData(); })); $$('.segmented-control button').forEach(button => button.addEventListener('click', () => { dashboardView = button.dataset.view; $$('.segmented-control button').forEach(b => b.classList.remove('active')); button.classList.add('active'); renderDashboard(); toast(dashboardView === 'real' ? 'Showing real expenses only' : 'Showing all outflow'); }));
$$('[data-chart-range]').forEach(button => button.addEventListener('click', () => { chartRange = button.dataset.chartRange; $$('[data-chart-range]').forEach(b => b.classList.remove('active')); button.classList.add('active'); renderChart(dashboardView); }));
let transactionFilterTimer;
$('#subPageView').addEventListener('change', event => { const form = event.target.closest('#transactionFilters'); if (!form || !event.target.closest('.transaction-table-tools')) return; applyTransactionFiltersFromForm(form); });
$('#subPageView').addEventListener('input', event => { const form = event.target.closest('#transactionFilters'); if (!form || event.target.name !== 'search') return; clearTimeout(transactionFilterTimer); transactionFilterTimer = setTimeout(() => applyTransactionFiltersFromForm(form), 250); });
$('#habitCheckinForm').addEventListener('change', event => { if (event.target.name !== 'date') return; habitCheckinDate = event.target.value || today(); $('#habitCheckinList').innerHTML = renderHabitCheckinRows(habitCheckinDate); });
$('#subPageView').addEventListener('click', async event => { const target = event.target.closest('[data-action],[data-page],[data-range],[data-insight-preset],[data-transaction-preset]'); if (!target) return; if (target.dataset.insightPreset === 'thisMonth') { insightFilter = { mode:'thisMonth' }; $('#subPageView').innerHTML = renderInsightsPage(); return; } if (target.dataset.transactionPreset === 'thisMonth') { const form = $('#transactionFilters'); transactionFilter = { ...transactionFilter, mode:'thisMonth', fromMonth:currentMonthKey(), toMonth:currentMonthKey(), fromYear:currentYear(), toYear:currentYear(), search:form?.search?.value || transactionFilter.search, type:form?.type?.value || transactionFilter.type, category:form?.category?.value || transactionFilter.category, sort:form?.sort?.value || transactionFilter.sort }; $('#subPageView').innerHTML = renderTransactionsPage(); return; } if (target.dataset.page) { navigate(target.dataset.page); if (target.dataset.page === 'dashboard') await refreshData(); return; } const action = target.dataset.action; if (!action) return; if (action === 'open-habit-modal') { openHabitModal(); return; } if (action === 'open-habit-checkin') { openHabitCheckinModal(target.dataset.date || today(), target.dataset.id || ''); return; } if (action === 'edit-habit') { const habit = data.habits.find(item => item.id === target.dataset.id); if (habit) openHabitModal(habit); return; } if (action === 'toggle-habit-active') { const habit = data.habits.find(item => item.id === target.dataset.id); if (!habit) return; const response = await fetch(`/api/habits/${habit.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ active:habit.active === false }) }); if (!response.ok) { toast('Could not update habit'); return; } await loadData(); navigate('habitManage', false); toast(habit.active === false ? 'Habit activated' : 'Habit paused'); return; } if (action === 'confirm-delete-habit') { const habit = data.habits.find(item => item.id === target.dataset.id); if (habit) openConfirmDeleteHabit(habit); return; } if (action === 'delete-habit-log') { const response = await fetch(`/api/habit-logs/${target.dataset.id}/${target.dataset.date}`, { method:'DELETE' }); if (!response.ok) { toast('Could not delete check-in'); return; } await loadData(); navigate('habitCheckins', false); toast('Check-in deleted'); return; } if (action === 'toggle-habit') { const habit = data.habits.find(item => item.id === target.dataset.id); if (!habit) return; const done = habitCompleted(habit); await saveHabitLog(habit, done ? 0 : Number(habit.target || 1), !done); return; } if (action === 'log-habit') { const habit = data.habits.find(item => item.id === target.dataset.id); if (!habit) return; const current = habitLog(habit.id)?.value || ''; const value = window.prompt(`Enter ${habit.name} value (${habit.unit || 'value'})`, current); if (value === null) return; await saveHabitLog(habit, value); return; } if (action === 'schedule-tab') { scheduleTab = target.dataset.tab || 'expense'; $('#subPageView').innerHTML = renderSubPage('schedule'); return; } if (action === 'logout') { await logout(); return; } if (action === 'refresh-profile') { await refreshData(); return; } if (action === 'open-add' || action === 'open-schedule') { openModal(activePage === 'investments' ? 'investment' : activePage === 'schedule' ? scheduleTab : 'expense'); if (activePage === 'investments' || action === 'open-schedule') { $('[name="recurring"]').checked = true; updateDetailSections(); } } if (action === 'export') exportData(); if (action === 'skip-schedule') toast('This schedule was skipped once'); if (action === 'edit') { const transaction = data.transactions.find(item => item.id === target.dataset.id); if (transaction) openModal(transaction.type, transaction); } if (action === 'delete') { const transaction = data.transactions.find(item => item.id === target.dataset.id); if (!transaction || !window.confirm(`Delete ${transaction.subcategory || transaction.category} for ${money(transaction.amount)}?`)) return; const response = await fetch(`/api/transactions/${transaction.id}`, { method:'DELETE' }); if (!response.ok) { toast('Could not delete transaction'); return; } data = await (await fetch('/api/data')).json(); navigate('transactions', false); toast('Transaction deleted'); } if (action === 'edit-schedule') { const response = await fetch(`/api/schedules/${target.dataset.id}`); if (!response.ok) { toast('Could not load the latest schedule'); return; } openScheduleModal(await response.json()); } if (action === 'edit-category') { const category = data.categories.find(item => item.id === target.dataset.id); const name = window.prompt('Category name', category.name); if (!name || name === category.name) return; const response = await fetch(`/api/categories/${category.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name }) }); if (response.ok) { data = await (await fetch('/api/data')).json(); updateCategoryOptions(); navigate('settings'); toast('Category updated'); } } });
$('#subPageView').addEventListener('submit', async event => {
  if (!['categoryForm','budgetSettingsForm','profileForm'].includes(event.target.id)) return;
  event.preventDefault();
  if (event.target.id === 'profileForm') { await submitProfile(event); return; }
  const form = new FormData(event.target);
  if (event.target.id === 'budgetSettingsForm') {
    const settings = normalizeSettings(data.settings);
    const overrideMonthInput = event.target.querySelector('[name="overrideMonth"]');
    const overrideMonth = normalizeMonthValue(form.get('overrideMonth'), overrideMonthInput?._flatpickr?.selectedDates?.[0]);
    const overrideAmount = Number(form.get('overrideAmount'));
    const monthlyBudgetOverrides = { ...settings.monthlyBudgetOverrides };
    if (overrideMonth) {
      if (overrideAmount > 0) monthlyBudgetOverrides[overrideMonth] = overrideAmount;
      else delete monthlyBudgetOverrides[overrideMonth];
    }
    const response = await fetch('/api/settings', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ monthlyExpenseBudget:Number(form.get('monthlyExpenseBudget')), monthlyBudgetOverrides }) });
    const result = await response.json();
    if (!response.ok) { toast(result.error || 'Could not save budget settings'); return; }
    await loadData();
    navigate('settings', false);
    toast('Budget target saved');
    return;
  }
  const response = await fetch('/api/categories', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:form.get('name'), kind:form.get('kind') }) });
  const result = await response.json();
  if (!response.ok) { toast(result.error || 'Could not add category'); return; }
  data = await (await fetch('/api/data')).json(); data.settings = normalizeSettings(data.settings);
  updateCategoryOptions(); navigate('settings'); toast('Category added');
});
$('#subPageView').addEventListener('click', event => { const range = event.target.dataset.range; if (!range) return; const now = new Date(); const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; const dates = reportDates(); const from = range === 'this-month' ? `${month}-01` : dates.from; const to = range === 'this-month' ? `${month}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}` : dates.to; $('#subPageView').innerHTML = renderOutflowReport(from, to); });
$('#subPageView').addEventListener('submit', event => { if (!['outflowFilters','insightFilters','transactionFilters'].includes(event.target.id)) return; event.preventDefault(); const form = new FormData(event.target); if (event.target.id === 'transactionFilters') { applyTransactionFiltersFromForm(event.target, event.submitter?.dataset.transactionMode || transactionFilter.mode || 'thisMonth'); return; } if (event.target.id === 'insightFilters') { const mode = event.submitter?.dataset.insightMode || 'monthRange'; const fromMonth = form.get('fromMonth'); const toMonth = form.get('toMonth'); const fromYear = form.get('fromYear'); const toYear = form.get('toYear'); insightFilter = mode === 'yearRange' ? { mode, fromYear, toYear, fromMonth, toMonth } : { mode, fromMonth, toMonth, fromYear, toYear }; $('#subPageView').innerHTML = renderInsightsPage(); return; } $('#subPageView').innerHTML = renderOutflowReport(form.get('from'), form.get('to')); });
new MutationObserver(() => initializeDatePickers($('#subPageView'))).observe($('#subPageView'), { childList:true, subtree:true });
window.addEventListener('popstate', () => navigate(pageForRoute[location.pathname] || 'dashboard', false));

async function bootstrap() {
  try { const auth = await checkAuth(); if (!auth.authenticated) { showAuthGate(); return; } currentUser = auth.user; await loadData(); updateCategoryOptions(); renderDashboard(); navigate(pageForRoute[location.pathname] || 'dashboard', false); maybeOpenMobileStartupTransactionModal(); }
  catch (error) { console.error(error); $('#syncLabel').textContent = 'Authentication unavailable'; showAuthGate(); $('#authError').textContent='Start the API and check the sync connection.'; }
}

updateCategoryOptions(); updatePrivacyButton(); initializeDatePickers(document); bootstrap();
