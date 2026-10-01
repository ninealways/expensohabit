function renderSettingsPage() {
  const settings = normalizeSettings(data.settings);
  const categoryRows = ['expense','loan','investment'].map(kind => {
    const categories = data.categories.filter(c => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
    const title = kind === 'expense' ? 'Expense categories' : kind === 'loan' ? 'Loan categories' : 'Investment categories';
    const icon = kind === 'expense' ? 'real-expenses' : kind === 'loan' ? 'loans' : 'investments';
    const description = kind === 'expense' ? 'Used to organize daily spending' : kind === 'loan' ? 'Tracked separately from real expenses' : 'Tracked as wealth-building outflow';
    return `<section class="account-category-group"><div class="account-category-heading"><span class="account-category-icon">${richIcon(icon)}</span><div><b>${title}</b><small>${description}</small></div><em>${categories.length}</em></div><div class="category-chip-grid">${categories.map(category => { const group = kind === 'expense' ? spendGroups[category.spendGroup || defaultSpendGroup(category.name)] : null; return `<div class="category-chip ${category.active === false ? 'inactive' : ''}"><span>${esc(category.name)}</span>${group ? `<small class="category-group-badge" style="--badge-color:${group.color}">${group.label}</small>` : ''}<button class="mini-button" data-action="edit-category" data-id="${category.id}" type="button">Edit</button></div>`; }).join('') || '<p class="empty-state">No categories yet.</p>'}</div></section>`;
  }).join('');
  return `<section class="account-page settings-page">
    <article class="panel account-page-hero">
      <div class="account-hero-copy"><span class="account-hero-icon">${richIcon('settings')}</span><div><p class="panel-kicker">PREFERENCES &amp; DATA</p><h3>Settings &amp; data</h3><p class="subtitle">Manage budgets, backups, sync status and the categories that organize your money.</p></div></div>
      <span class="account-sync-badge"><i></i>Everything synced</span>
    </article>

    <section class="account-status-grid" aria-label="Settings summary">
      <article class="account-status-card"><span class="purple">${richIcon('refresh')}</span><div><p>Storage</p><strong>Synced</strong><small>Account data is up to date</small></div></article>
      <article class="account-status-card"><span class="amber">${richIcon('insight-pace')}</span><div><p>Monthly target</p><strong>${money(settings.monthlyExpenseBudget)}</strong><small>Default expense budget</small></div></article>
      <article class="account-status-card"><span class="teal">${richIcon('insight-category')}</span><div><p>Categories</p><strong>${data.categories.length}</strong><small>Across expenses, loans and investments</small></div></article>
    </section>

    <section class="account-settings-grid">
      ${renderBudgetSettings()}
      <article class="panel account-data-panel">
        <div class="account-card-heading"><div><p class="panel-kicker">ACCOUNT DATA</p><h3>Sync &amp; backup</h3></div></div>
        <div class="account-data-list">
          <div><span class="account-action-icon teal">${richIcon('refresh')}</span><p><b>Live sync</b><small>Your latest transactions, schedules and categories load when the app opens.</small></p><span class="tag">Synced</span></div>
          <div><span class="account-action-icon amber">${richIcon('privacy')}</span><p><b>Portable backup</b><small>Download a JSON copy of the data currently loaded in the app.</small></p><button class="mini-button" data-action="export" type="button">Export data</button></div>
        </div>
      </article>
    </section>

    <article class="panel account-category-panel">
      <div class="account-card-heading account-category-panel-heading"><div class="account-heading-copy"><span class="account-heading-icon">${richIcon('insight-category')}</span><div><p class="panel-kicker">ORGANIZATION</p><h3>Manage categories</h3><p class="subtitle">Add, rename and classify the labels used throughout your money views.</p></div></div><button class="primary-button" data-action="open-category-modal" type="button">＋ Add category</button></div>
      <p class="account-category-note">Spend groups apply only to expense categories. Loans and investments remain separate from spending-priority analysis.</p>
      <div class="account-category-list">${categoryRows}</div>
    </article>
  </section>`;
}

function renderBudgetSettings() {
  const settings = normalizeSettings(data.settings);
  const overrides = Object.entries(settings.monthlyBudgetOverrides || {}).sort((a, b) => b[0].localeCompare(a[0]));
  const currentOverride = settings.monthlyBudgetOverrides?.[currentMonthKey()] || '';
  return `<article class="panel budget-editor account-budget-panel"><div class="account-card-heading"><div class="account-heading-copy"><span class="account-heading-icon amber">${richIcon('insight-pace')}</span><div><p class="panel-kicker">SPENDING PLAN</p><h3>Monthly expense target</h3><p class="subtitle">Set the baseline used by Insights to measure your spending pace.</p></div></div></div><form id="budgetSettingsForm" class="budget-form"><label>Default monthly expense target<input name="monthlyExpenseBudget" type="number" min="0" step="1" value="${settings.monthlyExpenseBudget}" required /></label><label>Override month<input name="overrideMonth" type="text" data-picker="month" value="${currentMonthKey()}" /></label><label>Override amount<input name="overrideAmount" type="number" min="0" step="1" value="${currentOverride}" placeholder="Optional" /></label><button class="primary-button" type="submit">Save target</button></form><p class="budget-help">A month override replaces the default target only for that month.</p>${overrides.length ? `<div class="budget-chip-grid">${overrides.map(([month, value]) => `<span class="budget-chip">${month}<b>${money(value)}</b></span>`).join('')}</div>` : '<p class="empty-state">No monthly overrides yet.</p>'}</article>`;
}

function renderOutflowReport(from = reportDates().from, to = reportDates().to) {
  const filtered = data.transactions.filter(t => t.date >= from && t.date <= to).sort((a,b) => b.date.localeCompare(a.date));
  const groups = { expense:filtered.filter(t => t.type === 'expense'), loan:filtered.filter(t => t.type === 'loan'), investment:filtered.filter(t => t.type === 'investment') };
  const sums = { expense:groups.expense.reduce((s,t)=>s+t.amount,0), loan:groups.loan.reduce((s,t)=>s+t.amount,0), investment:groups.investment.reduce((s,t)=>s+t.amount,0) };
  const total = sums.expense + sums.loan + sums.investment;
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">DATE-RANGE REPORT</p><h3>Total outflow</h3></div><div class="panel-actions"><button class="ghost-button" data-page="investments">View investments</button><button class="ghost-button" data-page="dashboard">Back home</button></div></div><form id="outflowFilters" class="outflow-filters"><label>From<input name="from" type="text" data-picker="date" value="${from}" placeholder="From date" /></label><label>To<input name="to" type="text" data-picker="date" value="${to}" placeholder="To date" /></label><div class="range-actions"><button type="button" data-range="this-month">This month</button><button type="button" data-range="all-time">All time</button></div></form><div class="outflow-summary"><div class="outflow-metric total"><p>Total outflow</p><strong>${money(total)}</strong></div><div class="outflow-metric"><p>Expenses</p><strong>${money(sums.expense)}</strong></div><div class="outflow-metric loan"><p>Loans paid</p><strong>${money(sums.loan)}</strong></div><div class="outflow-metric investment"><p>Investments made</p><strong>${money(sums.investment)}</strong></div></div>${['expense','loan','investment'].map(type => `<div class="outflow-group"><div class="outflow-group-heading"><b>${type === 'expense' ? 'All expenses' : type === 'loan' ? 'Loans paid' : 'Investments made'}</b><span>${groups[type].length} entries · ${money(sums[type])}</span></div>${groups[type].length ? `<table class="outflow-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>${groups[type].map(t=>`<tr><td>${t.date}</td><td>${t.subcategory || t.category}</td><td>${t.category}</td><td>${money(t.amount)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">No entries in this range.</p>'}</div>`).join('')}</article>`;
}

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
  const summaryRows = [
    { label:'Amount invested', value:totals.invested, icon:'investment-contributions', featured:true },
    { label:'Gross current value', value:totals.gross, icon:'investment-value' },
    { label:'Withdrawn', value:totals.withdrawn, icon:'investment-withdrawn' },
    { label:'Net current value', value:totals.net, icon:'investments' },
    { label:'Net gain/loss', value:gain, icon:'investment-growth', gain:true }
  ];
  const renderInvestmentSummary = (items, extraClass = '') => `<section class="investment-report-summary finance-kpi-grid ${extraClass}">${items.map((item, index) => `<article class="finance-kpi investment-summary-card ${item.featured ? 'featured' : ''} ${item.gain ? (item.value >= 0 ? 'positive-card' : 'negative-card') : ''}"><span class="finance-kpi-icon">${richIcon(item.icon || ['investment-contributions','investment-value','investment-growth','investment-withdrawn','investments'][index % 5])}</span><div><p>${item.label}</p><strong>${item.gain ? `${item.value >= 0 ? '+' : '-'}${money(Math.abs(item.value))}` : money(item.value)}</strong><small>${item.note || (item.gain ? 'Current portfolio return' : 'Across tracked investments')}</small></div></article>`).join('')}</section>`;
  const cards = rows.map(({ schedule, projection }) => `<article class="investment-report-card investment-position-card"><div class="schedule-card-heading"><span class="investment-position-icon">${richIcon('investments')}</span><span class="tag">${schedule.autoAdd ? 'Auto-add' : 'Manual'}</span></div><h4>${esc(schedule.subcategory)}</h4><p>${money(schedule.amount)} contribution · ${scheduleWhen(schedule)}</p><div class="investment-card-grid"><span>Invested<b>${money(projection.invested)}</b></span><span>Gross value<b>${money(projection.currentValue)}</b></span><span>Withdrawn<b>${money(projection.withdrawn)}</b></span><span>Net value<b>${money(projection.netValue)}</b></span></div><div class="investment-card-footer"><div class="investment-gain ${projection.gain >= 0 ? 'positive' : 'negative'}">${projection.gain >= 0 ? 'Gain' : 'Loss'} ${money(Math.abs(projection.gain))}</div><button class="mini-button" data-action="edit-schedule" data-id="${esc(schedule.id)}">Update value</button></div>${projection.projected ? `<small class="investment-note"><b>${money(projection.futureValue)}</b> projected by ${esc(projection.projectionEndDate)} at ${schedule.expectedAnnualRate}% expected return · ${projection.contributionCount} future contributions.</small>` : '<small class="investment-note">No projection end date or return set. Current gain/loss is shown only.</small>'}</article>`).join('');
  const holdings = stockHoldings();
  const stockTotals = holdings.reduce((acc, row) => { acc.invested += row.openCost; acc.value += row.marketValue; acc.realized += row.realizedGain; acc.unrealized += row.unrealizedGain; return acc; }, { invested:0, value:0, realized:0, unrealized:0 });
  const tabs = `<div class="schedule-tabs investment-tabs"><button class="schedule-tab ${investmentTab === 'portfolio' ? 'active' : ''}" data-investment-tab="portfolio"><span class="schedule-tab-icon">${richIcon('investments')}</span>Portfolio</button><button class="schedule-tab ${investmentTab === 'stocks' ? 'active' : ''}" data-investment-tab="stocks"><span class="schedule-tab-icon">${richIcon('investment-growth')}</span>Stock trades <small>${holdings.length}</small></button></div>`;
  const portfolioView = `${renderInvestmentSummary(summaryRows)}${investments.length ? `<section class="panel investment-positions-panel"><div class="panel-heading"><div><p class="panel-kicker">ACTIVE INVESTMENTS</p><h3>Portfolio positions</h3><p class="subtitle">Contributions, current values and forward projections.</p></div></div><div class="investment-report-grid">${cards}</div></section><section class="panel investment-breakdown-panel"><div class="outflow-group"><div class="outflow-group-heading"><b>Investment breakdown</b><span>${investments.length} active items</span></div><table class="outflow-table"><thead><tr><th>Name</th><th>Invested</th><th>Gross value</th><th>Withdrawn</th><th>Net value</th><th>Gain/Loss</th></tr></thead><tbody>${rows.map(({ schedule, projection }) => `<tr><td>${esc(schedule.subcategory)}</td><td>${money(projection.invested)}</td><td>${money(projection.currentValue)}</td><td>${money(projection.withdrawn)}</td><td>${money(projection.netValue)}</td><td class="${projection.gain >= 0 ? 'positive' : 'negative'}">${projection.gain >= 0 ? '+' : '-'}${money(Math.abs(projection.gain))}</td></tr>`).join('')}</tbody></table></div></section>` : '<div class="finance-empty"><span>' + richIcon('investments') + '</span><b>No investments yet</b><p>Add an investment schedule to track value, withdrawals and gain/loss.</p></div>'}`;
  const stockSummaryRows = [
    { label:'Open cost', value:stockTotals.invested, icon:'investment-contributions', featured:true },
    { label:'Market value', value:stockTotals.value, icon:'investment-value' },
    { label:'Unrealized P/L', value:stockTotals.unrealized, icon:'investment-growth', gain:true },
    { label:'Realized P/L', value:stockTotals.realized, icon:'investment-growth', gain:true },
    { label:'Positions', value:holdings.length, icon:'investments', note:'Tracked stock symbols', count:true }
  ];
  const stockSummary = `<section class="investment-report-summary finance-kpi-grid stock-summary">${stockSummaryRows.map(item => `<article class="finance-kpi investment-summary-card ${item.featured ? 'featured' : ''} ${item.gain ? (item.value >= 0 ? 'positive-card' : 'negative-card') : ''}"><span class="finance-kpi-icon">${richIcon(item.icon)}</span><div><p>${item.label}</p><strong>${item.count ? item.value : item.gain ? `${item.value >= 0 ? '+' : '-'}${money(Math.abs(item.value))}` : money(item.value)}</strong><small>${item.note || 'Across tracked positions'}</small></div></article>`).join('')}</section>`;
  const stockRows = holdings.map(row => `<tr class="${row.quantityLeft ? '' : 'closed-stock'}"><td><b>${esc(row.symbol)}</b><br><small>${esc(row.companyName || '—')} · ${row.quantityLeft ? 'Open' : 'Closed'}</small></td><td>${row.quantityLeft}</td><td>${money(row.averageCost)}</td><td>${row.currentPrice ? money(row.currentPrice) : '—'}</td><td>${money(row.marketValue)}</td><td class="${row.realizedGain >= 0 ? 'positive' : 'negative'}">${row.realizedGain >= 0 ? '+' : '-'}${money(Math.abs(row.realizedGain))}</td><td><div class="row-actions"><button class="table-actions" data-action="open-stock-trade" data-symbol="${esc(row.symbol)}" data-company="${esc(row.companyName || '')}" data-current-price="${row.currentPrice || ''}" data-trade-type="price">Edit value</button><button class="table-actions" data-action="open-stock-trade" data-symbol="${esc(row.symbol)}" data-company="${esc(row.companyName || '')}" data-current-price="${row.currentPrice || ''}" data-trade-type="buy">Buy</button><button class="table-actions" data-action="open-stock-trade" data-symbol="${esc(row.symbol)}" data-company="${esc(row.companyName || '')}" data-current-price="${row.currentPrice || ''}" data-trade-type="sell">Sell</button></div></td></tr>`).join('');
  const tradeRows = (data.stockTrades || []).slice().sort((a,b) => b.tradeDate.localeCompare(a.tradeDate)).map(trade => `<tr><td>${trade.tradeDate}</td><td>${esc(trade.symbol)}</td><td><span class="type-badge ${trade.tradeType === 'sell' ? 'loan' : 'investment'}">${trade.tradeType === 'price' ? 'value update' : trade.tradeType}</span></td><td>${trade.tradeType === 'price' ? '—' : trade.quantity}</td><td>${trade.tradeType === 'price' ? money(trade.currentPrice || 0) : money(trade.price)}</td><td>${trade.tradeType === 'price' ? '—' : money(trade.fees || 0)}</td><td><button class="table-actions delete-action" data-action="delete-stock-trade" data-id="${trade.id}">Delete</button></td></tr>`).join('');
  const stockView = `${stockSummary}${holdings.length ? `<section class="panel investment-breakdown-panel"><div class="outflow-group"><div class="outflow-group-heading"><b>Stock positions</b><span>Combined by symbol</span></div><table class="outflow-table stock-table"><thead><tr><th>Symbol</th><th>Qty left</th><th>Avg cost</th><th>Current</th><th>Market value</th><th>Realized</th><th></th></tr></thead><tbody>${stockRows}</tbody></table></div><div class="outflow-group"><div class="outflow-group-heading"><b>Trade history</b><span>${(data.stockTrades || []).length} entries</span></div><table class="outflow-table stock-table"><thead><tr><th>Date</th><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th><th>Fees</th><th></th></tr></thead><tbody>${tradeRows}</tbody></table></div></section>` : '<div class="finance-empty"><span>' + richIcon('investment-growth') + '</span><b>No stock trades yet</b><p>Add a stock trade to start tracking combined holdings.</p></div>'}`;
  return `<article class="investments-page finance-page"><section class="panel finance-page-hero investments-page-hero"><div><p class="panel-kicker">WEALTH TRACKER</p><h3>Investment position</h3><p class="subtitle">Follow contributions, current value, withdrawals and portfolio growth in one place.</p></div><div class="panel-actions"><button class="primary-button" data-action="${investmentTab === 'stocks' ? 'open-stock-trade' : 'open-add'}">${investmentTab === 'stocks' ? '＋ Add stock trade' : '＋ Add investment'}</button></div></section>${tabs}${investmentTab === 'stocks' ? stockView : portfolioView}</article>`;
}

function stockHoldings() {
  const holdings = {};
  (data.stockTrades || []).slice().sort((a, b) => {
    const dateCompare = String(a.tradeDate || '').localeCompare(String(b.tradeDate || ''));
    return dateCompare || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  }).forEach(trade => {
    const symbol = String(trade.symbol || '').toUpperCase();
    if (!symbol) return;
    const row = holdings[symbol] || { symbol, companyName:trade.companyName || '', quantityLeft:0, openCost:0, buyQty:0, sellQty:0, realizedGain:0, currentPrice:0, trades:0 };
    row.companyName = row.companyName || trade.companyName || '';
    row.trades += 1;
    const qty = Number(trade.quantity || 0);
    const price = Number(trade.price || 0);
    const fees = Number(trade.fees || 0);
    if (Number(trade.currentPrice || 0)) row.currentPrice = Number(trade.currentPrice);
    if (trade.tradeType === 'price') {
      row.trades -= 1;
    } else if (trade.tradeType === 'sell') {
      const avg = row.quantityLeft ? row.openCost / row.quantityLeft : 0;
      const soldQty = Math.min(qty, row.quantityLeft);
      const costRemoved = avg * soldQty;
      row.quantityLeft = Math.max(0, row.quantityLeft - soldQty);
      row.openCost = Math.max(0, row.openCost - costRemoved);
      row.sellQty += soldQty;
      row.realizedGain += (soldQty * price) - fees - costRemoved;
    } else {
      row.quantityLeft += qty;
      row.openCost += (qty * price) + fees;
      row.buyQty += qty;
    }
    holdings[symbol] = row;
  });
  return Object.values(holdings).map(row => ({ ...row, averageCost:row.quantityLeft ? row.openCost / row.quantityLeft : 0, marketValue:row.quantityLeft * (row.currentPrice || 0), unrealizedGain:row.quantityLeft && row.currentPrice ? row.quantityLeft * row.currentPrice - row.openCost : 0 })).sort((a,b) => Number(b.quantityLeft > 0) - Number(a.quantityLeft > 0) || a.symbol.localeCompare(b.symbol));
}

function renderProfilePage() {
  const user = currentUser || {};
  const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'Current session';
  return `<section class="account-page profile-page">
    <article class="panel account-page-hero">
      <div class="account-hero-copy"><span class="account-hero-icon">${richIcon('profile')}</span><div><p class="panel-kicker">YOUR ACCOUNT</p><h3>Profile</h3><p class="subtitle">Manage your identity and keep your ExpensoHabit data within reach.</p></div></div>
      <button class="account-danger-button" data-action="logout" type="button">${richIcon('logout')}<span>Log out</span></button>
    </article>

    <section class="account-profile-grid">
      <article class="panel account-identity-card">
        <div class="account-identity-main"><span class="account-avatar">${richIcon('profile')}</span><div><p class="panel-kicker">SIGNED IN AS</p><h4>${esc(displayName())}</h4><p>${esc(user.email || 'Signed-in user')}</p><small>Member since ${esc(joined)}</small></div></div>
        <form id="profileForm" class="profile-form account-profile-form"><label><span>Display name</span><input name="name" value="${esc(displayName())}" required /></label><button class="primary-button" type="submit">Save name</button></form>
      </article>

      <article class="panel account-overview-panel">
        <div class="account-card-heading"><div><p class="panel-kicker">AT A GLANCE</p><h3>Your workspace</h3></div><span class="account-sync-badge compact"><i></i>Synced</span></div>
        <div class="account-metric-grid">
          <div><span class="purple">${richIcon('transactions')}</span><p>Transactions<strong>${data.transactions.length}</strong></p></div>
          <div><span class="amber">${richIcon('schedule')}</span><p>Schedules<strong>${data.schedules.length}</strong></p></div>
          <div><span class="teal">${richIcon('insight-category')}</span><p>Categories<strong>${data.categories.length}</strong></p></div>
          <div><span class="blue">${richIcon('refresh')}</span><p>Storage<strong>Synced</strong></p></div>
        </div>
      </article>
    </section>

    <article class="panel account-actions-panel">
      <div class="account-card-heading"><div><p class="panel-kicker">ACCOUNT TOOLS</p><h3>Data &amp; preferences</h3><p class="subtitle">Quick access to the controls that keep your workspace organized.</p></div></div>
      <div class="account-action-grid">
        <div class="account-action-card"><span class="account-action-icon purple">${richIcon('refresh')}</span><p><b>Refresh account data</b><small>Pull the latest transactions, schedules and categories.</small></p><button class="mini-button" data-action="refresh-profile" type="button">Refresh</button></div>
        <div class="account-action-card"><span class="account-action-icon teal">${richIcon('settings')}</span><p><b>Categories &amp; budgets</b><small>Manage categories and monthly expense targets.</small></p><button class="mini-button" data-page="settings" type="button">Open settings</button></div>
        <div class="account-action-card"><span class="account-action-icon amber">${richIcon('privacy')}</span><p><b>Export a backup</b><small>Download a portable JSON copy of your loaded data.</small></p><button class="mini-button" data-action="export" type="button">Export</button></div>
      </div>
    </article>
  </section>`;
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expensohabit-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exported');
}
