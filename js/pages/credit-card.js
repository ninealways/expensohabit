const creditCardPreview = [
  { name:'HDFC Regalia', cycle:'6 Jul – 5 Aug', due:'20 Aug', outstanding:38420, paid:20000, status:'Partial', tone:'red' },
  { name:'ICICI Amazon Pay', cycle:'1 Jul – 31 Jul', due:'15 Aug', outstanding:24880, paid:24880, status:'Paid', tone:'green' },
  { name:'Axis Magnus', cycle:'12 Jul – 11 Aug', due:'27 Aug', outstanding:49180, paid:0, status:'Upcoming', tone:'purple' }
];

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

function renderCreditCardPage() {
  const hasSavedCards = Boolean(data.creditCards?.length);
  const cards = hasSavedCards ? data.creditCards : creditCardPreview;
  const activeCards = cards.filter(card => card.active !== false);
  const summaryCards = hasSavedCards ? activeCards : cards;
  const timelineCards = summaryCards.length ? summaryCards : cards;
  const totalOutstanding = sumAmount(summaryCards.map(card => ({ amount:card.outstanding || 0 })));
  const paidThisCycle = sumAmount(summaryCards.map(card => ({ amount:card.paid || 0 })));
  const dueSoon = summaryCards.filter(card => card.status !== 'Paid').reduce((sum, card) => sum + Math.max(0, Number(card.outstanding || 0) - Number(card.paid || 0)), 0);
  const largest = summaryCards.slice().sort((a, b) => Number(b.outstanding || 0) - Number(a.outstanding || 0))[0];
  const largestPct = largest ? percent(largest.outstanding, totalOutstanding) : 0;
  const paidCount = summaryCards.filter(card => card.status === 'Paid').length;
  const attentionCount = summaryCards.length - paidCount;
  return `<article class="credit-card-shell">
    <section class="panel credit-card-hero">
      <div><p class="panel-kicker">SEPARATE TRACKER</p><h3>Credit cards</h3><p class="subtitle">Outstanding, billing cycles, due dates and payments. This does not impact expenses.</p></div>
      <button class="primary-button" type="button" data-action="open-credit-card-modal">＋ Add card</button>
    </section>
    <section class="credit-summary-grid">
      <article class="summary-card total-card credit-total-card"><div class="card-icon">💳</div><p>Total outstanding</p><strong>${money(totalOutstanding)}</strong><div class="summary-breakdown">${summaryCards.map(card => `<span>● ${esc((card.name || 'Card').split(' ')[0])} <b>${money(card.outstanding || 0)}</b></span>`).join('') || '<span>No active cards</span>'}</div></article>
      <article class="summary-card"><div class="card-icon amber-bg">!</div><p>Due soon</p><strong>${money(dueSoon)}</strong><small>Unpaid balance this cycle</small></article>
      <article class="summary-card"><div class="card-icon teal-bg">✓</div><p>Paid this cycle</p><strong>${money(paidThisCycle)}</strong><small>Recorded payments</small></article>
      <article class="summary-card"><div class="card-icon purple-bg">%</div><p>Payment health</p><strong>${paidCount}/${summaryCards.length || 0}</strong><small>${attentionCount} active cards need attention</small></article>
    </section>
    <section class="credit-main-grid">
      <div class="panel" id="creditCardListPanel"><div class="panel-heading"><div><p class="panel-kicker">THIS CYCLE</p><h3>Cards overview</h3></div><button class="ghost-button" type="button" data-action="credit-card-view-all">View all</button></div><div class="credit-card-list">${cards.map(card => { const tone = card.active === false ? 'inactive' : card.tone || creditCardTone(card); const canToggle = hasSavedCards && card.id; return `<div class="credit-card-row ${card.active === false ? 'inactive' : ''}"><span class="credit-card-icon ${tone}">💳</span><div><b>${esc(card.name)}</b><small>${esc(card.issuer || 'Card')} · Cycle ${esc(creditCardCycleText(card))} · due ${esc(creditCardDueText(card))}</small></div><div><small>Outstanding</small><strong>${money(card.outstanding || 0)}</strong></div><div><small>Paid</small><strong>${money(card.paid || 0)}</strong></div><em class="${tone}">${card.active === false ? 'Inactive' : esc(card.status || 'Upcoming')}</em>${canToggle ? `<button class="mini-action ${card.active === false ? 'activate' : ''}" type="button" data-action="toggle-credit-card-active" data-id="${esc(card.id)}">${card.active === false ? 'Activate' : 'Deactivate'}</button>` : ''}</div>`; }).join('')}</div></div>
      <div class="panel credit-timeline-panel" id="creditCardTimelinePanel"><div class="panel-heading"><div><p class="panel-kicker">PAYMENT TIMELINE</p><h3>Upcoming due dates</h3></div><button class="ghost-button" type="button" data-action="credit-card-manage">Manage</button></div><div class="credit-due-timeline">${timelineCards.map((card, index) => { const due = creditCardDueText(card); const tone = card.tone || creditCardTone(card); return `<div class="credit-due-node ${tone}" style="--x:${18 + index * 34}%"><span>${esc(String(due).split(' ')[0])}</span><b>${esc(due)}</b><small>${esc((card.name || 'Card').split(' ')[0])}</small><strong>${money(Math.max(0, Number(card.outstanding || 0) - Number(card.paid || 0)))}</strong></div>`; }).join('')}</div><div class="credit-action-note"><small>Recommended action</small><b>${esc(summaryCards.find(card => card.status !== 'Paid')?.name || 'All active cards')} ${dueSoon ? 'has unpaid balance to clear before due date.' : 'is fully paid for this cycle.'}</b></div></div>
    </section>
    <section class="credit-bottom-grid">
      <div class="panel"><div class="panel-heading"><div><p class="panel-kicker">PAYMENT HEALTH</p><h3>Status check</h3></div></div><div class="home-pace-status ${dueSoon ? 'over' : 'under'}"><span>${dueSoon ? '!' : '✓'}</span><div><b>${dueSoon ? `${attentionCount} active cards need attention` : 'All active cards paid'}</b><small>${dueSoon ? `${money(dueSoon)} pending this cycle` : 'No pending card payments'}</small></div></div><div class="home-pace-metrics"><span><small>Paid</small><b class="under">${money(paidThisCycle)}</b></span><span><small>Left</small><b class="${dueSoon ? 'over' : 'under'}">${money(dueSoon)}</b></span><span><small>Active total</small><b>${money(totalOutstanding)}</b></span></div></div>
      <div class="panel"><div class="panel-heading"><div><p class="panel-kicker">LAST 6 MONTHS</p><h3>Outstanding trend</h3></div></div><div class="credit-mini-chart">${[58,82,42,96,72,108].map((height, index) => `<span style="--h:${height}px"><b>${['Feb','Mar','Apr','May','Jun','Jul'][index]}</b></span>`).join('')}</div></div>
      <div class="panel"><div class="panel-heading"><div><p class="panel-kicker">INSIGHTS</p><h3>Useful signals</h3></div></div><div class="key-insight-list"><div class="key-insight"><span>%</span><p>${largest?.name || 'Top card'} is ${largestPct}% of active outstanding.</p></div><div class="key-insight"><span>✓</span><p>${summaryCards.some(card => card.status === 'Paid') ? 'At least one active card is fully paid this cycle.' : 'No active card is fully paid yet this cycle.'}</p></div><div class="key-insight"><span>!</span><p>${cards.filter(card => card.active === false).length} cards are inactive and excluded from totals.</p></div></div></div>
    </section>
  </article>`;
}
