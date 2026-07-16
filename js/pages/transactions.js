function transactionRange(filter = transactionFilter) {
  if (filter.mode === 'monthRange') return monthKeyRange(filter.fromMonth, filter.toMonth);
  if (filter.mode === 'yearRange') return yearKeyRange(filter.fromYear, filter.toYear);
  const range = monthKeyRange(currentMonthKey(), currentMonthKey());
  return { ...range, label:'This month' };
}

function transactionCategories() {
  return [...new Set(data.transactions.map(transaction => transaction.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function selectedFilterValues(value) {
  if (Array.isArray(value)) return value.filter(item => item && item !== 'all');
  return value && value !== 'all' ? [value] : [];
}

function selectedTransactionFilterValues(form, name) {
  if (!form) return [];
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value).filter(value => value && value !== 'all');
}

function renderMultiSelectFilter(name, label, allLabel, options, selectedValue) {
  const selected = selectedFilterValues(selectedValue);
  const summary = selected.length ? `${selected.length} selected` : allLabel;
  const checked = value => selected.length ? selected.includes(value) : value === 'all';
  const isOpen = typeof transactionOpenMultiFilter !== 'undefined' && transactionOpenMultiFilter === name;
  return `<div class="multi-filter-label"><span>${label}</span>
    <details class="multi-select-filter" ${isOpen ? 'open' : ''}>
      <summary>${summary}</summary>
      <div class="multi-select-menu">
        <label><input type="checkbox" name="${name}" value="all" ${checked('all') ? 'checked' : ''} /> ${allLabel}</label>
        ${options.map(([value, optionLabel]) => `<label><input type="checkbox" name="${name}" value="${esc(value)}" ${checked(value) ? 'checked' : ''} /> ${optionLabel}</label>`).join('')}
      </div>
    </details>
  </div>`;
}

function filteredTransactions(filter = transactionFilter) {
  const range = transactionRange(filter);
  const query = (filter.search || '').trim().toLowerCase();
  const selectedCategories = selectedFilterValues(filter.category);
  const selectedSpendGroups = selectedFilterValues(filter.spendGroup);
  const rows = data.transactions.filter(transaction => {
    const matchesRange = transaction.date >= range.from && transaction.date <= range.to;
    const matchesType = !filter.type || filter.type === 'all' || transaction.type === filter.type;
    const matchesCategory = !selectedCategories.length || selectedCategories.includes(transaction.category);
    const matchesSpendGroup = !selectedSpendGroups.length || (transaction.type === 'expense' && selectedSpendGroups.includes(categorySpendGroup(transaction.category)));
    const text = `${transaction.subcategory || ''} ${transaction.category || ''} ${transaction.note || ''} ${transaction.type || ''}`.toLowerCase();
    return matchesRange && matchesType && matchesCategory && matchesSpendGroup && (!query || text.includes(query));
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
  const categoryOptions = transactionCategories().map(category => [category, category]);
  const spendGroupOptions = Object.entries(spendGroups).map(([value, group]) => [value, group.label]);
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
      ${renderMultiSelectFilter('category', 'Category', 'All categories', categoryOptions, filter.category)}
      ${renderMultiSelectFilter('spendGroup', 'Spend group', 'All spend groups', spendGroupOptions, filter.spendGroup)}
      <label>Sort<select name="sort">${sortOptions}</select></label>
    </div>
  </form>`;
}

function renderTransactionsPage() {
  const range = transactionRange();
  const rows = filteredTransactions();
  const total = sumAmount(rows);
  return `<article class="panel"><div class="panel-heading"><div><p class="panel-kicker">${range.label}</p><h3>Transactions</h3><p class="subtitle">${rows.length} entries · ${money(total)} in selected results</p></div><div class="panel-actions"><button class="ghost-button" data-page="calendar">Calendar view</button><button class="primary-button" data-action="open-add">＋ Add transaction</button></div></div>${renderTransactionFilters()}<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Amount</th><th></th></tr></thead><tbody>${rows.length ? rows.map(t => `<tr><td>${t.date}</td><td><b>${t.subcategory || t.category}</b><br><small>${t.note || 'No note'}</small></td><td><span class="type-badge ${t.type}">${t.type}</span></td><td>${t.category}</td><td>${money(t.amount)}</td><td><div class="row-actions"><button class="table-actions" data-action="edit" data-id="${t.id}">Edit</button><button class="table-actions delete-action" data-action="delete" data-id="${t.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="6"><p class="empty-state">No transactions match the selected range and filters.</p></td></tr>'}</tbody></table></div></article>`;
}

function applyTransactionFiltersFromForm(form, mode = transactionFilter.mode || 'thisMonth') {
  const data = new FormData(form);
  transactionFilter = { mode, fromMonth:data.get('fromMonth'), toMonth:data.get('toMonth'), fromYear:data.get('fromYear'), toYear:data.get('toYear'), search:data.get('search') || '', type:data.get('type') || 'all', category:selectedTransactionFilterValues(form, 'category'), spendGroup:selectedTransactionFilterValues(form, 'spendGroup'), sort:data.get('sort') || 'dateDesc' };
  $('#subPageView').innerHTML = renderTransactionsPage();
}
