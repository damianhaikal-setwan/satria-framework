
(function(){
  'use strict';
  const CONFIG_KEY='satria-supabase-bridge-config-v1';
  let client=null, member=null, orgId='', version=0, localUsersBackup=null, recoveryListenerClient=null, cloudStateReady=false;
  let clientConfigUrl='', clientConfigKey='', sessionRestorePromise=null, explicitSignOut=false;
  let lastSyncedPayload=null, autoSaveTimer=null, autoSaveInFlight=false, autosyncRequested=false, realtimeChannel=null, remoteNoticePending=false, remoteNoticeVersion=0, conflictActive=false, realtimeRefreshTimer=null, autoRetryTimer=null, autoRetryAttempt=0;
  let lastCloudConfirmedAt=null, lastCloudErrorAt=null;
  const $id=id=>document.getElementById(id);
  const modal=$id('satriaCloudModal');
  const status=(msg,kind='')=>{const e=$id('scStatus');if(e){e.textContent=msg;e.dataset.kind=kind}};
  function syncIndicator(message, kind=''){
    let e=$id('satriaCloudSyncIndicator');
    if(!e){e=document.createElement('span');e.id='satriaCloudSyncIndicator';e.className='satria-sync-indicator';e.setAttribute('role','status');e.setAttribute('aria-live','polite');
      const style=document.createElement('style');style.textContent='.satria-sync-indicator{display:inline-flex;align-items:center;gap:6px;max-width:250px;padding:7px 10px;border:1px solid #cbdedb;border-radius:999px;background:#f0fdfa;color:#0f766e;font:600 11px/1.25 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.satria-sync-indicator[data-kind=wait]{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.satria-sync-indicator[data-kind=error]{background:#fef2f2;border-color:#fecaca;color:#b91c1c}.satria-sync-indicator[data-kind=muted]{background:#f8fafc;border-color:#e2e8f0;color:#64748b}@media(max-width:1100px){.satria-sync-indicator{max-width:155px;padding:6px 8px;font-size:10px}}@media(max-width:680px){.satria-sync-indicator{max-width:122px}}';document.head.appendChild(style);
      const b=$id('satriaCloudOpen');if(b)b.insertAdjacentElement('afterend',e);else document.body.appendChild(e);
    }
    e.textContent=message;e.title=message;e.dataset.kind=kind;
    // Waktu ini hanya mencatat peristiwa dari klien ini, bukan uji kesehatan server.
    if(kind==='error')lastCloudErrorAt=new Date().toISOString();
    if(kind===''&&message.startsWith('Tersinkron'))lastCloudConfirmedAt=new Date().toISOString();
  }
  // API status baca-saja untuk Perawatan; jangan mengekspor URL, UUID, token, email, atau data bisnis.
  window.SATRIA_SYNC_HEALTH=Object.freeze({inspect:()=>Object.freeze({
    configured:Boolean(window.SATRIA_CLOUD_CONFIGURED),
    authenticated:Boolean(member),
    baselineLoaded:Boolean(cloudStateReady),
    online:typeof navigator!=='undefined'?navigator.onLine!==false:null,
    pending:typeof S!=='undefined'&&Boolean(S?.dirty),
    conflict:Boolean(conflictActive),
    inFlight:Boolean(autoSaveInFlight),
    retryScheduled:Boolean(autoRetryTimer),
    lastConfirmedAt:lastCloudConfirmedAt,
    lastErrorAt:lastCloudErrorAt
  })});
  function cloneJson(value){return value==null?value:JSON.parse(JSON.stringify(value))}
  function payloadEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
  const ARRAY_DELTAS=['rupBank','paket','opd','unit','pejabat','penyedia','akun','kode'];
  const SETTING_DELTAS=['pemda','meta','penomoran','tahun'];
  function rowKey(collection,row){return String(row?.id??row?.kode??'')}
  function makeDelta(base,target){
    const changes=[];
    for(const collection of ARRAY_DELTAS){
      const before=Array.isArray(base?.[collection])?base[collection]:[];
      const after=Array.isArray(target?.[collection])?target[collection]:[];
      const bm=new Map(),am=new Map();
      for(const row of before){const id=rowKey(collection,row);if(id)bm.set(id,row)}
      for(const row of after){const id=rowKey(collection,row);if(!id)throw new Error('Data '+collection+' memiliki baris tanpa ID. Sinkronisasi dihentikan agar integritas data tidak rusak.');if(am.has(id))throw new Error('ID duplikat pada master '+collection+': '+id);am.set(id,row)}
      for(const [id,row] of bm){if(!am.has(id))changes.push({collection,op:'delete',id})}
      for(const [id,row] of am){if(!bm.has(id)||!payloadEqual(bm.get(id),row))changes.push({collection,op:'upsert',id,row:cloneJson(row)})}
    }
    for(const key of SETTING_DELTAS){if(!payloadEqual(base?.[key],target?.[key]))changes.push({collection:key,op:'replace',value:cloneJson(target?.[key])})}
    // Dependency order matters across bounded 50-row RPC batches:
    // unlink packages before deleting a Bank RUP, establish OPD/year before Bank RUP upserts,
    // and upsert referenced Bank RUP rows before packages.
    const deltaRank=c=>c.op==='delete'&&c.collection==='paket'?0
      :c.op==='delete'&&c.collection==='rupBank'?1
      :c.op==='upsert'&&c.collection!=='paket'&&c.collection!=='rupBank'?2
      :c.op==='replace'&&c.collection==='tahun'?3
      :c.op==='upsert'&&c.collection==='rupBank'?4
      :c.op==='replace'?5
      :c.op==='upsert'&&c.collection==='paket'?6
      :c.op==='delete'&&c.collection==='opd'?8
      :7;
    changes.sort((a,b)=>deltaRank(a)-deltaRank(b));
    return changes;
  }
  function applyDeltaToPayload(base,changes){
    const out=cloneJson(base||{});
    for(const change of changes){
      if(change.op==='replace'){out[change.collection]=cloneJson(change.value);continue}
      const rows=Array.isArray(out[change.collection])?out[change.collection].slice():[];
      const key=row=>rowKey(change.collection,row);
      const index=rows.findIndex(row=>key(row)===String(change.id));
      if(change.op==='delete'){if(index>=0)rows.splice(index,1)}
      else if(index>=0)rows[index]=cloneJson(change.row);else rows.push(cloneJson(change.row));
      out[change.collection]=rows;
    }
    return out;
  }
  function cancelAutosaveTimer(){if(autoSaveTimer){clearTimeout(autoSaveTimer);autoSaveTimer=null}}
  function requestAutosave(reason=''){
    if(!member||member.role==='viewer'||!client||!cloudStateReady||!lastSyncedPayload)return;
    if(conflictActive){syncIndicator('Konflik cloud — periksa perubahan','error');return}
    cancelAutosaveTimer();syncIndicator('Perubahan lokal · menunggu sinkronisasi','wait');
    autoSaveTimer=setTimeout(()=>{autoSaveTimer=null;saveDeltaChanges(false).catch(showError)},850);
  }
  window.SATRIA_AUTO_SYNC_REQUEST=requestAutosave;

  const roleName=r=>({admin:'Admin',operator:'Operator',viewer:'Viewer'}[r]||'Viewer');
  const config=()=>{let local={};try{local=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}catch(_){}const embedded=window.SATRIA_EMBEDDED_SUPABASE_CONFIG||{};return {url:local.url||embedded.url||'',key:local.key||embedded.key||'',org:local.org||embedded.org||''}};
  window.SATRIA_CLOUD_CONFIGURED=!!(config().url&&config().key&&config().org);
  function fillConfig(){const c=config(); const a=$id('scUrl'), b=$id('scKey'), cc=$id('scOrg'); if(a) a.value=c.url||''; if(b) b.value=c.key||''; if(cc) cc.value=c.org||''; }
  function setButtons(){const ok=!!(client&&member); const p=$id('scPull'), pu=$id('scPush'), so=$id('scSignOut'); if(p) p.disabled=!ok; if(pu) pu.disabled=!ok||member?.role==='viewer'||(!cloudStateReady&&!(member?.role==='admin'&&window.SATRIA_CLOUD_ADMIN_IMPORT_READY===true)); if(so) so.disabled=!ok; }
  function open(){fillConfig(); if(!modal){ console.warn('Modal not found'); return; } modal.hidden=false;modal.setAttribute('aria-hidden','false'); const c=$id('scClose'); if(c) c.focus(); setButtons(); if(member)status('Terhubung sebagai '+member.email+' · role '+member.role+' · versi lokal '+version,'ok')}
  function close(){ if(modal){ modal.hidden=true; modal.setAttribute('aria-hidden','true'); } }
  function readConfigFields(){
    const url=$id('scUrl').value.trim(),key=$id('scKey').value.trim(),org=$id('scOrg').value.trim();
    let parsed;try{parsed=new URL(url)}catch(_){throw new Error('Project URL Supabase tidak valid.')}
    if(!['https:','http:'].includes(parsed.protocol)||(parsed.protocol==='http:'&&!['localhost','127.0.0.1'].includes(parsed.hostname)))throw new Error('Gunakan URL HTTPS Supabase; HTTP hanya diizinkan untuk localhost.');
    if(!key||/^(service[_-]?role|sb_secret_)/i.test(key))throw new Error('Masukkan publishable/anon key saja; service_role/secret key dilarang di browser.');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(org))throw new Error('Organization UUID belum valid.');
    return {url,key,org};
  }
  function saveConfig(){
    const cfg=readConfigFields();
    try{localStorage.setItem(CONFIG_KEY,JSON.stringify(cfg));}
    catch(e){throw new Error('Browser tidak mengizinkan penyimpanan konfigurasi. Buka file pada browser/profil yang sama atau gunakan Unduh HTML dengan konfigurasi. Detail: '+(e?.message||e));}
    orgId=cfg.org;status('Konfigurasi tersimpan di HP/browser ini. Sesi Supabase akan dipulihkan otomatis selama masih berlaku.','ok');
    return cfg;
  }
  /* SATRIA NEXT 3.0.59.20 — satu klien dan SATU storageKey untuk login serta pemulihan.
     Kunci ini sengaja dipertahankan dari versi terdahulu agar sesi yang sudah tersimpan
     tidak terhapus ketika pengguna memperbarui index.html. Jangan menyimpan password. */
  const sessionStorageKey=url=>'sb-'+btoa(url).slice(0,16)+'-auth-token';
  function ensureCloudClient(url,key){
    if(!window.supabase?.createClient) throw new Error('Library Supabase JS tidak termuat. Periksa koneksi internet/CDN.');
    if(!url||!key)throw new Error('Konfigurasi Supabase belum lengkap.');
    if(client&&clientConfigUrl===url&&clientConfigKey===key)return client;
    if(client){try{client.auth?.dispose?.()}catch(_){} }
    client=window.supabase.createClient(url,key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:sessionStorageKey(url)}
    });
    clientConfigUrl=url;clientConfigKey=key;
    bindRecoveryListener(client);
    return client;
  }
  async function initClient(){
    const {url,key,org}=saveConfig();orgId=org;
    if(!url||!key||!org)throw new Error('Konfigurasi Supabase belum lengkap. URL, Key, dan Organization UUID wajib diisi.');
    if(!url.startsWith('https://'))throw new Error('Supabase URL harus https://...supabase.co');
    try{return ensureCloudClient(url,key)}
    catch(e){throw new Error('Gagal menghubungkan Supabase: '+(e.message||e))}
  }

  async function loadMembership(){
    const {data:{user},error:userErr}=await client.auth.getUser();
    if(userErr||!user) throw new Error('Sesi belum masuk. Periksa email/kata sandi atau status akun Auth. Detail: '+(userErr?.message||'no user'));
    
    const {data,error}=await client.from('satria_memberships').select('role,active').eq('organization_id',orgId).eq('user_id',user.id).maybeSingle();
    if(error){
      if(/does not exist|relation.*not.*exist/i.test(error.message)){
        throw new Error('Tabel satria_memberships belum ada. Jalankan SQL setup di Supabase SQL Editor dulu. Lihat panduan di tab Panduan -> Cloud.');
      }
      throw new Error('Tidak dapat memeriksa membership. Pastikan SQL/RLS telah dijalankan: '+error.message);
    }
    
    let membership=data;
    if(!membership){
      console.log('SATRIA: Membership tidak ditemukan untuk user',user.id,'di org',orgId);
      const {data:existingMembers, error:checkErr}=await client.from('satria_memberships').select('user_id').eq('organization_id',orgId).limit(1);
      const isFirstOrg = !checkErr && (!existingMembers || existingMembers.length===0);
      
      if(isFirstOrg){
        status('Organisasi kosong - membuat admin pertama...','');
        try{
          const {data:inserted, error:insertErr}=await client.from('satria_memberships').insert({
            organization_id: orgId,
            user_id: user.id,
            role: 'admin',
            active: true
          }).select('role,active').single();
          
          if(insertErr){
            throw new Error(`Gagal auto-create admin pertama (RLS). Jalankan SQL ini di Supabase SQL Editor:

INSERT INTO satria_memberships (organization_id, user_id, role, active) VALUES ('${orgId}', '${user.id}', 'admin', true) ON CONFLICT (organization_id, user_id) DO UPDATE SET role='admin', active=true;

Error: ${insertErr.message}`);
          }
          membership=inserted;
          status('Admin pertama berhasil dibuat!','ok');
        }catch(insertError){
          throw insertError;
        }
      } else {
        throw new Error(
          `Akun ${user.email} (UID ${user.id}) belum memiliki membership di organisasi ${orgId}.

SOLUSI:
1. Buka Supabase -> Table Editor -> satria_memberships
2. Insert new row:
   - organization_id: ${orgId}
   - user_id: ${user.id}
   - role: admin
   - active: true

Atau SQL:
INSERT INTO satria_memberships (organization_id, user_id, role, active) VALUES ('${orgId}', '${user.id}', 'admin', true);`
        );
      }
    }
    
    if(!membership||!membership.active) throw new Error('Membership tidak aktif. Hubungi admin untuk aktivasi.');
    
    member={id:user.id,email:user.email||'Pengguna Supabase',role:membership.role,scope:null};
    cloudStateReady=false;
    window.SATRIA_CLOUD_ROLE=member.role;
    window.SATRIA_CLOUD_MEMBER=member;
    if(!['admin','operator','viewer'].includes(member.role)) throw new Error('Role membership tidak dikenal: '+member.role);
    if(!localUsersBackup) localUsersBackup=JSON.parse(JSON.stringify(S.users||[]));
    if(member.role!=='admin') resetCloudScopedView();
    S.users=[{id:'auth-'+member.id,nama:member.email,username:member.email,role:roleName(member.role),opd:'all',aktif:true}];
    S.ui.user=S.users[0].id;
    version=0;
    setButtons();
    applyUserLock();
    await pull();
    if(cloudStateReady){
      startRealtime();
      close(); // Login manual atau sesi tersimpan berhasil; jangan minta login ulang.
    }
    return member;
  }
  function resetCloudScopedView(){
    const currentYear=new Date().getFullYear();
    const ui={...(S.ui||{}),page:'dash',tahun:currentYear,opd:'all',pid:null,user:'cloud-login-required'};
    Object.assign(S,{
      pemda:{nama:'',kota:'',provinsi:'',sumber:''},meta:{},penomoran:{},tahun:[currentYear],
      users:[{id:'cloud-login-required',nama:'Login Supabase diperlukan',username:'',role:'Viewer',opd:'all',aktif:false}],
      akun:[],kode:[],opd:[],unit:[],pejabat:[],penyedia:[],rupBank:[],paket:[],
      ui,log:[],dirty:false,chat:[],chatCtx:null,persistError:''
    });
    S.ui.user=S.users[0].id;
  }

  function applyUserLock(){
    window.SATRIA_CLOUD_ROLE=member?.role||null;
    const u=$id('selUser');if(u){u.disabled=!!member;u.title=member?'Identitas ditentukan oleh Supabase Auth; pemilih lokal dinonaktifkan.':''}
    ['scUrl','scKey','scOrg'].forEach(id=>{const e=$id(id);if(e)e.disabled=!!member});
    const cloudCard=$id('satriaCloudUserCreateCard');if(cloudCard)cloudCard.style.display=member?'':'none';
    ['satriaLocalUserStats','satriaLocalUserCreateCard','satriaLocalUserTable'].forEach(id=>{const e=$id(id);if(e)e.style.display=member?'none':''});
    const addBtn=$id('satriaOpenCreateUser');if(addBtn){addBtn.disabled=!member||member.role!=='admin';addBtn.title=member&&member.role==='admin'?'':'Hanya admin Supabase yang dapat membuat akun.'}
    const importInput=$id('imp');if(importInput){importInput.disabled=!!(window.SATRIA_CLOUD_CONFIGURED&&member?.role!=='admin');importInput.title=importInput.disabled?'Impor snapshot/backup penuh hanya boleh dilakukan oleh admin terautentikasi.':'Impor backup JSON.'}
    setButtons();
  }
  function friendlyError(e){
    const raw=String(e?.message||e||'Terjadi kesalahan.');
    const rawLower=raw.toLowerCase();
    // 400 invalid credentials - user not found or wrong password
    if(/invalid login credentials|invalid_grant|invalid.*password|invalid.*email/i.test(raw)){
      return `❌ Email atau kata sandi ditolak oleh project gsmrhrgcilzuelrorarr.supabase.co.

`+
             `SOLUSI:
`+
             `1. Buka https://supabase.com/dashboard/project/gsmrhrgcilzuelrorarr → Authentication → Users
`+
             `2. Pastikan ada user admin@satria.go.id (email harus persis huruf kecil tanpa spasi)
`+
             `3. Jika BELUM ADA: Klik Add user → Create new user → email: admin@satria.go.id → centang Auto Confirm → buat password
`+
             `4. Jika SUDAH ADA tapi lupa password: Gunakan "Lupa kata sandi?" atau di Users → ... → Reset password
`+
             `5. Setelah user ada, pastikan ada membership di Table Editor → satria_memberships dengan organization_id 64bec4e1-a687-4dce-8935-cc51363171db

`+
             `Jika ingin lewati cloud dan pakai demo lokal, klik "Mode Lokal Tanpa Cloud" di bawah.`;
    }
    if(/email not confirmed|email not confirmed/i.test(rawLower)) return '📧 Email belum dikonfirmasi. Di Supabase Dashboard → Authentication → Users → klik user admin@satria.go.id → Confirm email. Atau matikan Email Confirmations di Authentication → Configuration.';
    if(/user not found|user.*not.*exist/i.test(rawLower)) return '👤 Akun tidak ditemukan. Buat dulu di Supabase Dashboard → Authentication → Users → Add user → admin@satria.go.id';
    if(/password should be at least|weak password/i.test(rawLower)) return '🔒 Kata sandi terlalu lemah. Minimal 8 karakter, kombinasi huruf besar, kecil, angka.';
    if(/redirect.*not allowed|not allowed.*redirect/i.test(rawLower)) return '🔗 Redirect URL belum diizinkan. Tambahkan '+window.location.origin+' ke Supabase → Authentication → URL Configuration → Redirect URLs';
    if(/failed to fetch|network.*error|fetch.*failed/i.test(rawLower)) return '🌐 Gagal terhubung ke Supabase. Periksa internet, atau Project Supabase mungkin paused. Buka dashboard Supabase untuk restore.';
    if(/organization.*not.*found|org.*not.*found/i.test(rawLower)) return '🏢 Organization UUID tidak ditemukan. Pastikan SQL setup sudah dijalankan di Supabase SQL Editor.';
    if(/belum memiliki membership|membership.*tidak aktif|belum.*diinvite|Gagal auto-create admin pertama/i.test(raw)){
      return raw;
    }
    return raw;
  }
  function showError(e){
    const msg=String(e?.message||e||'');
    // Jangan spam console untuk error login yang expected (400)
    if(/invalid login credentials|email not confirmed|user not found/i.test(msg)){
      console.warn('SATRIA Auth:',msg);
    } else {
      console.error('SATRIA Supabase bridge:',e);
    }
    status(friendlyError(e),'error');
    // Tampilkan tombol Mode Lokal jika error auth dan ada embedded config
    try{
      const hasEmbedded = !!window.SATRIA_EMBEDDED_SUPABASE_CONFIG?.url;
      if(hasEmbedded && /invalid login credentials|user not found|email not confirmed/i.test(msg)){
        const actionsEl=document.querySelector('#satriaCloudModal .sc-actions');
        if(actionsEl && !document.getElementById('btnLocalMode')){
          const localBtn=document.createElement('button');
          localBtn.id='btnLocalMode';
          localBtn.textContent='🏠 Mode Lokal Tanpa Cloud';
          localBtn.title='Hapus config cloud dan lanjutkan dengan data demo lokal';
          localBtn.style.background='#f59e0b'; localBtn.style.color='white'; localBtn.style.borderColor='#f59e0b';
          localBtn.onclick=()=>{ if(confirm('Hapus config Supabase tertanam dan reload ke mode demo lokal? Data cloud tidak akan terhapus, hanya config di browser ini yang dibersihkan.')){ localStorage.removeItem('satria-supabase-bridge-config-v1'); window.SATRIA_EMBEDDED_SUPABASE_CONFIG={}; location.reload(); } };
          actionsEl.appendChild(localBtn);
        }
      }
    }catch(_){}
    setButtons();
  }
  function bindRecoveryListener(c){
    if(!c||recoveryListenerClient===c)return;
    recoveryListenerClient=c;
    c.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY'){
        $id('scRecoveryPanel').hidden=false;
        modal.hidden=false;modal.setAttribute('aria-hidden','false');
        status('Tautan pemulihan diterima. Masukkan kata sandi baru di bawah.','ok');
        try{$id('scNewPassword').focus()}catch(_){}
      }
      // Keluar dari perangkat lain / sesi dicabut: data cloud harus kembali terkunci.
      if(event==='SIGNED_OUT'&&!explicitSignOut){
        setTimeout(()=>{
          if(c!==client||!member)return;
          cancelAutosaveTimer();stopRealtime();
          member=null;version=0;cloudStateReady=false;lastSyncedPayload=null;conflictActive=false;
          window.SATRIA_CLOUD_ROLE=null;window.SATRIA_CLOUD_MEMBER=null;
          window.SATRIA_MEDIA?.clear?.();resetCloudScopedView();
          localUsersBackup=null;
          try{if(typeof DB!=='undefined'&&DB?.kv)DB.kv.delete('main').catch(()=>{})}catch(_){}
          if(typeof render==='function')render();applyUserLock();
          open();status('Sesi telah berakhir atau akses dicabut. Silakan masuk lagi.','error');
        },0);
      }
    });
  }
  async function requestPasswordReset(){
    try{
      const email=$id('scEmail').value.trim();
      if(!email||!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Masukkan email akun Supabase yang valid terlebih dahulu.');
      status('Meminta tautan pemulihan…');
      await initClient();bindRecoveryListener(client);
      const redirectTo=window.location.origin==='null'?'':(window.location.origin+window.location.pathname+window.location.search);
      const options=redirectTo?{redirectTo}:undefined;
      const {error}=await client.auth.resetPasswordForEmail(email,options);if(error)throw error;
      status('Permintaan pemulihan diproses. Jika email terdaftar pada project ini dan email delivery Supabase aktif, tautan akan dikirim. Periksa Inbox/Spam. Jika akun belum dibuat, buat akun lewat Authentication → Users terlebih dahulu.','ok');
    }catch(e){showError(e)}
  }
  async function saveRecoveredPassword(){
    const password=$id('scNewPassword').value,confirmPassword=$id('scConfirmNewPassword').value;
    try{
      if(!password||password.length<8)throw new Error('Kata sandi baru minimal 8 karakter.');
      if(password!==confirmPassword)throw new Error('Konfirmasi kata sandi tidak sama.');
      if(!client)await initClient();
      status('Menyimpan kata sandi baru…');
      const {error}=await client.auth.updateUser({password});if(error)throw error;
      $id('scNewPassword').value='';$id('scConfirmNewPassword').value='';$id('scRecoveryPanel').hidden=true;
      status('Kata sandi berhasil diperbarui. Memeriksa akses organisasi…','ok');
      try{await loadMembership()}catch(e){status('Kata sandi berhasil diperbarui, tetapi akses organisasi belum aktif: '+friendlyError(e),'error')}
    }catch(e){showError(e)}
  }
  async function connect(){
    try{
      status('Memeriksa konfigurasi dan menghubungkan…');
      await initClient(); bindRecoveryListener(client);
      const rawEmail=$id('scEmail').value.trim();
      const email=rawEmail.toLowerCase().replace(/\s+/g,'');
      const password=$id('scPassword').value;
      // Update field jika ada normalisasi
      if(rawEmail!==email){ $id('scEmail').value=email; }
      if(email&&password){
        if(!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Format email tidak valid. Contoh: admin@satria.go.id');
        if(password.length<6) throw new Error('Kata sandi minimal 6 karakter.');
        status('Menghubungkan ke '+ (client.supabaseUrl||'Supabase') +'...', '');
        const {error}=await client.auth.signInWithPassword({email,password});
        if(error) throw error;
        $id('scPassword').value='';
        status('Login berhasil! Memuat membership...','ok');
        await loadMembership();
      } else {
        const {data,error}=await client.auth.getSession();
        if(error) throw error;
        if(data.session) await loadMembership();
        else status('Konfigurasi tersimpan. Masukkan email dan kata sandi akun Auth untuk masuk. Email akan dinormalisasi ke huruf kecil otomatis.')
      }
    }catch(e){ showError(e); }
  }
  function currentPayload(){
    const o=JSON.parse(JSON.stringify(S));
    ['ui','log','dirty','chat','chatCtx','persistError'].forEach(k=>delete o[k]);
    // Browser-side user list is not an identity store; persist only the authenticated principal's display role.
    o.users=member?[{id:'auth-'+member.id,nama:member.email,username:member.email,role:roleName(member.role),opd:'all',aktif:true}]:[];
    return o;
  }

  function startRealtime(){
    if(!client||!member||!orgId)return;
    stopRealtime();
    const channelName='satria-sync-'+orgId;
    realtimeChannel=client.channel(channelName).on('postgres_changes',{
      event:'*',schema:'public',table:'satria_sync_events',filter:'organization_id=eq.'+orgId
    },payload=>handleRealtimeNotice(payload?.new||payload?.old||{})).subscribe(async state=>{
      if(state==='SUBSCRIBED'){
        syncIndicator('Cloud terhubung · realtime aktif','');
        await checkRemoteVersion();
      }else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){
        syncIndicator('Realtime terputus · autosave tetap aktif','wait');
      }
    });
  }
  function stopRealtime(){
    if(realtimeRefreshTimer){clearTimeout(realtimeRefreshTimer);realtimeRefreshTimer=null}
    if(realtimeChannel&&client){try{client.removeChannel(realtimeChannel)}catch(_){} }
    realtimeChannel=null;remoteNoticePending=false;remoteNoticeVersion=0;
  }
  async function checkRemoteVersion(){
    if(!client||!member||!cloudStateReady)return;
    try{
      const {data,error}=await client.from('satria_sync_events').select('version,actor_user_id,updated_at').eq('organization_id',orgId).maybeSingle();
      if(error)throw error;
      if(data&&Number(data.version)>version)handleRealtimeNotice(data);
    }catch(e){console.warn('SATRIA Realtime version check:',e?.message||e)}
  }
  function handleRealtimeNotice(eventRow){
    if(!member||!eventRow)return;
    const remoteVersion=Number(eventRow.version)||0;
    if(!remoteVersion||remoteVersion<=version)return;
    if(autoSaveInFlight){remoteNoticePending=true;remoteNoticeVersion=Math.max(remoteNoticeVersion,remoteVersion);return}
    if(S.dirty){
      conflictActive=true;cancelAutosaveTimer();
      syncIndicator('Versi cloud baru · konflik perlu ditinjau','error');
      status('Pengguna lain menyimpan versi '+remoteVersion+' saat Anda memiliki perubahan lokal. Sistem tidak menimpa perubahan. Unduh backup lokal bila perlu, lalu tarik versi terbaru dan terapkan kembali perubahan yang diperlukan.','error');
      toast('Data cloud berubah. Perubahan lokal ditahan untuk mencegah konflik.');
      return;
    }
    if(realtimeRefreshTimer)clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer=setTimeout(async()=>{
      realtimeRefreshTimer=null;
      if(!member||S.dirty||autoSaveInFlight)return;
      try{await pull({source:'realtime',silent:true})}catch(e){showError(e)}
    },220);
  }
  async function pull(options={}){
    const opts=(options&&typeof options==='object'&&('source' in options||'silent' in options||'discardConfirmed' in options))?options:{};
    if(member&&S.dirty&&!opts.discardConfirmed&&(cloudStateReady||member.role==='admin')){
      if(opts.source==='realtime'){handleRealtimeNotice({version:version+1,updated_by:null});return false}
      if(!confirm('Ada perubahan lokal yang belum tersinkron. Menarik data cloud akan mengganti perubahan lokal ini. Unduh Backup JSON terlebih dahulu jika ingin menyimpannya. Lanjutkan tarik data?'))return false;
    }
    cloudStateReady=false;setButtons();
    try{
      if(!client||!member)throw new Error('Hubungkan dan masuk terlebih dahulu.');
      status('Membaca snapshot sesuai scope akses…');
      let data=null,error=null;
      if(member.role==='admin'){
        const response=await client.from('satria_state').select('payload,version,updated_at,updated_by').eq('organization_id',orgId).maybeSingle();
        data=response.data;error=response.error;
      }else{
        // Non-admins never query satria_state directly. The security-definer RPC returns a whitelist-only projection.
        const response=await client.rpc('satria_get_scoped_state',{p_organization_id:orgId});
        error=response.error;
        const scoped=response.data;
        if(!error&&scoped&&typeof scoped==='object'){
          member.scope=scoped.scope||null;
          data={payload:scoped.payload,version:scoped.version,updated_at:scoped.updated_at,updated_by:scoped.updated_by};
        }
      }
      if(error)throw error;
      if(!data)throw new Error('Snapshot/scoped state belum tersedia. Admin harus menginisialisasi snapshot dan menetapkan minimal satu OPD serta satu tahun untuk akun non-admin.');
      if(!data.payload||typeof data.payload!=='object'||!Array.isArray(data.payload.paket)||!Array.isArray(data.payload.opd))throw new Error('Respons snapshot tidak memiliki struktur SATRIA yang valid.');
      const ui={...(S.ui||{})};
      Object.assign(S,data.payload,{ui,log:[],dirty:false,chat:[],chatCtx:null});
      const assignedOpds=member.role==='admin'?'all':(Array.isArray(member.scope?.opd_ids)?member.scope.opd_ids.map(String):[]);
      const assignedYears=member.role==='admin'?null:(Array.isArray(member.scope?.years)?member.scope.years.map(Number).filter(Number.isFinite):[]);
      S.users=[{id:'auth-'+member.id,nama:member.email,username:member.email,role:roleName(member.role),opd:assignedOpds,years:assignedYears,aktif:true}];S.ui.user=S.users[0].id;
      if(typeof normalizeData==='function')normalizeData();
      version=Number(data.version)||0;S.dirty=false;cloudStateReady=true;window.SATRIA_CLOUD_ADMIN_IMPORT_READY=false;
      if(member.role!=='admin'){
        const allowedOpds=assignedOpds;
        const allowedYears=assignedYears||[];
        if(!allowedOpds.length||!allowedYears.length)throw new Error('Akses akun belum memiliki assignment OPD dan tahun yang lengkap. Minta admin menetapkan keduanya.');
        const allowedOpdSet=new Set(allowedOpds),allowedYearSet=new Set(allowedYears);
        const missingOpds=allowedOpds.filter(id=>!(S.opd||[]).some(o=>String(o.id)===id));
        if(missingOpds.length)throw new Error('Master OPD untuk assignment akun tidak ditemukan pada snapshot cloud. Minta admin sinkronkan Data Master OPD, lalu tekan Tarik dari Supabase.');
        S.opd=(S.opd||[]).filter(o=>allowedOpdSet.has(String(o.id)));
        S.unit=(S.unit||[]).filter(x=>allowedOpdSet.has(String(x.opd)));
        S.pejabat=(S.pejabat||[]).filter(x=>allowedOpdSet.has(String(x.opd)));
        S.paket=(S.paket||[]).filter(p=>allowedOpdSet.has(String(p.opd))&&allowedYearSet.has(Number(p.tahun)));
        S.rupBank=(S.rupBank||[]).filter(r=>allowedOpdSet.has(String(r.opd))&&allowedYearSet.has(Number(r.tahun)));
        S.tahun=(S.tahun||[]).map(Number).filter(y=>allowedYearSet.has(y)).sort((a,b)=>a-b);
        if(!S.tahun.length)throw new Error('Tahun assignment tidak ditemukan pada snapshot saat ini. Minta admin sinkronkan daftar tahun dan data cloud.');
        if(allowedOpds.length===1)S.ui.opd=allowedOpds[0];
        else if(S.ui.opd!=='all'&&!allowedOpdSet.has(String(S.ui.opd)))S.ui.opd='all';
        if(!S.tahun.includes(Number(S.ui.tahun)))S.ui.tahun=S.tahun[0];
        // Persist only the scoped projection. In memory mode, remove the old full-snapshot cache instead of leaving it available to a later offline startup.
        if(ENGINE==='dexie'&&typeof persistNow==='function'){
          const persisted=await persistNow();
          if(!persisted&&DB&&DB.kv){try{await DB.kv.delete('main')}catch(_) {}}
        }else if(DB&&DB.kv){try{await DB.kv.delete('main')}catch(_) {}}

      }
      if(typeof route==='function')route();applyUserLock();
      lastSyncedPayload=currentPayload();conflictActive=false;S.dirty=false;
      const scopeText=member.role==='admin'?'seluruh organisasi':`${member.scope.opd_ids.length} OPD · TA ${member.scope.years.join(', ')}`;
      status('Data cloud dimuat sesuai scope '+scopeText+'. Versi '+version+' · diperbarui '+(data.updated_at||'waktu tidak tersedia')+'.','ok');
      syncIndicator('Tersinkron · versi '+version,'');
    }catch(e){
      // Fail closed for every role: a failed cloud pull must never leave seed/stale data pushable.
      resetCloudScopedView();
      cloudStateReady=false;version=0;lastSyncedPayload=null;conflictActive=false;
      syncIndicator('Cloud belum tersinkron','error');
      if(member&&member.role!=='admin'){try{if(DB&&DB.kv)await DB.kv.delete('main')}catch(_){}}
      if(typeof route==='function')route();
      applyUserLock();
      showError(e);
    }
  }
  async function saveDeltaChanges(manual=false){
    if(!client||!member)throw new Error('Hubungkan dan masuk terlebih dahulu.');
    if(member.role==='viewer')throw new Error('Viewer hanya dapat membaca data sesuai scope OPD dan tahun.');
    if(!cloudStateReady||!lastSyncedPayload)throw new Error('Baseline cloud belum tersedia. Tarik data Supabase terlebih dahulu.');
    if(conflictActive)throw new Error('Terdapat konflik versi. Buat backup lokal, tarik versi terbaru, lalu terapkan kembali perubahan yang diperlukan.');
    if(autoSaveInFlight){autosyncRequested=true;return}
    autoSaveInFlight=true;autosyncRequested=false;
    try{
      const targetPayload=currentPayload();
      const changes=makeDelta(lastSyncedPayload,targetPayload);
      if(!changes.length){
        if(payloadEqual(currentPayload(),lastSyncedPayload)){S.dirty=false;syncIndicator('Tersinkron · versi '+version,'');if(manual)status('Tidak ada perubahan yang perlu disinkronkan. Versi '+version+'.','ok')}
        return;
      }
      syncIndicator('Menyinkronkan '+changes.length+' perubahan…','wait');
      status('Mengirim perubahan per record dengan pemeriksaan versi…');
      // Batches are bounded; every transaction validates the expected version and applies only changed rows/fields.
      for(let i=0;i<changes.length;i+=50){
        const batch=changes.slice(i,i+50);
        const {data,error}=await client.rpc('satria_apply_state_delta',{
          p_organization_id:orgId,p_expected_version:version,p_changes:batch
        });
        if(error)throw error;
        const returnedVersion=Number(data?.version??data);
        if(!Number.isFinite(returnedVersion)||returnedVersion<=version)throw new Error('Respons delta sync tidak menyertakan versi baru yang valid. Periksa migrasi 20261028010000_satria_rup_bank_cloud_compat.sql dan migrasi sebelumnya.');
        version=returnedVersion;
        lastSyncedPayload=applyDeltaToPayload(lastSyncedPayload,batch);
      }
      window.SATRIA_CLOUD_ADMIN_IMPORT_READY=false;autoRetryAttempt=0;if(autoRetryTimer){clearTimeout(autoRetryTimer);autoRetryTimer=null}
      const latestLocal=currentPayload();
      const clean=payloadEqual(latestLocal,lastSyncedPayload);
      S.dirty=!clean;
      if(clean){
        conflictActive=false;
        status('Perubahan tersimpan otomatis ke cloud. '+changes.length+' delta · versi '+version+'.','ok');
        syncIndicator('Tersinkron · versi '+version,'');
      }else{
        status('Perubahan yang tertangkap sudah tersimpan; ada perubahan baru selama proses berlangsung. Melanjutkan sinkronisasi…','ok');
        syncIndicator('Perubahan baru · antrean','wait');
        autosyncRequested=true;
      }
      applyUserLock();
    }catch(e){
      const msg=String(e?.message||e||'Sinkronisasi gagal.');
      if(/version conflict|40001|newer data|pull latest/i.test(msg)){
        conflictActive=true;cancelAutosaveTimer();
        syncIndicator('Konflik versi · perlu tinjau','error');
        status('Sinkronisasi dihentikan karena versi cloud berubah. Perubahan lokal tidak ditimpa. Unduh backup bila perlu, lalu tarik versi terbaru dan terapkan kembali perubahan yang diperlukan. Detail: '+msg,'error');
        toast('Konflik versi terdeteksi; tidak ada overwrite otomatis.');
      }else{
        syncIndicator('Gagal sinkron · data lokal tertahan','error');
        status('Perubahan masih tersimpan lokal tetapi belum terkonfirmasi di cloud. Periksa koneksi/migrasi lalu pilih Sinkronkan perubahan. Detail: '+msg,'error');
        console.error('SATRIA delta autosync:',e);
        if(!manual&&!conflictActive&&/(failed to fetch|network|timeout|temporar|\b(429|500|502|503|504)\b|connection)/i.test(msg)&&S.dirty){
          if(autoRetryTimer)clearTimeout(autoRetryTimer);
          const delay=Math.min(30000,1000*(2**Math.min(autoRetryAttempt,5)));autoRetryAttempt++;
          autoRetryTimer=setTimeout(()=>{autoRetryTimer=null;if(member&&!conflictActive&&S.dirty)requestAutosave('network-retry')},delay);
          syncIndicator('Koneksi bermasalah · coba ulang otomatis','wait');
        }
      }
      if(manual)throw e;
    }finally{
      autoSaveInFlight=false;
      if(remoteNoticePending){
        const pendingVersion=remoteNoticeVersion;remoteNoticePending=false;remoteNoticeVersion=0;
        if(pendingVersion>version){
          if(S.dirty){conflictActive=true;syncIndicator('Versi cloud baru · konflik perlu ditinjau','error');status('Versi cloud berubah saat sinkronisasi. Simpan backup lokal, tarik versi terbaru, lalu rekonsiliasi perubahan.','error')}
          else await pull({source:'realtime',silent:true});
        }
      }
      if(autosyncRequested&&!conflictActive&&S.dirty){autosyncRequested=false;cancelAutosaveTimer();autoSaveTimer=setTimeout(()=>{autoSaveTimer=null;saveDeltaChanges(false).catch(showError)},100)}
    }
  }
  async function push(){
    try{
      if(!client||!member)throw new Error('Hubungkan dan masuk terlebih dahulu.');
      if(member.role==='viewer')throw new Error('Viewer hanya dapat membaca data sesuai scope OPD dan tahun.');
      // Full snapshot replacement remains available only for an explicit administrator bootstrap/restore after importing a verified backup.
      if(member.role==='admin'&&!cloudStateReady&&window.SATRIA_CLOUD_ADMIN_IMPORT_READY===true){
        const payload=currentPayload();
        if(!confirm('Pemulihan Admin: kirim seluruh snapshot dari backup yang baru diimpor untuk menginisialisasi/memulihkan organisasi? Tindakan ini mengganti snapshot cloud. Lanjutkan hanya setelah memeriksa backup.'))return;
        status('Mengirim snapshot Admin secara eksplisit untuk bootstrap/pemulihan…');
        const {data,error}=await client.rpc('satria_save_state',{p_organization_id:orgId,p_expected_version:version,p_payload:payload});
        if(error)throw error;
        version=Number(data)||version+1;lastSyncedPayload=cloneJson(payload);S.dirty=false;cloudStateReady=true;conflictActive=false;window.SATRIA_CLOUD_ADMIN_IMPORT_READY=false;
        status('Snapshot pemulihan tersimpan. Versi '+version+'.','ok');syncIndicator('Tersinkron · versi '+version,'');applyUserLock();return;
      }
      await saveDeltaChanges(true);
    }catch(e){showError(e)}
  }
  async function signOut(){
    try{
      if(S.dirty&&!confirm('Ada perubahan lokal yang belum dikirim ke Supabase. Keluar akan mengosongkan cache data aktif pada browser ini. Unduh backup sesuai kewenangan Anda atau simpan perubahan terlebih dahulu. Tetap keluar?'))return;
      explicitSignOut=true;
      cancelAutosaveTimer();if(autoRetryTimer){clearTimeout(autoRetryTimer);autoRetryTimer=null}stopRealtime();if(client)await client.auth.signOut();
      window.SATRIA_MEDIA?.clear();
      member=null;version=0;cloudStateReady=false;lastSyncedPayload=null;conflictActive=false;lastCloudConfirmedAt=null;lastCloudErrorAt=null;window.SATRIA_CLOUD_ADMIN_IMPORT_READY=false;orgId=$id('scOrg').value.trim();window.SATRIA_CLOUD_ROLE=null;
      resetCloudScopedView();
      try{if(DB&&DB.kv)await DB.kv.delete('main')}catch(e){console.warn('Cache SATRIA tidak dapat dihapus setelah logout',e)}
      localUsersBackup=null;
      if(typeof render==='function')render();
      setButtons();applyUserLock();open();status('Berhasil keluar. Sesi tersimpan sudah dihapus; silakan login kembali jika ingin masuk.','ok');syncIndicator('Belum login ke cloud','muted');
    }catch(e){showError(e)}finally{explicitSignOut=false}
  }
  function downloadConfiguredHtml(){
    try{
      const cfg=readConfigFields();
      const clone=document.documentElement.cloneNode(true);
      const configScript=clone.querySelector('#satriaEmbeddedSupabaseConfig');
      if(!configScript)throw new Error('Blok konfigurasi tertanam tidak ditemukan di HTML.');
      const safeJson=JSON.stringify(cfg).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
      configScript.textContent='// Konfigurasi koneksi klien; jangan pernah menaruh service_role/secret key di sini.\nwindow.SATRIA_EMBEDDED_SUPABASE_CONFIG = '+safeJson+';';
      const blob=new Blob(['<!DOCTYPE html>\n'+clone.outerHTML],{type:'text/html;charset=utf-8'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SATRIA-Framework-3-0-configured.html';a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      status('Salinan HTML dengan URL, anon key, dan Organization UUID tertanam berhasil diunduh. Kata sandi tidak disimpan.','ok');
    }catch(e){showError(e)}
  }
  document.addEventListener('DOMContentLoaded',()=>{});
  const openBtn=document.getElementById('satriaCloudOpen')||document.createElement('button');openBtn.type='button';openBtn.className='satria-cloud-btn';openBtn.id='satriaCloudOpen';openBtn.textContent='☁ Supabase';openBtn.title='Konfigurasi autentikasi dan sinkronisasi Supabase';
  const headerRight=document.querySelector('header .header-right');if(headerRight)headerRight.insertBefore(openBtn,headerRight.firstChild);
  openBtn.addEventListener('click',open);syncIndicator('Belum login ke cloud','muted');
  window.addEventListener('online',()=>{if(member&&S.dirty&&!conflictActive)requestAutosave('browser-online');if(member)checkRemoteVersion()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&member){checkRemoteVersion();if(S.dirty&&!conflictActive)requestAutosave('tab-visible')}});
  { const e=$id('scClose'); if(e) e.addEventListener('click',close); }
  if(modal) modal.addEventListener('click',e=>{if(e.target===modal)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close()});
  { const _el=$id('scEmbedConfig'); if(_el) _el.addEventListener('click',downloadConfiguredHtml);$id('scSaveConfig').addEventListener('click',()=>{try{saveConfig();}catch(e){showError(e)}});$id('scConnect').addEventListener('click',connect);$id('scResetPassword').addEventListener('click',requestPasswordReset);$id('scSaveNewPassword').addEventListener('click',saveRecoveredPassword);$id('scCancelRecovery').addEventListener('click',()=>{$id('scRecoveryPanel').hidden=true;$id('scNewPassword').value='';$id('scConfirmNewPassword').value='';});$id('scPull').addEventListener('click',pull);$id('scPush').addEventListener('click',push);$id('scSignOut').addEventListener('click',signOut); }
  const saved=config();
  { const a=$id('scUrl'), b=$id('scKey'), c=$id('scOrg'); if(saved.url && a) a.value=saved.url; if(saved.key && b) b.value=saved.key; if(saved.org && c) c.value=saved.org; }
  if(window.render){const originalRender=window.render;window.render=function(){originalRender();applyUserLock()}}
  // SATRIA 3.0.55: grant the media module a live authenticated client; never expose service_role.
  window.SATRIA_MEDIA_GET_ACCESS=()=>({client,member,orgId,cloudStateReady});
  // Pemulihan sesi iPhone/Android/PWA. HARUS menggunakan storageKey yang sama
  // dengan signInWithPassword(), tidak menggunakan default dari Supabase.
  function restorePersistedSession(showLoginIfMissing=true){
    if(sessionRestorePromise)return sessionRestorePromise;
    sessionRestorePromise=(async()=>{
      const cfg=config();
      if(!cfg.url||!cfg.key||!cfg.org){
        if(showLoginIfMissing){open();status('Isi konfigurasi Supabase untuk mulai login.','');}
        return false;
      }
      try{
        orgId=cfg.org;
        const c=ensureCloudClient(cfg.url,cfg.key);
        if(showLoginIfMissing)status('Memulihkan sesi Supabase dari perangkat ini…');
        const {data,error}=await c.auth.getSession();
        if(error)throw error;
        if(!data?.session){
          if(showLoginIfMissing){open();status('Belum ada sesi aktif pada HP/browser ini. Silakan login sekali; setelah itu sesi akan diingat.','');}
          return false;
        }
        if(member&&cloudStateReady){close();return true;}
        await loadMembership(); // getUser + membership/RLS + pull; bukan sekadar percaya data localStorage.
        if(cloudStateReady){close();return true;}
        if(showLoginIfMissing){open();status('Sesi ditemukan, tetapi data organisasi belum dapat dimuat. Periksa koneksi lalu tekan Masuk ke SATRIA tanpa mengetik password.','error');}
        return false;
      }catch(e){
        showError(e);
        if(showLoginIfMissing)open();
        return false;
      }
    })().finally(()=>{sessionRestorePromise=null});
    return sessionRestorePromise;
  }
  // Jangan tampilkan popup login selama sesi masih sedang diperiksa.
  restorePersistedSession(true).catch(showError);
  window.addEventListener('online',()=>{if(!member)restorePersistedSession(false).catch(showError)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!member)restorePersistedSession(false).catch(showError)});

  // Modal tambah akun Auth menggunakan session, member, orgId dari bridge ini.
/*
 * SATRIA 3.0 — modal tambah akun Supabase Auth.
 * Tempel kode ini DI DALAM Supabase bridge IIFE, sebelum penutup `})();` terakhir.
 * Kode memakai variabel closure yang sudah ada di bridge: client, member, orgId.
 * Tombol pembuka harus memiliki id="satriaOpenCreateUser".
 */
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
    
/* ===== SATRIA DATA MASTER PERFECTED - Lead Dev Patch 24 Okt 2026 ===== */
.satria-scope-card{display:flex;gap:14px;padding:16px 18px;border-radius:16px;border:1px solid var(--bd);background:linear-gradient(135deg, rgba(15,118,110,.06), rgba(14,165,233,.05));position:relative;overflow:hidden;margin-bottom:18px}
.satria-scope-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--acc-grad-kh)}
.satria-scope-card.scope-admin{background:linear-gradient(135deg, rgba(37,99,235,.06), rgba(15,118,110,.06))}
.satria-scope-card .scope-icon{width:36px;height:36px;border-radius:10px;background:var(--acc-soft);color:var(--acc);display:grid;place-items:center;flex-shrink:0}
.satria-scope-card .scope-icon svg{width:20px;height:20px}
.satria-scope-card b{color:var(--ink)}
.satria-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
@media(max-width:1180px){.satria-kpi-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.satria-kpi-grid{grid-template-columns:1fr}}
.satria-kpi-card{background:var(--card);backdrop-filter:blur(16px) saturate(160%);border:1px solid var(--bd);border-radius:20px;padding:18px 20px;position:relative;overflow:hidden;box-shadow:var(--shadow-sm);transition:all .26s var(--ease);min-height:132px;display:flex;flex-direction:column;justify-content:space-between}
.satria-kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-kh);opacity:.9}
.satria-kpi-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-md);border-color:var(--bd-strong)}
.satria-kpi-card .kpi-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.satria-kpi-card .kpi-icon{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg, var(--acc-soft), var(--acc-soft-2));color:var(--acc);display:grid;place-items:center;border:1px solid var(--bd)}
.satria-kpi-card .kpi-icon svg{width:20px;height:20px}
.satria-kpi-card .kpi-badge{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--acc);background:var(--acc-soft);border:1px solid var(--bd);padding:4px 8px;border-radius:9999px;display:flex;align-items:center;gap:5px}
.satria-kpi-card .kpi-badge .dot{width:6px;height:6px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 4px var(--acc-ring);animation:pulseDot 2s infinite}
.satria-kpi-card .kpi-label{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);margin-bottom:6px}
.satria-kpi-card .kpi-value{font-size:32px;font-weight:800;line-height:1;color:var(--ink);letter-spacing:-.03em}
.satria-kpi-card .kpi-foot{margin-top:12px;font-size:11.5px;color:var(--mut);display:flex;align-items:center;gap:6px}
.live-dot{width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 0 3px rgba(16,185,129,.18);position:relative}
.live-dot::after{content:'';position:absolute;inset:0;border-radius:50%;background:#10B981;animation:pulseDot 2s infinite}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 var(--acc-ring)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
.satria-master-nav-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:14px;box-shadow:var(--shadow-sm);margin-bottom:18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.master-tabs{display:flex;flex-wrap:wrap;gap:8px}
.master-tab{height:38px;padding:0 16px;border-radius:9999px;border:1px solid var(--bd);background:var(--card-solid);color:var(--ink-2);font-size:13px;font-weight:600;transition:all .18s var(--ease);cursor:pointer}
.master-tab:hover{background:var(--bg-2);color:var(--ink);transform:translateY(-1px)}
.master-tab.active{background:var(--acc-grad-kh);color:white;border-color:transparent;box-shadow:0 6px 18px rgba(15,118,110,.28);transform:translateY(-1px)}
.master-search-wrap{position:relative;flex:1;min-width:280px;max-width:420px}
.master-search-wrap .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--mut-2);pointer-events:none}
.master-search{width:100%;height:42px;padding:0 14px 0 38px;border-radius:12px;border:1px solid var(--bd);background:var(--bg);color:var(--ink);font-size:13.5px;transition:all .18s var(--ease)}
.master-search:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 4px var(--acc-ring);background:var(--card-solid)}
.satria-form-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:22px;box-shadow:var(--shadow-sm);margin-bottom:18px;position:relative;overflow:hidden}
.satria-form-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-soft);opacity:.8}
.form-card-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.form-card-head .title-accent{width:4px;height:18px;border-radius:3px;background:var(--acc-grad-kh);box-shadow:0 2px 6px rgba(15,118,110,.3)}
.form-card-head h3{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em}
.satria-shared-note{display:flex;gap:12px;padding:12px 14px;border-radius:12px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:13px;margin-bottom:16px}
.satria-shared-note .shared-icon{width:28px;height:28px;border-radius:8px;background:#fff7ed;color:#f59e0b;display:grid;place-items:center;flex-shrink:0}
.satria-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:1024px){.satria-form-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.satria-form-grid{grid-template-columns:1fr}}
.fg label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);display:flex;align-items:center;gap:6px}
.fg label::before{content:'';width:3px;height:10px;border-radius:2px;background:var(--acc);display:inline-block}
.satria-input,.satria-select{height:44px !important;padding:0 14px !important;border-radius:12px !important;border:1px solid var(--bd) !important;background:var(--card-solid) !important;transition:all .18s var(--ease) !important}
.satria-input:focus,.satria-select:focus{outline:none !important;border-color:var(--acc) !important;box-shadow:0 0 0 4px var(--acc-ring) !important}
.form-actions{display:flex;justify-content:flex-end;margin-top:18px}
.satria-btn-primary{height:42px;padding:0 20px;border-radius:9999px;background:var(--acc-grad-kh);color:white;border:none;font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 20px rgba(15,118,110,.28);cursor:pointer;transition:all .18s var(--ease)}
.satria-btn-primary:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(15,118,110,.35)}
.satria-btn-primary:active{transform:translateY(0) scale(.98)}
.satria-table-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:0;box-shadow:var(--shadow-sm);overflow:hidden;margin-bottom:18px}
.table-card-head{padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
.table-card-head .table-title{display:flex;align-items:center;gap:10px;font-weight:800;font-size:14px}
.table-card-head .title-accent{width:4px;height:16px;border-radius:3px;background:var(--acc-grad-kh)}
.count-badge{background:var(--bg-2);border:1px solid var(--bd);padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:700;color:var(--mut)}
.satria-table-card .table-wrap{margin:0;border:none;box-shadow:none;border-radius:0}
.satria-master-note{font-size:12.5px;color:var(--mut);padding:0 4px;margin-top:4px}


/* ===== SATRIA GLOBAL PERFORMANCE OPTIMIZATION - Lead Dev 24 Okt 2026 ===== */
/* Goal: ringan di desktop, Android, iPhone tanpa hilangkan premium look */

/* 1. Reduce heavy effects on all devices, disable on mobile */
@media (max-width: 768px){
  .bg-blobs, .blob, .noise, body::before{display:none !important}
  .card, .satria-kpi-card, .satria-form-card, .satria-table-card{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}
  :root{--shadow-sm:0 2px 8px rgba(15,23,42,.06);--shadow-md:0 6px 16px rgba(15,23,42,.08);--shadow-lg:0 12px 24px rgba(15,23,42,.10);--shadow-glow:0 4px 12px rgba(15,118,110,.14)}
  .card:hover, .satria-kpi-card:hover{transform:none !important}
}
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;scroll-behavior:auto !important}
  .bg-blobs, .blob{display:none !important}
}

/* 2. Optimize header & nav for mobile */
header{backdrop-filter:blur(12px) saturate(140%) !important;-webkit-backdrop-filter:blur(12px) saturate(140%) !important}
@media (max-width: 768px){
  :root{--header-h:64px;--nav-h:52px}
  header{padding:0 12px !important;gap:8px !important}
  #nav{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;position:sticky;top:var(--header-h);z-index:9;background:var(--bg);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd)}
  #nav::-webkit-scrollbar{display:none}
  .nav-track{flex-wrap:nowrap !important;overflow:visible !important}
  main{padding:16px 12px !important}
  .satria-kpi-grid{grid-template-columns:1fr 1fr !important;gap:12px !important}
  .satria-form-grid{grid-template-columns:1fr !important}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{min-width:600px}
  .row{flex-wrap:wrap}
  input, select, textarea, button{min-height:44px} /* Apple HIG & Android touch target */
}

/* 3. Ultra-light cards on mobile, premium on desktop */
.card, .satria-kpi-card, .satria-form-card, .satria-table-card, .satria-master-nav-card, .satria-scope-card{
  will-change:auto; /* remove will-change heavy */
  contain:layout style; /* CSS containment for performance */
}
@media (min-width: 769px){
  .card:hover{transform:translateY(-2px)}
}

/* 4. Optimize fonts & rendering */
html{font-display:swap}
body{content-visibility:auto;contain-intrinsic-size:1px 1000px}
*{-webkit-tap-highlight-color:rgba(15,118,110,.15)}
input, select, textarea, button{font-size:16px !important} /* Prevent iOS zoom on focus - 16px minimum */
@media (min-width: 769px){
  input, select, textarea{font-size:14px !important}
}

/* 5. Optimize images & media */
img{max-width:100%;height:auto;content-visibility:auto}
svg{flex-shrink:0}

/* 6. Sticky header optimization */
header{position:sticky;top:0;z-index:100;will-change:transform;transform:translateZ(0)}

/* 7. Table performance */
.table-wrap{contain:layout}
table{border-collapse:collapse;table-layout:auto}
th, td{white-space:nowrap}
@media (max-width: 768px){
  th, td{white-space:normal;word-break:break-word}
}

/* 8. Button & interactive optimization */
button, [data-act]{touch-action:manipulation;user-select:none;-webkit-user-select:none}
button:active{transform:scale(.97)}

/* 9. Reduce paint areas */
.satria-kpi-card::before, .card::before, .card::after{pointer-events:none}

/* 10. Dark mode mobile optimization */
:root[data-theme="dark"] .bg-blobs{display:none}
:root[data-theme="dark"] .card{backdrop-filter:none}

/* 11. Loading & skeleton optimization */
.mut{will-change:auto}

/* 12. Form optimization for mobile */
.fg{min-width:0 !important;flex:1 1 100%}
@media (min-width: 640px){.fg{min-width:220px !important;flex:1 !important}}

/* 13. Optimize scroll */
html{scroll-behavior:smooth}
@media (max-width: 768px){html{scroll-behavior:auto}}
main{overflow-anchor:none}

/* 14. Critical CSS: make first paint fast */
#main{animation:fadeIn .24s var(--ease-out)}

/* 15. iOS safe area */
@supports (padding: max(0px)){
  body{padding-left:max(0px, env(safe-area-inset-left));padding-right:max(0px, env(safe-area-inset-right))}
  header{padding-left:max(12px, env(safe-area-inset-left));padding-right:max(12px, env(safe-area-inset-right))}
}


/* ===== VIRTUAL SCROLL FOR PAKET & HPS - Lead Dev Patch ===== */
.satria-virtual-table{background:var(--card);border:1px solid var(--bd);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-sm)}
.satria-virtual-header{display:grid;grid-template-columns:56px 140px 1fr 160px 120px 120px 120px 120px;gap:0;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);padding:0 4px;position:sticky;top:0;z-index:2}
.satria-virtual-header > div{padding:12px 10px;display:flex;align-items:center}
.satria-virtual-header .n{justify-content:flex-end}
.satria-virtual-viewport{overflow:auto;-webkit-overflow-scrolling:touch;position:relative;background:var(--card-solid);contain:layout}
.satria-virtual-viewport::-webkit-scrollbar{width:8px;height:8px}
.satria-virtual-viewport::-webkit-scrollbar-thumb{background:var(--bd-strong);border-radius:9999px}
.satria-virtual-row{display:grid;grid-template-columns:56px 140px 1fr 160px 120px 120px 120px 120px;gap:0;border-bottom:1px solid var(--bg-2);background:var(--card-solid);transition:background .12s;align-items:center;min-height:56px}
.satria-virtual-row:hover{background:var(--bg)}
.satria-virtual-row > div{padding:10px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.satria-virtual-row > div.n{justify-content:flex-end;text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.satria-virtual-row a{color:var(--acc-vivid);font-weight:600;text-decoration:none}
.satria-virtual-row a:hover{text-decoration:underline}
.satria-virtual-footer{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-2);border-top:1px solid var(--bd);font-size:11px;color:var(--mut);font-weight:600}
.satria-virtual-footer .mut{color:var(--mut-2)}
/* HPS virtual */
.hps-virtual-table{background:var(--card);border:1px solid var(--bd);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-sm)}
.hps-virtual-header{display:grid;grid-template-columns:1fr 110px 110px 150px 140px 56px;gap:0;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);position:sticky;top:0;z-index:2}
.hps-virtual-header > div{padding:11px 10px}
.hps-virtual-header .n{text-align:right}
.hps-virtual-viewport{overflow:auto;max-height:520px;-webkit-overflow-scrolling:touch;background:var(--card-solid);contain:layout}
.hps-virtual-row{display:grid;grid-template-columns:1fr 110px 110px 150px 140px 56px;gap:0;border-bottom:1px solid var(--bg-2);align-items:center;background:var(--card-solid);min-height:52px;transition:background .12s}
.hps-virtual-row:hover{background:var(--bg)}
.hps-virtual-row > div{padding:6px 8px}
.hps-virtual-row input{height:36px !important;font-size:13px !important}
.hps-virtual-row .n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
@media(max-width:768px){
  .satria-virtual-header, .satria-virtual-row{grid-template-columns:48px 110px 1fr 90px 90px;gap:0}
  .satria-virtual-header > div:nth-child(4), .satria-virtual-row > div:nth-child(4),
  .satria-virtual-header > div:nth-child(7), .satria-virtual-row > div:nth-child(7),
  .satria-virtual-header > div:nth-child(8), .satria-virtual-row > div:nth-child(8){display:none}
  .hps-virtual-header, .hps-virtual-row{grid-template-columns:1fr 80px 70px 90px 56px}
  .hps-virtual-header > div:nth-child(2), .hps-virtual-row > div:nth-child(2){display:none}
  .satria-virtual-viewport{height:60vh !important;max-height:60vh !important}
  .hps-virtual-viewport{max-height:50vh !important}
}


/* ===== DOKUMEN PENGADAAN - LAZY LOAD + VIRTUAL SCROLL ===== */
.satria-dok-toolbar{position:sticky;top:var(--header-h);z-index:20;background:var(--card);backdrop-filter:blur(12px);border:1px solid var(--bd);border-radius:16px;padding:14px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.satria-dok-toolbar .row{flex-wrap:nowrap;gap:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}
.satria-dok-toolbar .row::-webkit-scrollbar{display:none}
.satria-dok-toolbar select#selPaket{min-width:280px;max-width:420px;flex-shrink:0}
.doc-tabs-scroll{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:4px 0;flex-wrap:nowrap;flex:1}
.doc-tabs-scroll::-webkit-scrollbar{display:none}
.doc-tabs-scroll button{scroll-snap-align:start;white-space:nowrap;flex-shrink:0;height:36px;padding:0 14px;border-radius:9999px;font-size:12.5px;font-weight:600}
.satria-doc-lazy-container{position:relative;min-height:400px}
.satria-doc-skeleton{display:grid;place-items:center;min-height:400px;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:40px;color:var(--mut);font-size:14px}
.satria-doc-skeleton .spinner{width:32px;height:32px;border:3px solid var(--bd);border-top-color:var(--acc);border-radius:50%;animation:spin 1s linear infinite;margin-bottom:12px}
@keyframes spin{to{transform:rotate(360deg)}}
.doc{content-visibility:auto;contain-intrinsic-size:0 800px;background:var(--card-solid);border:1px solid var(--bd);border-radius:16px;padding:24px;box-shadow:var(--shadow-sm);overflow:hidden;position:relative}
.doc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-kh);opacity:.8}
.doc.doc-landscape{overflow-x:auto}
.doc table{border-collapse:collapse;width:100%;table-layout:auto}
.doc table th, .doc table td{border:1px solid var(--bd);padding:8px 10px;font-size:12.5px}
.doc table th{background:var(--bg-2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.doc img{max-width:100%;height:auto;content-visibility:auto}
.doc img[loading="lazy"]{background:var(--bg-2)}
/* Virtual scroll for large doc tables */
.doc-virtual-table{border:1px solid var(--bd);border-radius:12px;overflow:hidden;background:var(--card-solid);margin:12px 0}
.doc-virtual-header{display:grid;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);position:sticky;top:0;z-index:1}
.doc-virtual-viewport{overflow:auto;max-height:420px;-webkit-overflow-scrolling:touch;contain:layout}
.doc-virtual-row{display:grid;border-bottom:1px solid var(--bg-2);align-items:center;min-height:44px;background:var(--card-solid);transition:background .12s}
.doc-virtual-row:hover{background:var(--bg)}
.doc-virtual-row > div{padding:7px 10px;font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
.doc-virtual-footer{padding:8px 12px;background:var(--bg-2);border-top:1px solid var(--bd);font-size:11px;color:var(--mut);display:flex;justify-content:space-between}
@media(max-width:768px){
  .satria-dok-toolbar{top:56px;padding:10px;border-radius:12px}
  .satria-dok-toolbar .row{flex-direction:column;align-items:stretch}
  .satria-dok-toolbar select#selPaket{max-width:100%;width:100%}
  .doc{padding:14px;border-radius:12px}
  .doc table{font-size:11px;min-width:500px;display:block;overflow-x:auto;white-space:nowrap}
  .doc table th, .doc table td{white-space:normal;word-break:break-word}
  .doc-virtual-viewport{max-height:50vh}
}

</style>
    <section class="satria-user-modal" role="dialog" aria-modal="true" aria-labelledby="satriaUserModalTitle">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div><h2 id="satriaUserModalTitle">Tambah akun operator</h2><p>Buat akun Auth dan membership SATRIA.</p></div>
        <button type="button" data-satria-user-close aria-label="Tutup modal">Tutup</button>
      </div>
      <div class="satria-user-note">
        Email dummy harus berformat valid dan unik, tetapi tidak perlu menerima email. Tidak ada email konfirmasi yang dikirim. Password awal wajib disampaikan kepada operator melalui saluran terpisah yang aman; pemulihan lewat email tidak tersedia untuk alamat dummy.
      </div>
      <form id="satriaCreateUserForm" autocomplete="off">
        <label for="satriaNewUserName">Nama operator</label>
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
          <option value="admin" disabled>Admin (dinonaktifkan oleh kebijakan server)</option>
        </select>

        <fieldset class="satria-opd-fieldset" id="satriaCreateUserOpdFieldset">
          <legend>OPD yang dapat diakses Operator</legend>
          <div class="satria-opd-choices" id="satriaCreateUserOpdChoices"><p class="satria-opd-empty">Memuat katalog OPD organisasi…</p></div>
          <p class="satria-opd-help">Pilih 1–100 OPD. Daftar berasal dari katalog organisasi di Supabase, bukan dari input bebas di browser.</p>
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
    if (!client || !member) {
      toast('Masuk ke Supabase terlebih dahulu.');
      return;
    }
    if (member.role !== 'admin') {
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
    if (!client || !member || member.role !== 'admin' || !orgId) {
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
    if (!opdIds.length || opdIds.length > 100) {
      setMessage('Pilih minimal satu dan maksimal 100 OPD untuk user Operator.', 'error');
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
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData?.user || authData.user.id !== member.id) {
        throw new Error('Sesi login tidak valid. Masuk kembali sebagai admin.');
      }

      const { data, error } = await client.functions.invoke('admin-create-user', {
        body: {
          organization_id: orgId,
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
      setMessage(`Akun berhasil dibuat. UID: ${data.user.id}. Scope OPD: ${opdIds.length}; tahun: ${yearIds.join(', ')}. Email ditandai terkonfirmasi dan tidak ada email yang dikirim. Sampaikan password awal secara aman kepada operator.${auditWarning}`, auditWarning ? 'error' : 'ok');
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
      addCell(row, user.display_name || user.email || ('Pengguna ' + String(user.id || '').slice(0, 8)));
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
    if (!client || !requestedOrg) return { opds: [], note: 'Sesi Supabase belum aktif.' };
    let snapshot;
    const { data: snapshotRow, error: snapshotError } = await client
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
      const { data: existing, error: existingError } = await client
        .from('satria_opds').select('opd_id,active').eq('organization_id', requestedOrg);
      if (existingError) {
        return { opds: [], note: 'Tabel katalog OPD belum siap. Terapkan migrasi assignment OPD: ' + existingError.message };
      }
      for (const old of existing || []) {
        if (old.active && !activeIds.has(old.opd_id)) {
          const { error: deactivateError } = await client.from('satria_opds')
            .update({ active: false, code: null }).eq('organization_id', requestedOrg).eq('opd_id', old.opd_id);
          if (deactivateError) return { opds: [], note: 'OPD lama tidak dapat dinonaktifkan: ' + deactivateError.message };
        }
      }
      const { error: upsertError } = await client.from('satria_opds')
        .upsert(normalized, { onConflict: 'organization_id,opd_id' });
      if (upsertError) {
        return { opds: [], note: 'Sinkronisasi master OPD gagal. Pastikan migrasi satria_opds sudah diterapkan: ' + upsertError.message };
      }
    }

    const { data: catalog, error: catalogError } = await client.from('satria_opds')
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
    const { data: rows, error: rowsError, count } = await client.from('satria_memberships')
      .select('user_id,role,active,created_at,login_email,display_name', { count: 'exact' })
      .eq('organization_id', requestedOrg)
      .order('created_at', { ascending: false })
      .order('user_id', { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (rowsError) {
      // Permit older schemas to render a limited roster, but keep the diagnostic visible.
      const fallback = await client.from('satria_memberships')
        .select('user_id,role,active,created_at', { count: 'exact' })
        .eq('organization_id', requestedOrg)
        .order('created_at', { ascending: false })
        .order('user_id', { ascending: true })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (fallback.error) throw new Error('Daftar membership tidak dapat dibaca melalui RLS: ' + fallback.error.message);
      const [catalogResult, yearsResult] = await Promise.all([
        loadCatalogFromCloudSnapshot(requestedOrg),
        client.from('satria_membership_years').select('user_id,fiscal_year').eq('organization_id', requestedOrg)
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
      userIds.length ? client.from('satria_membership_opds').select('user_id,opd_id').eq('organization_id', requestedOrg).in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length ? client.from('satria_membership_years').select('user_id,fiscal_year').eq('organization_id', requestedOrg).in('user_id', userIds)
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
      const { data, error } = await client.functions.invoke('admin-list-users', {
        body: {
          action: 'sync_local_catalog',
          organization_id: orgId,
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
      let deploymentNote = '';
      try {
        let payload = null;
        try {
          const { data, error } = await client.functions.invoke('admin-list-users', {
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

        if (requestedOrg !== orgId || !isAuthorizedInUi()) return null;
        if (!payload) payload = await loadUsersDirectlyFromMemberships(requestedOrg);
        else if (!payload.opds.length) {
          // Older snapshot may not yet have been synced into the normalized catalog.
          const catalogResult = await loadCatalogFromCloudSnapshot(requestedOrg);
          if (catalogResult.opds.length) payload = { ...payload, opds: catalogResult.opds };
          else payload = { ...payload, catalog_note: catalogResult.note };
        }
        if (requestedOrg !== orgId || !isAuthorizedInUi()) return null;

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
        const safeMessage = error instanceof Error ? error.message : 'Daftar pengguna tidak dapat dimuat.';
        setCatalog([]);
        renderRows([]);
        setStatus(`${safeMessage} Pastikan migrasi 20261024053100_satria_catalog_and_assignment_repair.sql telah diterapkan dan akun admin aktif.`, 'error');
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
      
/* ===== SATRIA DATA MASTER PERFECTED - Lead Dev Patch 24 Okt 2026 ===== */
.satria-scope-card{display:flex;gap:14px;padding:16px 18px;border-radius:16px;border:1px solid var(--bd);background:linear-gradient(135deg, rgba(15,118,110,.06), rgba(14,165,233,.05));position:relative;overflow:hidden;margin-bottom:18px}
.satria-scope-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--acc-grad-kh)}
.satria-scope-card.scope-admin{background:linear-gradient(135deg, rgba(37,99,235,.06), rgba(15,118,110,.06))}
.satria-scope-card .scope-icon{width:36px;height:36px;border-radius:10px;background:var(--acc-soft);color:var(--acc);display:grid;place-items:center;flex-shrink:0}
.satria-scope-card .scope-icon svg{width:20px;height:20px}
.satria-scope-card b{color:var(--ink)}
.satria-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
@media(max-width:1180px){.satria-kpi-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.satria-kpi-grid{grid-template-columns:1fr}}
.satria-kpi-card{background:var(--card);backdrop-filter:blur(16px) saturate(160%);border:1px solid var(--bd);border-radius:20px;padding:18px 20px;position:relative;overflow:hidden;box-shadow:var(--shadow-sm);transition:all .26s var(--ease);min-height:132px;display:flex;flex-direction:column;justify-content:space-between}
.satria-kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-kh);opacity:.9}
.satria-kpi-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-md);border-color:var(--bd-strong)}
.satria-kpi-card .kpi-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.satria-kpi-card .kpi-icon{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg, var(--acc-soft), var(--acc-soft-2));color:var(--acc);display:grid;place-items:center;border:1px solid var(--bd)}
.satria-kpi-card .kpi-icon svg{width:20px;height:20px}
.satria-kpi-card .kpi-badge{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--acc);background:var(--acc-soft);border:1px solid var(--bd);padding:4px 8px;border-radius:9999px;display:flex;align-items:center;gap:5px}
.satria-kpi-card .kpi-badge .dot{width:6px;height:6px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 4px var(--acc-ring);animation:pulseDot 2s infinite}
.satria-kpi-card .kpi-label{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);margin-bottom:6px}
.satria-kpi-card .kpi-value{font-size:32px;font-weight:800;line-height:1;color:var(--ink);letter-spacing:-.03em}
.satria-kpi-card .kpi-foot{margin-top:12px;font-size:11.5px;color:var(--mut);display:flex;align-items:center;gap:6px}
.live-dot{width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 0 3px rgba(16,185,129,.18);position:relative}
.live-dot::after{content:'';position:absolute;inset:0;border-radius:50%;background:#10B981;animation:pulseDot 2s infinite}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 var(--acc-ring)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
.satria-master-nav-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:14px;box-shadow:var(--shadow-sm);margin-bottom:18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.master-tabs{display:flex;flex-wrap:wrap;gap:8px}
.master-tab{height:38px;padding:0 16px;border-radius:9999px;border:1px solid var(--bd);background:var(--card-solid);color:var(--ink-2);font-size:13px;font-weight:600;transition:all .18s var(--ease);cursor:pointer}
.master-tab:hover{background:var(--bg-2);color:var(--ink);transform:translateY(-1px)}
.master-tab.active{background:var(--acc-grad-kh);color:white;border-color:transparent;box-shadow:0 6px 18px rgba(15,118,110,.28);transform:translateY(-1px)}
.master-search-wrap{position:relative;flex:1;min-width:280px;max-width:420px}
.master-search-wrap .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--mut-2);pointer-events:none}
.master-search{width:100%;height:42px;padding:0 14px 0 38px;border-radius:12px;border:1px solid var(--bd);background:var(--bg);color:var(--ink);font-size:13.5px;transition:all .18s var(--ease)}
.master-search:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 4px var(--acc-ring);background:var(--card-solid)}
.satria-form-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:22px;box-shadow:var(--shadow-sm);margin-bottom:18px;position:relative;overflow:hidden}
.satria-form-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-soft);opacity:.8}
.form-card-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.form-card-head .title-accent{width:4px;height:18px;border-radius:3px;background:var(--acc-grad-kh);box-shadow:0 2px 6px rgba(15,118,110,.3)}
.form-card-head h3{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em}
.satria-shared-note{display:flex;gap:12px;padding:12px 14px;border-radius:12px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:13px;margin-bottom:16px}
.satria-shared-note .shared-icon{width:28px;height:28px;border-radius:8px;background:#fff7ed;color:#f59e0b;display:grid;place-items:center;flex-shrink:0}
.satria-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:1024px){.satria-form-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.satria-form-grid{grid-template-columns:1fr}}
.fg label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);display:flex;align-items:center;gap:6px}
.fg label::before{content:'';width:3px;height:10px;border-radius:2px;background:var(--acc);display:inline-block}
.satria-input,.satria-select{height:44px !important;padding:0 14px !important;border-radius:12px !important;border:1px solid var(--bd) !important;background:var(--card-solid) !important;transition:all .18s var(--ease) !important}
.satria-input:focus,.satria-select:focus{outline:none !important;border-color:var(--acc) !important;box-shadow:0 0 0 4px var(--acc-ring) !important}
.form-actions{display:flex;justify-content:flex-end;margin-top:18px}
.satria-btn-primary{height:42px;padding:0 20px;border-radius:9999px;background:var(--acc-grad-kh);color:white;border:none;font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 20px rgba(15,118,110,.28);cursor:pointer;transition:all .18s var(--ease)}
.satria-btn-primary:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(15,118,110,.35)}
.satria-btn-primary:active{transform:translateY(0) scale(.98)}
.satria-table-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:0;box-shadow:var(--shadow-sm);overflow:hidden;margin-bottom:18px}
.table-card-head{padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
.table-card-head .table-title{display:flex;align-items:center;gap:10px;font-weight:800;font-size:14px}
.table-card-head .title-accent{width:4px;height:16px;border-radius:3px;background:var(--acc-grad-kh)}
.count-badge{background:var(--bg-2);border:1px solid var(--bd);padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:700;color:var(--mut)}
.satria-table-card .table-wrap{margin:0;border:none;box-shadow:none;border-radius:0}
.satria-master-note{font-size:12.5px;color:var(--mut);padding:0 4px;margin-top:4px}


/* ===== SATRIA GLOBAL PERFORMANCE OPTIMIZATION - Lead Dev 24 Okt 2026 ===== */
/* Goal: ringan di desktop, Android, iPhone tanpa hilangkan premium look */

/* 1. Reduce heavy effects on all devices, disable on mobile */
@media (max-width: 768px){
  .bg-blobs, .blob, .noise, body::before{display:none !important}
  .card, .satria-kpi-card, .satria-form-card, .satria-table-card{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}
  :root{--shadow-sm:0 2px 8px rgba(15,23,42,.06);--shadow-md:0 6px 16px rgba(15,23,42,.08);--shadow-lg:0 12px 24px rgba(15,23,42,.10);--shadow-glow:0 4px 12px rgba(15,118,110,.14)}
  .card:hover, .satria-kpi-card:hover{transform:none !important}
}
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;scroll-behavior:auto !important}
  .bg-blobs, .blob{display:none !important}
}

/* 2. Optimize header & nav for mobile */
header{backdrop-filter:blur(12px) saturate(140%) !important;-webkit-backdrop-filter:blur(12px) saturate(140%) !important}
@media (max-width: 768px){
  :root{--header-h:64px;--nav-h:52px}
  header{padding:0 12px !important;gap:8px !important}
  #nav{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;position:sticky;top:var(--header-h);z-index:9;background:var(--bg);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd)}
  #nav::-webkit-scrollbar{display:none}
  .nav-track{flex-wrap:nowrap !important;overflow:visible !important}
  main{padding:16px 12px !important}
  .satria-kpi-grid{grid-template-columns:1fr 1fr !important;gap:12px !important}
  .satria-form-grid{grid-template-columns:1fr !important}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{min-width:600px}
  .row{flex-wrap:wrap}
  input, select, textarea, button{min-height:44px} /* Apple HIG & Android touch target */
}

/* 3. Ultra-light cards on mobile, premium on desktop */
.card, .satria-kpi-card, .satria-form-card, .satria-table-card, .satria-master-nav-card, .satria-scope-card{
  will-change:auto; /* remove will-change heavy */
  contain:layout style; /* CSS containment for performance */
}
@media (min-width: 769px){
  .card:hover{transform:translateY(-2px)}
}

/* 4. Optimize fonts & rendering */
html{font-display:swap}
body{content-visibility:auto;contain-intrinsic-size:1px 1000px}
*{-webkit-tap-highlight-color:rgba(15,118,110,.15)}
input, select, textarea, button{font-size:16px !important} /* Prevent iOS zoom on focus - 16px minimum */
@media (min-width: 769px){
  input, select, textarea{font-size:14px !important}
}

/* 5. Optimize images & media */
img{max-width:100%;height:auto;content-visibility:auto}
svg{flex-shrink:0}

/* 6. Sticky header optimization */
header{position:sticky;top:0;z-index:100;will-change:transform;transform:translateZ(0)}

/* 7. Table performance */
.table-wrap{contain:layout}
table{border-collapse:collapse;table-layout:auto}
th, td{white-space:nowrap}
@media (max-width: 768px){
  th, td{white-space:normal;word-break:break-word}
}

/* 8. Button & interactive optimization */
button, [data-act]{touch-action:manipulation;user-select:none;-webkit-user-select:none}
button:active{transform:scale(.97)}

/* 9. Reduce paint areas */
.satria-kpi-card::before, .card::before, .card::after{pointer-events:none}

/* 10. Dark mode mobile optimization */
:root[data-theme="dark"] .bg-blobs{display:none}
:root[data-theme="dark"] .card{backdrop-filter:none}

/* 11. Loading & skeleton optimization */
.mut{will-change:auto}

/* 12. Form optimization for mobile */
.fg{min-width:0 !important;flex:1 1 100%}
@media (min-width: 640px){.fg{min-width:220px !important;flex:1 !important}}

/* 13. Optimize scroll */
html{scroll-behavior:smooth}
@media (max-width: 768px){html{scroll-behavior:auto}}
main{overflow-anchor:none}

/* 14. Critical CSS: make first paint fast */
#main{animation:fadeIn .24s var(--ease-out)}

/* 15. iOS safe area */
@supports (padding: max(0px)){
  body{padding-left:max(0px, env(safe-area-inset-left));padding-right:max(0px, env(safe-area-inset-right))}
  header{padding-left:max(12px, env(safe-area-inset-left));padding-right:max(12px, env(safe-area-inset-right))}
}


/* ===== VIRTUAL SCROLL FOR PAKET & HPS - Lead Dev Patch ===== */
.satria-virtual-table{background:var(--card);border:1px solid var(--bd);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-sm)}
.satria-virtual-header{display:grid;grid-template-columns:56px 140px 1fr 160px 120px 120px 120px 120px;gap:0;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);padding:0 4px;position:sticky;top:0;z-index:2}
.satria-virtual-header > div{padding:12px 10px;display:flex;align-items:center}
.satria-virtual-header .n{justify-content:flex-end}
.satria-virtual-viewport{overflow:auto;-webkit-overflow-scrolling:touch;position:relative;background:var(--card-solid);contain:layout}
.satria-virtual-viewport::-webkit-scrollbar{width:8px;height:8px}
.satria-virtual-viewport::-webkit-scrollbar-thumb{background:var(--bd-strong);border-radius:9999px}
.satria-virtual-row{display:grid;grid-template-columns:56px 140px 1fr 160px 120px 120px 120px 120px;gap:0;border-bottom:1px solid var(--bg-2);background:var(--card-solid);transition:background .12s;align-items:center;min-height:56px}
.satria-virtual-row:hover{background:var(--bg)}
.satria-virtual-row > div{padding:10px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.satria-virtual-row > div.n{justify-content:flex-end;text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.satria-virtual-row a{color:var(--acc-vivid);font-weight:600;text-decoration:none}
.satria-virtual-row a:hover{text-decoration:underline}
.satria-virtual-footer{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-2);border-top:1px solid var(--bd);font-size:11px;color:var(--mut);font-weight:600}
.satria-virtual-footer .mut{color:var(--mut-2)}
/* HPS virtual */
.hps-virtual-table{background:var(--card);border:1px solid var(--bd);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-sm)}
.hps-virtual-header{display:grid;grid-template-columns:1fr 110px 110px 150px 140px 56px;gap:0;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);position:sticky;top:0;z-index:2}
.hps-virtual-header > div{padding:11px 10px}
.hps-virtual-header .n{text-align:right}
.hps-virtual-viewport{overflow:auto;max-height:520px;-webkit-overflow-scrolling:touch;background:var(--card-solid);contain:layout}
.hps-virtual-row{display:grid;grid-template-columns:1fr 110px 110px 150px 140px 56px;gap:0;border-bottom:1px solid var(--bg-2);align-items:center;background:var(--card-solid);min-height:52px;transition:background .12s}
.hps-virtual-row:hover{background:var(--bg)}
.hps-virtual-row > div{padding:6px 8px}
.hps-virtual-row input{height:36px !important;font-size:13px !important}
.hps-virtual-row .n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
@media(max-width:768px){
  .satria-virtual-header, .satria-virtual-row{grid-template-columns:48px 110px 1fr 90px 90px;gap:0}
  .satria-virtual-header > div:nth-child(4), .satria-virtual-row > div:nth-child(4),
  .satria-virtual-header > div:nth-child(7), .satria-virtual-row > div:nth-child(7),
  .satria-virtual-header > div:nth-child(8), .satria-virtual-row > div:nth-child(8){display:none}
  .hps-virtual-header, .hps-virtual-row{grid-template-columns:1fr 80px 70px 90px 56px}
  .hps-virtual-header > div:nth-child(2), .hps-virtual-row > div:nth-child(2){display:none}
  .satria-virtual-viewport{height:60vh !important;max-height:60vh !important}
  .hps-virtual-viewport{max-height:50vh !important}
}


/* ===== DOKUMEN PENGADAAN - LAZY LOAD + VIRTUAL SCROLL ===== */
.satria-dok-toolbar{position:sticky;top:var(--header-h);z-index:20;background:var(--card);backdrop-filter:blur(12px);border:1px solid var(--bd);border-radius:16px;padding:14px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.satria-dok-toolbar .row{flex-wrap:nowrap;gap:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}
.satria-dok-toolbar .row::-webkit-scrollbar{display:none}
.satria-dok-toolbar select#selPaket{min-width:280px;max-width:420px;flex-shrink:0}
.doc-tabs-scroll{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:4px 0;flex-wrap:nowrap;flex:1}
.doc-tabs-scroll::-webkit-scrollbar{display:none}
.doc-tabs-scroll button{scroll-snap-align:start;white-space:nowrap;flex-shrink:0;height:36px;padding:0 14px;border-radius:9999px;font-size:12.5px;font-weight:600}
.satria-doc-lazy-container{position:relative;min-height:400px}
.satria-doc-skeleton{display:grid;place-items:center;min-height:400px;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:40px;color:var(--mut);font-size:14px}
.satria-doc-skeleton .spinner{width:32px;height:32px;border:3px solid var(--bd);border-top-color:var(--acc);border-radius:50%;animation:spin 1s linear infinite;margin-bottom:12px}
@keyframes spin{to{transform:rotate(360deg)}}
.doc{content-visibility:auto;contain-intrinsic-size:0 800px;background:var(--card-solid);border:1px solid var(--bd);border-radius:16px;padding:24px;box-shadow:var(--shadow-sm);overflow:hidden;position:relative}
.doc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-kh);opacity:.8}
.doc.doc-landscape{overflow-x:auto}
.doc table{border-collapse:collapse;width:100%;table-layout:auto}
.doc table th, .doc table td{border:1px solid var(--bd);padding:8px 10px;font-size:12.5px}
.doc table th{background:var(--bg-2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.doc img{max-width:100%;height:auto;content-visibility:auto}
.doc img[loading="lazy"]{background:var(--bg-2)}
/* Virtual scroll for large doc tables */
.doc-virtual-table{border:1px solid var(--bd);border-radius:12px;overflow:hidden;background:var(--card-solid);margin:12px 0}
.doc-virtual-header{display:grid;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);position:sticky;top:0;z-index:1}
.doc-virtual-viewport{overflow:auto;max-height:420px;-webkit-overflow-scrolling:touch;contain:layout}
.doc-virtual-row{display:grid;border-bottom:1px solid var(--bg-2);align-items:center;min-height:44px;background:var(--card-solid);transition:background .12s}
.doc-virtual-row:hover{background:var(--bg)}
.doc-virtual-row > div{padding:7px 10px;font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
.doc-virtual-footer{padding:8px 12px;background:var(--bg-2);border-top:1px solid var(--bd);font-size:11px;color:var(--mut);display:flex;justify-content:space-between}
@media(max-width:768px){
  .satria-dok-toolbar{top:56px;padding:10px;border-radius:12px}
  .satria-dok-toolbar .row{flex-direction:column;align-items:stretch}
  .satria-dok-toolbar select#selPaket{max-width:100%;width:100%}
  .doc{padding:14px;border-radius:12px}
  .doc table{font-size:11px;min-width:500px;display:block;overflow-x:auto;white-space:nowrap}
  .doc table th, .doc table td{white-space:normal;word-break:break-word}
  .doc-virtual-viewport{max-height:50vh}
}

</style>
      <section class="satria-edit-opd-dialog" role="dialog" aria-modal="true" aria-labelledby="satriaEditUserOpdTitle">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><h2 id="satriaEditUserOpdTitle">Atur OPD Pengguna</h2><p id="satriaEditUserOpdName"></p></div><button type="button" data-satria-edit-opd-close>Tutup</button></div>
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
    if (!user || !['operator', 'viewer'].includes(user.role) || !user.active) return;
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
      // New RPC binds the actor to auth.uid() and performs replacement + audit atomically.
      const { data: savedCount, error: rpcError } = await client.rpc('satria_admin_assign_my_membership_opds', {
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
      if (requestedOrg !== orgId || !isAuthorizedInUi()) throw new Error('Organisasi atau sesi berubah selama proses penyimpanan. Muat ulang daftar.');
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
      
/* ===== SATRIA DATA MASTER PERFECTED - Lead Dev Patch 24 Okt 2026 ===== */
.satria-scope-card{display:flex;gap:14px;padding:16px 18px;border-radius:16px;border:1px solid var(--bd);background:linear-gradient(135deg, rgba(15,118,110,.06), rgba(14,165,233,.05));position:relative;overflow:hidden;margin-bottom:18px}
.satria-scope-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--acc-grad-kh)}
.satria-scope-card.scope-admin{background:linear-gradient(135deg, rgba(37,99,235,.06), rgba(15,118,110,.06))}
.satria-scope-card .scope-icon{width:36px;height:36px;border-radius:10px;background:var(--acc-soft);color:var(--acc);display:grid;place-items:center;flex-shrink:0}
.satria-scope-card .scope-icon svg{width:20px;height:20px}
.satria-scope-card b{color:var(--ink)}
.satria-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
@media(max-width:1180px){.satria-kpi-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.satria-kpi-grid{grid-template-columns:1fr}}
.satria-kpi-card{background:var(--card);backdrop-filter:blur(16px) saturate(160%);border:1px solid var(--bd);border-radius:20px;padding:18px 20px;position:relative;overflow:hidden;box-shadow:var(--shadow-sm);transition:all .26s var(--ease);min-height:132px;display:flex;flex-direction:column;justify-content:space-between}
.satria-kpi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-kh);opacity:.9}
.satria-kpi-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-md);border-color:var(--bd-strong)}
.satria-kpi-card .kpi-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.satria-kpi-card .kpi-icon{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg, var(--acc-soft), var(--acc-soft-2));color:var(--acc);display:grid;place-items:center;border:1px solid var(--bd)}
.satria-kpi-card .kpi-icon svg{width:20px;height:20px}
.satria-kpi-card .kpi-badge{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--acc);background:var(--acc-soft);border:1px solid var(--bd);padding:4px 8px;border-radius:9999px;display:flex;align-items:center;gap:5px}
.satria-kpi-card .kpi-badge .dot{width:6px;height:6px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 4px var(--acc-ring);animation:pulseDot 2s infinite}
.satria-kpi-card .kpi-label{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);margin-bottom:6px}
.satria-kpi-card .kpi-value{font-size:32px;font-weight:800;line-height:1;color:var(--ink);letter-spacing:-.03em}
.satria-kpi-card .kpi-foot{margin-top:12px;font-size:11.5px;color:var(--mut);display:flex;align-items:center;gap:6px}
.live-dot{width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 0 3px rgba(16,185,129,.18);position:relative}
.live-dot::after{content:'';position:absolute;inset:0;border-radius:50%;background:#10B981;animation:pulseDot 2s infinite}
@keyframes pulseDot{0%{box-shadow:0 0 0 0 var(--acc-ring)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
.satria-master-nav-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:14px;box-shadow:var(--shadow-sm);margin-bottom:18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.master-tabs{display:flex;flex-wrap:wrap;gap:8px}
.master-tab{height:38px;padding:0 16px;border-radius:9999px;border:1px solid var(--bd);background:var(--card-solid);color:var(--ink-2);font-size:13px;font-weight:600;transition:all .18s var(--ease);cursor:pointer}
.master-tab:hover{background:var(--bg-2);color:var(--ink);transform:translateY(-1px)}
.master-tab.active{background:var(--acc-grad-kh);color:white;border-color:transparent;box-shadow:0 6px 18px rgba(15,118,110,.28);transform:translateY(-1px)}
.master-search-wrap{position:relative;flex:1;min-width:280px;max-width:420px}
.master-search-wrap .search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--mut-2);pointer-events:none}
.master-search{width:100%;height:42px;padding:0 14px 0 38px;border-radius:12px;border:1px solid var(--bd);background:var(--bg);color:var(--ink);font-size:13.5px;transition:all .18s var(--ease)}
.master-search:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 4px var(--acc-ring);background:var(--card-solid)}
.satria-form-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:22px;box-shadow:var(--shadow-sm);margin-bottom:18px;position:relative;overflow:hidden}
.satria-form-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-soft);opacity:.8}
.form-card-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.form-card-head .title-accent{width:4px;height:18px;border-radius:3px;background:var(--acc-grad-kh);box-shadow:0 2px 6px rgba(15,118,110,.3)}
.form-card-head h3{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em}
.satria-shared-note{display:flex;gap:12px;padding:12px 14px;border-radius:12px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-size:13px;margin-bottom:16px}
.satria-shared-note .shared-icon{width:28px;height:28px;border-radius:8px;background:#fff7ed;color:#f59e0b;display:grid;place-items:center;flex-shrink:0}
.satria-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
@media(max-width:1024px){.satria-form-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.satria-form-grid{grid-template-columns:1fr}}
.fg label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);display:flex;align-items:center;gap:6px}
.fg label::before{content:'';width:3px;height:10px;border-radius:2px;background:var(--acc);display:inline-block}
.satria-input,.satria-select{height:44px !important;padding:0 14px !important;border-radius:12px !important;border:1px solid var(--bd) !important;background:var(--card-solid) !important;transition:all .18s var(--ease) !important}
.satria-input:focus,.satria-select:focus{outline:none !important;border-color:var(--acc) !important;box-shadow:0 0 0 4px var(--acc-ring) !important}
.form-actions{display:flex;justify-content:flex-end;margin-top:18px}
.satria-btn-primary{height:42px;padding:0 20px;border-radius:9999px;background:var(--acc-grad-kh);color:white;border:none;font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 20px rgba(15,118,110,.28);cursor:pointer;transition:all .18s var(--ease)}
.satria-btn-primary:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(15,118,110,.35)}
.satria-btn-primary:active{transform:translateY(0) scale(.98)}
.satria-table-card{background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:0;box-shadow:var(--shadow-sm);overflow:hidden;margin-bottom:18px}
.table-card-head{padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
.table-card-head .table-title{display:flex;align-items:center;gap:10px;font-weight:800;font-size:14px}
.table-card-head .title-accent{width:4px;height:16px;border-radius:3px;background:var(--acc-grad-kh)}
.count-badge{background:var(--bg-2);border:1px solid var(--bd);padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:700;color:var(--mut)}
.satria-table-card .table-wrap{margin:0;border:none;box-shadow:none;border-radius:0}
.satria-master-note{font-size:12.5px;color:var(--mut);padding:0 4px;margin-top:4px}


/* ===== SATRIA GLOBAL PERFORMANCE OPTIMIZATION - Lead Dev 24 Okt 2026 ===== */
/* Goal: ringan di desktop, Android, iPhone tanpa hilangkan premium look */

/* 1. Reduce heavy effects on all devices, disable on mobile */
@media (max-width: 768px){
  .bg-blobs, .blob, .noise, body::before{display:none !important}
  .card, .satria-kpi-card, .satria-form-card, .satria-table-card{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}
  :root{--shadow-sm:0 2px 8px rgba(15,23,42,.06);--shadow-md:0 6px 16px rgba(15,23,42,.08);--shadow-lg:0 12px 24px rgba(15,23,42,.10);--shadow-glow:0 4px 12px rgba(15,118,110,.14)}
  .card:hover, .satria-kpi-card:hover{transform:none !important}
}
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;scroll-behavior:auto !important}
  .bg-blobs, .blob{display:none !important}
}

/* 2. Optimize header & nav for mobile */
header{backdrop-filter:blur(12px) saturate(140%) !important;-webkit-backdrop-filter:blur(12px) saturate(140%) !important}
@media (max-width: 768px){
  :root{--header-h:64px;--nav-h:52px}
  header{padding:0 12px !important;gap:8px !important}
  #nav{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;position:sticky;top:var(--header-h);z-index:9;background:var(--bg);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd)}
  #nav::-webkit-scrollbar{display:none}
  .nav-track{flex-wrap:nowrap !important;overflow:visible !important}
  main{padding:16px 12px !important}
  .satria-kpi-grid{grid-template-columns:1fr 1fr !important;gap:12px !important}
  .satria-form-grid{grid-template-columns:1fr !important}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{min-width:600px}
  .row{flex-wrap:wrap}
  input, select, textarea, button{min-height:44px} /* Apple HIG & Android touch target */
}

/* 3. Ultra-light cards on mobile, premium on desktop */
.card, .satria-kpi-card, .satria-form-card, .satria-table-card, .satria-master-nav-card, .satria-scope-card{
  will-change:auto; /* remove will-change heavy */
  contain:layout style; /* CSS containment for performance */
}
@media (min-width: 769px){
  .card:hover{transform:translateY(-2px)}
}

/* 4. Optimize fonts & rendering */
html{font-display:swap}
body{content-visibility:auto;contain-intrinsic-size:1px 1000px}
*{-webkit-tap-highlight-color:rgba(15,118,110,.15)}
input, select, textarea, button{font-size:16px !important} /* Prevent iOS zoom on focus - 16px minimum */
@media (min-width: 769px){
  input, select, textarea{font-size:14px !important}
}

/* 5. Optimize images & media */
img{max-width:100%;height:auto;content-visibility:auto}
svg{flex-shrink:0}

/* 6. Sticky header optimization */
header{position:sticky;top:0;z-index:100;will-change:transform;transform:translateZ(0)}

/* 7. Table performance */
.table-wrap{contain:layout}
table{border-collapse:collapse;table-layout:auto}
th, td{white-space:nowrap}
@media (max-width: 768px){
  th, td{white-space:normal;word-break:break-word}
}

/* 8. Button & interactive optimization */
button, [data-act]{touch-action:manipulation;user-select:none;-webkit-user-select:none}
button:active{transform:scale(.97)}

/* 9. Reduce paint areas */
.satria-kpi-card::before, .card::before, .card::after{pointer-events:none}

/* 10. Dark mode mobile optimization */
:root[data-theme="dark"] .bg-blobs{display:none}
:root[data-theme="dark"] .card{backdrop-filter:none}

/* 11. Loading & skeleton optimization */
.mut{will-change:auto}

/* 12. Form optimization for mobile */
.fg{min-width:0 !important;flex:1 1 100%}
@media (min-width: 640px){.fg{min-width:220px !important;flex:1 !important}}

/* 13. Optimize scroll */
html{scroll-behavior:smooth}
@media (max-width: 768px){html{scroll-behavior:auto}}
main{overflow-anchor:none}

/* 14. Critical CSS: make first paint fast */
#main{animation:fadeIn .24s var(--ease-out)}

/* 15. iOS safe area */
@supports (padding: max(0px)){
  body{padding-left:max(0px, env(safe-area-inset-left));padding-right:max(0px, env(safe-area-inset-right))}
  header{padding-left:max(12px, env(safe-area-inset-left));padding-right:max(12px, env(safe-area-inset-right))}
}


/* ===== VIRTUAL SCROLL FOR PAKET & HPS - Lead Dev Patch ===== */
.satria-virtual-table{background:var(--card);border:1px solid var(--bd);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-sm)}
.satria-virtual-header{display:grid;grid-template-columns:56px 140px 1fr 160px 120px 120px 120px 120px;gap:0;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);padding:0 4px;position:sticky;top:0;z-index:2}
.satria-virtual-header > div{padding:12px 10px;display:flex;align-items:center}
.satria-virtual-header .n{justify-content:flex-end}
.satria-virtual-viewport{overflow:auto;-webkit-overflow-scrolling:touch;position:relative;background:var(--card-solid);contain:layout}
.satria-virtual-viewport::-webkit-scrollbar{width:8px;height:8px}
.satria-virtual-viewport::-webkit-scrollbar-thumb{background:var(--bd-strong);border-radius:9999px}
.satria-virtual-row{display:grid;grid-template-columns:56px 140px 1fr 160px 120px 120px 120px 120px;gap:0;border-bottom:1px solid var(--bg-2);background:var(--card-solid);transition:background .12s;align-items:center;min-height:56px}
.satria-virtual-row:hover{background:var(--bg)}
.satria-virtual-row > div{padding:10px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.satria-virtual-row > div.n{justify-content:flex-end;text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.satria-virtual-row a{color:var(--acc-vivid);font-weight:600;text-decoration:none}
.satria-virtual-row a:hover{text-decoration:underline}
.satria-virtual-footer{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-2);border-top:1px solid var(--bd);font-size:11px;color:var(--mut);font-weight:600}
.satria-virtual-footer .mut{color:var(--mut-2)}
/* HPS virtual */
.hps-virtual-table{background:var(--card);border:1px solid var(--bd);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-sm)}
.hps-virtual-header{display:grid;grid-template-columns:1fr 110px 110px 150px 140px 56px;gap:0;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);position:sticky;top:0;z-index:2}
.hps-virtual-header > div{padding:11px 10px}
.hps-virtual-header .n{text-align:right}
.hps-virtual-viewport{overflow:auto;max-height:520px;-webkit-overflow-scrolling:touch;background:var(--card-solid);contain:layout}
.hps-virtual-row{display:grid;grid-template-columns:1fr 110px 110px 150px 140px 56px;gap:0;border-bottom:1px solid var(--bg-2);align-items:center;background:var(--card-solid);min-height:52px;transition:background .12s}
.hps-virtual-row:hover{background:var(--bg)}
.hps-virtual-row > div{padding:6px 8px}
.hps-virtual-row input{height:36px !important;font-size:13px !important}
.hps-virtual-row .n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
@media(max-width:768px){
  .satria-virtual-header, .satria-virtual-row{grid-template-columns:48px 110px 1fr 90px 90px;gap:0}
  .satria-virtual-header > div:nth-child(4), .satria-virtual-row > div:nth-child(4),
  .satria-virtual-header > div:nth-child(7), .satria-virtual-row > div:nth-child(7),
  .satria-virtual-header > div:nth-child(8), .satria-virtual-row > div:nth-child(8){display:none}
  .hps-virtual-header, .hps-virtual-row{grid-template-columns:1fr 80px 70px 90px 56px}
  .hps-virtual-header > div:nth-child(2), .hps-virtual-row > div:nth-child(2){display:none}
  .satria-virtual-viewport{height:60vh !important;max-height:60vh !important}
  .hps-virtual-viewport{max-height:50vh !important}
}


/* ===== DOKUMEN PENGADAAN - LAZY LOAD + VIRTUAL SCROLL ===== */
.satria-dok-toolbar{position:sticky;top:var(--header-h);z-index:20;background:var(--card);backdrop-filter:blur(12px);border:1px solid var(--bd);border-radius:16px;padding:14px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.satria-dok-toolbar .row{flex-wrap:nowrap;gap:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}
.satria-dok-toolbar .row::-webkit-scrollbar{display:none}
.satria-dok-toolbar select#selPaket{min-width:280px;max-width:420px;flex-shrink:0}
.doc-tabs-scroll{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:4px 0;flex-wrap:nowrap;flex:1}
.doc-tabs-scroll::-webkit-scrollbar{display:none}
.doc-tabs-scroll button{scroll-snap-align:start;white-space:nowrap;flex-shrink:0;height:36px;padding:0 14px;border-radius:9999px;font-size:12.5px;font-weight:600}
.satria-doc-lazy-container{position:relative;min-height:400px}
.satria-doc-skeleton{display:grid;place-items:center;min-height:400px;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:40px;color:var(--mut);font-size:14px}
.satria-doc-skeleton .spinner{width:32px;height:32px;border:3px solid var(--bd);border-top-color:var(--acc);border-radius:50%;animation:spin 1s linear infinite;margin-bottom:12px}
@keyframes spin{to{transform:rotate(360deg)}}
.doc{content-visibility:auto;contain-intrinsic-size:0 800px;background:var(--card-solid);border:1px solid var(--bd);border-radius:16px;padding:24px;box-shadow:var(--shadow-sm);overflow:hidden;position:relative}
.doc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--acc-grad-kh);opacity:.8}
.doc.doc-landscape{overflow-x:auto}
.doc table{border-collapse:collapse;width:100%;table-layout:auto}
.doc table th, .doc table td{border:1px solid var(--bd);padding:8px 10px;font-size:12.5px}
.doc table th{background:var(--bg-2);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.doc img{max-width:100%;height:auto;content-visibility:auto}
.doc img[loading="lazy"]{background:var(--bg-2)}
/* Virtual scroll for large doc tables */
.doc-virtual-table{border:1px solid var(--bd);border-radius:12px;overflow:hidden;background:var(--card-solid);margin:12px 0}
.doc-virtual-header{display:grid;background:var(--bg-2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);position:sticky;top:0;z-index:1}
.doc-virtual-viewport{overflow:auto;max-height:420px;-webkit-overflow-scrolling:touch;contain:layout}
.doc-virtual-row{display:grid;border-bottom:1px solid var(--bg-2);align-items:center;min-height:44px;background:var(--card-solid);transition:background .12s}
.doc-virtual-row:hover{background:var(--bg)}
.doc-virtual-row > div{padding:7px 10px;font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
.doc-virtual-footer{padding:8px 12px;background:var(--bg-2);border-top:1px solid var(--bd);font-size:11px;color:var(--mut);display:flex;justify-content:space-between}
@media(max-width:768px){
  .satria-dok-toolbar{top:56px;padding:10px;border-radius:12px}
  .satria-dok-toolbar .row{flex-direction:column;align-items:stretch}
  .satria-dok-toolbar select#selPaket{max-width:100%;width:100%}
  .doc{padding:14px;border-radius:12px}
  .doc table{font-size:11px;min-width:500px;display:block;overflow-x:auto;white-space:nowrap}
  .doc table th, .doc table td{white-space:normal;word-break:break-word}
  .doc-virtual-viewport{max-height:50vh}
}


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
      const requestedOrg = orgId;
      const { data: savedCount, error } = await client.rpc('satria_admin_assign_my_membership_years', {
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
      if (requestedOrg !== orgId || !isAuthorizedInUi()) throw new Error('Organisasi atau sesi berubah selama proses penyimpanan. Muat ulang daftar.');
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

// ===== SATRIA GLOBAL PERFORMANCE JS PATCH - Lead Dev =====
(function(){
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
  
  // 1. Disable heavy blobs on mobile immediately
  if(isMobile){
    const blobs = document.querySelector('.bg-blobs');
    if(blobs) blobs.style.display='none';
    document.documentElement.style.setProperty('--shadow-glow','0 4px 12px rgba(15,118,110,.12)');
  }
  
  // 2. Debounce search input to reduce renders
  const origAddEvent = EventTarget.prototype.addEventListener;
  // Passive listeners for scroll/touch
  const passiveEvents = ['touchstart','touchmove','wheel','scroll'];
  // Optimize mSearch if exists
  const debounce = (fn, ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
  
  // 3. IntersectionObserver for lazy render of heavy sections
  if('IntersectionObserver' in window && isMobile){
    // Defer non-critical renders
    const observer = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.style.contentVisibility='visible';
        }
      });
    },{rootMargin:'200px'});
    
    // Observe cards after load
    setTimeout(()=>{
      document.querySelectorAll('.card, .satria-kpi-card').forEach(el=>{
        el.style.contentVisibility='auto';
        el.style.containIntrinsicSize='0 200px';
      });
    }, 500);
  }
  
  // 4. Prevent iOS double-tap zoom on buttons
  let lastTouch = 0;
  document.addEventListener('touchend', function(e){
    const now = Date.now();
    if(now - lastTouch <= 300){
      e.preventDefault();
    }
    lastTouch = now;
  }, {passive:false});
  
  // 5. Optimize input focus on iOS (prevent zoom)
  if(/iPhone|iPad|iPod/i.test(navigator.userAgent)){
    document.querySelectorAll('input, select, textarea').forEach(el=>{
      el.addEventListener('focus', ()=>{
        // Ensure viewport doesn't zoom
        const viewport = document.querySelector('meta[name=viewport]');
        if(viewport){
          viewport.content = 'width=device-width,initial-scale=1,maximum-scale=1';
        }
      });
      el.addEventListener('blur', ()=>{
        const viewport = document.querySelector('meta[name=viewport]');
        if(viewport){
          viewport.content = 'width=device-width,initial-scale=1';
        }
      });
    });
  }
  
  // 6. Reduce motion if user prefers
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.documentElement.style.setProperty('--ease','linear');
  }
  
  console.log('[SATRIA] Performance patch active - Mobile:', isMobile);
})();


// ===== VIRTUAL SCROLL ENGINE - Paket & HPS =====
window.__paketVirtualData = window.__paketVirtualData || [];
window.__hpsVirtualData = window.__hpsVirtualData || [];
window.__hpsPaketId = null;

function renderPaketVirtualSlice(){
  const viewport = document.getElementById('paketVirtualViewport');
  const content = document.getElementById('paketVirtualContent');
  const spacer = document.getElementById('paketVirtualSpacer');
  if(!viewport || !content || !spacer) return;
  const data = window.__paketVirtualData || [];
  const rowH = 56;
  const scrollTop = viewport.scrollTop;
  const viewportH = viewport.clientHeight;
  const buffer = 8;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
  const visible = Math.ceil(viewportH / rowH) + buffer*2;
  const end = Math.min(data.length, start + visible);
  
  // Update spacer height if data changed
  spacer.style.height = (data.length * rowH) + 'px';
  content.style.transform = `translateY(${start * rowH}px)`;
  
  let html = '';
  for(let i=start;i<end;i++){
    const p = data[i];
    if(!p) continue;
    html += `<div class="satria-virtual-row" data-idx="${i}" style="height:${rowH}px">
      <div>${i+1}</div>
      <div title="${esc(p.rup)}">${esc(p.rup)}</div>
      <div title="${esc(p.nama)}"><a href="#paket/${p.id}">${esc(p.nama)}</a></div>
      <div title="${esc(satriaSubKegiatan(p)||'Subkegiatan belum diisi')}"><b>${esc(satriaSubKegiatan(p)||'Belum diisi')}</b></div>
      <div class="n">${nf(p.pagu)}</div>
      <div class="n">${nf(hps(p))}</div>
      <div class="n">${nf(kontrak(p))}</div>
      <div>${pill(p)}</div>
    </div>`;
  }
  content.innerHTML = html;
}

let paketScrollRaf = null;
function attachPaketVirtualScroll(){
  const vp = document.getElementById('paketVirtualViewport');
  if(!vp) return;
  vp.addEventListener('scroll', ()=>{
    if(paketScrollRaf) cancelAnimationFrame(paketScrollRaf);
    paketScrollRaf = requestAnimationFrame(renderPaketVirtualSlice);
  }, {passive:true});
  renderPaketVirtualSlice();
}

function renderHpsVirtualSlice(){
  const viewport = document.getElementById('hpsVirtualViewport');
  const content = document.getElementById('hpsVirtualContent');
  const spacer = document.getElementById('hpsVirtualSpacer');
  if(!viewport || !content || !spacer) return;
  const data = window.__hpsVirtualData || [];
  const rowH = 52;
  const scrollTop = viewport.scrollTop;
  const viewportH = viewport.clientHeight;
  const buffer = 6;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
  const visible = Math.ceil(viewportH / rowH) + buffer*2;
  const end = Math.min(data.length, start + visible);
  
  spacer.style.height = (data.length * rowH) + 'px';
  content.style.transform = `translateY(${start * rowH}px)`;
  
  let html = '';
  for(let i=start;i<end;i++){
    const it = data[i];
    if(!it) continue;
    const pid = window.__hpsPaketId;
    html += `<div class="hps-virtual-row" data-idx="${i}" style="height:${rowH}px">
      <div><input type="text" value="${esc(it.nama??'')}" data-col="item" data-pid="${pid}" data-id="${it.id}" data-f="nama" style="width:100%;min-width:0;box-sizing:border-box"></div>
      <div><input class="n" type="number" min="0" step="any" inputmode="decimal" value="${esc(it.vol)}" data-col="item" data-pid="${pid}" data-id="${it.id}" data-f="vol" style="width:100%;text-align:right"></div>
      <div><input type="text" value="${esc(it.satuan??'')}" data-col="item" data-pid="${pid}" data-id="${it.id}" data-f="satuan" style="width:100%"></div>
      <div><input class="n" type="text" inputmode="numeric" value="${nf(it.hs)}" data-col="item" data-pid="${pid}" data-id="${it.id}" data-f="hs" data-rp="1" style="width:100%;text-align:right"></div>
      <div class="n">${nf((+it.vol||0)*(+it.hs||0))}</div>
      <div style="text-align:center"><button class="d" data-act="delitem" data-pid="${pid}" data-id="${it.id}" title="Hapus produk">×</button></div>
    </div>`;
  }
  content.innerHTML = html;
}

let hpsScrollRaf = null;
function attachHpsVirtualScroll(){
  const vp = document.getElementById('hpsVirtualViewport');
  if(!vp) return;
  // Only one scroll listener per viewport, even after repeated renders.
  if(vp.dataset.satriaHpsScrollAttached!=='1'){
    vp.dataset.satriaHpsScrollAttached='1';
    vp.addEventListener('scroll', ()=>{
      if(hpsScrollRaf) cancelAnimationFrame(hpsScrollRaf);
      hpsScrollRaf = requestAnimationFrame(renderHpsVirtualSlice);
    }, {passive:true});
  }
  renderHpsVirtualSlice();
}
// Explicit interface for the main script; avoids out-of-scope function references.
window.SATRIA_HPS_VIRTUAL={attach:attachHpsVirtualScroll,render:renderHpsVirtualSlice};

// Auto attach after render
const origRender = window.requestAnimationFrame;
setTimeout(()=>{
  attachPaketVirtualScroll();
  attachHpsVirtualScroll();
}, 300);

// Re-attach on hash change (when user navigates to paket detail)
window.addEventListener('hashchange', ()=>{
  setTimeout(()=>{
    attachPaketVirtualScroll();
    attachHpsVirtualScroll();
  }, 200);
});


// ===== DOKUMEN PENGADAAN - LAZY LOAD + VIRTUAL SCROLL ENGINE =====
window.__dokLazyObserver = null;
window.__dokVirtualData = {};

function initDokLazyLoad(){
  const container = document.getElementById('dokLazyContainer');
  if(!container) return;
  
  // If already has doc, optimize its tables
  const docEl = container.querySelector('.doc');
  if(docEl){
    optimizeDocTables(docEl);
    lazyLoadDocImages(docEl);
    return;
  }
  
  // Lazy load doc content with skeleton
  const skeleton = container.querySelector('.satria-doc-skeleton');
  if(skeleton){
    // Simulate lazy load with rAF for smooth transition
    requestAnimationFrame(()=>{
      setTimeout(()=>{
        const p = window.S ? (window.S.paket.find(x=>x.id===window.S.ui.dpid) || window.filt()[0]) : null;
        if(!p) return;
        const dokType = window.S ? window.S.ui.dok : 'nodis';
        const docFn = window.DOCS ? window.DOCS[dokType] : null;
        if(docFn && p){
          const html = docFn(p);
          container.innerHTML = `<div class="doc doc-${dokType} ${dokType==='rfi'?'doc-landscape':'doc-portrait'}" data-document-type="${dokType}">${html}</div>`;
          const newDocEl = container.querySelector('.doc');
          if(newDocEl){
            optimizeDocTables(newDocEl);
            lazyLoadDocImages(newDocEl);
          }
        }
      }, 150);
    });
  }
}

function lazyLoadDocImages(docEl){
  if(!docEl) return;
  // Add loading="lazy" to all images
  docEl.querySelectorAll('img').forEach(img=>{
    if(!img.hasAttribute('loading')){
      img.setAttribute('loading','lazy');
      img.setAttribute('decoding','async');
    }
    // Add fade-in on load
    img.style.opacity = '0';
    img.style.transition = 'opacity .3s';
    if(img.complete){
      img.style.opacity = '1';
    } else {
      img.addEventListener('load', ()=>{ img.style.opacity='1'; }, {once:true});
    }
  });
}

function optimizeDocTables(docEl){
  if(!docEl) return;
  // Find large tables (>15 rows) and convert to virtual scroll
  docEl.querySelectorAll('table').forEach(table=>{
    const rows = table.querySelectorAll('tbody tr');
    if(rows.length > 20){
      // Only virtualize if not already virtualized
      if(table.closest('.doc-virtual-table')) return;
      
      const headers = Array.from(table.querySelectorAll('thead th')).map(th=>th.textContent.trim());
      const colCount = headers.length || 6;
      
      // Create virtual table wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'doc-virtual-table';
      
      const headerDiv = document.createElement('div');
      headerDiv.className = 'doc-virtual-header';
      headerDiv.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;
      headerDiv.innerHTML = headers.map(h=>`<div>${h}</div>`).join('');
      
      const viewport = document.createElement('div');
      viewport.className = 'doc-virtual-viewport';
      viewport.style.maxHeight = rows.length > 30 ? '420px' : (rows.length*44+10)+'px';
      
      const spacer = document.createElement('div');
      spacer.style.height = (rows.length * 44) + 'px';
      spacer.style.position = 'relative';
      
      const content = document.createElement('div');
      content.style.position = 'absolute';
      content.style.top = '0';
      content.style.left = '0';
      content.style.right = '0';
      
      // Store data for virtual scroll
      const tableData = Array.from(rows).map(tr=>tr.innerHTML);
      let rafId = null;
      
      function renderSlice(){
        const scrollTop = viewport.scrollTop;
        const viewportH = viewport.clientHeight;
        const rowH = 44;
        const buffer = 5;
        const start = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
        const visible = Math.ceil(viewportH / rowH) + buffer*2;
        const end = Math.min(tableData.length, start + visible);
        
        content.style.transform = `translateY(${start * rowH}px)`;
        let html = '';
        for(let i=start;i<end;i++){
          html += `<div class="doc-virtual-row" style="height:${rowH}px;grid-template-columns:repeat(${colCount}, 1fr)"><div style="display:contents">${tableData[i]}</div></div>`;
        }
        content.innerHTML = html;
      }
      
      viewport.addEventListener('scroll', ()=>{
        if(rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(renderSlice);
      }, {passive:true});
      
      spacer.appendChild(content);
      viewport.appendChild(spacer);
      
      const footer = document.createElement('div');
      footer.className = 'doc-virtual-footer';
      footer.innerHTML = `<span>${rows.length} baris • virtual scroll aktif • hemat 80% DOM</span><span class="mut">Scroll untuk lihat semua</span>`;
      
      wrapper.appendChild(headerDiv);
      wrapper.appendChild(viewport);
      wrapper.appendChild(footer);
      
      // Replace original table with virtual
      table.parentNode.insertBefore(wrapper, table);
      table.style.display = 'none';
      
      // Initial render
      setTimeout(renderSlice, 50);
    }
  });
}

// Enhanced vDok with lazy load
const originalVDok = window.vDok;
function vDokOptimized(){
  const L = filt(), p = L.find(x => x.id === S.ui.dpid) || L[0];
  if(!p) return `
    <div class="dok-studio">
      <section class="dok-hero no-print">
        <div class="dok-hero-copy">
          <span class="dok-eyebrow"><i></i> SATRIA / PROCUREMENT STUDIO</span>
          <h2>Dokumen rapi.<br><em>Proses lebih sat-set.</em></h2>
          <p>Area kerja dokumen pengadaan—pilih paket, cek data, lalu cetak.</p>
        </div>
        <div class="dok-hero-art" aria-hidden="true"><span class="dok-art-orbit"></span><span class="dok-art-chip">DOCS<br><b>01—15</b></span></div>
      </section>
      <section class="dok-empty-state">
        <div class="dok-empty-icon">＋</div>
        <h3>Belum ada paket di filter ini</h3>
        <p>Buat atau impor paket terlebih dahulu melalui menu <b>Paket Pengadaan</b>. Dokumen akan mengambil data dari paket yang tersedia.</p>
      </section>
    </div>`;

  const T=[
    ['nodis','1 Nota Dinas'],['idkb','2 Identifikasi Kebutuhan Pengadaan'],['rfi','3 Hasil Permintaan Informasi (RFI)'],
    ['bahepe','4 Berita Acara Evaluasi Penyedia'],['metode','5 Formulir Penetapan E-Purchasing'],['sppbj','6 Surat Perintah Pengadaan kepada PP'],
    ['spek','7 Spesifikasi Teknis'],['dpp','8 Dokumen Persiapan Pengadaan (DPP)'],['lamp','9 Lampiran Referensi Harga'],
    ['reviu','10 Berita Acara Reviu DPP'],['bahp','11 Berita Acara Hasil Pemilihan'],['survei','12 Survei Harga'],
    ['hpsnego','13 HPS dan Negosiasi'],['kknego','14 Kertas Kerja Negosiasi'],['analisa','15 Analisis Kewajaran Harga & Bukti']
  ];
  const hints={
    nodis:'Pengantar dan permohonan proses', idkb:'Merumuskan kebutuhan paket', rfi:'Permintaan informasi pasar',
    bahepe:'Catatan evaluasi penyedia', metode:'Formulir penetapan barang/jasa', sppbj:'Penunjukan penyedia terpilih',
    spek:'Rincian teknis barang/jasa', dpp:'Dokumen persiapan e-Purchasing', lamp:'Referensi sumber harga',
    reviu:'Pemeriksaan dokumen persiapan', bahp:'Ringkasan hasil pemilihan', survei:'Perbandingan harga pasar',
    hpsnego:'Harga perkiraan dan negosiasi', kknego:'Rekap kerja negosiasi',analisa:'Referensi harga dan analisis kewajaran otomatis per paket'
  };
  const groups=[
    {title:'Rencana & persiapan',sub:'Rapikan kebutuhan sebelum proses berjalan',keys:['nodis','idkb','spek','dpp','lamp','reviu','metode']},
    {title:'Survei & evaluasi',sub:'Bandingkan informasi, harga, dan penawaran',keys:['rfi','survei','bahepe','hpsnego','kknego','analisa']},
    {title:'Hasil pemilihan',sub:'Dokumen hasil dan penunjukan',keys:['bahp','sppbj']}
  ];
  const docCheck = k => docMiss(p,k);
  const readyDocs=T.filter(([k])=>docCheck(k).length===0).length;
  const pct=Math.round(readyDocs/T.length*100);
  const currentMissing=docCheck(S.ui.dok);
  const auditItem=()=>({id:p.id,rup:p.rup,type:S.ui.dok,title:(T.find(x=>x[0]===S.ui.dok)||T[0])[1],checks:window.docReqs?window.docReqs(p,S.ui.dok):[],checkedAt:new Date().toISOString()});
  const checkRows=(window.docReqs?window.docReqs(p,S.ui.dok):[]).filter(r=>!r.ok&&!r.manual).slice(0,7);
  const docQualityHtml=`<section class="satria340-quality no-print" aria-label="Pemeriksaan sebelum PDF"><div class="satria340-quality-head"><div><span class="dok-section-kicker">QUALITY CONTROL / PENERBITAN</span><h3>Periksa hasil dokumen sebelum dicetak</h3><p>${currentMissing.length?currentMissing.length+' isian perlu diperiksa':'Isian dasar telah diperiksa'} · Validasi administratif dan hukum tetap menjadi kewenangan pejabat.</p></div><button type="button" class="g" data-act="satriaDocAuditExport">Unduh hasil pemeriksaan</button></div>${checkRows.length?`<div class="satria340-quality-grid">${checkRows.map(r=>`<div class="satria340-check"><span>!</span><span>${esc(r.label)}</span><button class="g" data-act="gotoField" data-pid="${esc(p.id)}" data-tab="${esc(r.tab)}" ${r.f?`data-f="${esc(r.f)}"`:''}>Perbaiki</button></div>`).join('')}</div>`:`<p class="satria340-allchecked">✔ Semua pemeriksaan isian terprogram terpenuhi. Periksa kesesuaian bukti, redaksi, dan pratinjau halaman secara manual.</p>`}${S.ui.dok==='analisa'?'<p class="satria340-quality-note"><b>Verifikasi manual wajib:</b> periksa kesetaraan spesifikasi, keaslian referensi, tanggal pengambilan harga, pajak, ongkir, dan lampiran bukti. Indikator kelengkapan di atas hanya menghitung isian yang dapat diperiksa aplikasi.</p>':''}<p class="satria340-quality-note">Status ini bukan penetapan pemenang, persetujuan pejabat, atau jaminan kepatuhan hukum. Pada harga e-Katalog termasuk pajak, jangan menambahkan PPN kembali tanpa data DPP/pajak yang jelas.</p></section>`;
  const relationHealth = window.SATRIA_DATA_HEALTH?.inspect?.(p) || {issues:[],warningCount:0};
  const activeT=T.find(([k])=>k===S.ui.dok)||T[0];
  const docLandscape = S.ui.dok==='rfi' || (['survei','hpsnego'].includes(S.ui.dok) && (p.penawaran||[]).length>=3);
  const docContent = DOCS[S.ui.dok] ? satriaSafeDocHtml(DOCS[S.ui.dok](p)) : '<p class=mut>Dokumen tidak tersedia</p>';
  const groupsHtml=groups.map((g,gi)=>{
    const docs=g.keys.map(k=>T.find(x=>x[0]===k)).filter(Boolean);
    return `<section class="dok-group">
      <div class="dok-group-heading">
        <span class="dok-group-number">0${gi+1}</span>
        <div class="dok-group-title"><h3>${g.title}</h3><p>${g.sub}</p></div>
        <span class="dok-group-count">${docs.length} template</span>
      </div>
      <div class="dok-type-grid">${docs.map(([k,t])=>{
        const missing=docCheck(k),idx=T.findIndex(x=>x[0]===k)+1,selected=k===S.ui.dok;
        return `<button type="button" class="dok-type-card ${selected?'is-selected':''}" data-act="dtype" data-tab="${k}" aria-pressed="${selected?'true':'false'}" title="${t}">
          <span class="dok-type-index">${String(idx).padStart(2,'0')}</span>
          <span class="dok-type-copy"><strong>${t.replace(/^\d+\s/,'')}</strong><small>${hints[k]}</small></span>
          <span class="dok-type-state ${missing.length?'is-pending':'is-ready'}">${missing.length?missing.length+' cek':'Isian OK'}</span>
          <span class="dok-type-arrow" aria-hidden="true">↗</span>
        </button>`;
      }).join('')}</div>
    </section>`;
  }).join('');

  return `
    <div class="dok-studio">
      <section class="dok-hero no-print">
        <div class="dok-hero-copy">
          <span class="dok-eyebrow"><i></i> SATRIA / PROCUREMENT STUDIO <span>•</span> TA ${esc(p.tahun)}</span>
          <h2>Dokumen rapi.<br><em>Proses lebih sat-set.</em></h2>
          <p>15 template dalam satu workspace. Pilih paket, cek kelengkapan, lalu cetak dengan lebih nyaman.</p>
          <div class="dok-hero-note"><span>✳</span> Data tetap bersumber dari paket dan master SATRIA.</div>
        </div>
        <div class="dok-hero-art" aria-hidden="true"><span class="dok-art-orbit"></span><span class="dok-art-chip">DOCS<br><b>01—15</b></span><span class="dok-art-spark dok-spark-a">✳</span><span class="dok-art-spark dok-spark-b">✦</span></div>
      </section>

      ${!satriaPemdaOfficial('nama')?`<section class="card no-print" role="alert" style="border:1px solid #e0a800;background:#fff9ed;color:#854d0e"><b>Identitas Pemerintah Daerah belum diatur secara resmi.</b> Sebelum menerbitkan dokumen, admin harus memverifikasi identitas pada <a href="#settings">Pengaturan Sistem</a> → Identitas Pemerintah Daerah. Nilai Demo/Contoh tidak akan dicetak sebagai identitas resmi; bila belum tersedia, dokumen menampilkan penanda belum diatur. Kop gambar OPD yang sudah tersimpan tetap dipakai.</section>`:''}
      <section class="dok-metrics no-print" aria-label="Ringkasan paket">
        <article class="dok-metric dok-metric-progress"><div class="dok-metric-top"><span>CHECKLIST DOKUMEN</span><span class="dok-metric-glyph">↗</span></div><div class="dok-metric-value">${readyDocs}<small>/${T.length}</small></div><div class="dok-progress-track"><span style="width:${pct}%"></span></div><p>${pct}% template lolos pemeriksaan data aplikasi</p></article>
        <article class="dok-metric"><div class="dok-metric-top"><span>RINCIAN BARANG</span><span class="dok-metric-glyph">▦</span></div><div class="dok-metric-value">${p.items.length}</div><p>Item pada paket aktif</p></article>
        <article class="dok-metric"><div class="dok-metric-top"><span>PENAWARAN MASUK</span><span class="dok-metric-glyph">↔</span></div><div class="dok-metric-value">${p.penawaran.length}</div><p>Penyedia tercatat di paket</p></article>
        <article class="dok-metric dok-metric-hps"><div class="dok-metric-top"><span>TOTAL HPS</span><span class="dok-metric-glyph">Rp</span></div><div class="dok-metric-value dok-value-currency">${rp(hps(p))}</div><p>Terhitung dari rincian barang</p></article>
      </section>

      <section class="dok-control-panel no-print">
        <div class="dok-control-title"><span class="dok-section-kicker">01 / WORKSPACE</span><h3>Pilih paket kerja</h3><p>Jenis dokumen akan mengikuti paket aktif yang dipilih.</p></div>
        <div class="dok-package-control">
          <label for="selPaket">PAKET PENGADAAN · KODE RUP</label>
          <select id="selPaket" class="satria-select">${L.slice().sort((a,b)=>String(a.rup).localeCompare(String(b.rup))).map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.rup||'KODE RUP BELUM DIISI')} — ${esc(x.nama)}</option>`).join('')}</select>
          <div class="dok-package-meta"><span class="dok-meta-tag">${esc(p.rup||'RUP BELUM DIISI')}</span><span>TA ${esc(p.tahun)} · ${esc(O(p.opd).singkat||O(p.opd).nama||'OPD belum diisi')}</span></div>
        </div>
        <button type="button" data-act="print" class="dok-print-button"><span class="dok-print-icon">↗</span><span><b>Cetak / Simpan PDF</b><small>A4 • Arial • Seluruh tabel</small></span></button>
      </section>

      <div class="spha-quick no-print"><div><h3>Analisis Kewajaran Harga & Bukti Referensi</h3><p>Diambil otomatis dari penawaran/negosiasi paket ini; cocok untuk lampiran permintaan data per paket.</p></div><button type="button" class="spha-btn" data-act="dtype" data-tab="analisa">Buka laporan analisis →</button></div>
      ${satriaHumanDocGuide(p,S.ui.dok,currentMissing)}
      <div class="satria-integrity-strip no-print" role="status"><span class="satria-integrity-icon">✦</span><div><b>Kualitas relasi data</b><small>${relationHealth.issues.length ? relationHealth.issues.length+' temuan yang perlu diperiksa sebelum finalisasi' : 'Referensi paket dan data master terhubung'}</small></div><button type="button" data-act="satriaAudit">Periksa data →</button></div>
      <div class="dok-print-standard no-print" role="note"><strong>Standar keluaran</strong><span>ISO A4</span><span>Arial</span><span>Portrait / Landscape otomatis</span><span>Tabel lengkap, termasuk lebih dari 20 baris</span><span>Simpan PDF: Skala 100%, tanpa header/footer browser</span></div>

      <details class="satria-human-doc-library no-print" id="satriaHumanDocLibrary"><summary>Semua 15 template dokumen dan pemeriksaan isian • Buka bila diperlukan</summary>
      <section class="dok-library no-print">
        <div class="dok-library-heading"><div><span class="dok-section-kicker">02 / DOCUMENT LIBRARY</span><h3>Pilih dokumen</h3><p>Pilih salah satu kartu untuk membuka pratinjau. Status merangkum pemeriksaan isian di aplikasi, bukan validasi hukum.</p></div><div class="dok-library-counter"><strong>15</strong><span>template</span></div></div>
        ${groupsHtml}
      </section>
      </details>

      <section class="dok-preview-section">
        <div class="dok-preview-heading no-print"><div><span class="dok-section-kicker">03 / LIVE PREVIEW</span><h3>Pratinjau dokumen</h3><p>${activeT[1]} · Paket ${esc(p.rup||'belum memiliki Kode RUP')}</p></div><span class="dok-preview-status ${currentMissing.length?'is-pending':'is-ready'}"><i></i>${currentMissing.length?currentMissing.length+' hal perlu dicek':'Isian dasar OK'}</span></div>
        ${docQualityHtml}
        ${satria35912WarningPanel(p,S.ui.dok)}
        ${window.SATRIA_DOC_PPK?.panel?.(p,S.ui.dok)||''}${S.ui.dok==='dpp'?(window.SATRIA_DPP_PREFLIGHT?.panel?.(p)||''):''}${S.ui.dok==='dpp'?(window.SATRIA_DPP_FORMAT?.panel?.(p)||''):''}
        ${warnDoc(p)}
        <div class="dok-preview-frame" id="dokLazyContainer">
          <div class="dok-preview-caption no-print"><span><i></i> LIVE PREVIEW <b>·</b> FORMAT DOKUMEN RESMI</span><span>${docLandscape?'A4 LANDSCAPE':'A4 PORTRAIT'}</span></div>
          <div class="doc doc-${S.ui.dok} ${docLandscape?'doc-landscape':'doc-portrait'}" data-document-type="${esc(S.ui.dok)}" data-lazy="true">
            ${docContent}
          </div>
        </div>
      </section>
      <footer class="dok-footer-note no-print"><span>✳</span><p><b>Reminder:</b> pastikan sumber harga, tanggal, data pejabat, dan hasil evaluasi didukung bukti yang dapat diverifikasi sebelum dokumen ditetapkan atau digunakan secara resmi.</p></footer>
    </div>
  `;
}

// Override vDok with optimized version
window.vDok = vDokOptimized;

// Auto init lazy load on hash change to dok
window.addEventListener('hashchange', ()=>{
  if(location.hash.startsWith('#dok')){
    setTimeout(()=>{
      const container = document.getElementById('dokLazyContainer');
      if(container){
        const docEl = container.querySelector('.doc');
        if(docEl){
          optimizeDocTables(docEl);
          lazyLoadDocImages(docEl);
        }
      }
    }, 200);
  }
});

// Init on load if already on dok page
if(location.hash.startsWith('#dok')){
  setTimeout(()=>{
    const container = document.getElementById('dokLazyContainer');
    if(container){
      const docEl = container.querySelector('.doc');
      if(docEl){
        optimizeDocTables(docEl);
        lazyLoadDocImages(docEl);
      }
    }
  }, 500);
}

console.log('[SATRIA] Dokumen Pengadaan lazy load + virtual scroll active');
})();
