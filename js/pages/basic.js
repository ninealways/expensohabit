function renderSettingsPage() {
  const categoryRows = ['expense','loan','investment'].map(kind => {
    const categories = data.categories.filter(c => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="category-group"><div class="category-group-heading"><b>${kind === 'expense' ? 'Expense categories' : kind === 'loan' ? 'Loan categories' : 'Investment categories'}</b><span>${categories.length}</span></div><div class="category-chip-grid">${categories.map(category => { const group = kind === 'expense' ? spendGroups[category.spendGroup || defaultSpendGroup(category.name)] : null; return `<div class="category-chip ${category.active === false ? 'inactive' : ''}"><span>${esc(category.name)}</span>${group ? `<small class="category-group-badge" style="--badge-color:${group.color}">${group.label}</small>` : ''}<button class="mini-button" data-action="edit-category" data-id="${category.id}">Edit</button></div>`; }).join('') || '<p class="empty-state">No categories yet.</p>'}</div></div>`;
  }).join('');
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">SECURE SYNC</p><h3>Settings &amp; data</h3></div></div><div class="setting-row"><div><b>Storage</b><small>Your transactions, schedules, categories, and budget targets are saved to your account.</small></div><span class="tag">Synced</span></div>${renderBudgetSettings()}<div class="setting-row"><div><b>Backup</b><small>Export a JSON backup anytime and restore it later.</small></div><button class="mini-button" data-action="export">Export data</button></div><div class="category-editor"><div class="category-group-heading"><b>Manage categories</b><span>Add, rename, and classify expense categories</span></div><button class="primary-button category-add-button" data-action="open-category-modal" type="button">＋ Add category</button><p class="budget-help">Spend groups apply only to expense categories. Loans and investments stay excluded from this priority analysis.</p>${categoryRows}</div><div class="setting-row"><div><b>Sync status</b><small>Latest data is loaded from your account when the app opens.</small></div><span class="tag">Synced</span></div></article>`;
}

function renderBudgetSettings() {
  const settings = normalizeSettings(data.settings);
  const overrides = Object.entries(settings.monthlyBudgetOverrides || {}).sort((a, b) => b[0].localeCompare(a[0]));
  const currentOverride = settings.monthlyBudgetOverrides?.[currentMonthKey()] || '';
  return `<div class="budget-editor"><div class="category-group-heading"><b>Monthly expense target</b><span>Used for Insights spend velocity</span></div><form id="budgetSettingsForm" class="budget-form"><label>Default monthly expense target<input name="monthlyExpenseBudget" type="number" min="0" step="1" value="${settings.monthlyExpenseBudget}" required /></label><label>Override month<input name="overrideMonth" type="text" data-picker="month" value="${currentMonthKey()}" /></label><label>Override amount<input name="overrideAmount" type="number" min="0" step="1" value="${currentOverride}" placeholder="Optional" /></label><button class="primary-button" type="submit">Save target</button></form><p class="budget-help">Insights compares real expenses against this target. Month overrides replace the default only for that month.</p>${overrides.length ? `<div class="budget-chip-grid">${overrides.map(([month, value]) => `<span class="budget-chip">${month}<b>${money(value)}</b></span>`).join('')}</div>` : '<p class="empty-state">No monthly overrides yet.</p>'}</div>`;
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
  const cards = rows.map(({ schedule, projection }) => `<div class="investment-report-card"><div class="schedule-card-heading"><span class="upcoming-icon teal-bg">${svgIcon('pie')}</span><span class="tag">${schedule.autoAdd ? 'Auto-add' : 'Manual'}</span></div><h4>${schedule.subcategory}</h4><p>${money(schedule.amount)} contribution · ${scheduleWhen(schedule)}</p><div class="investment-card-grid"><span>Invested<b>${money(projection.invested)}</b></span><span>Gross value<b>${money(projection.currentValue)}</b></span><span>Withdrawn<b>${money(projection.withdrawn)}</b></span><span>Net value<b>${money(projection.netValue)}</b></span></div><div class="investment-gain ${projection.gain >= 0 ? 'positive' : 'negative'}">${projection.gain >= 0 ? 'Gain' : 'Loss'} ${money(Math.abs(projection.gain))}</div>${projection.projected ? `<small class="investment-note">Projected ${money(projection.futureValue)} by ${projection.projectionEndDate} at ${schedule.expectedAnnualRate}% expected return, including ${projection.contributionCount} future contributions.</small>` : '<small class="investment-note">No projection end date or return set. Current gain/loss is shown only.</small>'}<div class="schedule-actions"><button class="mini-button" data-action="edit-schedule" data-id="${schedule.id}">Update value</button></div></div>`).join('');
  const holdings = stockHoldings();
  const stockTotals = holdings.reduce((acc, row) => { acc.invested += row.openCost; acc.value += row.marketValue; acc.realized += row.realizedGain; acc.unrealized += row.unrealizedGain; return acc; }, { invested:0, value:0, realized:0, unrealized:0 });
  const tabs = `<div class="schedule-tabs investment-tabs"><button class="schedule-tab ${investmentTab === 'portfolio' ? 'active' : ''}" data-investment-tab="portfolio">Portfolio</button><button class="schedule-tab ${investmentTab === 'stocks' ? 'active' : ''}" data-investment-tab="stocks">Stock trades <span>${holdings.length}</span></button></div>`;
  const portfolioView = `<div class="investment-report-summary"><div><p>Amount invested</p><strong>${money(totals.invested)}</strong></div><div><p>Gross current value</p><strong>${money(totals.gross)}</strong></div><div><p>Withdrawn</p><strong>${money(totals.withdrawn)}</strong></div><div class="net"><p>Net current value</p><strong>${money(totals.net)}</strong></div><div class="${gain >= 0 ? 'positive' : 'negative'}"><p>Net gain/loss</p><strong>${gain >= 0 ? '+' : '-'}${money(Math.abs(gain))}</strong></div></div>${investments.length ? `<div class="investment-report-grid">${cards}</div><div class="outflow-group"><div class="outflow-group-heading"><b>Investment breakdown</b><span>${investments.length} active items</span></div><table class="outflow-table"><thead><tr><th>Name</th><th>Invested</th><th>Gross value</th><th>Withdrawn</th><th>Net value</th><th>Gain/Loss</th></tr></thead><tbody>${rows.map(({ schedule, projection }) => `<tr><td>${schedule.subcategory}</td><td>${money(projection.invested)}</td><td>${money(projection.currentValue)}</td><td>${money(projection.withdrawn)}</td><td>${money(projection.netValue)}</td><td class="${projection.gain >= 0 ? 'positive' : 'negative'}">${projection.gain >= 0 ? '+' : '-'}${money(Math.abs(projection.gain))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state">Add an investment schedule to track current value, withdrawals, and gain/loss.</p>'}`;
  const stockView = `<div class="investment-report-summary stock-summary"><div><p>Open cost</p><strong>${money(stockTotals.invested)}</strong></div><div><p>Market value</p><strong>${money(stockTotals.value)}</strong></div><div class="${stockTotals.unrealized >= 0 ? 'positive' : 'negative'}"><p>Unrealized P/L</p><strong>${stockTotals.unrealized >= 0 ? '+' : '-'}${money(Math.abs(stockTotals.unrealized))}</strong></div><div class="${stockTotals.realized >= 0 ? 'positive' : 'negative'}"><p>Realized P/L</p><strong>${stockTotals.realized >= 0 ? '+' : '-'}${money(Math.abs(stockTotals.realized))}</strong></div><div><p>Positions</p><strong>${holdings.length}</strong></div></div>${holdings.length ? `<div class="outflow-group"><div class="outflow-group-heading"><b>Stock positions</b><span>Combined by symbol</span></div><table class="outflow-table stock-table"><thead><tr><th>Symbol</th><th>Qty left</th><th>Avg cost</th><th>Current</th><th>Market value</th><th>Realized</th><th></th></tr></thead><tbody>${holdings.map(row => `<tr class="${row.quantityLeft ? '' : 'closed-stock'}"><td><b>${esc(row.symbol)}</b><br><small>${esc(row.companyName || '—')} · ${row.quantityLeft ? 'Open' : 'Closed'}</small></td><td>${row.quantityLeft}</td><td>${money(row.averageCost)}</td><td>${row.currentPrice ? money(row.currentPrice) : '—'}</td><td>${money(row.marketValue)}</td><td class="${row.realizedGain >= 0 ? 'positive' : 'negative'}">${row.realizedGain >= 0 ? '+' : '-'}${money(Math.abs(row.realizedGain))}</td><td><div class="row-actions"><button class="table-actions" data-action="open-stock-trade" data-symbol="${esc(row.symbol)}" data-company="${esc(row.companyName || '')}" data-current-price="${row.currentPrice || ''}" data-trade-type="buy">Buy</button><button class="table-actions" data-action="open-stock-trade" data-symbol="${esc(row.symbol)}" data-company="${esc(row.companyName || '')}" data-current-price="${row.currentPrice || ''}" data-trade-type="sell">Sell</button></div></td></tr>`).join('')}</tbody></table></div><div class="outflow-group"><div class="outflow-group-heading"><b>Trade history</b><span>${(data.stockTrades || []).length} trades</span></div><table class="outflow-table stock-table"><thead><tr><th>Date</th><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th><th>Fees</th><th></th></tr></thead><tbody>${(data.stockTrades || []).slice().sort((a,b) => b.tradeDate.localeCompare(a.tradeDate)).map(trade => `<tr><td>${trade.tradeDate}</td><td>${esc(trade.symbol)}</td><td><span class="type-badge ${trade.tradeType === 'buy' ? 'investment' : 'loan'}">${trade.tradeType}</span></td><td>${trade.quantity}</td><td>${money(trade.price)}</td><td>${money(trade.fees || 0)}</td><td><button class="table-actions delete-action" data-action="delete-stock-trade" data-id="${trade.id}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-state">Add a stock trade to start tracking combined holdings.</p>'}`;
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">PORTFOLIO VIEW</p><h3>Investment position</h3></div><div class="panel-actions"><button class="primary-button" data-action="${investmentTab === 'stocks' ? 'open-stock-trade' : 'open-add'}">${investmentTab === 'stocks' ? '＋ Add stock trade' : '＋ Add investment'}</button></div></div>${tabs}${investmentTab === 'stocks' ? stockView : portfolioView}</article>`;
}

function stockHoldings() {
  const holdings = {};
  (data.stockTrades || []).slice().sort((a, b) => a.tradeDate.localeCompare(b.tradeDate)).forEach(trade => {
    const symbol = String(trade.symbol || '').toUpperCase();
    if (!symbol) return;
    const row = holdings[symbol] || { symbol, companyName:trade.companyName || '', quantityLeft:0, openCost:0, buyQty:0, sellQty:0, realizedGain:0, currentPrice:0, trades:0 };
    row.companyName = row.companyName || trade.companyName || '';
    row.trades += 1;
    const qty = Number(trade.quantity || 0);
    const price = Number(trade.price || 0);
    const fees = Number(trade.fees || 0);
    if (Number(trade.currentPrice || 0)) row.currentPrice = Number(trade.currentPrice);
    if (trade.tradeType === 'sell') {
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
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">ACCOUNT</p><h3>Your profile</h3></div><button class="mini-button warn" data-action="logout">Logout</button></div><div class="profile-card"><div class="profile-avatar">${svgIcon('user')}</div><div><h4>${displayName()}</h4><p>${user.email || 'Signed-in user'} · Member since ${joined}</p></div></div><form id="profileForm" class="profile-form"><label>Display name<input name="name" value="${displayName()}" required /></label><button class="primary-button" type="submit">Save name</button></form><div class="profile-grid"><div class="outflow-metric"><p>Transactions</p><strong>${data.transactions.length}</strong></div><div class="outflow-metric"><p>Schedules</p><strong>${data.schedules.length}</strong></div><div class="outflow-metric"><p>Categories</p><strong>${data.categories.length}</strong></div><div class="outflow-metric total"><p>Storage</p><strong>Synced</strong></div></div><div class="setting-row"><div><b>Data sync</b><small>Refresh pulls the latest transactions, schedules, and categories from your account.</small></div><button class="mini-button" data-action="refresh-profile">Refresh</button></div><div class="setting-row"><div><b>Categories</b><small>Add or rename expense, loan, and investment categories.</small></div><button class="mini-button" data-page="settings">Settings</button></div><div class="setting-row"><div><b>Backup</b><small>Download a JSON backup of the data currently loaded in the app.</small></div><button class="mini-button" data-action="export">Export</button></div></article>`;
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
