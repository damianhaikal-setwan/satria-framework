'use strict';
// Test independent of production records. Optional CLI args accept two exported SiRUP JSON files.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'frontend/refactor/js/01-app-core.js'),'utf8');
function section(start,end){const a=src.indexOf(start),b=src.indexOf(end,a+1);assert(a>=0&&b>a,`Missing ${start}`);return src.slice(a,b);}
const opdName='DINAS PELAKSANA SIMULASI';
const S={ui:{tahun:2026,opd:'o1'},tahun:[2026],opd:[{id:'o1',nama:opdName,singkat:'DINAS SIMULASI'}],kode:[],unit:[],rupBank:[],paket:[],pemda:{sumber:'APBD'}};
const sandbox={S,console,satriaValidSubCode:()=>'',activeCloudScope:()=>null,uid:(prefix)=>prefix+'-test-'+Math.random().toString(36).slice(2),satriaPemdaOfficial:()=> 'APBD',pjId:()=>'',O:()=>({nama:opdName,singkat:'DINAS SIMULASI',tempat:'',alamat:''}),esc:x=>String(x)};
vm.createContext(sandbox);
vm.runInContext(section('function uniqSumber(', 'function satriaRupLinks(')+section('function satriaRupSourcePatch(', 'const rupPreview=')+section('function satriaBankRow(', '/* SATRIA 3.0.42'), sandbox);
const {rupReadJson,satriaBankRow,satriaRupClassState}=sandbox;
let full,short;
if(process.argv[2]&&process.argv[3]){
  full=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
  short=JSON.parse(fs.readFileSync(process.argv[3],'utf8').replace(/^\uFEFF/,''));
  const nama=full.data?.[0]?.satuanKerja;
  assert(nama,'File pertama harus JSON data[] SiRUP yang mencantumkan satuanKerja.');
  S.opd[0].nama=nama;
}else{
  full={recordsFiltered:3,recordsTotal:3,data:[
   {id:101,paket:'Barang simulasi',pagu:123000,metode:'E-Purchasing',jenisPengadaan:'Barang',satuanKerja:opdName,pemilihan:'January 2026',lokasi:'Kalimantan Barat',sumberDana:'APBD',idMetode:9,idJenisPengadaan:1},
   {id:102,paket:'Pekerjaan konstruksi simulasi',pagu:175000000,metode:'Pengadaan Langsung',jenisPengadaan:'Pekerjaan Konstruksi',satuanKerja:opdName,pemilihan:'September 2026',lokasi:'Kalimantan Barat',sumberDana:'APBD',idMetode:8,idJenisPengadaan:2},
   {id:103,paket:'Tagihan simulasi',pagu:750000,metode:'Dikecualikan',jenisPengadaan:'Jasa Lainnya',satuanKerja:opdName,pemilihan:'January 2026',lokasi:'Kalimantan Barat',sumberDana:'APBD',idMetode:16,idJenisPengadaan:4}
  ]};
  short={aaData:full.data.map(r=>[String(r.id),r.paket,String(r.pagu),r.metode,r.sumberDana,String(r.id),r.pemilihan]),iTotalDisplayRecords:3,sEcho:1};
}
assert(Array.isArray(full.data));assert(Array.isArray(short.aaData));
const idFull=new Set(full.data.map(r=>String(r.id))),idShort=new Set(short.aaData.map(r=>String(r[0])));
assert.equal(idFull.size,full.data.length,'Duplicate ids in detailed file');
assert.equal(idShort.size,short.aaData.length,'Duplicate ids in compact file');
assert.deepEqual([...idFull].sort(),[...idShort].sort(),'Same source should contain same RUP codes');
const fullById=new Map(full.data.map(r=>[String(r.id),r]));
for(const row of short.aaData){const d=fullById.get(String(row[0]));assert(d);assert.equal(d.paket.trim(),String(row[1]).trim());assert.equal(d.pagu,Number(row[2]));assert.equal(d.metode,String(row[3]));}
const parsedFull=rupReadJson(JSON.stringify(full),'o1','','skip');
const parsedShort=rupReadJson(JSON.stringify(short),'o1','','skip');
assert.equal(parsedFull.errs.length,0,parsedFull.errs.join("; "));assert.equal(parsedShort.errs.length,0,parsedShort.errs.join("; "));
assert.equal(parsedFull.rows.length,idFull.size);assert.equal(parsedShort.rows.length,idFull.size);
assert.equal(parsedFull.missingClass||0,0,'Detailed source has type and method');
assert.equal(parsedShort.missingClass,idShort.size,'Compact source has no type, must remain unclassified');
assert(parsedFull.rows.every(r=>r.jenisPengadaan&&r.metodePemilihan));
assert(parsedShort.rows.every(r=>r.jenisPengadaan===''&&r.lokasiPengiriman===''));
assert(parsedFull.rows.every(r=>r.lokasiPengiriman===''),'Region in source must not be used as delivery address');
assert(parsedFull.warnings.some(x=>x.includes('objek lengkap')));
assert(parsedShort.warnings.some(x=>x.includes('daftar ringkas')));
assert.equal(satriaRupClassState({jenisPengadaan:'Jasa Lainnya',metodePemilihan:'Dikecualikan'}).unusual,false);
// Import compact first, then choose update on detailed. Bank entries remain the same, type is enriched.
S.rupBank=parsedShort.rows.map(satriaBankRow);
const enrichment=rupReadJson(JSON.stringify(full),'o1','','update');
assert.equal(enrichment.errs.length,0,enrichment.errs.join("; "));
assert.equal(enrichment.rows.length,0);
assert.equal(enrichment.updates.length,idFull.size);
assert(enrichment.updates.every(u=>Object.hasOwn(u.patch,'jenisPengadaan')));
for(const update of enrichment.updates){const b=S.rupBank.find(r=>r.id===update.id);Object.assign(b,update.patch);}
assert(S.rupBank.every(r=>r.jenisPengadaan),'All compact entries must be enriched only via explicit update');
const reverse=rupReadJson(JSON.stringify(short),'o1','','update');
assert.equal(reverse.updates.length,0,'Compact reimport must not erase full classifications');
console.log('PASS 3.0.59.59: '+idFull.size+' codes match, full/compact parsed, Dikecualikan known, explicit enrichment, compact cannot erase types or fabricate location.');
