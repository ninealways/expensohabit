let data = { transactions: [], schedules: [], categories: [], habits: [], habitLogs: [], stockTrades: [], settings: { monthlyExpenseBudget: 60000, monthlyBudgetOverrides: {} } };
let activePage = 'dashboard';
let activeType = 'expense';
let authMode = 'login';
let editingTransactionId = null;
let editingScheduleId = null;
let editingCategoryId = null;
let stockTradeSeed = null;
let dashboardView = 'all';
let chartRange = 'last7';
let currentUser = null;
let insightFilter = { mode:'thisMonth' };
let calendarFilter = { view:'month', month:'', type:'all', selectedDate:'' };
let privacyMode = localStorage.getItem('dailyExpensesPrivacy') !== 'shown';
let scheduleTab = 'expense';
let investmentTab = 'portfolio';
let transactionFilter = { mode:'thisMonth', type:'all', category:[], spendGroup:[], search:'', sort:'dateDesc' };
let transactionOpenMultiFilter = '';
let activeWorkspace = 'expense';
let editingHabitId = null;
let pendingHabitDeleteId = null;
let habitCheckinDate = '';
let habitCheckinFocusId = '';
let habitSleepRange = 'daily';
let mobileStartupTransactionModalOpened = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
window.ExpensoApi?.installFetchLoader();
const hiddenMoney = () => '₹••••';
const money = (value) => privacyMode ? hiddenMoney() : `₹${Math.round(value).toLocaleString('en-IN')}`;
const compactMoney = (value) => privacyMode ? hiddenMoney() : value >= 100000 ? `₹${(value / 100000).toFixed(value % 100000 ? 1 : 0)}L` : value >= 1000 ? `₹${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : money(value);
const svgIcon = (name) => `<svg class="svg-icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const spendGroups = {
  need:{ label:'Need', color:'#7857f4', icon:'lock' },
  commitment:{ label:'Commitment', color:'#ff9f3f', icon:'receipt' },
  growth:{ label:'Growth', color:'#35bfa9', icon:'pie' },
  goodToHave:{ label:'Good to have', color:'#5f7cf6', icon:'tag' },
  leisure:{ label:'Leisure', color:'#ff715c', icon:'fork' }
};
function defaultSpendGroup(categoryName = '') {
  const name = String(categoryName).toLowerCase();
  if (/loan|emi|insurance|subscription|term|bill|utility|electricity|rent/.test(name)) return 'commitment';
  if (/book|course|learn|education|health|gym|fitness|medical|doctor/.test(name)) return 'growth';
  if (/entertain|movie|restaurant|travel|leisure|game|hobby/.test(name)) return 'leisure';
  if (/shopping|auto|fuel|wallet|misc|gadget|home/.test(name)) return 'goodToHave';
  return 'need';
}
function categorySpendGroup(categoryName = '') {
  const category = (data.categories || []).find(item => item.kind === 'expense' && item.name === categoryName);
  const key = category?.spendGroup || defaultSpendGroup(categoryName);
  return spendGroups[key] ? key : 'need';
}
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
const isSleepHabit = (habit = {}) => String(`${habit.name || ''} ${habit.icon || ''}`).toLowerCase().includes('sleep') || habit.icon === 'moon';
function timeToMinutes(value = '') {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? hours * 60 + minutes : null;
}
function sleepHours(from, to) {
  const start = timeToMinutes(from);
  let end = timeToMinutes(to);
  if (start === null || end === null) return 0;
  if (end <= start) end += 24 * 60;
  return Math.round(((end - start) / 60) * 10) / 10;
}
function formatClock(value = '') {
  const minutes = timeToMinutes(value);
  if (minutes === null) return '';
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return date.toLocaleTimeString('en-IN', { hour:'numeric', minute:'2-digit' });
}
function formatSleepDuration(hours = 0) {
  const totalMinutes = Math.round(Number(hours || 0) * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${wholeHours}h ${String(minutes).padStart(2, '0')}m` : `${wholeHours}h`;
}
function sleepLogText(log = {}) {
  const range = log.sleepStart && log.sleepEnd ? `${formatClock(log.sleepStart)} → ${formatClock(log.sleepEnd)}` : 'Sleep time not logged';
  return `${range} · ${formatSleepDuration(log.value)}`;
}
const habitValueText = (habit, log = habitLog(habit.id)) => isSleepHabit(habit) && log ? sleepLogText(log) : habit.goalType === 'checkbox' ? (log?.completed ? 'Done' : 'Not done') : `${Number(log?.value || 0).toLocaleString('en-IN')} / ${habitTargetText(habit)}`;
const habitStartDate = (habit) => {
  if (habit.startDate) return habit.startDate;
  const firstLog = (data.habitLogs || []).filter(log => log.habitId === habit.id).map(log => log.date).sort()[0];
  if (firstLog) return firstLog;
  if (habit.createdAt) return String(habit.createdAt).slice(0, 10);
  return today();
};
const habitIsStarted = (habit, date = today()) => date >= habitStartDate(habit);
const activeStartedHabits = (date = today()) => activeHabits().filter(habit => habitIsStarted(habit, date));
const habitDatesInRange = (habit, dates) => dates.filter(date => habitIsStarted(habit, date));
const habitCompleted = (habit, date = today()) => { if (!habitIsStarted(habit, date)) return false; const log = habitLog(habit.id, date); if (!log) return false; return habit.goalType === 'checkbox' ? !!log.completed : !!log.completed || Number(log.value || 0) >= Number(habit.target || 1); };
function habitDayClosed(date = today()) {
  const current = today();
  if (date < current) return true;
  if (date > current) return false;
  const todaysHabits = activeStartedHabits(current);
  if (todaysHabits.length && todaysHabits.every(habit => habitLog(habit.id, current))) return true;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= 23 * 60 + 50;
}
const habitScoringDates = (dates) => dates.filter(date => habitDayClosed(date));
function weekDates(anchor = new Date()) { const start = new Date(anchor); const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); return Array.from({ length:7 }, (_, index) => dateKey(addDays(start, index))); }
function habitStreak(habit) { const start = habitStartDate(habit); let streak = 0; let date = new Date(); if (!habitDayClosed(today()) && !habitCompleted(habit, today())) date = addDays(date, -1); for (; streak < 730; date = addDays(date, -1)) { const key = dateKey(date); if (key < start || !habitCompleted(habit, key)) break; streak += 1; } return streak; }
function habitMilestoneProgress(habit) {
  const logs = (data.habitLogs || []).filter(log => log.habitId === habit.id && log.date >= habitStartDate(habit));
  const type = habit.milestoneType || 'days';
  const target = Number(habit.milestoneTarget || 30);
  const current = type === 'total' && habit.goalType !== 'checkbox' ? logs.reduce((sum, log) => sum + Number(log.value || 0), 0) : logs.filter(log => log.completed).length;
  const label = type === 'total' && habit.goalType !== 'checkbox' ? `${Number(current || 0).toLocaleString('en-IN')} / ${Number(target).toLocaleString('en-IN')} ${habit.unit || ''}`.trim() : `${current} / ${target} days`;
  return { type, target, current, pct:target ? Math.min(100, Math.round(current / target * 100)) : 0, label };
}
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
  data.stockTrades = data.stockTrades || [];
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
  root.querySelectorAll('[data-picker="time"]').forEach(input => {
    if (input._flatpickr) { input._flatpickr.setDate(input.value, false, 'H:i'); return; }
    window.flatpickr(input, {
      enableTime:true,
      noCalendar:true,
      dateFormat:'H:i',
      altInput:true,
      altFormat:'h:i K',
      allowInput:true,
      disableMobile:true,
      minuteIncrement:5,
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

const checkAuth = () => window.ExpensoAuth.checkSession();
function showBootGate(message = 'Checking your secure session...') {
  const boot = $('#bootGate');
  if (boot) {
    boot.hidden = false;
    const text = boot.querySelector('small');
    if (text) text.textContent = message;
  }
  $('#authGate').hidden = true;
  $('#appShell').hidden = true;
  document.body.classList.add('app-booting');
  document.body.classList.remove('app-ready');
}
function showAuthGate() {
  $('#bootGate').hidden = true;
  $('#authGate').hidden = false;
  $('#appShell').hidden = true;
  document.body.classList.remove('app-booting', 'app-ready');
}
function showAppShell() {
  $('#bootGate').hidden = true;
  $('#authGate').hidden = true;
  $('#appShell').hidden = false;
  document.body.classList.remove('app-booting');
  document.body.classList.add('app-ready');
}
function displayName() { return currentUser?.name || currentUser?.email?.split('@')[0] || 'there'; }
function dashboardGreeting() { return `Good morning, ${displayName()} <span class="title-icon">${svgIcon('insights')}</span>`; }
function setAuthMode(mode) { authMode=mode; const isLogin=mode==='login'; $('#authTitle').textContent=isLogin?'Welcome back':'Create your account'; $('#authSubtitle').textContent=isLogin?'Sign in to access your money and habit dashboard.':'Create a secure account for your money and habit data.'; $('#authSubmit').textContent=isLogin?'Sign in':'Create account'; $('#authToggle').textContent=isLogin?'Create a new account':'I already have an account'; $('#authPassword').autocomplete=isLogin?'current-password':'new-password'; $('#authNameRow').hidden=isLogin; $('#authName').required=!isLogin; $('#inviteCodeRow').hidden=isLogin; $('#inviteCode').required=!isLogin; $('#authError').textContent=''; }
async function submitAuth(event) { event.preventDefault(); const payload={ email:$('#authEmail').value, password:$('#authPassword').value }; if (authMode === 'register') { payload.name = $('#authName').value; payload.inviteCode = $('#inviteCode').value; } try { currentUser = authMode === 'login' ? await window.ExpensoAuth.login(payload) : await window.ExpensoAuth.register(payload); } catch (error) { $('#authError').textContent = error.message || 'Authentication failed'; return; } await loadData(); updateCategoryOptions(); renderDashboard(); navigate(window.ExpensoRouter.pageFromLocation(), false); showAppShell(); maybeOpenMobileStartupTransactionModal(); toast(authMode==='login'?'Signed in':'Account created'); }
async function logout() { try { await window.ExpensoAuth.logout(); } catch (error) { toast(error.message || 'Could not log out'); return; } currentUser = null; data = { transactions: [], schedules: [], categories: [], habits: [], habitLogs: [], stockTrades: [], settings:defaultSettings }; $('#authForm').reset(); setAuthMode('login'); history.pushState({ page:'dashboard' }, '', '/dashboard'); showAuthGate(); toast('Logged out'); }

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
  renderCategories(dashboardView); renderUpcoming(); renderChart(dashboardView); renderHomeVelocity(t.real);
}

function renderHomeVelocity(realSpend) {
  const target = $('#homeVelocity');
  if (!target || typeof spendVelocity !== 'function') return;
  const range = insightRange({ mode:'thisMonth' });
  const velocity = spendVelocity(range, realSpend);
  const start = new Date(`${range.from}T00:00:00`);
  const elapsedDays = Math.max(1, velocity.elapsedDays || 1);
  const days = Array.from({ length:elapsedDays }, (_, index) => dateKey(addDays(start, index)));
  const dailyTotals = days.map(day => data.transactions
    .filter(transaction => transaction.date === day && transaction.type === 'expense' && transaction.includeInReal !== false)
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0));
  const width = 360, height = 150, left = 38, right = 14, top = 18, bottom = 30;
  const max = Math.max(1, Math.ceil(Math.max(...dailyTotals, velocity.dailyBudget, velocity.daily) * 1.16));
  const x = index => left + (days.length === 1 ? (width - left - right) / 2 : index * ((width - left - right) / (days.length - 1)));
  const y = value => top + (max - value) / max * (height - top - bottom);
  const points = dailyTotals.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const budgetY = y(velocity.dailyBudget);
  const projectedY = y(velocity.daily);
  const labelEvery = Math.max(1, Math.ceil(days.length / 5));
  const pointDots = dailyTotals.map((value, index) => {
    const showLabel = value > 0 || index === days.length - 1;
    return `<g><circle cx="${x(index).toFixed(1)}" cy="${y(value).toFixed(1)}" r="${showLabel ? 3.5 : 2}" class="pace-point"><title>${days[index]}: ${money(value)}</title></circle>${showLabel ? `<text class="pace-value-label" x="${x(index).toFixed(1)}" y="${Math.max(12, y(value) - 8).toFixed(1)}" text-anchor="middle">${compactMoney(value)}</text>` : ''}${index % labelEvery === 0 || index === days.length - 1 ? `<text class="pace-axis-label" x="${x(index).toFixed(1)}" y="${height - 8}" text-anchor="middle">${days[index].slice(-2)}</text>` : ''}</g>`;
  }).join('');
  target.innerHTML = `<div class="home-pace-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily real spend versus daily budget"><line class="pace-grid-line" x1="${left}" x2="${width - right}" y1="${top}" y2="${top}" /><line class="pace-grid-line" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}" /><text class="pace-axis-label" x="4" y="${top + 4}">${compactMoney(max)}</text><text class="pace-axis-label" x="4" y="${height - bottom + 4}">0</text><line class="pace-budget-line" x1="${left}" x2="${width - right}" y1="${budgetY.toFixed(1)}" y2="${budgetY.toFixed(1)}" /><line class="pace-projected-line" x1="${left}" x2="${width - right}" y1="${projectedY.toFixed(1)}" y2="${projectedY.toFixed(1)}" /><polyline class="pace-actual-line" points="${points}" />${pointDots}</svg></div><div class="home-pace-legend"><span><i class="actual"></i>Actual daily spend</span><span><i class="target"></i>Daily budget ${money(velocity.dailyBudget)}</span><span><i class="projected"></i>Actual avg ${money(velocity.daily)}</span></div><div class="home-pace-metrics"><span><small>Projected month-end</small><b class="${velocity.statusTone}">${money(velocity.projected)}</b></span><span><small>Monthly target</small><b>${money(velocity.target)}</b></span><span><small>Real spend so far</small><b>${money(realSpend)}</b></span></div>`;
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
function dateFromKey(value) { const date = new Date(`${value || today()}T00:00:00`); return Number.isNaN(date.getTime()) ? new Date(`${today()}T00:00:00`) : date; }
function daysBetween(start, end) { return Math.max(0, Math.round((end - start) / 86400000)); }
function monthsBetweenDates(start, end) { return Math.max(0, Math.round(daysBetween(start, end) / 30.4375)); }
function contributionGrowth(value, fromDate, toDate, annualRate) { const years = daysBetween(fromDate, toDate) / 365; return value * Math.pow(1 + annualRate / 100, years); }
function projectionEndFromSchedule(schedule, valuationDate) {
  if (schedule.projectionEndDate) return dateFromKey(schedule.projectionEndDate);
  const months = Number(schedule.projectionMonths) || 0;
  return months ? addMonthsToDate(valuationDate, months) : null;
}
function projectedContributionDates(schedule, valuationDate, projectionEndDate) {
  const amount = Number(schedule.amount) || 0;
  if (!amount || projectionEndDate <= valuationDate) return [];
  const dates = [];
  const push = date => {
    if (date > valuationDate && date <= projectionEndDate && (!schedule.endDate || dateKey(date) <= schedule.endDate)) dates.push(new Date(date));
  };
  const start = dateFromKey(schedule.startDate || today());
  const frequency = schedule.frequency || 'Monthly';
  if (frequency === 'Daily') {
    for (let cursor = addDays(new Date(Math.max(start, valuationDate)), 1); cursor <= projectionEndDate && dates.length < 5000; cursor = addDays(cursor, 1)) push(cursor);
  }
  else if (frequency === 'Weekly') {
    for (let cursor = new Date(start); cursor <= projectionEndDate && dates.length < 1000; cursor = addDays(cursor, 7)) push(cursor);
  }
  else if (frequency === 'Quarterly' || frequency === 'Yearly' || frequency === 'Monthly') {
    const step = frequency === 'Quarterly' ? 3 : frequency === 'Yearly' ? 12 : 1;
    const dueDay = Number(schedule.dueDay) || start.getDate();
    for (let offset = 0; dates.length < 1000; offset += step) {
      const monthBase = new Date(start.getFullYear(), start.getMonth() + offset, 1);
      if (monthBase > projectionEndDate) break;
      const lastDay = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0).getDate();
      push(new Date(monthBase.getFullYear(), monthBase.getMonth(), Math.min(dueDay, lastDay)));
    }
  }
  else if (frequency === 'BiMonthly') {
    const days = dayList(schedule).length ? dayList(schedule) : [start.getDate(), 15];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= projectionEndDate && dates.length < 1000) {
      days.forEach(day => push(new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()))));
      cursor = addMonthsToDate(cursor, 1);
    }
  }
  return dates.sort((a, b) => a - b);
}
function investmentProjection(schedule) {
  const invested = Number(schedule.amountInvestedToDate) || 0;
  const currentValue = Number(schedule.currentValue) || invested;
  const withdrawn = Number(schedule.amountWithdrawn) || 0;
  const netValue = Math.max(0, currentValue - withdrawn);
  const valuationDate = dateFromKey(schedule.investmentValuationDate || schedule.startDate || today());
  const projectionEndDate = projectionEndFromSchedule(schedule, valuationDate);
  const rate = Number(schedule.expectedAnnualRate);
  const gain = netValue - invested;
  if (!projectionEndDate || projectionEndDate <= valuationDate || !Number.isFinite(rate)) return { invested, currentValue, withdrawn, netValue, gain, valuationDate:dateKey(valuationDate), projected:false };
  const contributionDates = projectedContributionDates(schedule, valuationDate, projectionEndDate);
  const futureContributions = contributionDates.length * (Number(schedule.amount) || 0);
  const futureContributionValue = contributionDates.reduce((sum, date) => sum + contributionGrowth(Number(schedule.amount) || 0, date, projectionEndDate, rate), 0);
  const currentValueFuture = contributionGrowth(netValue, valuationDate, projectionEndDate, rate);
  const months = monthsBetweenDates(valuationDate, projectionEndDate);
  return { invested, currentValue, withdrawn, netValue, gain, projected:true, months, valuationDate:dateKey(valuationDate), projectionEndDate:dateKey(projectionEndDate), contributionCount:contributionDates.length, futureValue:currentValueFuture + futureContributionValue, futureContributions, futureContributionValue };
}
function scheduleSummary(schedule) { if (schedule.type === 'expense') return ''; if (schedule.type === 'loan') { const projection = loanProjection(schedule); return projection ? `<div class="schedule-summary"><b>Estimated remaining · ${schedule.interestType === 'floating' ? 'Floating' : 'Fixed'}</b><br>${money(projection.principalPaid)} principal + <strong>${money(projection.interest)}</strong> interest<br><small>${projection.months} months · approx. EMI ${money(projection.payment)}${schedule.interestType === 'floating' ? ' · uses current rate' : ''}</small></div>` : ''; } const projection = investmentProjection(schedule); if (!projection) return ''; if (!projection.projected) return `<div class="schedule-summary"><b>Current position</b><br>Invested ${money(projection.invested)} · Gross ${money(projection.currentValue)} · Withdrawn ${money(projection.withdrawn)}<br>Net value <strong>${money(projection.netValue)}</strong><br><small class="${projection.gain >= 0 ? 'positive' : 'negative'}">${projection.gain >= 0 ? 'Gain' : 'Loss'} ${money(Math.abs(projection.gain))} · valuation ${projection.valuationDate}</small></div>`; return `<div class="schedule-summary"><b>Net current value ${money(projection.netValue)}</b><br>Projected value <strong>${money(projection.futureValue)}</strong><br><small>${projection.valuationDate} to ${projection.projectionEndDate} · ${projection.contributionCount} contributions ${money(projection.futureContributions)} · expected return ${schedule.expectedAnnualRate}%</small></div>`; }

function openModal(type = 'expense', transaction = null) { editingTransactionId = transaction?.id || null; editingScheduleId = null; activeType = type; $('#modalBackdrop').hidden = false; $('#transactionForm').reset(); $('input[name="date"]').value = today(); setType(type); updateCategoryOptions(); $('#modalTitle').textContent = editingTransactionId ? 'Edit transaction' : 'Add transaction'; $('#transactionForm button[type="submit"]').textContent = editingTransactionId ? 'Save changes' : 'Save transaction'; updateDetailSections(); if (transaction) { $('input[name="amount"]').value=transaction.amount; $('input[name="subcategory"]').value=transaction.subcategory || ''; $('input[name="date"]').value=transaction.date; $('input[name="note"]').value=transaction.note || ''; $('input[name="includeInReal"]').checked=transaction.includeInReal !== false; $('#categoryInput').value=transaction.category; } initializeDatePickers($('#transactionForm')); }
function setField(name, value) { const field = $(`[name="${name}"]`); if (field) field.value = value ?? ''; }
function openScheduleModal(schedule) { const now = new Date(); const dueDate = schedule.startDate || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(schedule.dueDay).padStart(2,'0')}`; const days = dayList(schedule); openModal(schedule.type); editingScheduleId = schedule.id; $('#modalTitle').textContent='Edit schedule'; $('#transactionForm button[type="submit"]').textContent='Save schedule'; setField('amount', schedule.amount); setField('subcategory', schedule.subcategory); setField('date', dueDate); setField('frequency', schedule.frequency || 'Monthly'); setField('biMonthlyDayOne', days[0] || schedule.dueDay); setField('biMonthlyDayTwo', days[1] || ''); setField('endDate', schedule.endDate); setField('originalAmount', schedule.originalAmount); setField('remainingPrincipal', schedule.remainingPrincipal); setField('annualRate', schedule.annualRate); setField('interestType', schedule.interestType || 'fixed'); setField('amountInvestedToDate', schedule.amountInvestedToDate); setField('currentValue', schedule.currentValue); setField('investmentValuationDate', schedule.investmentValuationDate || schedule.startDate || today()); setField('amountWithdrawn', schedule.amountWithdrawn); setField('expectedAnnualRate', schedule.expectedAnnualRate); setField('projectionEndDate', schedule.projectionEndDate || (schedule.projectionMonths ? dateKey(addMonthsToDate(dateFromKey(schedule.investmentValuationDate || schedule.startDate || today()), Number(schedule.projectionMonths))) : '')); const recurring = $('[name="recurring"]'); if (recurring) recurring.checked = schedule.autoAdd !== false; if ($('#categoryInput')) $('#categoryInput').value=schedule.category; updateDetailSections(); initializeDatePickers($('#transactionForm')); }
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
  const investmentFields = { amountInvestedToDate:form.get('amountInvestedToDate') || null, currentValue:form.get('currentValue') || null, investmentValuationDate:form.get('investmentValuationDate') || null, amountWithdrawn:form.get('amountWithdrawn') || null, expectedAnnualRate:form.get('expectedAnnualRate') || null, projectionEndDate:form.get('projectionEndDate') || null };
  const scheduleFields = { amount, category:item.category, subcategory:item.subcategory, startDate:item.date, dueDay:dueDays[0], dueDays, frequency, autoAdd:form.get('recurring') === 'on', endDate:form.get('endDate') || null, originalAmount:form.get('originalAmount') || null, remainingPrincipal:form.get('remainingPrincipal') || null, annualRate:form.get('annualRate') || null, interestType:form.get('interestType') || 'fixed', ...investmentFields };
  const response = editingScheduleId ? await fetch(`/api/schedules/${editingScheduleId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(scheduleFields) }) : editingTransactionId ? await fetch(`/api/transactions/${editingTransactionId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(item) }) : await fetch('/api/transactions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ transaction:item, recurring:form.get('recurring') === 'on', frequency, dueDays, endDate:form.get('endDate') || null, originalAmount:form.get('originalAmount') || null, remainingPrincipal:form.get('remainingPrincipal') || null, annualRate:form.get('annualRate') || null, interestType:form.get('interestType') || 'fixed', ...investmentFields }) });
  if (!response.ok) { toast('Could not save data'); return; }
  data = await (await fetch('/api/data')).json(); saveData(); closeModal(); if (activePage === 'dashboard') renderDashboard(); else navigate(activePage, false); toast(editingScheduleId ? 'Schedule updated' : editingTransactionId ? 'Transaction updated' : 'Transaction saved'); editingTransactionId = null; editingScheduleId = null;
}

function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); }
const pageTitles = { transactions:'Your transactions', calendar:'Spend calendar', schedule:'Plan your payments', outflow:'Outflow report', investments:'Investments', insights:'Spend insights', profile:'Profile', settings:'Keep your data yours', habits:'Habit tracker', habitInsights:'Habit insights', habitManage:'Manage habits', habitCheckins:'Habit check-ins' };

function navigate(page, updateUrl = true) {
  transactionOpenMultiFilter = '';
  activePage = page; activeWorkspace = ['habits','habitInsights','habitManage','habitCheckins'].includes(page) ? 'habits' : 'expense'; if (updateUrl) window.ExpensoRouter.push(page); document.body.classList.toggle('dashboard-mode', page === 'dashboard'); document.body.classList.toggle('habits-mode', activeWorkspace === 'habits'); $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page)); $$('[data-workspace]').forEach(item => item.classList.toggle('active', item.dataset.workspace === activeWorkspace));
  const dashboardSections = $$('.hero-row,.summary-grid,.view-switch-row,.content-grid,.bottom-grid'); const subPage = $('#subPageView');
  if (page === 'habits') { dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderHabitsMockPage(); initializeDatePickers(subPage); return; }
  if (page === 'habitInsights') { dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderHabitInsightsPage(); initializeDatePickers(subPage); return; }
  if (page === 'habitManage') { dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderHabitManagePage(); initializeDatePickers(subPage); return; }
  if (page === 'habitCheckins') { dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderHabitCheckinsPage(); initializeDatePickers(subPage); return; }
  if (page === 'dashboard') { dashboardSections.forEach(section => section.hidden = false); subPage.hidden = true; $('#pageTitle').innerHTML = dashboardGreeting(); return; }
  dashboardSections.forEach(section => section.hidden = true); subPage.hidden = false; subPage.innerHTML = renderSubPage(page); $('#pageTitle').textContent = pageTitles[page] || pageTitles.settings; initializeDatePickers(subPage);
}

function renderSubPage(page) {
  if (page === 'transactions') return renderTransactionsPage();
  if (page === 'calendar') return renderCalendarPage();
  if (page === 'schedule') return renderSchedulePage();
  if (page === 'outflow') return renderOutflowReport();
  if (page === 'investments') return renderInvestmentsPage();
  if (page === 'insights') return renderInsightsPage();
  if (page === 'profile') return renderProfilePage();
  return renderSettingsPage();
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
function insightYearOptions(selectedYear) {
  const years = new Set([currentYear(), String(Number(currentYear()) - 1)]);
  data.transactions.forEach(transaction => { if (transaction.date) years.add(transaction.date.slice(0, 4)); });
  if (selectedYear) years.add(String(selectedYear));
  return [...years].sort((a, b) => Number(b) - Number(a)).map(year => `<option value="${year}" ${String(selectedYear) === year ? 'selected' : ''}>${year}</option>`).join('');
}
function openHabitModal(habit = null) {
  editingHabitId = habit?.id || null;
  const form = $('#habitForm');
  form.reset();
  $('#habitModalTitle').textContent = habit ? 'Edit habit' : 'Add habit';
  form.name.value = habit?.name || '';
  form.description.value = habit?.description || '';
  form.startDate.value = habit ? habitStartDate(habit) : today();
  form.goalType.value = habit?.goalType || 'checkbox';
  form.target.value = habit?.goalType === 'checkbox' ? '' : habit?.target || '';
  form.milestoneType.value = habit?.milestoneType || 'days';
  form.milestoneTarget.value = habit?.milestoneTarget || 30;
  form.growthTarget.value = habit?.growthTarget || '';
  form.growthTargetDate.value = habit?.growthTargetDate || '';
  form.growthStrategy.value = habit?.growthStrategy || 'manual';
  form.growthStep.value = habit?.growthStep || '';
  form.unit.value = habit?.unit || '';
  form.icon.value = habit?.icon || 'habit';
  form.color.value = habit?.color || 'purple-bg';
  form.active.checked = habit?.active !== false;
  $('#habitModalBackdrop').hidden = false;
  initializeDatePickers($('#habitModalBackdrop'));
}
function closeHabitModal() { editingHabitId = null; $('#habitModalBackdrop').hidden = true; $('#habitForm').reset(); $('#habitModalTitle').textContent = 'Add habit'; }
function renderHabitCheckinRows(date, focusHabitId = '') {
  const habits = activeHabits().filter(habit => habitIsStarted(habit, date)).filter(habit => !focusHabitId || habit.id === focusHabitId);
  return habits.map(habit => {
    const log = habitLog(habit.id, date);
    const checked = log?.completed || false;
    const sleep = isSleepHabit(habit);
    return `<div class="habit-checkin-row ${sleep ? 'sleep-row' : ''} ${focusHabitId && focusHabitId !== habit.id ? 'muted' : ''}">
      <label class="habit-checkin-toggle"><input type="checkbox" name="completed-${habit.id}" ${checked ? 'checked' : ''} /><span class="map-icon ${habit.color}">${svgIcon(habit.icon)}</span><b>${esc(habit.name)}</b></label>
      ${sleep ? `<div class="sleep-time-fields"><label>Sleep from<input name="sleepStart-${habit.id}" type="text" data-picker="time" value="${log?.sleepStart || ''}" placeholder="12:30 AM" /></label><label>Wake up<input name="sleepEnd-${habit.id}" type="text" data-picker="time" value="${log?.sleepEnd || ''}" placeholder="08:00 AM" /></label><small>${log?.sleepStart && log?.sleepEnd ? sleepLogText(log) : `Target ${habitTargetText(habit)}`}</small><input name="value-${habit.id}" type="hidden" value="${log?.value || ''}" /></div>` : habit.goalType !== 'checkbox' ? `<label>Value<input name="value-${habit.id}" type="number" step="0.1" min="0" value="${log?.value || ''}" placeholder="${habitTargetText(habit)}" /></label>` : `<input name="value-${habit.id}" type="hidden" value="${checked ? 1 : 0}" />`}
      <label>Note<textarea name="note-${habit.id}" rows="2" placeholder="Anything to remember for this day...">${esc(log?.note || '')}</textarea></label>
    </div>`;
  }).join('') || '<p class="empty-state">Add active habits before checking in.</p>';
}
function openHabitCheckinModal(date = today(), focusHabitId = '') {
  habitCheckinDate = date || today();
  habitCheckinFocusId = focusHabitId || '';
  const form = $('#habitCheckinForm');
  form.reset();
  form.date.value = habitCheckinDate;
  $('#habitCheckinList').innerHTML = renderHabitCheckinRows(habitCheckinDate, focusHabitId);
  $('#habitCheckinModalBackdrop').hidden = false;
  initializeDatePickers($('#habitCheckinModalBackdrop'));
}
function closeHabitCheckinModal() { habitCheckinFocusId = ''; $('#habitCheckinModalBackdrop').hidden = true; $('#habitCheckinForm').reset(); $('#habitCheckinList').innerHTML = ''; }
function openConfirmDeleteHabit(habit) {
  pendingHabitDeleteId = habit?.id || null;
  $('#confirmModalTitle').textContent = `Delete ${habit?.name || 'habit'}?`;
  $('#confirmModalCopy').textContent = 'This removes the habit and all of its check-in history. This action cannot be undone.';
  $('#confirmModalBackdrop').hidden = false;
}
function closeConfirmModal() { pendingHabitDeleteId = null; $('#confirmModalBackdrop').hidden = true; }
function updateCategoryModalSpendVisibility() {
  const form = $('#categoryForm');
  $('#categorySpendGroupRow').hidden = form.kind.value !== 'expense';
}
function openCategoryModal(category = null) {
  editingCategoryId = category?.id || null;
  const form = $('#categoryForm');
  form.reset();
  $('#categoryModalTitle').textContent = category ? 'Edit category' : 'Add category';
  form.name.value = category?.name || '';
  form.kind.value = category?.kind || 'expense';
  form.spendGroup.value = category?.spendGroup || defaultSpendGroup(category?.name || '');
  updateCategoryModalSpendVisibility();
  $('#categoryModalBackdrop').hidden = false;
}
function closeCategoryModal() {
  editingCategoryId = null;
  $('#categoryModalBackdrop').hidden = true;
  $('#categoryForm').reset();
  updateCategoryModalSpendVisibility();
}
async function submitCategory(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const kind = form.get('kind') || 'expense';
  const payload = { name:form.get('name'), kind, ...(kind === 'expense' ? { spendGroup:form.get('spendGroup') } : {}) };
  const wasEditing = !!editingCategoryId;
  const response = await fetch(editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories', { method:editingCategoryId ? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) { toast(result.error || 'Could not save category'); return; }
  closeCategoryModal();
  data = await (await fetch('/api/data')).json(); data.settings = normalizeSettings(data.settings);
  updateCategoryOptions();
  navigate('settings', false);
  toast(wasEditing ? 'Category updated' : 'Category added');
}
function openStockTradeModal(seed = {}) {
  stockTradeSeed = seed || {};
  const form = $('#stockTradeForm');
  form.reset();
  form.symbol.value = stockTradeSeed.symbol || '';
  form.companyName.value = stockTradeSeed.companyName || '';
  form.tradeType.value = stockTradeSeed.tradeType || 'buy';
  form.tradeDate.value = today();
  form.currentPrice.value = stockTradeSeed.currentPrice || '';
  $('#stockTradeModalTitle').textContent = stockTradeSeed.symbol ? `Add ${stockTradeSeed.symbol} trade` : 'Add stock trade';
  $('#stockTradeModalBackdrop').hidden = false;
  initializeDatePickers($('#stockTradeModalBackdrop'));
}
function closeStockTradeModal() {
  stockTradeSeed = null;
  $('#stockTradeModalBackdrop').hidden = true;
  $('#stockTradeForm').reset();
}
async function submitStockTrade(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  const response = await fetch('/api/stock-trades', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) { toast(result.error || 'Could not save stock trade'); return; }
  closeStockTradeModal();
  await loadData();
  investmentTab = 'stocks';
  navigate('investments', false);
  toast('Stock trade saved');
}
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
  const payload = { name:form.get('name'), description:form.get('description'), startDate:form.get('startDate') || today(), goalType, target:form.get('target'), unit:form.get('unit'), milestoneType:form.get('milestoneType') || 'days', milestoneTarget:form.get('milestoneTarget') || 30, growthTarget:form.get('growthTarget'), growthTargetDate:form.get('growthTargetDate'), growthStrategy:form.get('growthStrategy') || 'manual', growthStep:form.get('growthStep'), icon:form.get('icon'), color:form.get('color'), frequency:'Daily', active:event.target.active.checked };
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
  const habits = activeHabits().filter(habit => habitIsStarted(habit, date)).filter(habit => !habitCheckinFocusId || habit.id === habitCheckinFocusId);
  for (const habit of habits) {
    const completed = !!form.elements[`completed-${habit.id}`]?.checked;
    const sleep = isSleepHabit(habit);
    const sleepStart = form.elements[`sleepStart-${habit.id}`]?.value || '';
    const sleepEnd = form.elements[`sleepEnd-${habit.id}`]?.value || '';
    const value = sleep ? sleepHours(sleepStart, sleepEnd) : habit.goalType === 'checkbox' ? (completed ? 1 : 0) : form.elements[`value-${habit.id}`]?.value || 0;
    const note = form.elements[`note-${habit.id}`]?.value || '';
    const response = await fetch('/api/habit-logs', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ habitId:habit.id, date, value, completed:habit.goalType === 'checkbox' ? completed : completed || Number(value || 0) >= Number(habit.target || 1), note, ...(sleep ? { sleepStart, sleepEnd } : {}) }) });
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

$('#heroAddButton').addEventListener('click', () => openModal()); $('#fabButton').addEventListener('click', () => openModal()); $('#topAddButton').addEventListener('click', () => openModal()); $('#closeModal').addEventListener('click', closeModal); $('#cancelModal').addEventListener('click', closeModal); $('#modalBackdrop').addEventListener('click', event => { if (event.target.id === 'modalBackdrop') closeModal(); }); $('#transactionForm').addEventListener('submit', addTransaction); $('#closeHabitModal').addEventListener('click', closeHabitModal); $('#cancelHabitModal').addEventListener('click', closeHabitModal); $('#habitModalBackdrop').addEventListener('click', event => { if (event.target.id === 'habitModalBackdrop') closeHabitModal(); }); $('#habitForm').addEventListener('submit', submitHabit); $('#closeCategoryModal').addEventListener('click', closeCategoryModal); $('#cancelCategoryModal').addEventListener('click', closeCategoryModal); $('#categoryModalBackdrop').addEventListener('click', event => { if (event.target.id === 'categoryModalBackdrop') closeCategoryModal(); }); $('#categoryForm').addEventListener('submit', submitCategory); $('#categoryForm select[name="kind"]').addEventListener('change', updateCategoryModalSpendVisibility); $('#closeStockTradeModal').addEventListener('click', closeStockTradeModal); $('#cancelStockTradeModal').addEventListener('click', closeStockTradeModal); $('#stockTradeModalBackdrop').addEventListener('click', event => { if (event.target.id === 'stockTradeModalBackdrop') closeStockTradeModal(); }); $('#stockTradeForm').addEventListener('submit', submitStockTrade); $('#closeHabitCheckinModal').addEventListener('click', closeHabitCheckinModal); $('#cancelHabitCheckinModal').addEventListener('click', closeHabitCheckinModal); $('#habitCheckinModalBackdrop').addEventListener('click', event => { if (event.target.id === 'habitCheckinModalBackdrop') closeHabitCheckinModal(); }); $('#habitCheckinForm').addEventListener('submit', submitHabitCheckin); $('#closeConfirmModal').addEventListener('click', closeConfirmModal); $('#cancelConfirmModal').addEventListener('click', closeConfirmModal); $('#confirmModalBackdrop').addEventListener('click', event => { if (event.target.id === 'confirmModalBackdrop') closeConfirmModal(); }); $('#confirmDeleteButton').addEventListener('click', deleteHabit); $('#refreshButton').addEventListener('click', refreshData); $('#privacyButton').addEventListener('click', togglePrivacy);
$('#accountMenuButton').addEventListener('click', event => { event.stopPropagation(); $('#accountMenuPanel').hidden = !$('#accountMenuPanel').hidden; });
$('#accountMenuPanel').addEventListener('click', async event => { const target = event.target.closest('[data-account-page],[data-account-action]'); if (!target) return; $('#accountMenuPanel').hidden = true; if (target.dataset.accountPage) { navigate(target.dataset.accountPage); return; } if (target.dataset.accountAction === 'logout') await logout(); });
document.addEventListener('click', event => {
  if (!event.target.closest('.account-menu')) $('#accountMenuPanel').hidden = true;
  if (!event.target.closest('.multi-select-filter')) {
    transactionOpenMultiFilter = '';
    $$('.multi-select-filter[open]').forEach(dropdown => { dropdown.open = false; });
  }
});
$('#authForm').addEventListener('submit', submitAuth); $('#authToggle').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
$('#transactionForm input[name="recurring"]').addEventListener('change', () => updateDetailSections());
$('#transactionForm select[name="frequency"]').addEventListener('change', () => updateDetailSections());
$$('.type-tabs button').forEach(button => button.addEventListener('click', () => { setType(button.dataset.type); updateCategoryOptions(); })); $$('[data-workspace]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.workspace === 'habits' ? 'habits' : 'dashboard'))); $$('.nav-item,[data-page]').forEach(button => button.addEventListener('click', async event => { if (button.matches('a')) event.preventDefault(); navigate(button.dataset.page); if (button.dataset.page === 'dashboard') await refreshData(); })); $$('.segmented-control button').forEach(button => button.addEventListener('click', () => { dashboardView = button.dataset.view; $$('.segmented-control button').forEach(b => b.classList.remove('active')); button.classList.add('active'); renderDashboard(); toast(dashboardView === 'real' ? 'Showing real expenses only' : 'Showing all outflow'); }));
$$('[data-chart-range]').forEach(button => button.addEventListener('click', () => { chartRange = button.dataset.chartRange; $$('[data-chart-range]').forEach(b => b.classList.remove('active')); button.classList.add('active'); renderChart(dashboardView); }));
let transactionFilterTimer;
$('#subPageView').addEventListener('change', async event => {
  if (event.target.dataset.categorySpend) {
    const category = data.categories.find(item => item.id === event.target.dataset.categorySpend);
    if (!category) return;
    const response = await fetch(`/api/categories/${category.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ spendGroup:event.target.value }) });
    if (!response.ok) { toast('Could not update spend group'); return; }
    await loadData();
    navigate('settings', false);
    toast('Spend group updated');
    return;
  }
  if (event.target.id === 'calendarMonthInput') {
    calendarFilter.month = normalizeMonthValue(event.target.value, event.target._flatpickr?.selectedDates?.[0]) || currentMonthKey();
    calendarFilter.selectedDate = `${calendarFilter.month}-01`;
    $('#subPageView').innerHTML = renderCalendarPage();
    return;
  }
  const form = event.target.closest('#transactionFilters');
  if (!form || !event.target.closest('.transaction-table-tools')) return;
  if (event.target.matches('.multi-select-filter input[type="checkbox"]')) {
    const group = event.target.closest('.multi-select-filter');
    transactionOpenMultiFilter = event.target.name;
    const boxes = [...group.querySelectorAll('input[type="checkbox"]')];
    const allBox = boxes.find(box => box.value === 'all');
    if (event.target.value === 'all' && event.target.checked) boxes.forEach(box => { if (box !== event.target) box.checked = false; });
    if (event.target.value !== 'all' && event.target.checked && allBox) allBox.checked = false;
    if (!boxes.some(box => box.checked) && allBox) allBox.checked = true;
  }
  else {
    transactionOpenMultiFilter = '';
  }
  applyTransactionFiltersFromForm(form);
});
$('#subPageView').addEventListener('input', event => { const form = event.target.closest('#transactionFilters'); if (!form || event.target.name !== 'search') return; clearTimeout(transactionFilterTimer); transactionFilterTimer = setTimeout(() => applyTransactionFiltersFromForm(form), 250); });
$('#habitCheckinForm').addEventListener('change', event => { if (event.target.name !== 'date') return; habitCheckinDate = event.target.value || today(); $('#habitCheckinList').innerHTML = renderHabitCheckinRows(habitCheckinDate, habitCheckinFocusId); initializeDatePickers($('#habitCheckinList')); });
$('#subPageView').addEventListener('click', event => {
  const target = event.target.closest('[data-transaction-preset]');
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const form = $('#transactionFilters');
  transactionFilter = {
    ...transactionFilter,
    mode:'thisMonth',
    fromMonth:currentMonthKey(),
    toMonth:currentMonthKey(),
    fromYear:currentYear(),
    toYear:currentYear(),
    search:form?.search?.value || transactionFilter.search,
    type:form?.type?.value || transactionFilter.type,
    category:selectedTransactionFilterValues(form, 'category'),
    spendGroup:selectedTransactionFilterValues(form, 'spendGroup'),
    sort:form?.sort?.value || transactionFilter.sort
  };
  $('#subPageView').innerHTML = renderTransactionsPage();
}, true);
$('#subPageView').addEventListener('click', async event => { const target = event.target.closest('[data-action],[data-page],[data-range],[data-insight-preset],[data-transaction-preset],[data-investment-tab],[data-calendar-view],[data-calendar-type],[data-calendar-date],[data-calendar-nav]'); if (!target) return; if (target.dataset.calendarView) { calendarFilter.view = target.dataset.calendarView; calendarFilter.month = calendarFilter.month || currentMonthKey(); calendarFilter.selectedDate = calendarFilter.selectedDate || today(); $('#subPageView').innerHTML = renderCalendarPage(); return; } if (target.dataset.calendarType) { calendarFilter.type = target.dataset.calendarType; $('#subPageView').innerHTML = renderCalendarPage(); return; } if (target.dataset.calendarDate) { calendarFilter.selectedDate = target.dataset.calendarDate; calendarFilter.month = target.dataset.calendarDate.slice(0, 7); $('#subPageView').innerHTML = renderCalendarPage(); return; } if (target.dataset.calendarNav) { const current = new Date(`${calendarFilter.view === 'week' ? (calendarFilter.selectedDate || today()) : `${calendarFilter.month || currentMonthKey()}-01`}T00:00:00`); const direction = target.dataset.calendarNav === 'next' ? 1 : -1; const nextDate = calendarFilter.view === 'week' ? addDays(current, direction * 7) : addMonthsToDate(current, direction); calendarFilter.selectedDate = dateKey(nextDate); calendarFilter.month = monthInputKey(nextDate); $('#subPageView').innerHTML = renderCalendarPage(); return; } if (target.dataset.insightPreset === 'thisMonth') { insightFilter = { mode:'thisMonth' }; $('#subPageView').innerHTML = renderInsightsPage(); return; } if (target.dataset.investmentTab) { investmentTab = target.dataset.investmentTab; $('#subPageView').innerHTML = renderInvestmentsPage(); return; } if (target.dataset.transactionPreset === 'thisMonth') { const form = $('#transactionFilters'); transactionFilter = { ...transactionFilter, mode:'thisMonth', fromMonth:currentMonthKey(), toMonth:currentMonthKey(), fromYear:currentYear(), toYear:currentYear(), search:form?.search?.value || transactionFilter.search, type:form?.type?.value || transactionFilter.type, category:form?.category?.value || transactionFilter.category, sort:form?.sort?.value || transactionFilter.sort }; $('#subPageView').innerHTML = renderTransactionsPage(); return; } if (target.dataset.page) { navigate(target.dataset.page); if (target.dataset.page === 'dashboard') await refreshData(); return; } const action = target.dataset.action; if (!action) return; if (action === 'sleep-range') { habitSleepRange = target.dataset.range || 'daily'; $('#subPageView').innerHTML = renderHabitInsightsPage(); return; } if (action === 'open-habit-modal') { openHabitModal(); return; } if (action === 'open-habit-checkin') { openHabitCheckinModal(target.dataset.date || today(), target.dataset.id || ''); return; } if (action === 'edit-habit') { const habit = data.habits.find(item => item.id === target.dataset.id); if (habit) openHabitModal(habit); return; } if (action === 'toggle-habit-active') { const habit = data.habits.find(item => item.id === target.dataset.id); if (!habit) return; const response = await fetch(`/api/habits/${habit.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ active:habit.active === false }) }); if (!response.ok) { toast('Could not update habit'); return; } await loadData(); navigate('habitManage', false); toast(habit.active === false ? 'Habit activated' : 'Habit paused'); return; } if (action === 'confirm-delete-habit') { const habit = data.habits.find(item => item.id === target.dataset.id); if (habit) openConfirmDeleteHabit(habit); return; } if (action === 'delete-habit-log') { const response = await fetch(`/api/habit-logs/${target.dataset.id}/${target.dataset.date}`, { method:'DELETE' }); if (!response.ok) { toast('Could not delete check-in'); return; } await loadData(); navigate('habitCheckins', false); toast('Check-in deleted'); return; } if (action === 'toggle-habit') { const habit = data.habits.find(item => item.id === target.dataset.id); if (!habit) return; const done = habitCompleted(habit); await saveHabitLog(habit, done ? 0 : Number(habit.target || 1), !done); return; } if (action === 'log-habit') { const habit = data.habits.find(item => item.id === target.dataset.id); if (!habit) return; const current = habitLog(habit.id)?.value || ''; const value = window.prompt(`Enter ${habit.name} value (${habit.unit || 'value'})`, current); if (value === null) return; await saveHabitLog(habit, value); return; } if (action === 'open-stock-trade') { openStockTradeModal({ symbol:target.dataset.symbol || '', companyName:target.dataset.company || '', tradeType:target.dataset.tradeType || 'buy', currentPrice:target.dataset.currentPrice || '' }); return; } if (action === 'delete-stock-trade') { if (!window.confirm('Delete this stock trade?')) return; const response = await fetch(`/api/stock-trades/${target.dataset.id}`, { method:'DELETE' }); if (!response.ok) { toast('Could not delete stock trade'); return; } await loadData(); investmentTab='stocks'; navigate('investments', false); toast('Stock trade deleted'); return; } if (action === 'schedule-tab') { scheduleTab = target.dataset.tab || 'expense'; $('#subPageView').innerHTML = renderSubPage('schedule'); return; } if (action === 'logout') { await logout(); return; } if (action === 'refresh-profile') { await refreshData(); return; } if (action === 'open-add' || action === 'open-schedule') { openModal(activePage === 'investments' ? 'investment' : activePage === 'schedule' ? scheduleTab : 'expense'); if (activePage === 'investments' || action === 'open-schedule') { $('[name="recurring"]').checked = true; updateDetailSections(); } } if (action === 'export') exportData(); if (action === 'skip-schedule') toast('This schedule was skipped once'); if (action === 'edit') { const transaction = data.transactions.find(item => item.id === target.dataset.id); if (transaction) openModal(transaction.type, transaction); } if (action === 'delete') { const transaction = data.transactions.find(item => item.id === target.dataset.id); if (!transaction || !window.confirm(`Delete ${transaction.subcategory || transaction.category} for ${money(transaction.amount)}?`)) return; const response = await fetch(`/api/transactions/${transaction.id}`, { method:'DELETE' }); if (!response.ok) { toast('Could not delete transaction'); return; } data = await (await fetch('/api/data')).json(); navigate('transactions', false); toast('Transaction deleted'); } if (action === 'edit-schedule') { const response = await fetch(`/api/schedules/${target.dataset.id}`); if (!response.ok) { toast('Could not load the latest schedule'); return; } openScheduleModal(await response.json()); } if (action === 'open-category-modal') { openCategoryModal(); return; } if (action === 'edit-category') { const category = data.categories.find(item => item.id === target.dataset.id); if (category) openCategoryModal(category); return; } });
$('#subPageView').addEventListener('submit', async event => {
  if (!['budgetSettingsForm','profileForm'].includes(event.target.id)) return;
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
});
$('#subPageView').addEventListener('click', event => { const target = event.target.closest('[data-range]'); if (!target || target.dataset.action || activePage !== 'outflow') return; const range = target.dataset.range; const now = new Date(); const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; const dates = reportDates(); const from = range === 'this-month' ? `${month}-01` : dates.from; const to = range === 'this-month' ? `${month}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}` : dates.to; $('#subPageView').innerHTML = renderOutflowReport(from, to); });
$('#subPageView').addEventListener('submit', event => { if (!['outflowFilters','insightFilters','transactionFilters'].includes(event.target.id)) return; event.preventDefault(); const form = new FormData(event.target); if (event.target.id === 'transactionFilters') { applyTransactionFiltersFromForm(event.target, event.submitter?.dataset.transactionMode || transactionFilter.mode || 'thisMonth'); return; } if (event.target.id === 'insightFilters') { const mode = event.submitter?.dataset.insightMode || 'monthRange'; const fromMonth = form.get('fromMonth'); const toMonth = form.get('toMonth'); const fromYear = form.get('fromYear'); const toYear = form.get('toYear'); insightFilter = mode === 'yearRange' ? { mode, fromYear, toYear, fromMonth, toMonth } : { mode, fromMonth, toMonth, fromYear, toYear }; $('#subPageView').innerHTML = renderInsightsPage(); return; } $('#subPageView').innerHTML = renderOutflowReport(form.get('from'), form.get('to')); });
new MutationObserver(() => initializeDatePickers($('#subPageView'))).observe($('#subPageView'), { childList:true, subtree:true });
window.addEventListener('popstate', () => navigate(window.ExpensoRouter.pageFromLocation(), false));

async function bootstrap() {
  showBootGate();
  try {
    const auth = await checkAuth();
    if (!auth.authenticated) { showAuthGate(); return; }
    currentUser = auth.user;
    await loadData();
    updateCategoryOptions();
    renderDashboard();
    navigate(window.ExpensoRouter.pageFromLocation(), false);
    showAppShell();
    maybeOpenMobileStartupTransactionModal();
  }
  catch (error) {
    console.error(error);
    $('#syncLabel').textContent = 'Authentication unavailable';
    showAuthGate();
    $('#authError').textContent='Start the API and check the sync connection.';
  }
}

updateCategoryOptions(); updatePrivacyButton(); initializeDatePickers(document); bootstrap();
