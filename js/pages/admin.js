function adminDate(value, withTime = false) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-IN', withTime ? { day:'2-digit', month:'short', year:'numeric', hour:'numeric', minute:'2-digit' } : { day:'2-digit', month:'short', year:'numeric' });
}

function adminRelativeDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return adminDate(value);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return adminDate(value);
}

function adminInitials(user = {}) {
  const parts = String(user.name || user.email || 'U').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || 'U').toUpperCase();
}

function filteredAdminUsers() {
  const rows = adminDirectoryState?.users?.slice() || [];
  const search = String(adminDirectoryFilter.search || '').trim().toLowerCase();
  const status = adminDirectoryFilter.status || 'all';
  const filtered = rows.filter(user => {
    if (search && !`${user.name || ''} ${user.email || ''}`.toLowerCase().includes(search)) return false;
    if (status === 'active' && !user.isActive) return false;
    if (status === 'inactive' && user.isActive) return false;
    if (status === 'admin' && !user.isAdmin) return false;
    return true;
  });
  return filtered.sort((a, b) => {
    if (adminDirectoryFilter.sort === 'name') return String(a.name || a.email).localeCompare(String(b.name || b.email));
    if (adminDirectoryFilter.sort === 'lastActive') return new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function adminUserRows() {
  const filtered = filteredAdminUsers();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  adminDirectoryFilter.page = Math.min(Math.max(1, Number(adminDirectoryFilter.page) || 1), totalPages);
  const offset = (adminDirectoryFilter.page - 1) * pageSize;
  const rows = filtered.slice(offset, offset + pageSize);
  const body = rows.map((user, index) => {
    const protectedAccount = user.id === currentUser?.id || user.email === '9always.rocks@gmail.com';
    return `<tr>
      <td><div class="admin-user-cell"><span class="admin-user-avatar tone-${index % 5}">${esc(adminInitials(user))}</span><div><b>${esc(user.name || 'Unnamed user')}${user.isAdmin ? '<em>Admin</em>' : ''}</b><small>${esc(user.email || '')}</small></div></div></td>
      <td>${adminDate(user.createdAt)}</td>
      <td><span title="${esc(adminDate(user.lastActiveAt, true))}">${adminRelativeDate(user.lastActiveAt)}</span></td>
      <td><strong>${Number(user.transactionCount || 0).toLocaleString('en-IN')}</strong></td>
      <td><strong>${Number(user.habitCount || 0).toLocaleString('en-IN')}</strong></td>
      <td><span class="admin-user-status ${user.isActive ? 'active' : 'inactive'}"><i></i>${user.isActive ? 'Active' : 'Inactive'}</span></td>
      <td>${protectedAccount ? '<span class="admin-protected-label">Protected</span>' : `<button class="admin-status-button ${user.isActive ? 'deactivate' : 'activate'}" type="button" data-action="toggle-admin-user" data-id="${esc(user.id)}" data-next-active="${user.isActive ? 'false' : 'true'}">${user.isActive ? 'Deactivate' : 'Activate'}</button>`}</td>
    </tr>`;
  }).join('');
  const pagination = Array.from({ length:totalPages }, (_, index) => index + 1).map(page => `<button type="button" class="${page === adminDirectoryFilter.page ? 'active' : ''}" data-action="admin-page" data-page="${page}">${page}</button>`).join('');
  return {
    body:body || '<tr><td colspan="7"><p class="empty-state">No users match these filters.</p></td></tr>',
    footer:`<span>Showing ${filtered.length ? offset + 1 : 0}–${Math.min(offset + pageSize, filtered.length)} of ${filtered.length}</span><div>${pagination}</div>`
  };
}

function renderAdminPage() {
  if (!currentUser?.isAdmin) return '<section class="account-page"><article class="panel admin-access-denied"><span>!</span><h3>Administrator access required</h3><p>This page is available only to authorized administrators.</p></article></section>';
  if (!adminDirectoryState) return `<section class="account-page admin-page"><article class="panel account-page-hero admin-page-hero"><div class="account-hero-copy"><span class="account-hero-icon">${richIcon('profile')}</span><div><p class="panel-kicker">ADMIN CONSOLE</p><h3>User management</h3><p class="subtitle">Loading account access and activity…</p></div></div></article><article class="panel admin-loading"><span class="loader-spinner"></span><b>Loading users</b></article></section>`;
  if (adminDirectoryState.error) return `<section class="account-page admin-page"><article class="panel admin-access-denied"><span>!</span><h3>Could not load users</h3><p>${esc(adminDirectoryState.error)}</p><button class="primary-button" type="button" data-action="reload-admin-users">Try again</button></article></section>`;

  const summary = adminDirectoryState.summary || {};
  const users = adminDirectoryState.users || [];
  const table = adminUserRows();
  const activePct = summary.total ? Math.round((summary.active || 0) / summary.total * 100) : 0;
  const recent = users.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4);
  return `<section class="account-page admin-page">
    <article class="panel account-page-hero admin-page-hero">
      <div class="account-hero-copy"><span class="account-hero-icon">${richIcon('profile')}</span><div><p class="panel-kicker">ADMIN CONSOLE</p><h3>User management</h3><p class="subtitle">Monitor accounts, access, and recent activity.</p></div></div>
      <span class="admin-owner-badge">${richIcon('privacy')}<b>Owner access</b> · ${esc(currentUser.email || '')}</span>
    </article>

    <section class="admin-summary-grid">
      <article class="admin-summary-card"><span class="purple">${richIcon('profile')}</span><div><p>Total users</p><strong>${summary.total || 0}</strong><small>${summary.active || 0} currently active</small></div></article>
      <article class="admin-summary-card"><span class="teal">${richIcon('refresh')}</span><div><p>Active this month</p><strong>${summary.activeThisMonth || 0}</strong><small>Accounts with recent access</small></div></article>
      <article class="admin-summary-card"><span class="amber">${richIcon('insight-pattern')}</span><div><p>New this month</p><strong>${summary.newThisMonth || 0}</strong><small>Recently registered users</small></div></article>
      <article class="admin-summary-card"><span class="pink">${richIcon('privacy')}</span><div><p>Admins</p><strong>${summary.admins || 0}</strong><small>${summary.admins === 1 ? 'Primary owner only' : 'Authorized administrators'}</small></div></article>
    </section>

    <section class="admin-layout">
      <article class="panel admin-users-panel">
        <div class="admin-users-heading"><div><p class="panel-kicker">DIRECTORY</p><h3>All users</h3></div><div class="admin-user-filters"><label class="admin-search"><svg class="admin-search-svg" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg><input id="adminUserSearch" type="search" value="${esc(adminDirectoryFilter.search || '')}" placeholder="Search users by name or email…" /></label><select id="adminUserStatus" aria-label="Filter users by status"><option value="all" ${adminDirectoryFilter.status === 'all' ? 'selected' : ''}>All status</option><option value="active" ${adminDirectoryFilter.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${adminDirectoryFilter.status === 'inactive' ? 'selected' : ''}>Inactive</option><option value="admin" ${adminDirectoryFilter.status === 'admin' ? 'selected' : ''}>Admins</option></select><select id="adminUserSort" aria-label="Sort users"><option value="joined" ${adminDirectoryFilter.sort === 'joined' ? 'selected' : ''}>Newest joined</option><option value="lastActive" ${adminDirectoryFilter.sort === 'lastActive' ? 'selected' : ''}>Last active</option><option value="name" ${adminDirectoryFilter.sort === 'name' ? 'selected' : ''}>Name A–Z</option></select></div></div>
        <div class="admin-users-table-wrap"><table class="admin-users-table"><thead><tr><th>User</th><th>Joined</th><th>Last active</th><th>Transactions</th><th>Habits</th><th>Status</th><th>Access</th></tr></thead><tbody id="adminUsersTableBody">${table.body}</tbody></table></div>
        <footer class="admin-table-footer" id="adminUsersTableFooter">${table.footer}</footer>
      </article>

      <aside class="admin-side-stack">
        <article class="panel admin-health-panel"><div class="panel-heading"><div><p class="panel-kicker">ACCOUNT HEALTH</p><h3>Access status</h3></div></div><div class="admin-health-body"><div class="admin-health-donut" style="--active-angle:${activePct * 3.6}deg"><b>${summary.total || 0}</b><small>users</small></div><div class="admin-health-legend"><span><i class="active"></i><b>Active</b><strong>${summary.active || 0} · ${activePct}%</strong></span><span><i class="inactive"></i><b>Inactive</b><strong>${summary.inactive || 0} · ${100 - activePct}%</strong></span><span><i class="admin"></i><b>Admins</b><strong>${summary.admins || 0}</strong></span></div></div></article>
        <article class="panel admin-recent-panel"><div class="panel-heading"><div><p class="panel-kicker">LATEST ACCOUNTS</p><h3>Recent sign-ups</h3></div></div><div class="admin-recent-list">${recent.map((user, index) => `<div><span class="admin-user-avatar tone-${index % 5}">${esc(adminInitials(user))}</span><p><b>${esc(user.name || 'Unnamed user')}</b><small>${esc(user.email || '')}</small></p><time>${adminRelativeDate(user.createdAt)}</time></div>`).join('') || '<p class="empty-state">No users yet.</p>'}</div></article>
      </aside>
    </section>
  </section>`;
}

async function loadAdminDirectory() {
  if (!currentUser?.isAdmin) return;
  try {
    const response = await fetch('/api/admin/users');
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not load the user directory.');
    adminDirectoryState = result;
  } catch (error) {
    adminDirectoryState = { error:error.message || 'Could not load the user directory.', users:[], summary:{} };
  }
  if (activePage === 'admin') $('#subPageView').innerHTML = renderAdminPage();
}

function refreshAdminUserResults() {
  if (activePage !== 'admin' || !adminDirectoryState?.users) return;
  const table = adminUserRows();
  const body = $('#adminUsersTableBody');
  const footer = $('#adminUsersTableFooter');
  if (body) body.innerHTML = table.body;
  if (footer) footer.innerHTML = table.footer;
}
