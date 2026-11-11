#!/usr/bin/env node
/* SATRIA Stage 5A: READ-ONLY API scope tests with real staging JWTs.
 * Does not log bearer tokens or sensitive record content. Does NOT mutate data.
 * Required environment: SATRIA_STAGING_CONFIRMED=YES_STAGING_ONLY,
 * SATRIA_STAGING_URL, SATRIA_STAGING_HOSTNAME, SATRIA_STAGING_ANON_KEY, SATRIA_STAGING_ORG_ID,
 * SATRIA_STAGING_ADMIN_JWT, SATRIA_STAGING_OPERATOR_JWT, SATRIA_STAGING_VIEWER_JWT.
 * Optional: SATRIA_STAGING_OTHER_ORG_ID, SATRIA_STAGING_OUTSIDER_JWT.
 */
import process from 'node:process';
const config={
 url:process.env.SATRIA_STAGING_URL,anon:process.env.SATRIA_STAGING_ANON_KEY,
 org:process.env.SATRIA_STAGING_ORG_ID,other:process.env.SATRIA_STAGING_OTHER_ORG_ID,
 tokens:{admin:process.env.SATRIA_STAGING_ADMIN_JWT,operator:process.env.SATRIA_STAGING_OPERATOR_JWT,
 viewer:process.env.SATRIA_STAGING_VIEWER_JWT,outsider:process.env.SATRIA_STAGING_OUTSIDER_JWT}
};
function assert(condition,message){if(!condition)throw Error(message)}
function jsonHeaders(token){return {'apikey':config.anon,'authorization':`Bearer ${token}`,'accept':'application/json','content-type':'application/json'}}
async function request(path,token,options={}){
 const response=await fetch(new URL(path,config.url),{...options,headers:jsonHeaders(token),redirect:'error',signal:AbortSignal.timeout(12000)});
 let result=null;try{result=await response.json()}catch{}
 return {ok:response.ok,status:response.status,result};
}
function scopedRows(response){
 if(!response.ok||!response.result?.payload)throw Error('RPC scoped gagal atau respons tanpa payload');
 const scope=response.result.scope||{},allowedOpd=new Set((scope.opd_ids||[]).map(String)),
 allowedYears=new Set((scope.years||[]).map(Number));
 if(!allowedOpd.size||!allowedYears.size)throw Error('Fixture tidak mempunyai OPD dan tahun: pengujian scope tidak dapat dibuktikan');
 for(const collection of ['rupBank','paket'])for(const row of response.result.payload[collection]||[]){
  if(!allowedOpd.has(String(row.opd))||!allowedYears.has(Number(row.tahun)))
   throw Error('RPC membocorkan baris dari OPD/tahun di luar scope');
 }
 for(const row of response.result.payload.opd||[])if(!allowedOpd.has(String(row.id)))
  throw Error('Proyeksi OPD membocorkan master di luar scope');
 for(const collection of ['unit','pejabat'])for(const row of response.result.payload[collection]||[])
  if(!allowedOpd.has(String(row.opd)))throw Error('Proyeksi '+collection+' membocorkan baris di luar scope');
 return {opds:allowedOpd.size,years:allowedYears.size,allowedOpd,allowedYears};
}
async function run(){
 assert(process.env.SATRIA_STAGING_CONFIRMED==='YES_STAGING_ONLY','Wajib konfirmasi lingkungan STAGING secara eksplisit');
 for(const k of ['url','anon','org'])assert(Boolean(config[k]),`Konfigurasi ${k} belum lengkap`);
 for(const role of ['admin','operator','viewer'])assert(Boolean(config.tokens[role]),`JWT uji ${role} belum tersedia`);
 const origin=new URL(config.url);
 assert(origin.protocol==='https:'&&origin.username===''&&origin.password===''&&origin.hostname===process.env.SATRIA_STAGING_HOSTNAME&&!!process.env.SATRIA_STAGING_HOSTNAME&&origin.pathname==='/'&&origin.search===''&&origin.hash==='',
   'Hostname staging harus cocok PERSIS dengan SATRIA_STAGING_HOSTNAME; URL hanya origin HTTPS tanpa path/query');
 assert(/^[a-f\d-]{36}$/i.test(config.org),'Organization UUID tidak valid');
 let passed=0;
 const scopes=new Map();
 const print=message=>{console.log('PASS '+message);passed++};
 const query=`rest/v1/satria_state?organization_id=eq.${encodeURIComponent(config.org)}&select=version&limit=1`;
 const admin=await request(query,config.tokens.admin);
 assert(admin.ok&&Array.isArray(admin.result)&&admin.result.length===1,'Admin tidak dapat membaca versi snapshot organisasi staging');print('Admin: baca versi snapshot sendiri');
 for(const role of ['operator','viewer']){
  const raw=await request(query,config.tokens[role]);
  assert(!raw.ok||(Array.isArray(raw.result)&&raw.result.length===0),`${role} bisa membaca snapshot mentah`);
  print(`${role}: tidak dapat membaca snapshot mentah`);
  const scoped=await request('rest/v1/rpc/satria_get_scoped_state',config.tokens[role],{method:'POST',body:JSON.stringify({p_organization_id:config.org})});
  const projection=scopedRows(scoped);
  scopes.set(role,projection);
  print(`${role}: proyeksi sesuai ${projection.opds} OPD dan ${projection.years} tahun`);
 }
 for(const role of ['admin','operator','viewer']){
  const trash=await request(`rest/v1/satria_trash_entries?organization_id=eq.${encodeURIComponent(config.org)}&select=id,collection,opd_id,fiscal_year&limit=1000`,config.tokens[role]);
  assert(trash.ok&&Array.isArray(trash.result),`${role}: endpoint Sampah gagal`);
  if(role!=='admin'){
   const scope=scopes.get(role);
   for(const row of trash.result){
    if(row.opd_id==null||row.fiscal_year==null||!scope.allowedOpd.has(String(row.opd_id))||!scope.allowedYears.has(Number(row.fiscal_year)))
     throw Error(`${role}: Sampah membocorkan arsip organisasi/OPD/tahun di luar scope`);
   }
  }
  // Absence of staged trash fixtures is not proof of correct filtering.
  print(`${role}: metadata Sampah terbaca (${trash.result.length} baris; pastikan fixture ada untuk uji isolasi)`);
 }
 if(config.other){
  assert(/^[a-f\d-]{36}$/i.test(config.other),'Other-org UUID tidak valid');
  for(const role of ['admin','operator','viewer']){
   const r=await request(`rest/v1/satria_trash_entries?organization_id=eq.${encodeURIComponent(config.other)}&select=id&limit=1`,config.tokens[role]);
   assert(!r.ok||(Array.isArray(r.result)&&r.result.length===0),`${role}: data Sampah organisasi lain bocor`);
   print(`${role}: tidak melihat Sampah organisasi lain`);
  }
 }
 if(config.tokens.outsider){
  const o=await request(query,config.tokens.outsider);
  assert(!o.ok||(Array.isArray(o.result)&&o.result.length===0),'Pengguna luar organisasi bisa membaca snapshot');
  print('Akun luar organisasi: tidak dapat membaca snapshot');
 }
 console.log(`SELESAI: ${passed} pemeriksaan API baca-saja lulus. Ini BUKAN uji mutasi atomik, konflik, atau backup/restore.`);
}
run().catch(err=>{console.error('GAGAL: '+String(err?.message||'kesalahan tidak diketahui'));process.exitCode=1});
