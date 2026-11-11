
(function(){
  'use strict';
  const CONFIG_KEY='satria-supabase-bridge-config-v1';
  let client=null, member=null, orgId='', version=0, localUsersBackup=null, recoveryListenerClient=null, cloudStateReady=false;
  let clientConfigUrl='', clientConfigKey='', sessionRestorePromise=null, explicitSignOut=false;
  let lastSyncedPayload=null, autoSaveTimer=null, autoSaveInFlight=false, autosyncRequested=false, realtimeChannel=null, remoteNoticePending=false, remoteNoticeVersion=0, conflictActive=false, realtimeRefreshTimer=null, autoRetryTimer=null, autoRetryAttempt=0;
  let lastCloudConfirmedAt=null, lastCloudErrorAt=null;
  // Every asynchronous response belongs to exactly one authenticated session.
  // A later login, logout, or client replacement invalidates old responses.
  let sessionEpoch=0, pullEpoch=0, pendingScopedSave=null;
  function captureSession(){return {epoch:sessionEpoch,client,member,orgId}}
  function sameSession(token){return Boolean(token&&token.epoch===sessionEpoch&&token.client===client&&token.member===member&&token.orgId===orgId)}
  function invalidateSession(){
    sessionEpoch++;pullEpoch++;
    autoSaveInFlight=false;autosyncRequested=false;trashBusy=false;
    return sessionEpoch;
  }
  const $id=id=>document.getElementById(id);
  const modal=$id('satriaCloudModal');
  const status=(msg,kind='')=>{const e=$id('scStatus');if(e){e.textContent=msg;e.dataset.kind=kind}};
  function syncIndicator(message, kind=''){
    let e=$id('satriaCloudSyncIndicator');
    if(!e){e=document.createElement('span');e.id='satriaCloudSyncIndicator';e.className='satria-sync-indicator';e.setAttribute('role','status');e.setAttribute('aria-live','polite');
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
  // Stage 5B: use the pure calculation engine; fail closed if an asset is missing.
  const cloudDelta=window.SATRIA_CLOUD_DELTA;
  if(!cloudDelta)throw new Error('Mesin sinkronisasi SATRIA tidak termuat. Muat ulang seluruh aset versi yang sama.');
  const {cloneJson,payloadEqual,makeDelta,applyDeltaToPayload}=cloudDelta;
  function cancelAutosaveTimer(){if(autoSaveTimer){clearTimeout(autoSaveTimer);autoSaveTimer=null}}
  function requestAutosave(reason=''){
    if(!member||member.role==='viewer'||!client||!cloudStateReady||!lastSyncedPayload)return;
    if(conflictActive){syncIndicator('Konflik cloud — periksa perubahan','error');return}
    cancelAutosaveTimer();syncIndicator('Perubahan lokal · menunggu sinkronisasi','wait');
    autoSaveTimer=setTimeout(()=>{autoSaveTimer=null;saveDeltaChanges(false).catch(showError)},850);
  }
  window.SATRIA_AUTO_SYNC_REQUEST=requestAutosave;

  // Stage 2: cloud Recycle Bin is server-owned and never mixed into S.sampah.
  let trashRows=[], trashLoaded=false, trashLoading=null, trashBusy=false, trashError='', trashEpoch=0;
  function clearCloudTrash(){trashEpoch++;trashRows=[];trashLoaded=false;trashError='';trashLoading=null}
  function trashAuthorized(){
    if(!window.SATRIA_CLOUD_CONFIGURED||!client||!member||!cloudStateReady)
      throw Error('Masuk Supabase dan tarik snapshot cloud sebelum memakai Sampah.');
  }
  function trashCanMutate(){
    trashAuthorized();
    if(member.role==='viewer')throw Error('Viewer hanya boleh melihat Sampah.');
    if(trashBusy||autoSaveInFlight||autoSaveTimer||conflictActive||S.dirty||
       !lastSyncedPayload||!payloadEqual(currentPayload(),lastSyncedPayload))
      throw Error('Masih ada perubahan lokal, sinkronisasi, atau konflik. Selesaikan sinkronisasi sebelum menggunakan Sampah cloud.');
  }
  async function loadCloudTrash(force=false){
    trashAuthorized();
    if(force)clearCloudTrash();
    if(trashLoaded)return trashRows;
    if(trashLoading)return trashLoading;
    const epoch=trashEpoch;
    const subject=member.id,organization=orgId;
    trashLoading=(async()=>{
      // Read existing Stage 2 archives independently: a missing Stage 6 migration
      // must NEVER hide an organization's existing (older) Recycle Bin contents.
      const [base,nested]=await Promise.all([
        client.from('satria_trash_entries')
          .select('id,collection,record_id,record_summary,deleted_at,deleted_by,opd_id,fiscal_year,retain_until')
          .eq('organization_id',organization).is('restored_at',null)
          .order('deleted_at',{ascending:false}).limit(250),
        client.from('satria_nested_trash_entries')
          .select('id,collection,record_id,record_summary,deleted_at,deleted_by,opd_id,fiscal_year,retain_until')
          .eq('organization_id',organization).is('restored_at',null)
          .order('deleted_at',{ascending:false}).limit(250)
      ]);
      if(base.error)throw Error('Sampah cloud Tahap 2 tidak tersedia: '+base.error.message);
      if(epoch===trashEpoch&&member?.id===subject&&orgId===organization){
        const normalize=(rows,nestedFlag)=>(Array.isArray(rows)?rows:[]).map(x=>({
          id:x.id,collection:x.collection,originalId:x.record_id,record:{nama:x.record_summary},
          deletedAt:x.deleted_at,deletedBy:x.deleted_by,retainUntil:x.retain_until,nested:nestedFlag
        }));
        trashRows=normalize(base.data,false).concat(normalize(nested.data,true))
          .sort((a,b)=>String(b.deletedAt||'').localeCompare(String(a.deletedAt||''))).slice(0,250);
        trashLoaded=true;
        trashError=nested.error?'Arsip penawaran/media belum tersedia: pasang migrasi Tahap 6 di staging.':'';
      }
      return trashRows;
    })().catch(err=>{
      if(epoch===trashEpoch){trashError=String(err.message||err);trashLoaded=true;trashRows=[]}
      return trashRows;
    }).finally(()=>{
      if(epoch===trashEpoch){trashLoading=null;if(S?.ui?.page==='sampah'&&typeof route==='function')route()}
    });
    return trashLoading;
  }
  async function performCloudTrash(operation,collectionOrId,recordId){
    trashCanMutate();
    const context=captureSession();
    if(operation==='archive'&& !['paket','rupBank','opd','unit','pejabat','penyedia','akun','kode'].includes(collectionOrId))
      throw Error('Jenis data tidak mendukung Sampah cloud. Tidak ada penghapusan.');
    if(operation==='archive'&&member.role==='operator'&&!['paket','rupBank'].includes(collectionOrId))
      throw Error('Master organisasi hanya boleh dipindahkan ke Sampah oleh Admin.');
    const selected=operation==='restore'?trashRows.find(x=>x.id===collectionOrId):null;
    if(operation==='restore'&&!selected)
      throw Error('Item Sampah tidak tersedia untuk akun ini. Segarkan daftar Sampah.');
    trashBusy=true;cancelAutosaveTimer();
    try{
      const rpc=operation==='archive'?'satria_archive_record':selected.nested?'satria_restore_nested':'satria_restore_record';
      const args={p_organization_id:orgId,p_expected_version:version};
      if(operation==='archive'){
        args.p_collection=collectionOrId;args.p_record_id=String(recordId);
      }else args.p_trash_id=collectionOrId;
      syncIndicator(operation==='archive'?'Mengarsipkan cloud…':'Memulihkan cloud…','wait');
      const {data,error}=await client.rpc(rpc,args);
      if(!sameSession(context))return false;
      if(error)throw Error('Transaksi Sampah cloud gagal atau belum terkonfirmasi. Segarkan cloud sebelum mengulangi: '+error.message);
      if(!data||data.status!==(operation==='archive'?'archived':'restored')||!Number.isFinite(Number(data.version)))
        throw Error('Respons server tidak lengkap. Periksa Sampah sebelum mengulangi operasi.');
      clearCloudTrash();
      await pull({discardConfirmed:true,source:'trash'});
      if(!sameSession(context))return false;
      if(!cloudStateReady)throw Error('Transaksi selesai di server, tetapi pemuatan ulang data cloud gagal. Tarik cloud secara manual.');
      await loadCloudTrash(true);
      if(!sameSession(context))return false;
      if(operation==='archive'&&collectionOrId==='paket'){
        S.ui.pid=null;location.hash='#paket';
      }
      if(typeof route==='function')route();
      toast(operation==='archive'?'Data tersimpan di Sampah cloud.':'Data berhasil dipulihkan dari Sampah cloud.');
      return data;
    }catch(err){
      if(!sameSession(context))return false;
      syncIndicator('Periksa Sampah cloud / sinkronisasi','error');
      throw err;
    }finally{if(sameSession(context))trashBusy=false}
  }
  // Nested transactions are separate from the older top-level archive RPC.
  // Never mutate local arrays optimistically; refresh only after server commit.
  async function archiveNested(collection,parentId,recordId){
    trashCanMutate();
    const context=captureSession();
    if(!['penawaran','item','media'].includes(collection))throw Error('Jenis arsip bersarang belum didukung.');
    if(member.role==='operator'&&collection==='media')throw Error('Media hanya dapat diarsipkan Admin.');
    trashBusy=true;cancelAutosaveTimer();
    try{
      syncIndicator('Mengarsipkan data terkait…','wait');
      const {data,error}=await client.rpc('satria_archive_nested',{
        p_organization_id:orgId,p_expected_version:version,p_collection:collection,
        p_parent_id:String(parentId),p_record_id:String(recordId)
      });
      if(!sameSession(context))return false;
      if(error)throw Error('Arsip bersarang ditolak / migrasi cloud belum dipasang: '+error.message);
      if(data?.status!=='archived'||!Number.isFinite(Number(data.version)))
        throw Error('Respons server belum dapat dipastikan. Periksa Sampah sebelum mengulang.');
      clearCloudTrash();
      await pull({discardConfirmed:true,source:'trash'});
      if(!sameSession(context))return false;
      if(!cloudStateReady)throw Error('Transaksi selesai, tetapi tarikan cloud belum berhasil. Muat ulang Sampah.');
      await loadCloudTrash(true);
      if(!sameSession(context))return false;
      if(typeof route==='function')route();
      toast('Data tersimpan di Sampah cloud dan dapat dipulihkan.');
      return data;
    }catch(err){if(!sameSession(context))return false;syncIndicator('Periksa Sampah / status cloud','error');throw err}
    finally{if(sameSession(context))trashBusy=false}
  }
  window.SATRIA_CLOUD_TRASH=Object.freeze({
    get items(){return trashRows.slice()}, get loaded(){return trashLoaded},
    get loading(){return Boolean(trashLoading)},get error(){return trashError},
    get ready(){return Boolean(client&&member&&cloudStateReady)},
    ensureLoaded:()=>loadCloudTrash(false),refresh:()=>loadCloudTrash(true),
    archive:(collection,id)=>performCloudTrash('archive',collection,id),
    archiveNested,restore:id=>performCloudTrash('restore',id)
  });

  const roleName=r=>({admin:'Admin',operator:'Operator',viewer:'Viewer'}[r]||'Viewer');
  const accountName=()=>member?.role==='operator'&&member?.account_type==='ppkom'?'PPKom':roleName(member?.role);
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
    invalidateSession();
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
    const loginClient=client,loginOrg=orgId,loginEpoch=sessionEpoch;
    const loginIsCurrent=()=>client===loginClient&&orgId===loginOrg&&sessionEpoch===loginEpoch;
    const {data:{user},error:userErr}=await client.auth.getUser();
    if(!loginIsCurrent())return false;
    if(userErr||!user) throw new Error('Sesi belum masuk. Periksa email/kata sandi atau status akun Auth. Detail: '+(userErr?.message||'no user'));
    
    const {data,error}=await client.from('satria_memberships').select('role,active').eq('organization_id',orgId).eq('user_id',user.id).maybeSingle();
    if(!loginIsCurrent())return false;
    if(error){
      if(/does not exist|relation.*not.*exist/i.test(error.message)){
        throw new Error('Tabel satria_memberships belum ada. Jalankan SQL setup di Supabase SQL Editor dulu. Lihat panduan di tab Panduan -> Cloud.');
      }
      throw new Error('Tidak dapat memeriksa membership. Pastikan SQL/RLS telah dijalankan: '+error.message);
    }
    
    let membership=data;
    // Tahap 5A: fail closed. A browser session never grants itself Admin membership.
    if(!membership){
      throw new Error('Akun belum mendapat akses organisasi. Admin organisasi dapat menambah akun dan cakupan kerja melalui pengelolaan pengguna. Untuk organisasi baru, siapkan admin awal melalui prosedur server yang tepercaya.');
    }
    if(!membership||!membership.active) throw new Error('Membership tidak aktif. Hubungi admin untuk aktivasi.');
    
    invalidateSession();
    clearCloudTrash();
    window.dispatchEvent(new Event('satria:cloud-session-reset'));
    member={id:user.id,email:user.email||'Pengguna Supabase',role:membership.role,account_type:membership.role==='operator'&&user.app_metadata?.satria_account_type==='ppkom'?'ppkom':'standard',scope:null};
    cloudStateReady=false;
    window.SATRIA_CLOUD_ROLE=member.role;
    window.SATRIA_CLOUD_MEMBER=member;
    if(!['admin','operator','viewer'].includes(member.role)) throw new Error('Role membership tidak dikenal: '+member.role);
    if(!localUsersBackup) localUsersBackup=JSON.parse(JSON.stringify(S.users||[]));
    if(member.role!=='admin') resetCloudScopedView();
    S.users=[{id:'auth-'+member.id,nama:member.account_type==='ppkom'?'PPKom · '+member.email:member.email,username:member.email,role:roleName(member.role),opd:'all',aktif:true}];
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
      akun:[],kode:[],opd:[],unit:[],pejabat:[],penyedia:[],rupBank:[],paket:[],sampah:[],
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
      return 'Email atau kata sandi ditolak. Periksa akun pada proyek Supabase yang sedang dipakai, atau gunakan pemulihan kata sandi. Jangan mengirim kata sandi kepada petugas lain.';
    }
    if(/email not confirmed/i.test(rawLower)) return 'Email belum dikonfirmasi. Hubungi pengelola akun Supabase untuk memeriksa status akun pada proyek yang terhubung.';
    if(/user not found|user.*not.*exist/i.test(rawLower)) return 'Akun tidak ditemukan pada proyek Supabase yang terhubung. Hubungi administrator organisasi.';
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
        setTimeout(async()=>{
          if(c!==client||!member)return;
          const logoutEpoch=invalidateSession();
          cancelAutosaveTimer();stopRealtime();
          clearCloudTrash();member=null;version=0;cloudStateReady=false;lastSyncedPayload=null;conflictActive=false;
          window.dispatchEvent(new Event('satria:cloud-session-reset'));
          window.SATRIA_CLOUD_ROLE=null;window.SATRIA_CLOUD_MEMBER=null;
          window.SATRIA_MEDIA?.clear?.();resetCloudScopedView();
          localUsersBackup=null;
          // An earlier scoped IndexedDB write must finish before cache deletion.
          const pending=pendingScopedSave;
          if(pending)try{await pending}catch(_){}
          if(logoutEpoch!==sessionEpoch)return; // New login must retain its own cache.
          try{if(typeof DB!=='undefined'&&DB?.kv)await DB.kv.delete('main')}catch(_){}
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
    // Local recycle entries are device-only. Cloud trash uses its own RLS table, never the snapshot payload.
    ['ui','log','dirty','chat','chatCtx','persistError','sampah'].forEach(k=>delete o[k]);
    // Browser-side user list is not an identity store; persist only the authenticated principal's display role.
    o.users=member?[{id:'auth-'+member.id,nama:member.account_type==='ppkom'?'PPKom · '+member.email:member.email,username:member.email,role:roleName(member.role),opd:'all',aktif:true}]:[];
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
    if(autoSaveInFlight){
      if(opts.source==='realtime')return false;
      throw new Error('Sinkronisasi kirim masih berlangsung. Selesaikan dahulu sebelum menarik data cloud.');
    }
    const context=captureSession();
    const requestEpoch=++pullEpoch;
    const current=()=>sameSession(context)&&requestEpoch===pullEpoch;
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
      if(!current())return false; // Ignore late replies from another user or older pull.
      if(error)throw error;
      if(!data)throw new Error('Snapshot/scoped state belum tersedia. Admin harus menginisialisasi snapshot dan menetapkan minimal satu OPD serta satu tahun untuk akun non-admin.');
      if(!data.payload||typeof data.payload!=='object'||!Array.isArray(data.payload.paket)||!Array.isArray(data.payload.opd))throw new Error('Respons snapshot tidak memiliki struktur SATRIA yang valid.');
      const ui={...(S.ui||{})};
      Object.assign(S,data.payload,{ui,log:[],dirty:false,chat:[],chatCtx:null});
      const assignedOpds=member.role==='admin'?'all':(Array.isArray(member.scope?.opd_ids)?member.scope.opd_ids.map(String):[]);
      const assignedYears=member.role==='admin'?null:(Array.isArray(member.scope?.years)?member.scope.years.map(Number).filter(Number.isFinite):[]);
      S.users=[{id:'auth-'+member.id,nama:member.account_type==='ppkom'?'PPKom · '+member.email:member.email,username:member.email,role:roleName(member.role),opd:assignedOpds,years:assignedYears,aktif:true}];S.ui.user=S.users[0].id;
      if(typeof normalizeData==='function')normalizeData();
      const previousCloudVersion=version;
      version=Number(data.version)||0;S.dirty=false;cloudStateReady=true;window.SATRIA_CLOUD_ADMIN_IMPORT_READY=false;
      if(version!==previousCloudVersion)clearCloudTrash(); // another device may have archived or restored records
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
          const writing=Promise.resolve().then(()=>persistNow());
          pendingScopedSave=writing;
          let persisted;
          try{persisted=await writing}finally{if(pendingScopedSave===writing)pendingScopedSave=null}
          if(!current())return false;
          if(!persisted&&DB&&DB.kv){try{await DB.kv.delete('main')}catch(_) {}}
        }else if(DB&&DB.kv){try{await DB.kv.delete('main')}catch(_) {}}

      }
      if(!current())return false;
      if(typeof route==='function')route();applyUserLock();
      lastSyncedPayload=currentPayload();conflictActive=false;S.dirty=false;
      const scopeText=member.role==='admin'?'seluruh organisasi':`${member.scope.opd_ids.length} OPD · TA ${member.scope.years.join(', ')}`;
      status(accountName()+' · Data cloud dimuat sesuai scope '+scopeText+'. Versi '+version+' · diperbarui '+(data.updated_at||'waktu tidak tersedia')+'.','ok');
      syncIndicator('Tersinkron · versi '+version,'');
    }catch(e){
      if(!current())return false; // Do not clear data belonging to a newer session.
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
    const context=captureSession();
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
        if(!sameSession(context))return false; // Old session may have committed on server; never apply locally.
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
      if(!sameSession(context))return false;
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
      if(sameSession(context)){
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
        const context=captureSession();
        const {data,error}=await client.rpc('satria_save_state',{p_organization_id:orgId,p_expected_version:version,p_payload:payload});
        if(!sameSession(context))return; // Ignore old administrator bootstrap reply.
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
      const logoutEpoch=invalidateSession();
      cancelAutosaveTimer();if(autoRetryTimer){clearTimeout(autoRetryTimer);autoRetryTimer=null}stopRealtime();if(client)await client.auth.signOut();
      if(logoutEpoch!==sessionEpoch)return; // A different login took over during sign-out.
      window.SATRIA_MEDIA?.clear();
      clearCloudTrash();member=null;version=0;cloudStateReady=false;lastSyncedPayload=null;conflictActive=false;lastCloudConfirmedAt=null;
      window.dispatchEvent(new Event('satria:cloud-session-reset'));
      // `lastCloudErrorAt` and related state remain reset in the assignment below.
      lastCloudErrorAt=null;window.SATRIA_CLOUD_ADMIN_IMPORT_READY=false;orgId=$id('scOrg').value.trim();window.SATRIA_CLOUD_ROLE=null;window.SATRIA_CLOUD_MEMBER=null;
      resetCloudScopedView();
      // Never allow an old asynchronous scoped cache write to resurrect data after logout.
      const pending=pendingScopedSave;
      if(pending)try{await pending}catch(_){}
      if(logoutEpoch!==sessionEpoch)return;
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

  // Stage 5B: instantiate administration UI with LIVE session, no duplicate listeners.
  for(const install of ['SATRIA_INSTALL_CLOUD_ADMIN_CREATE','SATRIA_INSTALL_CLOUD_ADMIN_ROSTER']){
    if(typeof window[install]!=='function')
      throw new Error('Modul administrasi cloud SATRIA tidak lengkap; periksa cache PWA.');
    window[install](()=>({client,member,orgId}));
    // An installer exposes no service credentials and is removed after initialization.
    delete window[install];
  }

})();
