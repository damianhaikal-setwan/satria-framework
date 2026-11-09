'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(dir,'frontend/refactor/js/01-app-core.js'),'utf8');
const start=src.indexOf('function satriaLaporanRekeningScope(){'),end=src.indexOf('function vLap(){',start);
assert(start>0&&end>start,'modul laporan rekening ditemukan');
const S={
 ui:{opd:'all',lapRekeningTahun:'all',lapRekeningAkun:'all',lapRekeningCari:''},
 akun:[{id:'a1',kode:'5.1.02.01',nama:'Belanja Alat Tulis'}, {id:'a2',kode:'5.1.02.02',nama:'Belanja Perjalanan'}, {id:'unused',kode:'INVISIBLE',nama:'Tidak dipakai'}],
 opd:[{id:'bap',singkat:'Bapperida',nama:'Bapperida'}, {id:'disp',singkat:'Disporapar',nama:'Disporapar'}],
 paket:[]
};
const pack=(id,opd,tahun,akunId,pagu,hpsVal=50)=>({id,opd,tahun,akunId,pagu,
 rup:'RUP-'+id,nama:'Paket '+id,items:[{id:'i',vol:1,hs:hpsVal}],penawaran:[],pemenangId:null});
S.paket=[
 pack('bap1','bap',2026,'a1',100,80),
 {...pack('bap2','bap',2026,'a1',180,90),arsip:true,pemenangId:'chosen'},
 pack('bap3','bap',2026,'a2',200,100),
 pack('bap4','bap',2026,'',90),
 pack('bap5','bap',2026,'gone',40),
 pack('disp1','disp',2026,'a1',999),
 pack('old','bap',2025,'a1',44),
 {...pack('spse','bap',2026,'a1',150),jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{contractNo:'',contractValue:120,payments:[{amount:70,status:'Terverifikasi'},{amount:30,status:'Draf'}],status:'Proses'}},
 {...pack('spse2','bap',2026,'a2',180),jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{contractNo:'KR-1',contractValue:110,payments:[{amount:45,status:'Terverifikasi'}],status:'Kontrak'}}
];
let scope=null;const exportedCsv=[];
const f=new Function('S','activeCloudScope','O','hps','pemenang','satriaSpseIs','satriaSpseContractValue','satriaSpsePayments','stt','esc','rp','satriaLaporanDownloadCsv',
 src.slice(start,end)+ '\nreturn {satriaLaporanRekeningScope,satriaLaporanRekeningRows,vLaporanRekening,satriaLaporanRekeningCsv};');
const h={
 activeCloudScope:()=>scope,
 O:id=>S.opd.find(o=>o.id===id)||{singkat:id,nama:id},
 hps:p=>p.items.reduce((acc,i)=>acc+i.vol*i.hs,0),
 pemenang:p=>p.pemenangId==='chosen'?{t:67}:null,
 satriaSpseIs:p=>p.jalurPengadaan==='SPSE_MONITOR',
 satriaSpseContractValue:m=>m.contractValue||0,
 satriaSpsePayments:m=>(m.payments||[]).filter(x=>x.status==='Terverifikasi').reduce((s,x)=>s+x.amount,0),
 stt:p=>p.pemenangId?'Selesai':'Draf',
 esc:x=>String(x??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])),
 rp:n=>'Rp '+Math.round(n||0).toLocaleString('id-ID'),
 satriaLaporanDownloadCsv:(name,cols,rows)=>exportedCsv.push({name,cols,rows})
};
const api=f(S,...['activeCloudScope','O','hps','pemenang','satriaSpseIs','satriaSpseContractValue','satriaSpsePayments','stt','esc','rp','satriaLaporanDownloadCsv'].map(k=>h[k]));
const snapshot=JSON.stringify(S.paket);
let data=api.satriaLaporanRekeningRows();
assert.equal(data.details.length,9,'termasuk arsip, e-P, SPSE dan dua OPD');
assert.equal(data.groups.length,6,'rekap dipisahkan menurut rekening, tahun, OPD');
let x=data.groups.find(x=>x.opd==='bap'&&x.tahun===2026&&x.kode==='5.1.02.01');
assert.equal(x.total,3);assert.equal(x.pagu,430);assert.equal(x.hps,170);assert.equal(x.penetapan,67);
assert.equal(x.kontrak,0,'kontrak SPSE tanpa nomor kontrak tidak dihitung');assert.equal(x.bayar,70);
x=data.groups.find(x=>x.opd==='bap'&&x.kode==='5.1.02.02');
assert.equal(x.kontrak,110);assert.equal(x.bayar,45);
assert(data.groups.some(g=>g.status==='tanpa'));assert(data.groups.some(g=>g.status==='hilang'));
assert(!api.vLaporanRekening().includes('INVISIBLE'),'kode master yang tidak dipakai tidak muncul di dropdown');
assert(api.vLaporanRekening().includes('Paket bap2'),'paket arsip tetap ditampilkan');
assert(api.vLaporanRekening().includes('Belum ditautkan ke rekening'),'paket tanpa relasi ditandai');
S.ui.lapRekeningTahun='2025';data=api.satriaLaporanRekeningRows();assert.deepEqual(data.details.map(p=>p.id),['old']);
S.ui.lapRekeningTahun='all';S.ui.lapRekeningAkun='akun:a2';data=api.satriaLaporanRekeningRows();assert.deepEqual(data.details.map(p=>p.id).sort(),['bap3','spse2']);
S.ui.lapRekeningAkun='all';S.ui.lapRekeningCari='RUP-bap5';data=api.satriaLaporanRekeningRows();assert.equal(data.details.length,1);assert.equal(data.details[0].id,'bap5');
S.ui.lapRekeningCari='';scope={opdIds:['bap'],years:[2026]};data=api.satriaLaporanRekeningRows();assert.equal(data.details.length,7,'scope PPKom menyaring OPD dan TA');assert(data.details.every(p=>p.tahun===2026&&p.opd==='bap'));
api.satriaLaporanRekeningCsv(false);assert.equal(exportedCsv.at(-1).rows.reduce((s,r)=>s+r[5],0),7);
api.satriaLaporanRekeningCsv(true);assert.equal(exportedCsv.at(-1).rows.length,7);assert(exportedCsv.at(-1).rows.some(r=>r[7]==='Paket bap1'&&r[3]==='Belanja Alat Tulis'),'nama paket benar, bukan uraian rekening');
assert(exportedCsv.at(-1).rows.some(r=>r[2]==='5.1.02.01'&&r[3]==='Belanja Alat Tulis'));
assert(!exportedCsv.at(-1).rows.some(r=>r[7]==='Paket disp1'),'CSV juga dibatasi scope');
S.ui.opd='disp';data=api.satriaLaporanRekeningRows();assert.equal(data.details.length,0,'filter OPD dan server scope saling memotong');
S.ui.opd='all';scope=null;assert.equal(JSON.stringify(S.paket),snapshot,'laporan tidak mengubah paket');
const malicious=pack('evil','bap',2026,'a1',10);malicious.nama='<img src=x onerror=alert(1)>';S.paket.push(malicious);
assert(api.vLaporanRekening().includes('&lt;img'),'XSS data paket di-escape');
console.log('PASS: rekap rekening, join master, read-only, arsip, filter, OPD/TA PPKom, SPSE, CSV, keamanan HTML');
