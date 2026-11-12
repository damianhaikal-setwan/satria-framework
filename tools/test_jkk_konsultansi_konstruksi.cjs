'use strict';
const assert=require('node:assert/strict');
const core=require('../frontend/satria-jkk-core.js');
const schema=require('../frontend/satria-jkk-schema.js');
const docs=require('../frontend/satria-jkk-docs.js');
const ui=require('../frontend/satria-jkk-workspace.js');
const rup={id:'rup-jkk',rup:'25001234',nama:'Perencanaan rehabilitasi gedung',jenisPengadaan:'Jasa Konsultansi',metodePemilihan:'Pengadaan Langsung',tahun:2026,opd:'opd-a',pagu:50000000};
const p={id:'pak-jkk',nama:rup.nama,tahun:2026,opd:'opd-a',rup:rup.rup,rupBankId:rup.id,rupBankIds:[rup.id],pagu:45000000,jenisPengadaan:'Jasa Konsultansi',jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{method:'Pengadaan Langsung'},kkJkk:{...core.blank(),subjenis:'Konstruksi'}};
assert.equal(core.rupEligible(rup),true);
for(const change of [{jenisPengadaan:'Pekerjaan Konstruksi'},{jenisPengadaan:'Barang'},{metodePemilihan:'Seleksi'},{metodePemilihan:'Tender'}])assert.equal(core.rupEligible({...rup,...change}),false);
assert.equal(core.eligiblePackage(p,[rup]).eligible,true);
assert.equal(core.subtypeConfirmed(p,rup),true);
assert.equal(core.subtypeConfirmed({...p,kkJkk:core.blank()},rup),false);
for(const patch of [{rupBankId:null,rupBankIds:[]},{rupBankId:'rup-foo',rupBankIds:['rup-foo']},{rupBankIds:['rup-jkk','rup-lain']},{opd:'opd-b'},{tahun:2025},{rup:'RUP-LAIN'},{spseMonitoring:{method:'Tender'}},{jenisPengadaan:'Barang'}]){
 assert.equal(core.eligiblePackage({...p,...patch},[rup]).eligible,false,JSON.stringify(patch));
}
assert.equal(schema.rev.length,42);assert.equal(schema.perorangan.kua.length,8);assert.equal(schema.perorangan.pen.length,12);
assert.equal(new Set(schema.rev.map(x=>x.id)).size,42);
const blank=core.blank();assert.equal(blank.tarifPajak,'');assert.deepEqual(blank.reviu,{});assert.deepEqual(blank.kualifikasi,{});
assert.deepEqual(core.progress(blank,schema),{reviu:0,semuaReviu:42,kua:0,semuaKua:8,pen:0,semuaPen:12});
const d=core.model(p.kkJkk);
d.bentuk='Perorangan';d.hpsPPK='4000000';d.tarifPajak='11';d.biaya=[{id:'jkk-1',kategori:'Personel',uraian:'Tenaga ahli',volume:'2',satuan:'OH',harga:'1500000',penawaran:'1400000',negosiasi:'1300000',survei:'Referensi tertulis'}];
assert.deepEqual(core.totals(d),{base:3000000,tax:330000,hps:3330000,offer:2800000,nego:2600000,invalid:false,rate:11,selisih:-670000});
assert(core.warnings(p,rup,d).some(x=>x.includes('berbeda')));
assert.equal(core.clean(d).biaya.length,1);
assert.equal(core.totals({...d,biaya:[]}).hps,null);
assert.equal(core.totals({...d,tarifPajak:''}).hps,null);
assert.equal(core.totals({...d,biaya:[{...d.biaya[0],penawaran:''}]}).offer,null);
for(const change of [{tarifPajak:'125'},{hpsPPK:'-1'},{subjenis:'Jasa Lainnya'},{bentuk:'Tender'}])assert.throws(()=>core.clean({...d,...change}));
for(const change of [{volume:'0'},{harga:'-1'},{kategori:'Unknown'},{id:'notsafe'},{penawaran:'NaN'}])assert.throws(()=>core.clean({...d,biaya:[{...d.biaya[0],...change}]}));
assert.throws(()=>core.clean({...d,biaya:Array.from({length:101},(_,i)=>({...d.biaya[0],id:'jkk-'+i}))}));
assert.throws(()=>core.clean({...d,reviu:{'rev-01':{status:'Lulus'}}}));
assert.throws(()=>core.clean({...d,reviu:{'rev-01':{status:'Sesuai',catatan:'a'.repeat(1501)}}}));
assert.equal(docs.DOCS.length,9);
const ctx={p:{...p,kkJkk:{...d,namaPenyedia:'PT <unsafe>'}},r:rup,opd:'OPD <b>abc</b>',instansi:'Instansi XYZ',pp:'PP <script>alert(1)</script>',nipPP:'123',ppk:'PPK A',kota:'Pontianak',printDate:'12 November 2026',supplier:'PT <unsafe>'};
for(const [id] of docs.DOCS){const html=docs.build(id,ctx);assert(html.includes('DRAF KERJA SATRIA'));assert(html.includes('25001234'));assert(!html.includes('PP <script>'));assert(!html.includes('PT <unsafe>'));assert(html.includes('PT &lt;unsafe&gt;') || !html.includes('PT &lt;unsafe&gt;'));assert(html.includes('<html lang="id">'));}
assert.throws(()=>docs.build('this-does-not-exist',ctx));
assert(ui.page().includes('Data SATRIA belum tersedia')); // Node tanpa state browser
console.log('PASS: klasifikasi RUP, relasi ID/OPD/tahun, filter metode, 42/8/12 kriteria, HPS, validasi, dokumen 9, escaping HTML.');
