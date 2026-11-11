#!/usr/bin/env node
/* STAGING ONLY. Impossible version -1 and invented record IDs: failure paths, zero planned data writes.
 * Does not print tokens, raw rows or business data. Real archive/restore positive scenarios need test fixtures.
 * Expects SATRIA_STAGING_CONFIRMED=YES_STAGING_ONLY, SATRIA_STAGING_URL,
 * SATRIA_STAGING_HOSTNAME, SATRIA_STAGING_ANON_KEY, SATRIA_STAGING_ORG_ID,
 * SATRIA_STAGING_ADMIN_JWT, SATRIA_STAGING_OPERATOR_JWT, SATRIA_STAGING_VIEWER_JWT.
 */
import process from 'node:process';
const env=process.env;
function check(condition,text){if(!condition)throw Error(text)}
async function rpc(rpcName,token,args){
 const url=new URL('/rest/v1/rpc/'+rpcName,env.SATRIA_STAGING_URL);
 const response=await fetch(url,{method:'POST',headers:{apikey:env.SATRIA_STAGING_ANON_KEY,authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify(args),redirect:'error',signal:AbortSignal.timeout(12000)});
 let error={};try{error=await response.json()}catch{}
 return {ok:response.ok,status:response.status,code:String(error?.code||'')};
}
async function run(){
 check(env.SATRIA_STAGING_CONFIRMED==='YES_STAGING_ONLY','Gunakan konfirmasi STAGING eksplisit');
 const url=new URL(env.SATRIA_STAGING_URL||'https://missing.invalid');
 check(url.protocol==='https:'&&url.hostname===env.SATRIA_STAGING_HOSTNAME&&!!env.SATRIA_STAGING_HOSTNAME,
   'Hostname staging harus cocok persis dengan SATRIA_STAGING_HOSTNAME');
 for(const k of ['SATRIA_STAGING_ANON_KEY','SATRIA_STAGING_ORG_ID','SATRIA_STAGING_ADMIN_JWT','SATRIA_STAGING_OPERATOR_JWT','SATRIA_STAGING_VIEWER_JWT'])
  check(Boolean(env[k]),'Variabel STAGING belum lengkap: '+k);
 check(/^[0-9a-f-]{36}$/i.test(env.SATRIA_STAGING_ORG_ID),'Organization UUID tidak valid');
 const args={p_organization_id:env.SATRIA_STAGING_ORG_ID,p_expected_version:-1,p_collection:'penawaran',
  p_parent_id:'__nonexistent_satria_staging_probe__',p_record_id:'__nonexistent_satria_staging_probe__'};
 let count=0;
 for(const role of ['ADMIN','OPERATOR','VIEWER']){
  const x=await rpc('satria_archive_nested',env['SATRIA_STAGING_'+role+'_JWT'],args);
  check(!x.ok,role+' unexpectedly succeeded on impossible version: do not repeat; investigate database');
  if(role==='VIEWER')check(x.status===401||x.status===403||x.code==='42501',
    'Viewer seharusnya ditolak oleh server karena izin, bukan sekadar konflik versi');
  console.log('PASS '+role+' archive nested rejected with invalid version (no write)');count++;
 }
 const media={...args,p_collection:'media',p_parent_id:'pemda',p_record_id:'pemda-logo'};
 const denied=await rpc('satria_archive_nested',env.SATRIA_STAGING_OPERATOR_JWT,media);
 check(!denied.ok&&(denied.status===401||denied.status===403||denied.code==='42501'),
  'Operator media harus ditolak server karena role');
 console.log('PASS OPERATOR media rejected by role');count++;
 const restore=await rpc('satria_restore_nested',env.SATRIA_STAGING_VIEWER_JWT,{
  p_organization_id:env.SATRIA_STAGING_ORG_ID,p_expected_version:-1,
  p_trash_id:'00000000-0000-4000-8000-000000000000'});
 check(!restore.ok&&(restore.status===401||restore.status===403||restore.code==='42501'),
  'Viewer restore harus ditolak server karena role');
 console.log('PASS VIEWER restore rejected by role');count++;
 console.log(`Selesai ${count}/${count} negative probes; uji positif transaksi/backup masih harus dilakukan terpisah.`);
}
run().catch(e=>{console.error('GAGAL: '+e.message);process.exitCode=1});
