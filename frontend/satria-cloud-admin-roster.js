/* SATRIA Tahap 5B — daftar pengguna dan penugasan OPD/tahun.
 * Event/UI module installed exactly once by the cloud bridge; session is always read live.
 */
(function(root){
  'use strict';
  if(!root)return;
  let installed=false;
  root.SATRIA_INSTALL_CLOUD_ADMIN_ROSTER=function(getContext){
    if(installed)return;
    if(typeof getContext!=='function')throw new Error('Modul cloud memerlukan konteks sesi.');
    const ctx=Object.freeze({
      get client(){return getContext().client},
      get member(){return getContext().member},
      get orgId(){return getContext().orgId}
    });
    installed=true;
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
  let sessionEpoch = 0; // Prevent in-flight roster responses crossing login/logout boundaries.

  const byId = (id) => document.getElementById(id);

  function setStatus(message, kind = '') {
    const status = byId('satriaAdminUsersStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function isAuthorizedInUi() {
    return !!(ctx.client && ctx.member && ctx.member.role === 'admin' && ctx.orgId);
  }

  function setCatalog(items) {
    opds = Array.isArray(items) ? items.filter((item) => item && typeof item.id === 'string' && item.id && typeof item.name === 'string' && item.name) : [];
    window.dispatchEvent(new CustomEvent('satria:opds-loaded', { detail: { opds: opds.map((item) => ({ ...item })) } }));
  }

  function updateVisibility() {
    const card = byId('satriaCloudUserListCard');
    if (!card) return false;
    const authorized = isAuthorizedInUi();
    const organizationChanged = !!(lastFetchedOrg && ctx.orgId && lastFetchedOrg !== ctx.orgId);
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

  // Stage 5A: erase admin-only DOM and caches on session or organization change.
  // Never preserve an old roster after an admin signs out or another account signs in.
  function clearAccountSession(){
    sessionEpoch += 1;
    page = 1;
    cachedPayload = null;
    lastFetchedAt = 0;
    lastFetchedOrg = '';
    loadingPromise = null;
    busy = false;
    editingUser = null;
    editingYearUser = null;
    opds = [];
    byId('satriaAdminUsersRows')?.replaceChildren();
    const card=byId('satriaCloudUserListCard');
    if(card)card.style.display='none';
    for(const id of ['satriaEditUserOpdModal','satriaEditUserYearModal','satriaCreateUserModal']){
      const modal=byId(id);if(modal)modal.hidden=true;
    }
    const createForm=byId('satriaCreateUserForm');if(createForm)createForm.reset();
    const pass=byId('satriaNewUserPassword'),confirm=byId('satriaNewUserPasswordConfirm');
    if(pass)pass.value='';if(confirm)confirm.value='';
    window.dispatchEvent(new CustomEvent('satria:opds-loaded',{detail:{opds:[]}}));
    setStatus('Daftar pengguna dikosongkan karena sesi berubah.','');
  }
  window.addEventListener('satria:cloud-session-reset',clearAccountSession);

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
      addCell(row, user.display_name || user.email || ('Pengguna ' + String(user.id || '').slice(0, 8)));
      addCell(row, user.email || '—');
      addCell(row, user.account_type === 'ppkom' && user.role === 'operator' ? 'PPKom' : (({ admin: 'Admin', operator: 'Operator', viewer: 'Viewer' })[user.role] || user.role || '—'));

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
      const years = Array.isArray(user.year_ids) ? user.year_ids.map(Number).filter(Number.isInteger).sort((a,b) => a-b) : [];
      opdCell.textContent = `${opdLabel}\nTA: ${years.length ? years.join(', ') : (user.role === 'admin' ? 'Semua tahun (admin)' : 'Belum ditetapkan')}`;
      opdCell.style.whiteSpace = 'pre-line';
      opdCell.style.minWidth = '220px';

      addCell(row, user.active ? 'Aktif' : 'Nonaktif');
      addCell(row, dateLabel(user.membership_created_at));
      const actionCell = document.createElement('td');
      if (user.role === 'operator' || user.role === 'viewer') {
        const opdButton = document.createElement('button');
        opdButton.type = 'button';
        opdButton.textContent = (Array.isArray(user.opd_ids) && user.opd_ids.length) ? 'Ubah OPD' : 'Atur OPD';
        opdButton.dataset.satriaEditOpd = user.id;
        opdButton.disabled = !user.active;
        opdButton.title = !user.active ? 'Akun nonaktif; aktifkan membership lebih dahulu.' : (!opds.length ? 'Katalog OPD belum tersedia; buka untuk melihat petunjuk.' : 'Atur OPD yang dapat diakses user ini.');
        actionCell.appendChild(opdButton);
        const yearButton = document.createElement('button');
        yearButton.type = 'button';
        yearButton.textContent = (years.length ? 'Ubah TA' : 'Atur TA');
        yearButton.dataset.satriaEditYears = user.id;
        yearButton.disabled = !user.active;
        yearButton.style.marginTop = '5px';
        yearButton.title = !user.active ? 'Akun nonaktif; aktifkan membership lebih dahulu.' : 'Atur tahun anggaran yang boleh diakses user ini.';
        actionCell.appendChild(yearButton);
      } else {
        actionCell.textContent = 'Semua OPD/tahun';
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

  function normalizeCatalogRows(rawOpds, requestedOrg) {
    if (!Array.isArray(rawOpds)) return [];
    const parsed = rawOpds.map((source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
      const idValue = source.id ?? source.opd_id;
      const id = (typeof idValue === 'string' || typeof idValue === 'number') ? String(idValue).trim() : '';
      const shortName = String(source.singkat ?? source.code ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
      const rawName = source.nama ?? source.name ?? shortName;
      const name = typeof rawName === 'string' ? rawName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) : '';
      if (!id || id.length > 128 || !name) return null;
      return { organization_id: requestedOrg, opd_id: id, name, code: shortName || null, active: true };
    }).filter(Boolean);
    const ids = new Set();
    for (const row of parsed) {
      if (ids.has(row.opd_id)) throw new Error('ID OPD duplikat pada snapshot cloud. Perbaiki Data Master sebelum mengatur hak akses.');
      ids.add(row.opd_id);
    }
    const codeCounts = new Map();
    for (const row of parsed) if (row.code) codeCounts.set(row.code, (codeCounts.get(row.code) || 0) + 1);
    return parsed.map((row) => ({ ...row, code: row.code && codeCounts.get(row.code) === 1 ? row.code : null }));
  }

  async function loadCatalogFromCloudSnapshot(requestedOrg) {
    if (!ctx.client || !requestedOrg) return { opds: [], note: 'Sesi Supabase belum aktif.' };
    let snapshot;
    const { data: snapshotRow, error: snapshotError } = await ctx.client
      .from('satria_state').select('payload').eq('organization_id', requestedOrg).maybeSingle();
    if (snapshotError) {
      return { opds: [], note: 'Snapshot cloud tidak dapat dibaca. Periksa RLS dan tabel satria_state: ' + snapshotError.message };
    }
    snapshot = snapshotRow?.payload;
    const rawOpds = snapshot && typeof snapshot === 'object' ? snapshot.opd : null;
    if (Array.isArray(rawOpds) && rawOpds.length) {
      let normalized;
      try { normalized = normalizeCatalogRows(rawOpds, requestedOrg); }
      catch (error) { return { opds: [], note: error instanceof Error ? error.message : 'Data OPD snapshot tidak valid.' }; }
      if (!normalized.length) return { opds: [], note: 'Snapshot cloud memiliki data OPD, tetapi tidak ada baris dengan ID dan nama yang valid.' };

      // Keep the canonical catalog derived from the organization's current cloud snapshot.
      // This request is executed with the logged-in admin JWT and is protected by RLS.
      const activeIds = new Set(normalized.map((row) => row.opd_id));
      const { data: existing, error: existingError } = await ctx.client
        .from('satria_opds').select('opd_id,active').eq('organization_id', requestedOrg);
      if (existingError) {
        return { opds: [], note: 'Tabel katalog OPD belum siap. Terapkan migrasi assignment OPD: ' + existingError.message };
      }
      for (const old of existing || []) {
        if (old.active && !activeIds.has(old.opd_id)) {
          const { error: deactivateError } = await ctx.client.from('satria_opds')
            .update({ active: false, code: null }).eq('organization_id', requestedOrg).eq('opd_id', old.opd_id);
          if (deactivateError) return { opds: [], note: 'OPD lama tidak dapat dinonaktifkan: ' + deactivateError.message };
        }
      }
      const { error: upsertError } = await ctx.client.from('satria_opds')
        .upsert(normalized, { onConflict: 'organization_id,opd_id' });
      if (upsertError) {
        return { opds: [], note: 'Sinkronisasi master OPD gagal. Pastikan migrasi satria_opds sudah diterapkan: ' + upsertError.message };
      }
    }

    const { data: catalog, error: catalogError } = await ctx.client.from('satria_opds')
      .select('opd_id,name,code').eq('organization_id', requestedOrg).eq('active', true).order('name', { ascending: true });
    if (catalogError) return { opds: [], note: 'Katalog OPD tidak dapat dibaca. Jalankan migrasi OPD terbaru: ' + catalogError.message };
    const opds = (catalog || []).map((item) => ({ id: String(item.opd_id), name: item.name, code: item.code || null }));
    if (!opds.length) {
      const hasSnapshotOpds = Array.isArray(rawOpds) && rawOpds.length > 0;
      return { opds, note: hasSnapshotOpds
        ? 'Data master OPD ada, tetapi katalog assignment belum berhasil dibuat. Periksa migrasi satria_opds dan policy admin.'
        : 'Snapshot cloud belum berisi master OPD. Buka Data Master, pastikan OPD tersimpan, lalu gunakan Kirim snapshot lokal sebagai admin. Setelah itu klik Muat ulang.' };
    }
    return { opds, note: '' };
  }

  async function loadUsersDirectlyFromMemberships(requestedOrg) {
    // Compatibility path for an older admin-list-users deployment. RLS still limits
    // this query to the current active admin; emails/names are read only from the
    // profile columns added by the companion migration, never from arbitrary input.
    const { data: rows, error: rowsError, count } = await ctx.client.from('satria_memberships')
      .select('user_id,role,active,created_at,login_email,display_name', { count: 'exact' })
      .eq('organization_id', requestedOrg)
      .order('created_at', { ascending: false })
      .order('user_id', { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (rowsError) {
      // Permit older schemas to render a limited roster, but keep the diagnostic visible.
      const fallback = await ctx.client.from('satria_memberships')
        .select('user_id,role,active,created_at', { count: 'exact' })
        .eq('organization_id', requestedOrg)
        .order('created_at', { ascending: false })
        .order('user_id', { ascending: true })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (fallback.error) throw new Error('Daftar membership tidak dapat dibaca melalui RLS: ' + fallback.error.message);
      const [catalogResult, yearsResult] = await Promise.all([
        loadCatalogFromCloudSnapshot(requestedOrg),
        ctx.client.from('satria_membership_years').select('user_id,fiscal_year').eq('organization_id', requestedOrg)
          .in('user_id', (fallback.data || []).map((row) => row.user_id)),
      ]);
      const yearsByUser = new Map();
      if (!yearsResult.error) for (const row of yearsResult.data || []) {
        const values = yearsByUser.get(row.user_id) || [];
        values.push(Number(row.fiscal_year)); yearsByUser.set(row.user_id, values);
      }
      const users = (fallback.data || []).map((row) => ({
        id: row.user_id,
        email: '',
        display_name: 'Pengguna ' + String(row.user_id).slice(0, 8),
        role: row.role,
        active: row.active === true,
        membership_created_at: row.created_at,
        opd_ids: [], opd_names: [], year_ids: (yearsByUser.get(row.user_id) || []).sort((a,b) => a-b),
      }));
      return { ok: true, organization_id: requestedOrg, page, page_size: PAGE_SIZE, total: fallback.count || 0, users, opds: catalogResult.opds, catalog_note: catalogResult.note, profile_note: 'Kolom profil login belum tersedia; terapkan migrasi 20261024053100_satria_catalog_and_assignment_repair.sql untuk menampilkan nama/email.' };
    }

    const userIds = (rows || []).map((row) => row.user_id);
    const [assignmentResult, yearsResult, catalogResult] = await Promise.all([
      userIds.length ? ctx.client.from('satria_membership_opds').select('user_id,opd_id').eq('organization_id', requestedOrg).in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length ? ctx.client.from('satria_membership_years').select('user_id,fiscal_year').eq('organization_id', requestedOrg).in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      loadCatalogFromCloudSnapshot(requestedOrg),
    ]);
    const assignmentNote = assignmentResult.error
      ? 'Assignment OPD belum dapat dibaca. Terapkan migrasi satria_membership_opds: ' + assignmentResult.error.message
      : '';
    const yearNote = yearsResult.error
      ? 'Assignment tahun belum dapat dibaca. Terapkan migrasi satria_membership_years: ' + yearsResult.error.message
      : '';
    const yearsByUser = new Map();
    for (const assignment of yearsResult.data || []) {
      const values = yearsByUser.get(assignment.user_id) || [];
      values.push(Number(assignment.fiscal_year));
      yearsByUser.set(assignment.user_id, values);
    }
    const opds = catalogResult.opds;
    const opdNameById = new Map(opds.map((item) => [item.id, item.name]));
    const idsByUser = new Map();
    for (const assignment of assignmentResult.data || []) {
      const ids = idsByUser.get(assignment.user_id) || [];
      ids.push(String(assignment.opd_id));
      idsByUser.set(assignment.user_id, ids);
    }
    const users = (rows || []).map((row) => {
      const ids = (idsByUser.get(row.user_id) || []).sort();
      const email = typeof row.login_email === 'string' ? row.login_email : '';
      return {
        id: row.user_id,
        email,
        display_name: row.display_name || email || ('Pengguna ' + String(row.user_id).slice(0, 8)),
        role: row.role,
        active: row.active === true,
        membership_created_at: row.created_at,
        opd_ids: ids,
        opd_names: ids.map((id) => opdNameById.get(id)).filter(Boolean),
        year_ids: (yearsByUser.get(row.user_id) || []).sort((a,b) => a-b),
      };
    });
    return {
      ok: true, organization_id: requestedOrg, page, page_size: PAGE_SIZE,
      total: count || 0, users, opds,
      catalog_note: catalogResult.note,
      assignment_note: [assignmentNote, yearNote].filter(Boolean).join(' '),
      profile_note: '', 
    };
  }

  async function syncLocalOpdCatalog() {
    if (!isAuthorizedInUi()) {
      setStatus('Login admin aktif diperlukan untuk sinkronisasi master OPD.', 'error');
      return;
    }
    const localRows = Array.isArray(S?.opd) ? S.opd : [];
    if (!localRows.length) {
      assignmentMessage('Data Master lokal belum memiliki OPD. Tambahkan OPD terlebih dahulu melalui menu Data Master.', 'error');
      setStatus('Tidak ada OPD pada Data Master lokal untuk disinkronkan.', 'error');
      return;
    }
    const catalogRows = localRows.map((row) => ({
      id: row?.id,
      nama: row?.nama,
      singkat: row?.singkat,
      alamat: row?.alamat,
      kontak: row?.kontak,
      tempat: row?.tempat,
    }));
    const invalidCount = catalogRows.filter((row) => row.id == null || !String(row.id).trim() || typeof row.nama !== 'string' || !row.nama.trim()).length;
    if (invalidCount) {
      setStatus(`Sinkronisasi dibatalkan: ${invalidCount} baris OPD tidak memiliki ID/nama valid. Perbaiki Data Master terlebih dahulu.`, 'error');
      return;
    }
    if (!confirm(`Sinkronkan ${catalogRows.length} OPD dari Data Master lokal ke Supabase? Tindakan ini hanya memperbarui master OPD di snapshot cloud dan katalog assignment; paket, dokumen, dan bagian snapshot lain tidak diganti. Versi cloud harus sama dengan versi terakhir yang dimuat.`)) return;

    const buttons = Array.from(document.querySelectorAll('[data-satria-sync-local-opds]'));
    buttons.forEach((button) => { button.disabled = true; });
    setStatus('Menyinkronkan master OPD ke cloud dengan pemeriksaan versi…');
    try {
      const { data, error } = await ctx.client.functions.invoke('admin-list-users', {
        body: {
          action: 'sync_local_catalog',
          organization_id: ctx.orgId,
          expected_version: version,
          opds: catalogRows,
        },
      });
      if (error) throw new Error(await readableError(error, 'Sinkronisasi master OPD gagal. Deploy ulang Edge Function admin-list-users dari paket terbaru.'));
      if (!data?.ok || !Array.isArray(data.opds) || !data.catalog_sync?.synced) {
        throw new Error('Edge Function belum mendukung sinkronisasi master OPD. Deploy ulang supabase/functions/admin-list-users dari ZIP terbaru.');
      }
      if (Number.isInteger(Number(data.snapshot_version))) version = Number(data.snapshot_version);
      setCatalog(data.opds);
      cachedPayload = null;
      lastFetchedAt = 0;
      const refreshed = await loadUsers(true);
      if (!refreshed || !Array.isArray(refreshed.opds) || !refreshed.opds.length) {
        throw new Error('Snapshot OPD telah dikirim, tetapi katalog belum dapat dimuat. Periksa migrasi 20261024052900 dan deploy ulang admin-list-users dari paket terbaru.');
      }
      const total = data.catalog_sync.count || data.opds.length;
      setStatus(`Master OPD berhasil disinkronkan (${total} OPD). Data paket/dokumen dan bagian snapshot lainnya tidak diganti. Versi cloud ${version}.`, 'ok');
      const createMessage = byId('satriaCreateUserMessage');
      if (createMessage && byId('satriaCreateUserModal') && !byId('satriaCreateUserModal').hidden) { createMessage.textContent = `Katalog OPD berhasil disinkronkan (${total} OPD). Pilih OPD untuk melanjutkan.`; createMessage.dataset.kind = 'ok'; }
      if (byId('satriaEditUserOpdModal') && !byId('satriaEditUserOpdModal').hidden && editingUser) openAssignmentModal(editingUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sinkronisasi master OPD gagal.';
      assignmentMessage(message, 'error');
      const createMessage = byId('satriaCreateUserMessage');
      if (createMessage && byId('satriaCreateUserModal') && !byId('satriaCreateUserModal').hidden) { createMessage.textContent = message; createMessage.dataset.kind = 'error'; }
      setStatus(message, 'error');
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  async function loadUsers(force = false) {
    if (!updateVisibility()) return null;
    const requestedOrg = ctx.orgId;
    const requestedEpoch = sessionEpoch;
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
      let deploymentNote = '';
      try {
        let payload = null;
        try {
          const { data, error } = await ctx.client.functions.invoke('admin-list-users', {
            body: { organization_id: requestedOrg, page, page_size: PAGE_SIZE },
          });
          if (error) throw new Error(await readableError(error, 'Daftar pengguna dan OPD tidak dapat dimuat.'));
          if (data?.ok === true && Array.isArray(data.users) && Array.isArray(data.opds)) {
            payload = data;
          } else {
            deploymentNote = 'Edge Function admin-list-users masih mengirim format respons lama. Daftar dicoba dimuat melalui fallback RLS; deploy ulang fungsi dari paket perbaikan.';
          }
        } catch (functionError) {
          deploymentNote = (functionError instanceof Error ? functionError.message : 'Edge Function admin-list-users tidak dapat dipanggil.') + ' Dicoba jalur fallback RLS.';
        }

        if (requestedEpoch !== sessionEpoch || requestedOrg !== ctx.orgId || !isAuthorizedInUi()) return null;
        if (!payload) payload = await loadUsersDirectlyFromMemberships(requestedOrg);
        else if (!payload.opds.length) {
          // Older snapshot may not yet have been synced into the normalized catalog.
          const catalogResult = await loadCatalogFromCloudSnapshot(requestedOrg);
          if (catalogResult.opds.length) payload = { ...payload, opds: catalogResult.opds };
          else payload = { ...payload, catalog_note: catalogResult.note };
        }
        if (requestedEpoch !== sessionEpoch || requestedOrg !== ctx.orgId || !isAuthorizedInUi()) return null;

        cachedPayload = payload;
        lastFetchedAt = Date.now();
        lastFetchedOrg = requestedOrg;
        setCatalog(payload.opds);
        renderRows(payload.users);
        renderPagination(payload);
        const catalogNote = payload.catalog_note || '';
        const profileNote = payload.profile_note || '';
        const assignmentNote = payload.assignment_note || '';
        if (deploymentNote) {
          setStatus(`Roster dimuat dengan fallback yang dibatasi RLS. ${deploymentNote}${opds.length ? ` Katalog OPD aktif: ${opds.length}.` : ` ${catalogNote || 'Katalog OPD belum tersedia.'}`} ${profileNote} ${assignmentNote}`.trim(), 'error');
        } else if (!opds.length || assignmentNote) {
          setStatus(`Daftar pengguna dimuat. ${!opds.length ? (catalogNote || 'Katalog OPD aktif belum tersedia.') : `Katalog OPD aktif: ${opds.length}.`} ${profileNote} ${assignmentNote}`.trim(), 'error');
        } else {
          setStatus(`Daftar pengguna berhasil dimuat. Katalog OPD aktif: ${opds.length}.${profileNote ? ' ' + profileNote : ''}`, profileNote ? 'error' : 'ok');
        }
        return payload;
      } catch (error) {
        if(requestedEpoch !== sessionEpoch)return null;
        const safeMessage = error instanceof Error ? error.message : 'Daftar pengguna tidak dapat dimuat.';
        setCatalog([]);
        renderRows([]);
        setStatus(`${safeMessage} Pastikan migrasi 20261024053100_satria_catalog_and_assignment_repair.sql telah diterapkan dan akun admin aktif.`, 'error');
        return null;
      } finally {
        if (requestedEpoch !== sessionEpoch) return;
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
      

/* Shared modal and application CSS loaded from satria-shared-modal-ui.css. */
</style>
      <section class="satria-edit-opd-dialog" role="dialog" aria-modal="true" aria-labelledby="satriaEditUserOpdTitle">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h2 id="satriaEditUserOpdTitle">Atur OPD Pengguna</h2><p id="satriaEditUserOpdName"></p></div><button type="button" data-satria-edit-opd-close>Tutup</button></div>
        <p>PPKom hanya dapat ditugaskan pada satu OPD. Perubahan OPD dan tahun anggaran hanya dapat dilakukan Admin dan diverifikasi oleh server.</p>
        <div id="satriaEditUserOpdChoices" class="satria-edit-opd-choices"></div>
        <p id="satriaEditUserOpdMessage" role="status" aria-live="polite"></p>
        <div class="satria-edit-opd-actions"><button type="button" data-satria-edit-opd-close>Batal</button><button id="satriaEditUserOpdSave" class="primary" type="button">Simpan assignment</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || (event.target instanceof Element && event.target.closest('[data-satria-edit-opd-close]'))) closeAssignmentModal();
    });
    byId('satriaEditUserOpdSave').addEventListener('click', () => { void saveAssignment(); });
    byId('satriaEditUserOpdChoices').addEventListener('change', event => {
      if (editingUser?.account_type !== 'ppkom' || !event.target?.matches?.('input[name="satria_edit_opd_ids"]') || !event.target.checked) return;
      byId('satriaEditUserOpdChoices').querySelectorAll('input[name="satria_edit_opd_ids"]').forEach(input => { if (input !== event.target) input.checked=false; });
    });
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
    if (!user || !['operator', 'viewer'].includes(user.role) || !user.active) return;
    if (!isAuthorizedInUi()) {
      setStatus('Sesi admin aktif diperlukan untuk mengubah assignment OPD.', 'error');
      return;
    }
    const modal = ensureAssignmentModal();
    editingUser = user;
    byId('satriaEditUserOpdName').textContent = `${user.account_type === 'ppkom' ? 'PPKom · ' : ''}${user.display_name || user.email} · ${user.email || ''}`;
    const choices = byId('satriaEditUserOpdChoices');
    choices.replaceChildren();
    const selected = new Set(Array.isArray(user.opd_ids) ? user.opd_ids : []);
    if (!opds.length) {
      const empty = document.createElement('p');
      empty.style.gridColumn = '1 / -1';
      empty.textContent = `Katalog cloud kosong, sementara status aplikasi menunjukkan perubahan lokal belum di-backup. Jika Data Master sudah memiliki ${Array.isArray(S?.opd) ? S.opd.length : 0} OPD, sinkronkan master OPD saja di bawah. Paket, dokumen, dan bagian snapshot lainnya tidak akan ditimpa.`;
      choices.appendChild(empty);
      const syncButton = document.createElement('button');
      syncButton.type = 'button';
      syncButton.dataset.satriaSyncLocalOpds = 'true';
      syncButton.textContent = 'Sinkronkan master OPD dari Data Master';
      syncButton.style.gridColumn = '1 / -1';
      syncButton.style.justifySelf = 'start';
      choices.appendChild(syncButton);
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
    if (!opdIds.length || opdIds.length > 100 || (editingUser?.account_type === 'ppkom' && opdIds.length !== 1)) {
      assignmentMessage(editingUser?.account_type === 'ppkom' ? 'Akun PPKom hanya boleh memiliki satu OPD.' : 'Pilih minimal satu dan maksimal 100 OPD sebelum menyimpan.', 'error');
      return;
    }
    const saveButton = byId('satriaEditUserOpdSave');
    assignmentBusy = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan…';
    assignmentMessage('Memvalidasi dan menyimpan assignment OPD…');
    try {
      const requestedOrg = ctx.orgId;
      // New RPC binds the actor to auth.uid() and performs replacement + audit atomically.
      const { data: savedCount, error: rpcError } = await ctx.client.rpc('satria_admin_assign_my_membership_opds', {
        p_organization_id: requestedOrg,
        p_target_user_id: editingUser.id,
        p_opd_ids: opdIds,
      });
      if (rpcError) {
        const message = await readableError(rpcError, 'Assignment OPD gagal disimpan.');
        if (/function .*satria_admin_assign_my_membership_opds.*not found|could not find the function|PGRST202|42883/i.test(message + ' ' + String(rpcError.code || ''))) {
          throw new Error('RPC assignment terbaru belum tersedia. Terapkan migrasi 20261024053100_satria_catalog_and_assignment_repair.sql lalu Muat ulang.');
        }
        throw new Error(message);
      }
      if (!Number.isInteger(Number(savedCount)) || Number(savedCount) !== opdIds.length) throw new Error('Database tidak mengonfirmasi jumlah OPD yang tersimpan. Muat ulang untuk memeriksa hasil.');
      if (requestedOrg !== ctx.orgId || !isAuthorizedInUi()) throw new Error('Organisasi atau sesi berubah selama proses penyimpanan. Muat ulang daftar.');
      assignmentMessage(`Assignment tersimpan: ${Number(savedCount)} OPD.`, 'ok');
      await loadUsers(true);
      assignmentBusy = false;
      setStatus('Assignment OPD operator berhasil diperbarui dan dicatat dalam audit trail.', 'ok');
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

  let editingYearUser = null;
  let yearAssignmentBusy = false;

  function ensureYearAssignmentModal() {
    let modal = byId('satriaEditUserYearModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'satriaEditUserYearModal';
    modal.hidden = true;
    modal.innerHTML = `
      <style>
        #satriaEditUserYearModal{position:fixed;inset:0;z-index:10026;background:rgba(15,23,42,.64);display:grid;place-items:center;padding:18px}
        #satriaEditUserYearModal[hidden]{display:none}
        .satria-edit-year-dialog{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #dbe3ea;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);padding:22px;color:#17212b;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
        .satria-edit-year-dialog h2{margin:0;font-size:20px}.satria-edit-year-dialog p{color:#52616f}
        .satria-edit-year-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 12px;max-height:48vh;overflow:auto;border:1px solid #cbd5df;border-radius:10px;padding:12px}
        .satria-edit-year-choice{display:flex;gap:8px;align-items:flex-start;cursor:pointer}.satria-edit-year-choice input{margin-top:4px}
        .satria-edit-year-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}
        .satria-edit-year-actions button{border:1px solid #cbd5df;border-radius:9px;padding:9px 14px;font:inherit;font-weight:650;cursor:pointer;background:#fff;color:#1f2937}
        .satria-edit-year-actions button.primary{background:#0f766e;color:#fff;border-color:#0f766e}
        .satria-edit-year-actions button:disabled{opacity:.55;cursor:not-allowed}
        #satriaEditUserYearMessage{min-height:20px;white-space:pre-wrap;font-size:13px}#satriaEditUserYearMessage[data-kind=error]{color:#b42318}#satriaEditUserYearMessage[data-kind=ok]{color:#067647}
      

/* Shared modal and application CSS loaded from satria-shared-modal-ui.css. */

/* ===== RINGKASAN UTAMA & LAPORAN - D3 LAZY LOAD ===== */
.chart-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px;margin:16px 0}
.chart-card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px;box-shadow:var(--shadow-sm);position:relative;overflow:hidden;content-visibility:auto;contain-intrinsic-size:0 320px;min-height:320px}
.chart-card.wide{grid-column:span 12}
.chart-card.half{grid-column:span 6}
.chart-card.third{grid-column:span 4}
.chart-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-soft);opacity:.6}
.kh-accent{height:3px;border-radius:3px;margin:-16px -16px 14px -16px}
.chart-title{font-size:13px;font-weight:800;letter-spacing:-.01em;display:flex;align-items:center;gap:8px;margin-bottom:12px}
.chart-title .badge{font-size:10px;padding:3px 8px;border-radius:9999px;font-weight:700}
.d3-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:11px;font-weight:600;color:var(--mut)}
.d3-legend-item{display:flex;align-items:center;gap:6px}
.d3-legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.d3-tooltip{position:absolute;pointer-events:none;background:rgba(15,23,42,.92);color:#fff;padding:8px 10px;border-radius:8px;font-size:11px;font-weight:600;z-index:1000;opacity:0;transition:opacity .18s;max-width:260px;backdrop-filter:blur(8px)}
.chart-skeleton{display:grid;place-items:center;height:280px;background:linear-gradient(90deg, var(--bg-2) 25%, var(--bg) 50%, var(--bg-2) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:12px;color:var(--mut);font-size:12px;font-weight:600}
.chart-skeleton .spinner{width:28px;height:28px;border:3px solid var(--bd);border-top-color:var(--acc);border-radius:50%;animation:spin 1s linear infinite;margin-bottom:10px}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.satria-command-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:20px;box-shadow:var(--shadow-sm);margin-bottom:16px;position:relative;overflow:hidden}
.satria-command-header::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-kh)}
.satria-command-badge{display:inline-flex;align-items:center;gap:6px;background:var(--acc-soft);border:1px solid var(--bd);color:var(--acc);font-size:10px;font-weight:800;letter-spacing:.07em;padding:4px 10px;border-radius:9999px;margin-bottom:10px}
.satria-command-badge .dot{width:6px;height:6px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 4px var(--acc-ring);animation:pulseDot 2s infinite}
.satria-command-title h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em}
.satria-command-title p{margin:6px 0 0;color:var(--mut);font-size:13px}
.satria-command-meta{display:flex;gap:12px}
.satria-meta-card{background:var(--bg-2);border:1px solid var(--bd);border-radius:12px;padding:12px 14px;min-width:90px;text-align:center}
.satria-meta-card span{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-bottom:4px}
.satria-meta-card b{font-size:18px;font-weight:800;color:var(--ink)}
.satria-overview .satria-metrics-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:16px;padding-top:16px;border-top:1px solid var(--bd)}
.satria-overview .satria-metrics-row > div{background:var(--bg-2);border:1px solid var(--bd);border-radius:12px;padding:12px}
.satria-overview .satria-metrics-row span{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px}
.satria-overview .satria-metrics-row b{font-size:16px;font-weight:800;display:block;color:var(--ink)}
.satria-overview .satria-metrics-row small{font-size:11px;color:var(--mut);margin-top:2px;display:block}
@media(max-width:768px){
  .chart-grid{grid-template-columns:1fr;gap:12px}
  .chart-card.wide, .chart-card.half, .chart-card.third{grid-column:span 1}
  .chart-card{min-height:260px}
  .satria-command-header{flex-direction:column;padding:16px;border-radius:16px}
  .satria-command-meta{width:100%;justify-content:space-between}
  .satria-meta-card{flex:1;min-width:0}
  .satria-overview .satria-metrics-row{grid-template-columns:1fr 1fr;gap:10px}
}

</style>
      <section class="satria-edit-year-dialog" role="dialog" aria-modal="true" aria-labelledby="satriaEditUserYearTitle">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h2 id="satriaEditUserYearTitle">Atur Tahun Anggaran</h2><p id="satriaEditUserYearName"></p></div><button type="button" data-satria-edit-year-close>Tutup</button></div>
        <p>Pilih tahun anggaran yang boleh diakses. Akses data ditentukan oleh assignment tahun dan OPD secara bersamaan.</p>
        <div id="satriaEditUserYearChoices" class="satria-edit-year-choices"></div>
        <p id="satriaEditUserYearMessage" role="status" aria-live="polite"></p>
        <div class="satria-edit-year-actions"><button type="button" data-satria-edit-year-close>Batal</button><button id="satriaEditUserYearSave" class="primary" type="button">Simpan tahun</button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || (event.target instanceof Element && event.target.closest('[data-satria-edit-year-close]'))) closeYearAssignmentModal();
    });
    byId('satriaEditUserYearSave').addEventListener('click', () => { void saveYearAssignment(); });
    return modal;
  }

  function yearAssignmentMessage(message, kind = '') {
    const element = byId('satriaEditUserYearMessage');
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind;
  }

  function closeYearAssignmentModal() {
    if (yearAssignmentBusy) return;
    const modal = byId('satriaEditUserYearModal');
    if (modal) modal.hidden = true;
    editingYearUser = null;
    yearAssignmentMessage('');
  }

  function openYearAssignmentModal(user) {
    if (!user || !['operator','viewer'].includes(user.role) || !user.active) return;
    if (!isAuthorizedInUi()) {
      setStatus('Sesi admin aktif diperlukan untuk mengubah assignment tahun.', 'error');
      return;
    }
    const modal = ensureYearAssignmentModal();
    editingYearUser = user;
    byId('satriaEditUserYearName').textContent = `${user.display_name || user.email} · ${user.email || ''}`;
    const choices = byId('satriaEditUserYearChoices');
    choices.replaceChildren();
    const assigned = new Set((Array.isArray(user.year_ids) ? user.year_ids : []).map(Number));
    const years = [...new Set([...(Array.isArray(S?.tahun) ? S.tahun : []), ...assigned])]
      .map(Number).filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2200).sort((a,b)=>a-b);
    if (!years.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Belum ada daftar tahun. Admin harus memuat snapshot cloud yang memuat S.tahun terlebih dahulu.';
      choices.appendChild(empty);
    } else {
      for (const year of years) {
        const label = document.createElement('label');
        label.className = 'satria-edit-year-choice';
        const input = document.createElement('input');
        input.type = 'checkbox'; input.name = 'satria_edit_year_ids'; input.value = String(year); input.checked = assigned.has(year);
        const text = document.createElement('span'); text.textContent = `Tahun Anggaran ${year}`;
        label.append(input, text); choices.appendChild(label);
      }
    }
    yearAssignmentMessage('');
    byId('satriaEditUserYearSave').disabled = !years.length;
    modal.hidden = false;
    byId('satriaEditUserYearSave').focus();
  }

  async function saveYearAssignment() {
    if (yearAssignmentBusy) return;
    if (!editingYearUser || !isAuthorizedInUi()) {
      yearAssignmentMessage('Sesi admin tidak aktif. Masuk kembali dan ulangi.', 'error');
      return;
    }
    const years = Array.from(document.querySelectorAll('#satriaEditUserYearChoices input[name="satria_edit_year_ids"]:checked'))
      .map((input) => Number(input.value));
    if (!years.length || years.length > 40 || years.some((year) => !Number.isInteger(year) || year < 2000 || year > 2200)) {
      yearAssignmentMessage('Pilih minimal satu dan maksimal 40 tahun anggaran valid.', 'error');
      return;
    }
    const saveButton = byId('satriaEditUserYearSave');
    yearAssignmentBusy = true; saveButton.disabled = true; saveButton.textContent = 'Menyimpan…';
    yearAssignmentMessage('Memvalidasi dan menyimpan assignment tahun…');
    try {
      const requestedOrg = ctx.orgId;
      const { data: savedCount, error } = await ctx.client.rpc('satria_admin_assign_my_membership_years', {
        p_organization_id: requestedOrg, p_target_user_id: editingYearUser.id, p_years: years,
      });
      if (error) {
        const message = await readableError(error, 'Assignment tahun gagal disimpan.');
        if (/satria_admin_assign_my_membership_years.*not found|could not find the function|PGRST202|42883/i.test(message + ' ' + String(error.code || ''))) {
          throw new Error('RPC assignment tahun belum tersedia. Terapkan migrasi 20261024053200_satria_scoped_access_and_years.sql lalu muat ulang.');
        }
        throw new Error(message);
      }
      if (!Number.isInteger(Number(savedCount)) || Number(savedCount) !== years.length) throw new Error('Database tidak mengonfirmasi jumlah tahun yang tersimpan. Muat ulang untuk memeriksa hasil.');
      if (requestedOrg !== ctx.orgId || !isAuthorizedInUi()) throw new Error('Organisasi atau sesi berubah selama proses penyimpanan. Muat ulang daftar.');
      yearAssignmentMessage(`Assignment tahun tersimpan: ${years.join(', ')}.`, 'ok');
      await loadUsers(true);
      setStatus('Assignment tahun berhasil diperbarui dan dicatat dalam audit trail.', 'ok');
      yearAssignmentBusy = false;
      closeYearAssignmentModal();
    } catch (error) {
      yearAssignmentMessage(error instanceof Error ? error.message : 'Assignment tahun gagal disimpan.', 'error');
    } finally {
      yearAssignmentBusy = false;
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Simpan tahun'; }
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
    } else if (target.closest('[data-satria-sync-local-opds]')) {
      event.preventDefault();
      void syncLocalOpdCatalog();
    } else {
      const yearButton = target.closest('[data-satria-edit-years]');
      if (yearButton) {
        event.preventDefault();
        const user = (cachedPayload?.users || []).find((item) => item.id === yearButton.dataset.satriaEditYears);
        if (user) openYearAssignmentModal(user);
        return;
      }
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
  window.SATRIA_ADMIN_USERS = Object.freeze({ version: '2026-10-24-opd-local-catalog-sync-v3', getOpds: () => opds.map((item) => ({ ...item })), refresh: () => loadUsers(true) });

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
  };
})(typeof window!=='undefined'?window:null);
