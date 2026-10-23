/*
 * SATRIA 3.0 — daftar anggota Auth pada halaman Pengguna dan Hak Akses.
 * Tempel blok ini DI DALAM Supabase bridge IIFE, sesudah modal tambah user
 * dan sebelum penutup `})();` terakhir. Ia memakai closure `client`, `member`,
 * `orgId` serta `window.render` dari HTML SATRIA hasil tugas sebelumnya.
 * Otorisasi tetap ditegakkan oleh Edge Function; gate di browser hanya UX.
 */
(() => {
  if (window.__satriaAdminUsersInstalled) return;
  window.__satriaAdminUsersInstalled = true;

  const PAGE_SIZE = 50;
  let page = 1;
  let busy = false;
  let lastFetchedAt = 0;
  let lastFetchedOrg = '';
  let cachedPayload = null;

  const byId = (id) => document.getElementById(id);

  function setStatus(message, kind = '') {
    const status = byId('satriaAdminUsersStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function isAuthorizedInUi() {
    return !!(client && member && member.role === 'admin' && orgId);
  }

  function updateVisibility() {
    const card = byId('satriaCloudUserListCard');
    if (!card) return false;
    const authorized = isAuthorizedInUi();
    const organizationChanged = !!(lastFetchedOrg && orgId && lastFetchedOrg !== orgId);
    card.style.display = authorized ? '' : 'none';
    if (!authorized || organizationChanged) {
      cachedPayload = null;
      lastFetchedAt = 0;
      lastFetchedOrg = '';
      page = 1;
      byId('satriaAdminUsersRows')?.replaceChildren();
      if (!authorized) setStatus('Daftar pengguna hanya tersedia bagi admin aktif organisasi.', '');
    }
    return authorized;
  }

  function dateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function addCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value == null ? '—' : String(value);
    row.appendChild(cell);
    return cell;
  }

  function renderRows(users) {
    const body = byId('satriaAdminUsersRows');
    if (!body) return;
    body.replaceChildren();

    if (!users.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = 'Belum ada anggota pada halaman ini.';
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    for (const user of users) {
      const row = document.createElement('tr');
      addCell(row, user.display_name || user.email || '—');
      addCell(row, user.email || '—');
      addCell(row, ({ admin: 'Admin', operator: 'Operator', viewer: 'Viewer' })[user.role] || user.role || '—');
      addCell(row, user.active ? 'Aktif' : 'Nonaktif');
      addCell(row, dateLabel(user.membership_created_at));
      body.appendChild(row);
    }
  }

  function renderPagination(payload) {
    const total = Number(payload.total) || 0;
    const pageSize = Number(payload.page_size) || PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const summary = byId('satriaAdminUsersPageSummary');
    const previous = byId('satriaAdminUsersPrevious');
    const next = byId('satriaAdminUsersNext');
    if (summary) {
      const first = total ? ((page - 1) * pageSize) + 1 : 0;
      const last = Math.min(page * pageSize, total);
      summary.textContent = `${first}–${last} dari ${total} pengguna · halaman ${page}/${pageCount}`;
    }
    if (previous) previous.disabled = busy || page <= 1;
    if (next) next.disabled = busy || page >= pageCount;
  }

  async function readableError(error) {
    const context = error?.context;
    if (context && typeof context.clone === 'function') {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === 'string') return body.error;
      } catch (_) {}
    }
    return 'Daftar pengguna tidak dapat dimuat. Periksa sesi dan konfigurasi Edge Function.';
  }

  async function loadUsers(force = false) {
    if (!updateVisibility()) return;
    const requestedOrg = orgId;
    if (busy) return;

    const isFresh = cachedPayload && lastFetchedOrg === requestedOrg && (Date.now() - lastFetchedAt) < 30_000;
    if (!force && isFresh) {
      renderRows(cachedPayload.users || []);
      renderPagination(cachedPayload);
      setStatus('Daftar diperbarui ' + dateLabel(lastFetchedAt), 'ok');
      return;
    }

    busy = true;
    const refreshButton = byId('satriaAdminUsersRefresh');
    if (refreshButton) refreshButton.disabled = true;
    setStatus('Memuat daftar pengguna…');
    renderPagination(cachedPayload || { total: 0, page_size: PAGE_SIZE });

    try {
      const { data, error } = await client.functions.invoke('admin-list-users', {
        body: { organization_id: requestedOrg, page, page_size: PAGE_SIZE },
      });
      if (error) throw new Error(await readableError(error));
      if (!data?.ok || !Array.isArray(data.users)) {
        throw new Error('Respons Edge Function tidak valid.');
      }
      if (requestedOrg !== orgId || !isAuthorizedInUi()) return;

      cachedPayload = data;
      lastFetchedAt = Date.now();
      lastFetchedOrg = requestedOrg;
      renderRows(data.users);
      renderPagination(data);
      setStatus('Daftar pengguna organisasi berhasil dimuat.', 'ok');
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'Daftar pengguna tidak dapat dimuat.';
      renderRows([]);
      setStatus(safeMessage, 'error');
    } finally {
      busy = false;
      if (refreshButton) refreshButton.disabled = false;
      renderPagination(cachedPayload || { total: 0, page_size: PAGE_SIZE });
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#satriaAdminUsersRefresh')) {
      event.preventDefault();
      void loadUsers(true);
    } else if (target.closest('#satriaAdminUsersPrevious')) {
      event.preventDefault();
      if (!busy && page > 1) {
        page -= 1;
        void loadUsers(true);
      }
    } else if (target.closest('#satriaAdminUsersNext')) {
      event.preventDefault();
      const total = Number(cachedPayload?.total) || 0;
      const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (!busy && page < pageCount) {
        page += 1;
        void loadUsers(true);
      }
    }
  });

  // Triggered after admin-create-user succeeds; also useful to other UI flows.
  window.addEventListener('satria:user-created', () => {
    page = 1;
    void loadUsers(true);
  });

  // Existing SATRIA routing replaces the page HTML on each render. Refresh the
  // list when the Pengguna view is rendered; cache avoids unnecessary requests.
  if (typeof window.render === 'function') {
    const originalRender = window.render;
    window.render = function (...args) {
      const result = originalRender.apply(this, args);
      requestAnimationFrame(() => {
        if (updateVisibility()) void loadUsers(false);
      });
      return result;
    };
  }

  // The restored session may already be on the Pengguna route at install time.
  requestAnimationFrame(() => {
    if (updateVisibility()) void loadUsers(false);
  });
})();
