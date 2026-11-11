/* SATRIA Tahap 5B — form pembuatan akun Supabase.
 * Event/UI module installed exactly once by the cloud bridge; session is always read live.
 */
(function(root){
  'use strict';
  if(!root)return;
  let installed=false;
  root.SATRIA_INSTALL_CLOUD_ADMIN_CREATE=function(getContext){
    if(installed)return;
    if(typeof getContext!=='function')throw new Error('Modul cloud memerlukan konteks sesi.');
    const ctx=Object.freeze({
      get client(){return getContext().client},
      get member(){return getContext().member},
      get orgId(){return getContext().orgId}
    });
    installed=true;
(() => {
  if (document.getElementById('satriaCreateUserModal')) return;

  const root = document.createElement('div');
  root.id = 'satriaCreateUserModal';
  root.hidden = true;
  root.innerHTML = `
    <style>
      #satriaCreateUserModal{position:fixed;inset:0;z-index:10020;background:rgba(15,23,42,.64);display:grid;place-items:center;padding:18px}
      #satriaCreateUserModal[hidden]{display:none}
      .satria-user-modal{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #dbe3ea;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);padding:22px;color:#17212b;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
      .satria-user-modal h2{font-size:20px;margin:0 0 4px}.satria-user-modal p{margin:6px 0 14px;color:#52616f}
      .satria-user-modal label{display:block;font-weight:650;margin:12px 0 5px}
      .satria-user-modal input,.satria-user-modal select{width:100%;box-sizing:border-box;border:1px solid #cbd5df;border-radius:9px;padding:10px 11px;font:inherit;background:#fff;color:#17212b}
      .satria-user-modal input:focus,.satria-user-modal select:focus{outline:3px solid rgba(13,148,136,.18);border-color:#0d9488}
      .satria-user-modal .satria-user-note{padding:10px 12px;border-radius:9px;background:#fff7e6;border:1px solid #f3d38b;color:#674d12;font-size:12px}
      .satria-user-modal .satria-user-msg{min-height:20px;margin:10px 0;font-size:13px;color:#334155;white-space:pre-wrap}
      .satria-user-modal .satria-user-msg[data-kind="error"]{color:#b42318}.satria-user-modal .satria-user-msg[data-kind="ok"]{color:#067647}
      .satria-user-modal .satria-user-check{display:flex;gap:9px;align-items:flex-start;font-weight:400;font-size:12px;color:#475569}
      .satria-user-modal .satria-user-check input{width:auto;margin-top:3px}
      .satria-user-modal .satria-password-fieldset{border:1px solid #cbd5df;border-radius:10px;padding:12px;margin:14px 0 8px;min-width:0}
      .satria-user-modal .satria-password-fieldset legend{font-weight:750;padding:0 5px;color:#0f766e}
      .satria-user-modal .satria-password-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
      .satria-user-modal .satria-password-row input{min-width:0}
      .satria-user-modal button.satria-password-toggle{align-self:end;white-space:nowrap;padding:10px 12px;min-height:42px;border-color:#8fb8b4;color:#0f766e;background:#f0fdfa}
      .satria-user-modal .satria-password-fieldset .satria-opd-help{margin:8px 0 0}
      @media(max-width:520px){.satria-user-modal{padding:14px;max-height:94dvh;width:calc(100% - 28px)}.satria-user-modal .satria-password-row{grid-template-columns:minmax(0,1fr) auto;gap:6px}.satria-user-modal button.satria-password-toggle{padding:9px 10px;font-size:12px}}
      .satria-user-modal .satria-opd-fieldset{border:1px solid #cbd5df;border-radius:10px;padding:12px;margin:14px 0 8px}
      .satria-user-modal .satria-opd-fieldset legend{font-weight:700;padding:0 5px}
      .satria-user-modal .satria-opd-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:7px 12px;max-height:220px;overflow:auto;padding:4px}
      .satria-user-modal .satria-opd-choice{display:flex;align-items:flex-start;gap:8px;font-weight:400;margin:0;cursor:pointer}
      .satria-user-modal .satria-opd-choice input{width:auto;flex:0 0 auto;margin:3px 0 0}
      .satria-user-modal .satria-opd-empty,.satria-user-modal .satria-opd-help{font-size:12px;color:#64748b;margin:8px 2px 0}
      .satria-user-modal .satria-user-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}
      .satria-user-modal button{border:1px solid #cbd5df;border-radius:9px;padding:9px 14px;font:inherit;font-weight:650;cursor:pointer;background:#fff;color:#1f2937}
      .satria-user-modal button.primary{background:#0f766e;border-color:#0f766e;color:#fff}
      .satria-user-modal button:disabled{opacity:.6;cursor:not-allowed}
    

/* Shared modal and application CSS loaded from satria-shared-modal-ui.css. */
</style>
    <section class="satria-user-modal" role="dialog" aria-modal="true" aria-labelledby="satriaUserModalTitle">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div><h2 id="satriaUserModalTitle">Tambah akun Operator / PPKom</h2><p>Akun dibuat Admin dengan akses dibatasi OPD dan tahun anggaran di server.</p></div>
        <button type="button" data-satria-user-close aria-label="Tutup modal">Tutup</button>
      </div>
      <div class="satria-user-note">
        Email dummy harus berformat valid dan unik, tetapi tidak perlu menerima email. Tidak ada email konfirmasi yang dikirim. Password awal wajib disampaikan kepada operator melalui saluran terpisah yang aman; pemulihan lewat email tidak tersedia untuk alamat dummy.
      </div>
      <form id="satriaCreateUserForm" autocomplete="off">
        <label for="satriaNewUserName">Nama pengguna / PPKom</label>
        <input id="satriaNewUserName" name="display_name" type="text" minlength="2" maxlength="100" required autocomplete="off">

        <label for="satriaNewUserEmail">Email / username login</label>
        <input id="satriaNewUserEmail" name="email" type="email" maxlength="254" required autocomplete="off" placeholder="operator01@example.com">

        <fieldset class="satria-password-fieldset">
          <legend>Password login (wajib diisi)</legend>
          <label for="satriaNewUserPassword">Password awal (minimal 12 karakter)</label>
          <div class="satria-password-row">
            <input id="satriaNewUserPassword" name="initial_password" type="password" minlength="12" maxlength="128" required autocomplete="new-password" aria-describedby="satriaPasswordHelp">
            <button type="button" class="satria-password-toggle" data-satria-password-toggle="satriaNewUserPassword" aria-pressed="false">Tampilkan</button>
          </div>
          <label for="satriaNewUserPasswordConfirm">Ulangi password awal</label>
          <div class="satria-password-row">
            <input id="satriaNewUserPasswordConfirm" name="password_confirm" type="password" minlength="12" maxlength="128" required autocomplete="new-password">
            <button type="button" class="satria-password-toggle" data-satria-password-toggle="satriaNewUserPasswordConfirm" aria-pressed="false">Tampilkan</button>
          </div>
          <p id="satriaPasswordHelp" class="satria-opd-help">Password tidak disimpan di browser. Sampaikan kepada operator melalui saluran terpisah yang aman.</p>
        </fieldset>

        <label for="satriaNewUserRole">Role</label>
        <select id="satriaNewUserRole" name="role" required>
          <option value="operator" selected>Operator</option>
          <option value="ppkom">PPKom (satu OPD + tahun anggaran tertentu)</option>
          <option value="admin" disabled>Admin (dinonaktifkan oleh kebijakan server)</option>
        </select>

        <p class="satria-opd-help" id="satriaCreateRoleHelp">PPKom dapat melihat dan mengolah data paket/dokumen sesuai OPD dan TA yang ditetapkan. Pengelolaan akun dan pengaturan organisasi tetap hanya untuk Admin.</p>
        <fieldset class="satria-opd-fieldset" id="satriaCreateUserOpdFieldset">
          <legend>OPD yang dapat diakses</legend>
          <div class="satria-opd-choices" id="satriaCreateUserOpdChoices"><p class="satria-opd-empty">Memuat katalog OPD organisasi…</p></div>
          <p class="satria-opd-help">PPKom wajib memilih tepat satu OPD (misalnya Bapperida atau Disporapar). Operator dapat memilih 1–100 OPD. Katalog berasal dari Supabase.</p>
        </fieldset>

        <fieldset class="satria-opd-fieldset" id="satriaCreateUserYearFieldset">
          <legend>Tahun anggaran yang dapat diakses</legend>
          <div class="satria-opd-choices" id="satriaCreateUserYearChoices"><p class="satria-opd-empty">Memuat daftar tahun anggaran…</p></div>
          <p class="satria-opd-help">Pilih minimal satu tahun. Akses data paket ditentukan oleh kombinasi OPD dan tahun, bukan hanya filter tampilan.</p>
        </fieldset>

        <label class="satria-user-check"><input id="satriaPasswordShareConfirm" type="checkbox" required><span>Saya akan menyampaikan password awal secara terpisah dan aman, lalu meminta operator menggantinya setelah login.</span></label>
        <div id="satriaCreateUserMessage" class="satria-user-msg" role="status" aria-live="polite"></div>
        <div class="satria-user-actions">
          <button type="button" data-satria-user-close>Batal</button>
          <button id="satriaCreateUserSubmit" class="primary" type="submit">Buat akun</button>
        </div>
      </form>
    </section>`;
  document.body.appendChild(root);

  const form = root.querySelector('#satriaCreateUserForm');
  const message = root.querySelector('#satriaCreateUserMessage');
  const submit = root.querySelector('#satriaCreateUserSubmit');
  const password = root.querySelector('#satriaNewUserPassword');
  const passwordConfirm = root.querySelector('#satriaNewUserPasswordConfirm');
  const nameInput = root.querySelector('#satriaNewUserName');
  const emailInput = root.querySelector('#satriaNewUserEmail');
  const roleInput = root.querySelector('#satriaNewUserRole');
  const opdChoices = root.querySelector('#satriaCreateUserOpdChoices');
  const yearChoices = root.querySelector('#satriaCreateUserYearChoices');
  roleInput.addEventListener('change', () => {
    if (roleInput.value === 'ppkom') {
      const checked = Array.from(opdChoices.querySelectorAll('input[name="satria_create_opd_ids"]:checked'));
      checked.slice(1).forEach(input => { input.checked = false; });
    }
  });
  opdChoices.addEventListener('change', (event) => {
    if (roleInput.value !== 'ppkom' || !event.target?.matches?.('input[name="satria_create_opd_ids"]') || !event.target.checked) return;
    opdChoices.querySelectorAll('input[name="satria_create_opd_ids"]').forEach(input => { if(input!==event.target) input.checked=false; });
  });
  let availableOpds = [];
  let availableYears = [];
  let busy = false;

  root.querySelectorAll('[data-satria-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = root.querySelector('#' + button.dataset.satriaPasswordToggle);
      if (!input) return;
      const revealing = input.type === 'password';
      input.type = revealing ? 'text' : 'password';
      button.textContent = revealing ? 'Sembunyikan' : 'Tampilkan';
      button.setAttribute('aria-pressed', String(revealing));
    });
  });

  function setMessage(text, kind = '') {
    message.textContent = text;
    message.dataset.kind = kind;
  }

  function clearPasswords() {
    password.value = '';
    passwordConfirm.value = '';
  }

  function renderCreateOpdOptions(items) {
    const selectedBeforeRefresh = new Set(Array.from(opdChoices.querySelectorAll('input[name="satria_create_opd_ids"]:checked')).map((input) => input.value));
    availableOpds = Array.isArray(items) ? items.filter((item) => item && typeof item.id === 'string' && item.id && typeof item.name === 'string' && item.name) : [];
    opdChoices.replaceChildren();
    if (!availableOpds.length) {
      const empty = document.createElement('p');
      empty.className = 'satria-opd-empty';
      empty.textContent = `Katalog cloud kosong. Jika Data Master lokal memiliki ${Array.isArray(S?.opd) ? S.opd.length : 0} OPD, sinkronkan master OPD saja; paket dan dokumen tidak ikut diganti.`;
      opdChoices.appendChild(empty);
      const syncButton = document.createElement('button');
      syncButton.type = 'button';
      syncButton.dataset.satriaSyncLocalOpds = 'true';
      syncButton.textContent = 'Sinkronkan master OPD dari Data Master';
      syncButton.style.marginTop = '8px';
      syncButton.style.maxWidth = '100%';
      opdChoices.appendChild(syncButton);
      return;
    }
    for (const opd of availableOpds) {
      const label = document.createElement('label');
      label.className = 'satria-opd-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'satria_create_opd_ids';
      input.value = opd.id;
      input.checked = selectedBeforeRefresh.has(opd.id);
      input.setAttribute('aria-label', `Izinkan akses ke ${opd.name}`);
      const text = document.createElement('span');
      text.textContent = opd.name + (opd.code ? ` (${opd.code})` : '');
      label.append(input, text);
      opdChoices.appendChild(label);
    }
  }

  function selectedCreateOpds() {
    return Array.from(form.querySelectorAll('input[name="satria_create_opd_ids"]:checked')).map((input) => input.value);
  }

  function renderCreateYearOptions(years, defaults = []) {
    const selectedBeforeRefresh = new Set(Array.from(yearChoices.querySelectorAll('input[name="satria_create_year_ids"]:checked')).map((input) => Number(input.value)));
    const source = Array.isArray(years) ? years : [];
    availableYears = [...new Set(source.map(Number).filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2200))].sort((a,b) => a-b);
    yearChoices.replaceChildren();
    if (!availableYears.length) {
      const empty = document.createElement('p');
      empty.className = 'satria-opd-empty';
      empty.textContent = 'Daftar tahun belum tersedia. Admin harus menarik snapshot cloud terbaru sebelum membuat akun Operator.';
      yearChoices.appendChild(empty);
      return;
    }
    const selected = selectedBeforeRefresh.size ? selectedBeforeRefresh : new Set(defaults.map(Number));
    for (const year of availableYears) {
      const label = document.createElement('label');
      label.className = 'satria-opd-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'satria_create_year_ids';
      input.value = String(year);
      input.checked = selected.has(year);
      input.setAttribute('aria-label', `Izinkan akses Tahun Anggaran ${year}`);
      const text = document.createElement('span');
      text.textContent = `Tahun Anggaran ${year}`;
      label.append(input, text);
      yearChoices.appendChild(label);
    }
  }

  function selectedCreateYears() {
    return Array.from(form.querySelectorAll('input[name="satria_create_year_ids"]:checked')).map((input) => Number(input.value));
  }

  window.addEventListener('satria:opds-loaded', (event) => {
    renderCreateOpdOptions(event.detail?.opds || []);
  });

  function closeModal() {
    if (busy) return;
    root.hidden = true;
    form.reset();
    clearPasswords();
    setMessage('');
  }

  function openModal() {
    if (!ctx.client || !ctx.member) {
      toast('Masuk ke Supabase terlebih dahulu.');
      return;
    }
    if (ctx.member.role !== 'admin') {
      toast('Hanya admin organisasi yang dapat membuat akun.');
      return;
    }
    form.reset();
    clearPasswords();
    roleInput.value = 'operator';
    setMessage('');
    renderCreateOpdOptions(window.SATRIA_ADMIN_USERS?.getOpds?.() || availableOpds);
    const yearSource = Array.isArray(S?.tahun) ? S.tahun : [];
    const currentYear = Number(S?.ui?.tahun);
    renderCreateYearOptions(yearSource, [yearSource.includes(currentYear) ? currentYear : yearSource[0]].filter(Number.isFinite));
    root.hidden = false;
    window.dispatchEvent(new CustomEvent('satria:load-opd-catalog'));
    nameInput.focus();
  }

  async function readableFunctionError(error) {
    const context = error?.context;
    if (context && typeof context.clone === 'function') {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === 'string') return body.error;
      } catch (_) {}
    }
    return 'Gagal membuat akun. Periksa koneksi dan konfigurasi Edge Function.';
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#satriaOpenCreateUser')) {
      event.preventDefault();
      openModal();
      return;
    }
    if (target.closest('[data-satria-user-close]')) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (target === root && !busy) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !root.hidden && !busy) closeModal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!ctx.client || !ctx.member || ctx.member.role !== 'admin' || !ctx.orgId) {
      setMessage('Sesi admin Supabase tidak aktif. Masuk kembali sebagai admin.', 'error');
      return;
    }

    const email = emailInput.value.trim().toLowerCase();
    const displayName = nameInput.value.trim();
    const role = roleInput.value;
    const initialPassword = password.value;
    const confirmPassword = passwordConfirm.value;

    if (initialPassword.length < 12 || initialPassword.length > 128) {
      setMessage('Password awal harus 12–128 karakter.', 'error');
      return;
    }
    if (initialPassword !== confirmPassword) {
      setMessage('Password dan pengulangannya tidak sama.', 'error');
      passwordConfirm.focus();
      return;
    }
    if (!document.querySelector('#satriaPasswordShareConfirm').checked) {
      setMessage('Konfirmasi penyampaian password awal secara aman terlebih dahulu.', 'error');
      return;
    }
    const opdIds = selectedCreateOpds();
    const yearIds = selectedCreateYears();
    if (!availableOpds.length) {
      setMessage('Katalog OPD belum tersedia. Muat ulang daftar pengguna dan pastikan snapshot OPD sudah ada di Supabase.', 'error');
      window.dispatchEvent(new CustomEvent('satria:load-opd-catalog'));
      return;
    }
    if (!opdIds.length || opdIds.length > 100 || (role === 'ppkom' && opdIds.length !== 1)) {
      setMessage(role === 'ppkom' ? 'Akun PPKom wajib memilih tepat satu OPD.' : 'Pilih minimal satu dan maksimal 100 OPD untuk Operator.', 'error');
      root.querySelector('#satriaCreateUserOpdFieldset')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!yearIds.length || yearIds.length > 40 || yearIds.some((year) => !Number.isInteger(year) || year < 2000 || year > 2200)) {
      setMessage('Pilih minimal satu dan maksimal 40 tahun anggaran yang valid.', 'error');
      root.querySelector('#satriaCreateUserYearFieldset')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    busy = true;
    submit.disabled = true;
    submit.textContent = 'Membuat akun…';
    setMessage('Memverifikasi sesi admin dan membuat akun…');

    try {
      const { data: authData, error: authError } = await ctx.client.auth.getUser();
      if (authError || !authData?.user || authData.user.id !== ctx.member.id) {
        throw new Error('Sesi login tidak valid. Masuk kembali sebagai admin.');
      }

      const { data, error } = await ctx.client.functions.invoke('admin-create-user', {
        body: {
          organization_id: ctx.orgId,
          email,
          role,
          initial_password: initialPassword,
          display_name: displayName,
          opd_ids: opdIds,
          year_ids: yearIds,
        },
      });
      if (error) throw new Error(await readableFunctionError(error));
      if (!data?.ok || !data?.user?.id) throw new Error('Respons admin-create-user tidak sesuai versi SATRIA terbaru. Deploy ulang Edge Function admin-create-user dari paket ini, lalu coba kembali.');

      form.reset();
      clearPasswords();
      roleInput.value = 'operator';
      window.dispatchEvent(new CustomEvent('satria:user-created'));
      const auditWarning = data.audit_recorded === false ? ' Catatan audit gagal disimpan; periksa log Edge Function.' : '';
      setMessage(`Akun ${role === 'ppkom' ? 'PPKom' : 'Operator'} berhasil dibuat. UID: ${data.user.id}. Scope OPD: ${opdIds.length}; tahun: ${yearIds.join(', ')}. Email ditandai terkonfirmasi dan tidak ada email yang dikirim. Sampaikan password awal secara aman kepada pengguna.${auditWarning}`, auditWarning ? 'error' : 'ok');
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'Gagal membuat akun.';
      setMessage(safeMessage, 'error');
    } finally {
      clearPasswords();
      busy = false;
      submit.disabled = false;
      submit.textContent = 'Buat akun';
    }
  });
})();
  };
})(typeof window!=='undefined'?window:null);
