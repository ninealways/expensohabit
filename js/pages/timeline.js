const timelineCategoryMeta = {
  money:{ label:'Money', asset:'timeline-money', tone:'teal' },
  trading:{ label:'Trading', asset:'timeline-trading', tone:'purple' },
  investment:{ label:'Investment', asset:'timeline-investment', tone:'teal' },
  personal:{ label:'Personal', asset:'timeline-personal', tone:'coral' },
  memory:{ label:'Memory', asset:'timeline-memory', tone:'purple' },
  travel:{ label:'Travel', asset:'timeline-travel', tone:'blue' },
  reading:{ label:'Reading', asset:'timeline-reading', tone:'blue' },
  work:{ label:'Work', asset:'timeline-work', tone:'amber' },
  health:{ label:'Health', asset:'timeline-health', tone:'teal' },
  other:{ label:'Other', asset:'timeline-event', tone:'purple' }
};
const timelineDensityOptions = ['overview', 'compact', 'comfortable'];
let timelineView = 'year';
let timelinePeriodDate = new Date();
let timelineCategory = 'all';
let timelineDensity = 'compact';
let editingTimelineEventId = null;

function timelinePeriodRange() {
  const year = timelinePeriodDate.getFullYear();
  const month = timelinePeriodDate.getMonth();
  if (timelineView === 'year') return { from:`${year}-01-01`, to:`${year}-12-31`, label:String(year) };
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from:`${year}-${String(month + 1).padStart(2, '0')}-01`,
    to:`${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    label:new Date(year, month, 1).toLocaleDateString('en-IN', { month:'short', year:'numeric' }).toUpperCase()
  };
}

function timelineVisibleEvents() {
  const range = timelinePeriodRange();
  return (data.timelineEvents || [])
    .filter(event => event.date >= range.from && event.date <= range.to)
    .filter(event => timelineCategory === 'all' || event.category === timelineCategory)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function timelineMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month:'long', year:'numeric' }).toUpperCase();
}

function timelineAmount(event) {
  if (event.amount === null || event.amount === undefined || event.amount === '') return '';
  if (privacyMode) return hiddenMoney();
  const value = Number(event.amount || 0).toLocaleString('en-IN', { maximumFractionDigits:2 });
  const prefix = event.amountType === 'in' ? '+' : event.amountType === 'out' ? '−' : '';
  return `${prefix}₹${value}`;
}

function timelineEventCard(event, index) {
  const meta = timelineCategoryMeta[event.category] || timelineCategoryMeta.other;
  const date = dateFromKey(event.date);
  const amount = timelineAmount(event);
  const side = index % 2 ? 'right' : 'left';
  return `<div class="timeline-entry ${side} timeline-${meta.tone}">
    <div class="timeline-event-card">
      <div class="timeline-date-tile"><strong>${String(date.getDate()).padStart(2, '0')}</strong><small>${monthName(date)}</small></div>
      <div class="timeline-event-copy">
        <span class="timeline-category-tag"><span class="timeline-category-icon">${richIcon(meta.asset)}</span>${meta.label}</span>
        <b>${esc(event.title)}</b>
        ${amount ? `<strong class="timeline-event-amount ${event.amountType || 'neutral'}">${amount}</strong>` : ''}
        ${event.note ? `<p>${esc(event.note)}</p>` : ''}
      </div>
      <div class="timeline-card-actions">
        <button type="button" title="Edit event" aria-label="Edit ${esc(event.title)}" data-timeline-action="edit" data-id="${esc(event.id)}">${richIcon('timeline-edit')}</button>
        <button type="button" class="danger" title="Delete event" aria-label="Delete ${esc(event.title)}" data-timeline-action="delete" data-id="${esc(event.id)}">${richIcon('timeline-delete')}</button>
      </div>
    </div>
    <span class="timeline-node" aria-hidden="true"></span>
  </div>`;
}

function timelineSummary(events, range) {
  const moneyMoments = events.filter(event => ['money', 'trading', 'investment'].includes(event.category)).length;
  const memories = events.filter(event => ['personal', 'memory', 'travel'].includes(event.category)).length;
  return `<section class="timeline-metric-grid" aria-label="Timeline summary">
    <article class="timeline-metric-card featured"><span class="timeline-metric-icon">${richIcon('timeline-event')}</span><div><p>Events</p><strong>${events.length}</strong><small>${range.label}</small></div></article>
    <article class="timeline-metric-card"><span class="timeline-metric-icon teal">${richIcon('timeline-money')}</span><div><p>Money moments</p><strong>${moneyMoments}</strong><small>Trading, returns and investments</small></div></article>
    <article class="timeline-metric-card"><span class="timeline-metric-icon coral">${richIcon('timeline-memory')}</span><div><p>Life moments</p><strong>${memories}</strong><small>Celebrations, trips and memories</small></div></article>
  </section>`;
}

function renderTimelinePage() {
  const events = timelineVisibleEvents();
  const groups = events.reduce((map, event) => {
    const month = event.date.slice(0, 7);
    if (!map.has(month)) map.set(month, []);
    map.get(month).push(event);
    return map;
  }, new Map());
  let entryIndex = 0;
  const timeline = events.length ? [...groups.entries()].map(([month, monthEvents]) => `<section class="timeline-month-group">
    ${monthEvents.map(event => timelineEventCard(event, entryIndex++)).join('')}
    <h4>${timelineMonthLabel(month)}</h4>
  </section>`).join('') : `<div class="timeline-empty"><span>${richIcon('timeline-event')}</span><h4>No moments here yet</h4><p>Add an event to start building your personal timeline.</p><button class="primary-button" type="button" data-timeline-action="add">＋ Add event</button></div>`;
  const categoryOptions = [`<option value="all">All events</option>`, ...Object.entries(timelineCategoryMeta).map(([key, meta]) => `<option value="${key}" ${timelineCategory === key ? 'selected' : ''}>${meta.label}</option>`)].join('');
  const range = timelinePeriodRange();
  const densityIndex = timelineDensityOptions.indexOf(timelineDensity);
  const densityLabel = timelineDensity.charAt(0).toUpperCase() + timelineDensity.slice(1);
  return `<section class="timeline-page density-${timelineDensity}">
    <article class="panel timeline-dashboard-hero">
      <div class="timeline-dashboard-hero-copy"><span class="timeline-dashboard-hero-icon">${richIcon('timeline-moment')}</span><div><p class="panel-kicker">PERSONAL TIMELINE</p><h3>Moments &amp; milestones</h3><p class="subtitle">Money moves, milestones and memories in one place.</p></div></div>
      <button class="primary-button" type="button" data-timeline-action="add">＋ Add event</button>
    </article>
    ${timelineSummary(events, range)}
    <article class="panel timeline-shell timeline-board">
      <div class="timeline-board-heading"><div><p class="panel-kicker">YOUR STORY</p><h3>Timeline</h3><p class="subtitle">Browse by month or year and adjust the detail level.</p></div><span class="tag">${events.length} ${events.length === 1 ? 'event' : 'events'}</span></div>
      <div class="timeline-toolbar">
        <div class="timeline-period-control"><button type="button" data-timeline-nav="previous" aria-label="Previous ${timelineView}">‹</button><strong>${range.label}</strong><button type="button" data-timeline-nav="next" aria-label="Next ${timelineView}">›</button></div>
        <div class="timeline-view-switch" role="group" aria-label="Timeline view"><button type="button" class="${timelineView === 'month' ? 'active' : ''}" data-timeline-view="month">Month</button><button type="button" class="${timelineView === 'year' ? 'active' : ''}" data-timeline-view="year">Year</button></div>
        <div class="timeline-density-control" aria-label="Timeline zoom"><button type="button" data-timeline-density="out" ${densityIndex === 0 ? 'disabled' : ''} aria-label="Zoom out">−</button><span>${densityLabel}</span><button type="button" data-timeline-density="in" ${densityIndex === timelineDensityOptions.length - 1 ? 'disabled' : ''} aria-label="Zoom in">＋</button></div>
        <label class="timeline-filter"><span class="sr-only">Filter events</span><select data-timeline-filter>${categoryOptions}</select></label>
      </div>
      <div class="timeline-canvas">${events.length ? '<span class="timeline-direction-arrow" aria-hidden="true"></span>' : ''}${timeline}</div>
    </article>
  </section>`;
}

function openTimelineEventModal(event = null) {
  editingTimelineEventId = event?.id || null;
  const form = $('#timelineEventForm');
  form.reset();
  form.elements.date.value = event?.date || today();
  form.elements.title.value = event?.title || '';
  form.elements.category.value = event?.category || 'personal';
  form.elements.amount.value = event?.amount ?? '';
  form.elements.amountType.value = event?.amountType || 'none';
  form.elements.note.value = event?.note || '';
  $('#timelineEventModalTitle').textContent = event ? 'Edit event' : 'Add event';
  form.querySelector('button[type="submit"]').textContent = event ? 'Save changes' : 'Save event';
  $('#timelineEventModalBackdrop').hidden = false;
  initializeDatePickers(form);
}

function closeTimelineEventModal() {
  editingTimelineEventId = null;
  $('#timelineEventModalBackdrop').hidden = true;
  $('#timelineEventForm').reset();
}

async function submitTimelineEvent(event) {
  event.preventDefault();
  const wasEditing = Boolean(editingTimelineEventId);
  const form = new FormData(event.target);
  const payload = {
    date:form.get('date'), title:form.get('title'), category:form.get('category'),
    amount:form.get('amount'), amountType:form.get('amount') === '' ? 'none' : form.get('amountType'), note:form.get('note')
  };
  const response = await fetch(editingTimelineEventId ? `/api/timeline-events/${editingTimelineEventId}` : '/api/timeline-events', {
    method:editingTimelineEventId ? 'PUT' : 'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(payload)
  });
  if (!response.ok) { const message = await response.json().catch(() => ({})); toast(message.error || 'Could not save event'); return; }
  await loadData();
  closeTimelineEventModal();
  navigate('timeline', false);
  toast(wasEditing ? 'Event updated' : 'Event added');
}

async function deleteTimelineEvent(id) {
  const event = (data.timelineEvents || []).find(item => item.id === id);
  if (!event || !window.confirm(`Delete “${event.title}” from your timeline?`)) return;
  const response = await fetch(`/api/timeline-events/${id}`, { method:'DELETE' });
  if (!response.ok) { toast('Could not delete event'); return; }
  await loadData();
  navigate('timeline', false);
  toast('Event deleted');
}

function shiftTimelinePeriod(direction) {
  const next = new Date(timelinePeriodDate);
  if (timelineView === 'year') next.setFullYear(next.getFullYear() + direction);
  else next.setMonth(next.getMonth() + direction);
  timelinePeriodDate = next;
}

function changeTimelineDensity(direction) {
  const index = timelineDensityOptions.indexOf(timelineDensity);
  const nextIndex = Math.max(0, Math.min(timelineDensityOptions.length - 1, index + (direction === 'in' ? 1 : -1)));
  timelineDensity = timelineDensityOptions[nextIndex];
}
