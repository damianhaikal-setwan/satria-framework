'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../frontend/refactor/js/01-app-core.js'),'utf8');
const cloud=fs.readFileSync(path.join(__dirname,'../frontend/refactor/js/05-cloud-sync.js'),'utf8');
function extractBlock(source,start){
 const i=source.indexOf(start);assert(i>=0,'blok wajib ada: '+start);
 const a=source.indexOf('{',i+start.length-1);
 let depth=0, quote=null, escaped=false;
 // Sumber blok yang diuji tidak memuat literal template multiline, cukup untuk braced JS ini.
 for(let k=a;k<source.length;k++){
  const c=source[k];
  if(quote){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c===quote){quote=null}continue}
  if(c==='\''||c==='"'||c==='`'){quote=c;continue}
  if(c==='{')depth++;else if(c==='}'&&!--depth)return source.slice(i,k+1);
 }
 throw Error('blok tidak seimbang');
}
const exportBlock=extractBlock(src,"if(a==='export'){");
const imports=src.slice(src.indexOf("if(t.id==='imp'){"),src.indexOf("\n if(d.addpw){"));
const validate=src.slice(src.indexOf('function validateBackup(o){'),src.indexOf('\nfunction resetDetailIfOutsideFilter(){'));
const cleanSnapshot={
 pemda:{nama:'PEMDA CONTOH'},tahun:[2026],opd:[{id:'opd1',nama:'BAPPERIDA Contoh',singkat:'BAPPERIDA'}],
 users:[{id:'u1',nama:'Admin Contoh',role:'Admin',aktif:true}],unit:[{id:'un1',opd:'opd1'}],
 pejabat:[],penyedia:[{id:'p1'}],akun:[],kode:[],rupBank:[],
 paket:[{id:'k1',tahun:2026,opd:'opd1',unit:'un1',pagu:1000000,
         items:[{id:'i1',nama:'Barang Contoh',vol:2,hs:10000}],
         penawaran:[{id:'w1',pen:'p1',harga:{i1:9000},nego:{i1:8800}}]}]
};
const deepCopy=v=>JSON.parse(JSON.stringify(v));
const globals={rupBankKey:r=>`${r.opd}|${r.tahun}|${r.rup}`,satriaRupLinks:p=>p.rupBankIds||[],Number,Array,Set,Map,Object,Error};
const validateBackup=vm.runInNewContext(validate+'\nvalidateBackup',globals);
assert.equal(validateBackup(deepCopy(cleanSnapshot)),true);
for(const change of [
 s=>s.opd.splice(0,1),s=>s.users[0].aktif=false,
 s=>s.paket[0].penawaran[0].pen='unknown',
 s=>s.paket[0].items.push(deepCopy(s.paket[0].items[0])),
 s=>s.paket[0].tahun=2300,
 s=>s.paket[0].pagu=-1
]){
 const bad=deepCopy(cleanSnapshot);change(bad);assert.throws(()=>validateBackup(bad));
}
// Ekspor backup harus mempertahankan status perubahan lokal, baik sukses maupun offline.
for(const dirty of [true,false]){
 const S={...deepCopy(cleanSnapshot),dirty,ui:{page:'dash'},log:[],chat:[],chatCtx:null};
 const before=deepCopy(S);let clicks=0, rendered=0, revoked=0;
 const context={a:'export',S,Date,Blob,JSON,
   URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>revoked++},
   document:{createElement:()=>({click:()=>clicks++})},setTimeout:fn=>fn(),render:()=>{rendered++}};
 vm.runInNewContext('(function(){'+exportBlock+'})()',context);
 assert.equal(S.dirty,dirty,'unduh backup tidak boleh menghapus status pending');
 assert.deepEqual(S,before,'unduh backup tidak boleh mengubah data bisnis');
 assert.equal(clicks,1);assert.equal(rendered,1);assert.equal(revoked,1);
}
// Drill impor menggunakan callback FileReader aktual dalam blok handler, tetapi TANPA cloud nyata.
function importLocal(data,accept=true){
 const S={...deepCopy(cleanSnapshot),ui:{page:'dash',tahun:2026},dirty:true,log:[]};
 const baseline=deepCopy(S);let syncCount=0,toastCalls=[];
 const t={id:'imp',files:[{size:512,contents:JSON.stringify(data)}],value:'backup.json'};
 const context={t,S,Date,JSON,Number,Array,Object,Set,Map,Error,console:{warn(){}},
   FileReader:class {readAsText(f){this.result=f.contents;this.onload()}},
   validateBackup,SEED:deepCopy(cleanSnapshot),
   normalizeData:()=>{},sync:()=>{syncCount++},render:()=>{},toast:m=>toastCalls.push(m),
   confirm:()=>accept,window:{},uid:()=> 'test'};
 vm.runInNewContext('(function(){'+imports+'})()',context);
 return {S,baseline,syncCount,toastCalls};
}
const ok=importLocal(deepCopy(cleanSnapshot));
assert.equal(ok.syncCount,1,'restore valid perlu dinyatakan sebagai perubahan lokal');
assert.equal(ok.S.dirty,true,'restore valid perlu disinkronkan sebelum dianggap cloud tersimpan');
assert.deepEqual(ok.S.paket,cleanSnapshot.paket,'data paket, harga dan nego tetap sama');
const broken=deepCopy(cleanSnapshot);broken.paket[0].opd='opd-tidak-ada';
const failed=importLocal(broken);assert.equal(failed.syncCount,0);
assert.deepEqual(failed.S,failed.baseline,'restore invalid tidak boleh mengubah data aktif');
const canceled=importLocal(deepCopy(cleanSnapshot),false);assert.equal(canceled.syncCount,0);
assert.deepEqual(canceled.S,canceled.baseline,'batal restore tidak boleh mengubah data');
// Backoff/routing cloud masih dipicu oleh status dirty ketika browser kembali online.
const onlineCode=cloud.match(/window\.addEventListener\('online',(\(\)=>\{if\(member&&S\.dirty&&!conflictActive\)requestAutosave\('browser-online'\);if\(member\)checkRemoteVersion\(\)\})\);/);
assert(onlineCode,'Listener online untuk retry tidak ditemukan');
for(const [dirty,conflict,shouldRetry] of [[true,false,true],[false,false,false],[true,true,false]]){
 let retries=0,checks=0;
 const listener=vm.runInNewContext(onlineCode[1],{member:{role:'operator'},S:{dirty},conflictActive:conflict,
   requestAutosave:()=>{retries++},checkRemoteVersion:()=>{checks++}});
 listener();
 assert.equal(retries,shouldRetry?1:0,'retry online tergantung pending dan konflik');
 assert.equal(checks,1);
}

assert(cloud.includes('if(!manual&&!conflictActive&&')&&cloud.includes('&&S.dirty)'));
assert(cloud.includes('window.SATRIA_SYNC_HEALTH=Object.freeze('));
console.log('PASS P1/P3: backup pending/clean, pemulihan simulasi valid/invalid/batal, retry online dan status sync tetap terjaga');
