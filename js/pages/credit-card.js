function creditCardTone(card = {}) {
  if (card.status === 'Paid') return 'green';
  if (card.status === 'Partial') return 'red';
  return 'purple';
}

function creditCardCycleText(card = {}) {
  if (card.cycle) return card.cycle;
  const month = card.currentCycleMonth || currentMonthKey();
  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short', year:'numeric' });
  return `${label} · cycle ${card.cycleStartDay || 1}${ordinal(card.cycleStartDay || 1)}–${card.cycleEndDay || 31}${ordinal(card.cycleEndDay || 31)}`;
}

function creditCardDueText(card = {}) {
  if (card.due) return card.due;
  return `${card.dueDay || 1}${ordinal(card.dueDay || 1)}`;
}

function creditCardFeeText(card = {}) {
  if (card.feeFrequency === 'free' || !Number(card.annualFee || 0)) return 'Lifetime free / no yearly charge';
  return `Yearly charge ${money(card.annualFee || 0)}${card.annualFeeDate ? ` · fee date ${card.annualFeeDate}` : ''}${card.waiverSpendLimit ? ` · waived after ${money(card.waiverSpendLimit)} spend` : ''}`;
}

function creditCardPrivileges(card = {}) {
  return Array.isArray(card.privileges) ? card.privileges : String(card.privileges || '').split(/\n|,/).map(item => item.trim()).filter(Boolean);
}

function creditCardBills(card = {}) {
  const bills = Array.isArray(card.bills) ? card.bills.slice() : [];
  const legacyMonth = card.currentCycleMonth || '';
  const legacyOutstanding = Number(card.outstanding || 0);
  const legacyPaid = Number(card.paid || 0);
  if (
    legacyMonth &&
    (legacyOutstanding > 0 || legacyPaid > 0) &&
    !bills.some(bill => bill.month === legacyMonth)
  ) {
    bills.push({
      month:legacyMonth,
      outstanding:legacyOutstanding,
      paid:legacyPaid,
      billDate:card.billDate || '',
      paymentDate:card.paymentDate || '',
      status:card.status || 'Upcoming',
      migrated:true
    });
  }
  return bills.sort((a, b) => String(b.month).localeCompare(String(a.month)));
}

function latestCreditCardBill(card = {}) {
  return creditCardBills(card)[0] || null;
}

function creditCardTrendRows(bills = []) {
  const months = [...new Set(bills.map(bill => bill.month).filter(Boolean))].sort().slice(-6);
  const maxValue = Math.max(...months.map(month => sumAmount(bills.filter(bill => bill.month === month).map(bill => ({ amount:bill.outstanding || 0 })))), 0);
  return months.map(month => {
    const total = sumAmount(bills.filter(bill => bill.month === month).map(bill => ({ amount:bill.outstanding || 0 })));
    const label = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short' });
    return { month, label, total, height:maxValue ? Math.max(18, Math.round((total / maxValue) * 108)) : 18 };
  });
}

function creditCardWaiverProgress(card = {}) {
  const target = Number(card.waiverSpendLimit || 0);
  if (!target) return null;
  const now = new Date();
  let start = new Date(now.getFullYear(), 0, 1);
  let end = new Date(now.getFullYear(), 11, 31);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(card.annualFeeDate || ''))) {
    const fee = new Date(`${card.annualFeeDate}T00:00:00`);
    start = new Date(now.getFullYear(), fee.getMonth(), fee.getDate());
    if (start > now) start.setFullYear(start.getFullYear() - 1);
    end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
  }
  const spend = sumAmount(creditCardBills(card).filter(bill => {
    const billDate = /^\d{4}-\d{2}-\d{2}$/.test(String(bill.billDate || '')) ? new Date(`${bill.billDate}T00:00:00`) : new Date(`${bill.month || currentMonthKey()}-01T00:00:00`);
    return billDate >= start && billDate <= end;
  }).map(bill => ({ amount:bill.outstanding || 0 })));
  const pct = Math.min(100, percent(spend, target));
  return { spend, target, pct, remaining:Math.max(0, target - spend), done:spend >= target, start:dateKey(start), end:dateKey(end) };
}

function creditCardRemaining(bill = {}) {
  return Math.max(0, Number(bill.outstanding || 0) - Number(bill.paid || 0));
}

function creditCardDisplayStatus(card = {}, bill = null) {
  if (card.active === false) return { label:'Inactive', tone:'inactive' };
  if (!bill) return { label:'No statement', tone:'purple' };
  const remaining = creditCardRemaining(bill);
  if (!remaining) return { label:'Paid', tone:'green' };
  if (Number(bill.paid || 0) > 0) return { label:'Part paid', tone:'red' };
  return { label:'Payment due', tone:'purple' };
}

function creditCardMonthLabel(month = '') {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short', year:'numeric' });
}

function renderCreditCardPage() {
  const cards = data.creditCards || [];
  const hasSavedCards = Boolean(cards.length);
  const activeCards = cards.filter(card => card.active !== false);
  const summaryCards = hasSavedCards ? activeCards : cards;
  const latestBills = summaryCards.map(card => ({ card, bill:latestCreditCardBill(card) })).filter(item => item.bill);
  const statementTotal = sumAmount(latestBills.map(item => ({ amount:item.bill.outstanding || 0 })));
  const paidThisCycle = sumAmount(latestBills.map(item => ({ amount:item.bill.paid || 0 })));
  const amountDue = latestBills.reduce((sum, item) => sum + creditCardRemaining(item.bill), 0);
  const largest = latestBills.slice().sort((a, b) => Number(b.bill.outstanding || 0) - Number(a.bill.outstanding || 0))[0];
  const largestPct = largest ? percent(largest.bill.outstanding, statementTotal) : 0;
  const attentionCount = latestBills.filter(item => creditCardRemaining(item.bill) > 0).length;
  const allBills = summaryCards.flatMap(card => creditCardBills(card).map(bill => ({ ...bill, cardName:card.name })));
  const lifetimeCardSpend = sumAmount(allBills.map(bill => ({ amount:bill.outstanding || 0 })));
  const lifetimeCardPaid = sumAmount(allBills.map(bill => ({ amount:bill.paid || 0 })));
  const topSpendCard = summaryCards.slice().sort((a, b) => sumAmount(creditCardBills(b).map(bill => ({ amount:bill.outstanding || 0 }))) - sumAmount(creditCardBills(a).map(bill => ({ amount:bill.outstanding || 0 }))))[0];
  const waiverCards = summaryCards.map(card => ({ card, progress:creditCardWaiverProgress(card) })).filter(item => item.progress);
  const completedWaivers = waiverCards.filter(item => item.progress.done).length;
  const trendRows = creditCardTrendRows(allBills);
  const dueCards = summaryCards.slice().sort((a, b) => Number(a.dueDay || String(creditCardDueText(a)).match(/\d+/)?.[0] || 99) - Number(b.dueDay || String(creditCardDueText(b)).match(/\d+/)?.[0] || 99));
  const cardBreakdown = latestBills.slice().sort((a, b) => Number(b.bill.outstanding || 0) - Number(a.bill.outstanding || 0)).slice(0, 3);

  return `<article class="credit-card-shell credit-card-dashboard">
    <section class="panel credit-card-hero credit-card-dashboard-hero">
      <div><p class="panel-kicker">CARD TRACKER</p><h3>Credit cards</h3><p class="subtitle">Statements, payment status, due dates and fee-waiver progress in one place.</p></div>
      <button class="primary-button" type="button" data-action="open-credit-card-modal">＋ Add card</button>
    </section>

    <section class="credit-card-kpi-grid" aria-label="Credit card summary">
      <article class="credit-card-kpi featured"><span class="credit-card-kpi-icon">${richIcon('credit-card')}</span><div><p>Current statements</p><strong>${money(statementTotal)}</strong><small>${latestBills.length} active statements tracked</small></div><div class="credit-card-kpi-breakdown">${cardBreakdown.map(({ card, bill }) => `<span>${esc((card.name || 'Card').split(' ')[0])}<b>${money(bill.outstanding || 0)}</b></span>`).join('') || '<span>No statements yet</span>'}</div></article>
      <article class="credit-card-kpi"><span class="credit-card-kpi-icon amber">${richIcon('credit-due')}</span><div><p>Amount due</p><strong>${money(amountDue)}</strong><small>${attentionCount ? `${attentionCount} card${attentionCount === 1 ? '' : 's'} need attention` : 'All current statements are clear'}</small></div></article>
      <article class="credit-card-kpi"><span class="credit-card-kpi-icon teal">${richIcon('credit-paid')}</span><div><p>Paid this cycle</p><strong>${money(paidThisCycle)}</strong><small>Payments recorded for current statements</small></div></article>
      <article class="credit-card-kpi"><span class="credit-card-kpi-icon blue">${richIcon('credit-spend')}</span><div><p>Recorded card spend</p><strong>${money(lifetimeCardSpend)}</strong><small>${allBills.length} monthly statements in history</small></div></article>
    </section>

    <section class="credit-card-dashboard-main">
      <section class="panel credit-card-accounts-panel" id="creditCardListPanel">
        <div class="panel-heading"><div><p class="panel-kicker">THIS CYCLE</p><h3>Cards overview</h3></div><button class="ghost-button" type="button" data-action="credit-card-view-all">View bill history</button></div>
        <div class="credit-card-account-grid">${cards.map(card => {
          const latest = latestCreditCardBill(card);
          const remaining = latest ? creditCardRemaining(latest) : 0;
          const state = creditCardDisplayStatus(card, latest);
          const waiver = creditCardWaiverProgress(card);
          const perks = creditCardPrivileges(card);
          const canToggle = hasSavedCards && card.id;
          return `<article class="credit-card-account ${state.tone} ${card.active === false ? 'inactive' : ''}">
            <header><span class="credit-card-account-icon">${richIcon('credit-card')}</span><div><b>${esc(card.name)}</b><small>${esc(card.issuer || 'Credit card')}</small></div><em>${esc(state.label)}</em></header>
            <p class="credit-card-cycle">${esc(creditCardCycleText(card))} · due ${esc(creditCardDueText(card))}</p>
            <div class="credit-card-account-values"><span><small>Statement</small><strong>${latest ? money(latest.outstanding || 0) : '—'}</strong></span><span><small>Paid</small><strong>${latest ? money(latest.paid || 0) : '—'}</strong></span><span><small>Remaining</small><strong class="${remaining ? 'due' : 'clear'}">${latest ? money(remaining) : '—'}</strong></span></div>
            ${waiver ? `<div class="credit-card-waiver"><div><b>${waiver.done ? 'Fee waiver reached' : `${money(waiver.remaining)} to fee waiver`}</b><small>${money(waiver.spend)} of ${money(waiver.target)} · ${waiver.pct}%</small></div><i><span style="width:${waiver.pct}%"></span></i></div>` : `<p class="credit-card-fee">${esc(creditCardFeeText(card))}</p>`}
            ${perks.length ? `<div class="credit-card-perks">${perks.slice(0, 3).map(item => `<span>${esc(item)}</span>`).join('')}</div>` : ''}
            ${card.benefitsSourceName ? `<a class="credit-card-source" href="${esc(card.benefitsSourceUrl || '#')}" target="_blank" rel="noopener">Benefits source: ${esc(card.benefitsSourceName)}</a>` : ''}
            ${canToggle ? `<footer><button class="mini-action neutral" type="button" data-action="edit-credit-card" data-id="${esc(card.id)}">Edit card</button><button class="mini-action neutral" type="button" data-action="update-credit-card-bill" data-id="${esc(card.id)}">Add bill</button><button class="mini-action ${card.active === false ? 'activate' : ''}" type="button" data-action="toggle-credit-card-active" data-id="${esc(card.id)}">${card.active === false ? 'Activate' : 'Deactivate'}</button></footer>` : ''}
          </article>`;
        }).join('') || `<div class="credit-card-dashboard-empty"><span>${richIcon('credit-card')}</span><b>No credit cards yet</b><p>Add your first card to track statements, due dates and fee waivers.</p><button class="primary-button" type="button" data-action="open-credit-card-modal">＋ Add card</button></div>`}</div>
      </section>

      <aside class="panel credit-card-due-panel" id="creditCardTimelinePanel">
        <div class="panel-heading"><div><p class="panel-kicker">PAYMENT TIMELINE</p><h3>Upcoming due dates</h3></div></div>
        ${dueCards.length ? `<div class="credit-card-due-list">${dueCards.map(card => {
          const latest = latestCreditCardBill(card);
          const remaining = latest ? creditCardRemaining(latest) : 0;
          const state = creditCardDisplayStatus(card, latest);
          const due = creditCardDueText(card);
          const dueDay = String(due).match(/\d+/)?.[0] || due;
          return `<div class="credit-card-due-item ${state.tone}"><span><b>${esc(dueDay)}</b><small>due</small></span><div><b>${esc(card.name)}</b><small>${esc(due)} · ${esc(state.label)}</small></div><strong class="${remaining ? 'due' : 'clear'}">${latest ? (remaining ? money(remaining) : 'Paid') : 'No bill'}</strong></div>`;
        }).join('')}</div><div class="credit-card-recommendation"><span>${richIcon(amountDue ? 'credit-due' : 'credit-paid')}</span><div><small>Recommended action</small><b>${amountDue ? (attentionCount === 1 ? `One card has ${money(amountDue)} left to clear.` : `${attentionCount} cards have ${money(amountDue)} left to clear.`) : 'All current statements are fully paid.'}</b></div></div>` : `<div class="credit-card-dashboard-empty compact"><span>${richIcon('credit-due')}</span><b>No upcoming due dates</b><p>Add an active credit card to build the payment timeline.</p></div>`}
      </aside>
    </section>

    <section class="panel credit-card-history-panel" id="creditCardHistoryPanel">
      <div class="panel-heading"><div><p class="panel-kicker">CARD HISTORY</p><h3>Monthly statements</h3></div><span class="tag">${allBills.length} records</span></div>
      <div class="credit-card-history-list">${summaryCards.map(card => {
        const bills = creditCardBills(card);
        const cardTotal = sumAmount(bills.map(bill => ({ amount:bill.outstanding || 0 })));
        return `<article class="credit-card-history-card"><header><span>${richIcon('credit-card')}</span><div><b>${esc(card.name)}</b><small>${bills.length} statements · ${money(cardTotal)} recorded spend</small></div><button class="mini-action neutral" type="button" data-action="update-credit-card-bill" data-id="${esc(card.id)}">Add bill</button></header><div class="credit-card-history-months">${bills.map(bill => { const remaining = creditCardRemaining(bill); return `<div><header><b>${esc(creditCardMonthLabel(bill.month || ''))}</b><em class="${remaining ? 'due' : 'clear'}">${remaining ? `${money(remaining)} due` : 'Paid'}</em></header><span><small>Statement</small><strong>${money(bill.outstanding || 0)}</strong></span><span><small>Paid</small><strong>${money(bill.paid || 0)}</strong></span><p>${esc(bill.billDate || 'No bill date')}${bill.paymentDate ? ` · paid ${esc(bill.paymentDate)}` : ''}</p><button class="mini-action neutral" type="button" data-action="edit-credit-card-bill" data-id="${esc(card.id)}" data-month="${esc(bill.month || '')}">Edit statement</button></div>`; }).join('') || '<p class="empty-state">No statement history yet.</p>'}</div></article>`;
      }).join('') || `<div class="credit-card-dashboard-empty compact"><span>${richIcon('credit-spend')}</span><b>No statement history yet</b><p>Add a card, then record its monthly statements.</p></div>`}</div>
    </section>

    <section class="credit-card-dashboard-bottom">
      <article class="panel credit-card-health-panel"><div class="panel-heading"><div><p class="panel-kicker">PAYMENT HEALTH</p><h3>Status check</h3></div><span class="credit-card-status-pill ${amountDue ? 'due' : 'clear'}">${amountDue ? 'Needs attention' : 'All clear'}</span></div><div class="credit-card-health-main"><span>${richIcon(amountDue ? 'credit-due' : 'credit-paid')}</span><div><b>${amountDue ? `${attentionCount} card${attentionCount === 1 ? '' : 's'} still have a balance` : 'All current statements are paid'}</b><small>${amountDue ? `${money(amountDue)} remains across active cards` : `${money(paidThisCycle)} recorded as paid this cycle`}</small></div></div><div class="credit-card-health-metrics"><span><small>Paid history</small><b>${money(lifetimeCardPaid)}</b></span><span><small>Amount due</small><b class="${amountDue ? 'due' : 'clear'}">${money(amountDue)}</b></span><span><small>Statement total</small><b>${money(statementTotal)}</b></span></div></article>

      <article class="panel credit-card-trend-panel"><div class="panel-heading"><div><p class="panel-kicker">SAVED STATEMENTS</p><h3>Monthly card spend</h3></div><span class="tag">Last 6 months</span></div>${trendRows.length ? `<div class="credit-card-trend-chart">${trendRows.map(row => `<div><strong>${money(row.total)}</strong><i><span style="height:${row.height}px"></span></i><b>${esc(row.label)}</b></div>`).join('')}</div>` : `<div class="credit-card-dashboard-empty compact"><span>${richIcon('credit-spend')}</span><b>No trend yet</b><p>Add monthly statements to build this chart.</p></div>`}</article>

      <article class="panel credit-card-signal-panel"><div class="panel-heading"><div><p class="panel-kicker">INSIGHTS</p><h3>Useful signals</h3></div></div><div class="credit-card-signal-list"><div><span>${richIcon('credit-insights')}</span><p><b>${esc(largest?.card?.name || 'Top card')}</b><small>${largestPct}% of the current statement total.</small></p></div><div><span>${richIcon('credit-spend')}</span><p><b>${esc(topSpendCard?.name || 'Top card')}</b><small>Highest recorded card spend history.</small></p></div><div><span>${richIcon('credit-paid')}</span><p><b>${completedWaivers}/${waiverCards.length || 0} waivers reached</b><small>Annual-fee waiver milestones completed.</small></p></div><div><span>${richIcon('credit-card')}</span><p><b>${cards.filter(card => card.active === false).length} inactive cards</b><small>Inactive cards are excluded from totals.</small></p></div></div></article>
    </section>
  </article>`;
}
