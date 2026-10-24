/*
 * Source companion to the integrated SATRIA index.html block.
 * Paste inside the Supabase bridge IIFE so client/member/orgId are in scope.
 */
/*
 * SATRIA 3.0 — roster Auth + OPD assignment administration.
 * Must remain inside the bridge IIFE so it uses the active Supabase client.
 */
(() => {
  if (window.__satriaAdminUsersInstalled) return;
  window.__satriaAdminUsersInstalled = true;

  const PAGE_SIZE = 50;
  let page = 1;
  let busy = false;
  let loadingPromise = null;
  let lastFetchedAt = 0;
  let lastFetchedOrg = '';
  let cachedPayload = null;
  let opds = [];
  let editingUser = null;
  let assignmentBusy = false;

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

  function setCatalog(items) {
    opds = Array.isArray(items) ? items.filter((item) => item && typeof item.id === 'string' && item.id && typeof item.name === 'string' && item.name) : [];
    window.dispatchEvent(new CustomEvent('satria:opds-loaded', { detail: { opds: opds.map((item) => ({ ...item })) } }));
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
      setCatalog([]);
      byId('satriaAdminUsersRows')?.replaceChildren();
      if (!authorized) setStatus('Daftar pengguna hanya tersedia bagi admin aktif organisasi.', '');
    }
    return authorized;
  }

  function dateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function addCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value == null || value === '' ? '—' : String(value);
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
      cell.colSpan = 7;
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

      let opdLabel = '—';
      if (user.role === 'admin') opdLabel = 'Semua OPD (akses admin)';
      else if (user.role === 'operator') {
        const names = Array.isArray(user.opd_names) ? user.opd_names : [];
        const ids = Array.isArray(user.opd_ids) ? user.opd_ids : [];
        opdLabel = names.length ? names.join(', ') + (ids.length > names.length ? ` (+${ids.length - names.length} OPD nonaktif)` : '') : (ids.length ? 'OPD lama/nonaktif perlu diperiksa' : 'Belum ditetapkan');
      } else if (Array.isArray(user.opd_names) && user.opd_names.length) opdLabel = user.opd_names.join(', ');
      const opdCell = addCell(row, opdLabel);
      opdCell.style.minWidth = '190px';
      opdCell.style.maxWidth = '340px';
      opdCell.style.whiteSpace = 'normal';

      addCell(row, user.active ? 'Aktif' : 'Nonaktif');
      addCell(row, dateLabel(user.membership_created_at));
      const actionCell = document.createElement('td');
      if (user.role === 'operator') {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = (Array.isArray(user.opd_ids) && user.opd_ids.length) ? 'Ubah OPD' : 'Atur OPD';
        button.dataset.satriaEditOpd = user.id;
        button.disabled = !user.active || !opds.length;
        button.title = !user.active ? 'Aktifkan user terlebih dahulu.' : (!opds.length ? 'Katalog OPD belum tersedia.' : 'Atur OPD yang dapat diakses user ini.');
        actionCell.appendChild(button);
      } else {
        actionCell.textContent = '—';
      }
      row.appendChild(actionCell);
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

  async function readableError(error, fallback = 'Permintaan tidak dapat diproses. Periksa sesi dan konfigurasi Edge Function.') {
    const context = error?.context;
    if (context && typeof context.clone === 'function') {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === 'string') return body.error;
      } catch (_) {}
    }
    return fallback;
  }

  async function loadUsers(force = false) {
    if (!updateVisibility()) return null;
    const requestedOrg = orgId;
    if (busy && loadingPromise) return loadingPromise;

    const isFresh = cachedPayload && lastFetchedOrg === requestedOrg && (Date.now() - lastFetchedAt) < 30_000;
    if (!force && isFresh) {
      setCatalog(cachedPayload.opds || []);
      renderRows(cachedPayload.users || []);
      renderPagination(cachedPayload);
      setStatus('Daftar diperbarui ' + dateLabel(lastFetchedAt), 'ok');
      return cachedPayload;
    }

    busy = true;
    const refreshButton = byId('satriaAdminUsersRefresh');
    if (refreshButton) refreshButton.disabled = true;
    setStatus('Memuat pengguna dan katalog OPD…');
    renderPagination(cachedPayload || { total: 0, page_size: PAGE_SIZE });

    loadingPromise = (async () => {
      try {
        const { data, error } = await client.functions.invoke('admin-list-users', {
          body: { organization_id: requestedOrg, page, page_size: PAGE_SIZE },
        });
        if (error) throw new Error(await readableError(error, 'Daftar pengguna dan OPD tidak dapat dimuat.'));
        if (!data?.ok || !Array.isArray(data.users) || !Array.isArray(data.opds)) {
          throw new Error('Respons Edge Function tidak valid. Pastikan deployment fungsi sudah diperbarui.');
        }
        if (requestedOrg !== orgId || !isAuthorizedInUi()) return null;

        cachedPayload = data;
        lastFetchedAt = Date.now();
        lastFetchedOrg = requestedOrg;
        setCatalog(data.opds);
        renderRows(data.users);
        renderPagination(data);
        setStatus(`Daftar pengguna berhasil dimuat. Katalog OPD: ${opds.length}.`, 'ok');
        return data;
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message : 'Daftar pengguna tidak dapat dimuat.';
        setCatalog([]);
        renderRows([]);
        setStatus(safeMessage, 'error');
        return null;
      } finally {
        busy = false;
        loadingPromise = null;
        if (refreshButton) refreshButton.disabled = false;
        renderPagination(cachedPayload || { total: 0, page_size: PAGE_SIZE });
      }
    })();
    return loadingPromise;
  }

  function ensureAssignmentModal() {
    let modal = byId('satriaEditUserOpdModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'satriaEditUserOpdModal';
    modal.hidden = true;
    modal.innerHTML = `
      <style>
        #satriaEditUserOpdModal{position:fixed;inset:0;z-index:10025;background:rgba(15,23,42,.64);display:grid;place-items:center;padding:18px}
        #satriaEditUserOpdModal[hidden]{display:none}
        .satria-edit-opd-dialog{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #dbe3ea;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);padding:22px;color:#17212b;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
        .satria-edit-opd-dialog h2{margin:0;font-size:20px}.satria-edit-opd-dialog p{color:#52616f}
        .satria-edit-opd-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px 12px;max-height:48vh;overflow:auto;border:1px solid #cbd5df;border-radius:10px;padding:12px}
        .satria-edit-opd-choice{display:flex;gap:8px;align-items:flex-start;cursor:pointer}.satria-edit-opd-choice input{margin-top:4px}
        .satria-edit-opd-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}
        .satria-edit-opd-actions button{border:1px solid #cbd5df;border-radius:9px;padding:9px 14px;font:inherit;font-weight:650;cursor:pointer;background:#fff;color:#1f2937}
        .satria-edit-opd-actions button.primary{background:#0f766e;color:#fff;border-color:#0f766e}
        .satria-edit-opd-actions button:disabled{opacity:.55;cursor:not-allowed}
        #satriaEditUserOpdMessage{min-height:20px;white-space:pre-wrap;font-size:13px}#satriaEditUserOpdMessage[data-kind=error]{color:#b42318}#satriaEditUserOpdMessage[data-kind=ok]{color:#067647}
      </style>
      <section class="satria-edit-opd-dialog" role="dialog" aria-modal="true" aria-labelledby="satriaEditUserOpdTitle">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h2 id="satriaEditUserOpdTitle">Atur OPD Operator</h2><p id="satriaEditUserOpdName"></p></div><button type="button" data-satria-edit-opd-close>Tutup</button></div>
        <p>Pilih OPD yang dapat diakses oleh Operator ini. Perubahan akan divalidasi dan disimpan oleh server.</p>
        <div id="satriaEditUserOpdChoices" class="satria-edit-opd-choices"></div>
        <p id="satriaEditUserOpdMessage" role="status" aria-live="polite"></p>
        <div class="satria-edit-opd-actions"><button type="button" data-satria-edit-opd-close>Batal</button><button id="satriaEditUserOpdSave" class="primary" type="button">Simpan assignment</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || (event.target instanceof Element && event.target.closest('[data-satria-edit-opd-close]'))) closeAssignmentModal();
    });
    byId('satriaEditUserOpdSave').addEventListener('click', () => { void saveAssignment(); });
    return modal;
  }

  function assignmentMessage(message, kind = '') {
    const element = byId('satriaEditUserOpdMessage');
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind;
  }

  function closeAssignmentModal() {
    if (assignmentBusy) return;
    const modal = byId('satriaEditUserOpdModal');
    if (modal) modal.hidden = true;
    editingUser = null;
    assignmentMessage('');
  }

  function openAssignmentModal(user) {
    if (!user || user.role !== 'operator' || !user.active) return;
    if (!isAuthorizedInUi()) {
      setStatus('Sesi admin aktif diperlukan untuk mengubah assignment OPD.', 'error');
      return;
    }
    const modal = ensureAssignmentModal();
    editingUser = user;
    byId('satriaEditUserOpdName').textContent = `${user.display_name || user.email} · ${user.email || ''}`;
    const choices = byId('satriaEditUserOpdChoices');
    choices.replaceChildren();
    const selected = new Set(Array.isArray(user.opd_ids) ? user.opd_ids : []);
    if (!opds.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Katalog OPD belum tersedia. Muat ulang daftar pengguna.';
      choices.appendChild(empty);
    } else {
      for (const opd of opds) {
        const label = document.createElement('label');
        label.className = 'satria-edit-opd-choice';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'satria_edit_opd_ids';
        input.value = opd.id;
        input.checked = selected.has(opd.id);
        const text = document.createElement('span');
        text.textContent = opd.name + (opd.code ? ` (${opd.code})` : '');
        label.append(input, text);
        choices.appendChild(label);
      }
      if ((user.opd_ids || []).some((id) => !opds.some((opd) => opd.id === id))) {
        const warning = document.createElement('p');
        warning.style.gridColumn = '1 / -1';
        warning.style.color = '#92400e';
        warning.textContent = 'Ada assignment lama yang OPD-nya tidak lagi aktif. Menyimpan pilihan baru akan menghapus assignment lama tersebut.';
        choices.appendChild(warning);
      }
    }
    assignmentMessage('');
    byId('satriaEditUserOpdSave').disabled = !opds.length;
    modal.hidden = false;
    byId('satriaEditUserOpdSave').focus();
  }

  async function saveAssignment() {
    if (assignmentBusy) return;
    if (!editingUser || !isAuthorizedInUi()) {
      assignmentMessage('Sesi admin tidak aktif. Masuk kembali dan ulangi.', 'error');
      return;
    }
    const opdIds = Array.from(document.querySelectorAll('#satriaEditUserOpdChoices input[name="satria_edit_opd_ids"]:checked')).map((input) => input.value);
    if (!opdIds.length || opdIds.length > 100) {
      assignmentMessage('Pilih minimal satu dan maksimal 100 OPD sebelum menyimpan.', 'error');
      return;
    }
    const saveButton = byId('satriaEditUserOpdSave');
    assignmentBusy = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan…';
    assignmentMessage('Memvalidasi dan menyimpan assignment OPD…');
    try {
      const requestedOrg = orgId;
      const { data, error } = await client.functions.invoke('admin-update-user', {
        body: { organization_id: requestedOrg, user_id: editingUser.id, opd_ids: opdIds },
      });
      if (error) throw new Error(await readableError(error, 'Assignment OPD gagal disimpan.'));
      if (!data?.ok || data.user_id !== editingUser.id) throw new Error('Respons server tidak valid. Pastikan admin-update-user sudah di-deploy.');
      if (requestedOrg !== orgId || !isAuthorizedInUi()) throw new Error('Organisasi atau sesi berubah selama proses penyimpanan. Muat ulang daftar.');
      assignmentMessage(`Assignment tersimpan: ${Number(data.assignment_count) || opdIds.length} OPD.`, 'ok');
      await loadUsers(true);
      assignmentBusy = false;
      const auditNote = data.audit_recorded === false ? ' Audit trail gagal disimpan; periksa log Edge Function.' : '';
      setStatus('Assignment OPD operator berhasil diperbarui.' + auditNote, data.audit_recorded === false ? 'error' : 'ok');
      closeAssignmentModal();
    } catch (error) {
      assignmentMessage(error instanceof Error ? error.message : 'Assignment OPD gagal disimpan.', 'error');
    } finally {
      assignmentBusy = false;
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Simpan assignment';
      }
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
      if (!busy && page > 1) { page -= 1; void loadUsers(true); }
    } else if (target.closest('#satriaAdminUsersNext')) {
      event.preventDefault();
      const total = Number(cachedPayload?.total) || 0;
      const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (!busy && page < pageCount) { page += 1; void loadUsers(true); }
    } else {
      const editButton = target.closest('[data-satria-edit-opd]');
      if (editButton) {
        event.preventDefault();
        const userId = editButton.getAttribute('data-satria-edit-opd');
        const user = cachedPayload?.users?.find((item) => item.id === userId);
        openAssignmentModal(user);
      }
    }
  });

  window.addEventListener('satria:user-created', () => { page = 1; void loadUsers(true); });
  window.addEventListener('satria:user-updated', () => { void loadUsers(true); });
  window.addEventListener('satria:load-opd-catalog', () => { void loadUsers(true); });
  window.SATRIA_ADMIN_USERS = Object.freeze({ getOpds: () => opds.map((item) => ({ ...item })), refresh: () => loadUsers(true) });

  if (typeof window.render === 'function') {
    const originalRender = window.render;
    window.render = function (...args) {
      const result = originalRender.apply(this, args);
      requestAnimationFrame(() => { if (updateVisibility()) void loadUsers(false); });
      return result;
    };
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && byId('satriaEditUserOpdModal') && !byId('satriaEditUserOpdModal').hidden) closeAssignmentModal();
  });
  requestAnimationFrame(() => { if (updateVisibility()) void loadUsers(false); });
})();
