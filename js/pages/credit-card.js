function creditCardTone(card = {}) {
  if (card.status === 'Paid') return 'green';
  if (card.status === 'Partial') return 'red';
  return 'purple';
}

function creditCardCycleText(card = {}, bill = null) {
  if (!bill && card.cycle) return card.cycle;
  const month = bill?.month || card.currentCycleMonth || currentMonthKey();
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

function creditCardExactMoney(value = 0) {
  if (privacyMode) return hiddenMoney();
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits:Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits:2
  })}`;
}

function creditCardDateLabel(value = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function creditCardShortName(name = '') {
  const value = String(name);
  if (/hdfc/i.test(value)) return 'HDFC';
  if (/kotak/i.test(value)) return 'Kotak';
  if (/\bau\b/i.test(value)) return 'AU KOSMO';
  if (/one\s*card/i.test(value)) return 'One Card';
  if (/amazon/i.test(value)) return 'Amazon';
  return value.split(/\s+/).slice(0, 2).join(' ');
}

function creditCardChartColor(index = 0) {
  return ['#7651ef','#ff6f91','#18bba6','#ffad43','#5a86f7','#9b61e9','#31a7d8'][index % 7];
}

function creditCardSpendChartData(cards = [], limit = 6) {
  const months = [...new Set(cards.flatMap(card => creditCardBills(card).map(bill => bill.month)).filter(Boolean))].sort().slice(-limit);
  const series = cards.map((card, index) => ({
    id:card.id || card.name || `card-${index}`,
    name:card.name || 'Credit card',
    color:creditCardChartColor(index),
    values:Object.fromEntries(months.map(month => {
      const bill = creditCardBills(card).find(item => item.month === month);
      return [month, bill ? Number(bill.outstanding || 0) : null];
    }))
  }));
  const rows = months.map(month => {
    const values = series.map(item => item.values[month]);
    return {
      month,
      label:new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month:'short', year:'2-digit' }),
      values,
      total:values.reduce((sum, value) => sum + (value === null ? 0 : value), 0)
    };
  });
  return { months, series, rows, maxTotal:Math.max(...rows.map(row => row.total), 0) };
}

function renderCreditCardSpendChart(cards = []) {
  const chart = creditCardSpendChartData(cards);
  if (!chart.rows.length || !chart.maxTotal) return '';
  const width = 860;
  const height = 286;
  const pad = { top:42, right:22, bottom:45, left:67 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const baseline = height - pad.bottom;
  const step = plotWidth / chart.rows.length;
  const barWidth = Math.min(82, step * .5);
  const y = value => baseline - ((Number(value || 0) / chart.maxTotal) * plotHeight);
  const ticks = [0,.25,.5,.75,1].map(ratio => {
    const value = chart.maxTotal * ratio;
    const tickY = baseline - (plotHeight * ratio);
    return `<g class="credit-card-chart-grid"><line x1="${pad.left}" y1="${tickY.toFixed(1)}" x2="${width - pad.right}" y2="${tickY.toFixed(1)}"></line><text x="${pad.left - 10}" y="${(tickY + 4).toFixed(1)}" text-anchor="end">${ratio ? compactMoney(value) : '₹0'}</text></g>`;
  }).join('');
  const bars = chart.rows.map((row, rowIndex) => {
    const x = pad.left + (rowIndex * step) + ((step - barWidth) / 2);
    let cursor = baseline;
    const segments = row.values.map((value, seriesIndex) => {
      if (value === null || value <= 0) return '';
      const segmentHeight = (value / chart.maxTotal) * plotHeight;
      cursor -= segmentHeight;
      const series = chart.series[seriesIndex];
      return `<rect x="${x.toFixed(1)}" y="${cursor.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${segmentHeight.toFixed(1)}" rx="3" fill="${series.color}"><title>${esc(series.name)} · ${esc(row.label)}: ${creditCardExactMoney(value)}</title></rect>`;
    }).join('');
    const center = x + (barWidth / 2);
    return `<g>${segments}<text class="credit-card-chart-total" x="${center.toFixed(1)}" y="${Math.max(16, y(row.total) - 11).toFixed(1)}" text-anchor="middle">${compactMoney(row.total)}</text><text class="credit-card-chart-month" x="${center.toFixed(1)}" y="${height - 15}" text-anchor="middle">${esc(row.label)}</text></g>`;
  }).join('');
  const totalPoints = chart.rows.map((row, index) => {
    const center = pad.left + (index * step) + (step / 2);
    return `${center.toFixed(1)},${y(row.total).toFixed(1)}`;
  }).join(' ');
  const totalDots = chart.rows.map((row, index) => {
    const center = pad.left + (index * step) + (step / 2);
    return `<circle cx="${center.toFixed(1)}" cy="${y(row.total).toFixed(1)}" r="4"><title>${esc(row.label)} total: ${creditCardExactMoney(row.total)}</title></circle>`;
  }).join('');
  return `<div class="credit-card-spend-chart-wrap"><svg class="credit-card-spend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly recorded credit card spend stacked by card with an overall total line">${ticks}${bars}<polyline class="credit-card-total-line" points="${totalPoints}"></polyline><g class="credit-card-total-dots">${totalDots}</g></svg></div><div class="credit-card-spend-legend">${chart.series.map(item => `<span><i style="--series-color:${item.color}"></i>${esc(item.name)}</span>`).join('')}<span class="total"><i></i>Overall monthly total</span></div>`;
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
  const historyMonths = [...new Set(allBills.map(bill => bill.month).filter(Boolean))].sort().reverse();
  const spendChart = renderCreditCardSpendChart(summaryCards);
  const dueCards = summaryCards.map(card => ({ card, bill:latestCreditCardBill(card) }))
    .filter(item => item.bill && creditCardRemaining(item.bill) > 0)
    .sort((a, b) => Number(a.card.dueDay || String(creditCardDueText(a.card)).match(/\d+/)?.[0] || 99) - Number(b.card.dueDay || String(creditCardDueText(b.card)).match(/\d+/)?.[0] || 99));
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
          const latestProductChange = Array.isArray(card.productChanges) ? card.productChanges.slice().sort((a, b) => String(b.effectiveDate || b.changedAt || '').localeCompare(String(a.effectiveDate || a.changedAt || '')))[0] : null;
          return `<article class="credit-card-account compact ${state.tone} ${card.active === false ? 'inactive' : ''}">
            <div class="credit-card-account-identity"><header><span class="credit-card-account-icon">${richIcon('credit-card')}</span><div><b>${esc(card.name)}</b><small>${esc(card.issuer || 'Credit card')}</small></div><em>${esc(state.label)}</em></header><p class="credit-card-cycle">${esc(creditCardCycleText(card, latest))} · due ${esc(creditCardDueText(card))}</p>${latestProductChange ? `<p class="credit-card-product-change ${latestProductChange.type === 'downgrade' ? 'downgrade' : ''}"><span>${latestProductChange.type === 'downgrade' ? '↓ Downgraded' : '↑ Upgraded'}</span> from ${esc(latestProductChange.fromName || 'previous card')}${latestProductChange.effectiveDate ? ` · ${esc(creditCardDateLabel(latestProductChange.effectiveDate))}` : ''}</p>` : ''}</div>
            <div class="credit-card-account-values ${latest && !remaining ? 'settled' : ''}"><span><small>Latest statement</small><strong>${latest ? money(latest.outstanding || 0) : '—'}</strong></span>${latest && !remaining ? `<span><small>Payment status</small><strong class="clear">Paid in full</strong></span>` : `<span><small>Paid</small><strong>${latest ? money(latest.paid || 0) : '—'}</strong></span><span><small>Remaining</small><strong class="${remaining ? 'due' : 'clear'}">${latest ? money(remaining) : '—'}</strong></span>`}</div>
            ${canToggle ? `<footer><button class="mini-action neutral" type="button" data-action="edit-credit-card" data-id="${esc(card.id)}">Edit</button><button class="mini-action neutral" type="button" data-action="change-credit-card-product" data-id="${esc(card.id)}">Change tier</button><button class="mini-action neutral" type="button" data-action="update-credit-card-bill" data-id="${esc(card.id)}">Add bill</button><button class="mini-action ${card.active === false ? 'activate' : ''}" type="button" data-action="toggle-credit-card-active" data-id="${esc(card.id)}">${card.active === false ? 'Activate' : 'Deactivate'}</button></footer>` : ''}
            <details class="credit-card-extra"><summary>Card details <span>${waiver ? `${waiver.pct}% toward fee waiver` : esc(creditCardFeeText(card))}${perks.length ? ` · ${perks.length} benefit${perks.length === 1 ? '' : 's'}` : ''}</span></summary><div>${waiver ? `<div class="credit-card-waiver"><div><b>${waiver.done ? 'Fee waiver reached' : `${money(waiver.remaining)} to fee waiver`}</b><small>${money(waiver.spend)} of ${money(waiver.target)} · ${waiver.pct}%</small></div><i><span style="width:${waiver.pct}%"></span></i></div>` : `<p class="credit-card-fee">${esc(creditCardFeeText(card))}</p>`}${perks.length ? `<div class="credit-card-perks">${perks.slice(0, 4).map(item => `<span>${esc(item)}</span>`).join('')}</div>` : ''}${card.benefitsSourceName ? `<a class="credit-card-source" href="${esc(card.benefitsSourceUrl || '#')}" target="_blank" rel="noopener">Benefits source: ${esc(card.benefitsSourceName)}</a>` : ''}</div></details>
          </article>`;
        }).join('') || `<div class="credit-card-dashboard-empty"><span>${richIcon('credit-card')}</span><b>No credit cards yet</b><p>Add your first card to track statements, due dates and fee waivers.</p><button class="primary-button" type="button" data-action="open-credit-card-modal">＋ Add card</button></div>`}</div>
      </section>

      <div class="credit-card-side-stack">
      <aside class="panel credit-card-due-panel" id="creditCardTimelinePanel">
        <div class="panel-heading"><div><p class="panel-kicker">PAYMENT TIMELINE</p><h3>Upcoming due dates</h3></div></div>
        ${dueCards.length ? `<div class="credit-card-due-list">${dueCards.map(({ card, bill:latest }) => {
          const remaining = creditCardRemaining(latest);
          const state = creditCardDisplayStatus(card, latest);
          const due = creditCardDueText(card);
          const dueDay = String(due).match(/\d+/)?.[0] || due;
          return `<div class="credit-card-due-item ${state.tone}"><span><b>${esc(dueDay)}</b><small>due</small></span><div><b>${esc(card.name)}</b><small>${esc(creditCardMonthLabel(latest.month))} · ${esc(state.label)}</small></div><strong class="due">${money(remaining)}</strong></div>`;
        }).join('')}</div><div class="credit-card-recommendation"><span>${richIcon('credit-due')}</span><div><small>Recommended action</small><b>${attentionCount === 1 ? `One card has ${money(amountDue)} left to clear.` : `${attentionCount} cards have ${money(amountDue)} left to clear.`}</b></div></div>` : `<div class="credit-card-all-clear"><span>${richIcon('credit-paid')}</span><div><b>Nothing due right now</b><p>All latest recorded statements are fully paid.</p></div></div>`}
      </aside>

      <article class="panel credit-card-health-panel"><div class="panel-heading"><div><p class="panel-kicker">PAYMENT HEALTH</p><h3>Status check</h3></div><span class="credit-card-status-pill ${amountDue ? 'due' : 'clear'}">${amountDue ? 'Needs attention' : 'All clear'}</span></div><div class="credit-card-health-main"><span>${richIcon(amountDue ? 'credit-due' : 'credit-paid')}</span><div><b>${amountDue ? `${attentionCount} card${attentionCount === 1 ? '' : 's'} still have a balance` : 'All current statements are paid'}</b><small>${amountDue ? `${money(amountDue)} remains across active cards` : `${money(paidThisCycle)} recorded as paid this cycle`}</small></div></div><div class="credit-card-health-metrics"><span><small>Paid history</small><b>${money(lifetimeCardPaid)}</b></span><span><small>Amount due</small><b class="${amountDue ? 'due' : 'clear'}">${money(amountDue)}</b></span><span><small>Statement total</small><b>${money(statementTotal)}</b></span></div></article>

      <article class="panel credit-card-signal-panel"><div class="panel-heading"><div><p class="panel-kicker">INSIGHTS</p><h3>Useful signals</h3></div></div><div class="credit-card-signal-list"><div><span>${richIcon('credit-insights')}</span><p><b>${esc(largest?.card?.name || 'Top card')}</b><small>${largestPct}% of the current statement total.</small></p></div><div><span>${richIcon('credit-spend')}</span><p><b>${esc(topSpendCard?.name || 'Top card')}</b><small>Highest recorded card spend history.</small></p></div><div><span>${richIcon('credit-paid')}</span><p><b>${completedWaivers}/${waiverCards.length || 0} waivers reached</b><small>Annual-fee waiver milestones completed.</small></p></div><div><span>${richIcon('credit-card')}</span><p><b>${cards.filter(card => card.active === false).length} inactive cards</b><small>Inactive cards are excluded from totals.</small></p></div></div></article>
      </div>
    </section>

    <section class="credit-card-history-suite" id="creditCardHistoryPanel">
      <section class="panel credit-card-spend-panel">
        <div class="panel-heading"><div><p class="panel-kicker">SPEND TREND</p><h3>Monthly card spend</h3><p class="credit-card-chart-subtitle">Stacked by card from saved statements; the line shows the combined monthly total.</p></div><span class="tag">Last 6 recorded months</span></div>
        ${spendChart || `<div class="credit-card-dashboard-empty compact"><span>${richIcon('credit-spend')}</span><b>No trend yet</b><p>Add monthly statements to build this chart.</p></div>`}
      </section>

      <section class="panel credit-card-history-panel">
        <div class="panel-heading"><div><p class="panel-kicker">CARD HISTORY</p><h3>Monthly statements</h3><p class="credit-card-chart-subtitle">Compare every saved statement by month. Missing cells mean no statement is recorded.</p></div><span class="tag">${allBills.length} records</span></div>
        ${historyMonths.length ? `<div class="credit-card-history-table-wrap"><table class="credit-card-history-table"><thead><tr><th scope="col">Month</th>${summaryCards.map((card, cardIndex) => {
          const bills = creditCardBills(card);
          return `<th scope="col"><div class="credit-card-history-card-head" style="--card-accent:${creditCardChartColor(cardIndex)}"><i></i><div><b title="${esc(card.name)}">${esc(creditCardShortName(card.name))}</b><small>${bills.length} saved</small></div><button class="mini-action neutral" type="button" data-action="update-credit-card-bill" data-id="${esc(card.id)}" aria-label="Add ${esc(card.name)} bill">＋</button></div></th>`;
        }).join('')}<th scope="col" class="total">Overall</th></tr></thead><tbody>${historyMonths.map(month => {
          const monthBills = summaryCards.map(card => creditCardBills(card).find(bill => bill.month === month) || null);
          const monthTotal = monthBills.reduce((sum, bill) => sum + Number(bill?.outstanding || 0), 0);
          return `<tr><th scope="row"><b>${esc(creditCardMonthLabel(month))}</b><small>${monthBills.filter(Boolean).length} of ${summaryCards.length} cards recorded</small></th>${summaryCards.map((card, index) => {
            const bill = monthBills[index];
            if (!bill) return '<td><span class="credit-card-history-empty">No statement</span></td>';
            const remaining = creditCardRemaining(bill);
            const paymentLabel = creditCardDateLabel(bill.paymentDate);
            return `<td><div class="credit-card-history-entry"><header><strong>${creditCardExactMoney(bill.outstanding || 0)}</strong><em class="${remaining ? 'due' : 'clear'}">${remaining ? `${creditCardExactMoney(remaining)} due` : 'Paid'}</em></header><small>Paid ${creditCardExactMoney(bill.paid || 0)}</small><footer><span>${paymentLabel ? `Paid ${esc(paymentLabel)}` : 'No payment date'}</span><button class="mini-action neutral" type="button" data-action="edit-credit-card-bill" data-id="${esc(card.id)}" data-month="${esc(bill.month || '')}">Edit</button></footer></div></td>`;
          }).join('')}<td class="total"><strong>${creditCardExactMoney(monthTotal)}</strong><small>Recorded total</small></td></tr>`;
        }).join('')}</tbody></table></div>` : `<div class="credit-card-dashboard-empty compact"><span>${richIcon('credit-spend')}</span><b>No statement history yet</b><p>Add a card, then record its monthly statements.</p></div>`}
      </section>
    </section>

  </article>`;
}
