/* SATRIA 3.0.59.22: per-RUP award/HPS reconciliation and dashboard regression. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=require('./legacy_index_source.cjs').readIndex();
const start=html.indexOf('function rupBankKey(p){');
const end=html.indexOf('function satriaRupPeriksaAlokasiPaket(',start);
assert(start>0&&end>start,'RUP core/overview not found');
const S={ui:{tahun:2026,opd:'all'},rupBank:[],paket:[],tahun:[2026]};
const f=new Function('S','activeCloudScope','satriaSpseIs','kontrak','rp','esc','window',
  html.slice(start,end)+ '\nreturn {satriaRupStatusAnggaran,satriaDashboardRupMetrics,satriaDashboardRupOverview,satriaRupBagianPagu,satriaRupBagianHps};');
// kontrak(p) in production is only nonzero after the full winner validation gate.
const {satriaRupStatusAnggaran,satriaDashboardRupMetrics,satriaDashboardRupOverview,satriaRupBagianPagu,satriaRupBagianHps}=f(
  S,()=>null,p=>p.jalurPengadaan==='SPSE_MONITOR',p=>p.award||0,n=>`Rp${n}`,String,{SATRIA_PROCUREMENT_CORE:require('../frontend/satria-procurement-core.js')});
const R=(id,pagu,opd='a')=>({id,rup:id,nama:id,tahun:2026,opd,pagu});
const P=(id,rup,hps,pagu,award=0)=>({id,opd:'a',tahun:2026,rup:rup.rup,rupBankId:rup.id,
  pagu,items:[{id:'i-'+id,nama:'Barang',vol:1,hs:hps}],award});
S.rupBank=[R('a',100),R('b',200)];
const draft=P('draft',S.rupBank[0],50,80);
const settled=P('settled',S.rupBank[0],70,80,35);
S.paket=[draft,settled];
let x=satriaRupStatusAnggaran(S.rupBank[0]);
assert.equal(x.allocatedHps,120,'HPS baseline includes settled HPS');
assert.equal(x.penetapan,35,'Only validated award in bank');
assert.equal(x.pending,50,'Unsettled reservation only');
assert.equal(x.allocated,85,'Award REPLACES 70 HPS; no double count');
assert.equal(x.sisaHps,-20);assert.equal(x.sisa,15);
assert.equal(satriaRupBagianPagu(settled,S.rupBank[0]),35);
assert.equal(satriaRupBagianHps(settled,S.rupBank[0]),70);
let m=satriaDashboardRupMetrics();
assert.equal(m.pagu,300);assert.equal(m.used,85);assert.equal(m.usedHps,120);
assert.equal(m.settled,35);assert.equal(m.pending,50);
assert.equal(m.free,215,'Free totals per RUP (15+200)');
assert.equal(m.freeHps,200,'Negative RUP excluded from aggregate positive capacity');
assert.equal(m.overHps,20);
const multi={id:'multi',opd:'a',tahun:2026,rup:'combined',pagu:30,award:18,
  rupBankIds:['a','b'],rupBankId:'a',rupAlokasi:{a:10,b:20},items:[{id:'m',nama:'M',vol:1,hs:30}]};
S.paket.push(multi);
let a=satriaRupStatusAnggaran(S.rupBank[0]),b=satriaRupStatusAnggaran(S.rupBank[1]);
assert.equal(a.allocated,95);assert.equal(b.allocated,20);
assert.equal(a.penetapan,35);assert.equal(b.penetapan,0);
assert.equal(a.penetapanBelumTerbagi,1);assert.equal(b.penetapanBelumTerbagi,1);
m=satriaDashboardRupMetrics();
assert.equal(m.settled,35);
assert.equal(m.settledUnattributed,18,'Multi-RUP award counted only once globally');
assert.equal(m.used,115,'Split remains reserved rather than re-spending award');
assert.equal(m.awardsUnassigned,2,'Each linked RUP flagged pending attribution');
assert.match(satriaDashboardRupOverview(m),/Sisa setelah penetapan/);
assert.match(satriaDashboardRupOverview(m),/Penetapan multi-RUP belum terbagi/);
const spse={id:'spse',opd:'a',tahun:2026,rup:'a',rupBankId:'a',pagu:25,award:20,
  jalurPengadaan:'SPSE_MONITOR',spseMonitoring:{contractValue:20},items:[]};
S.paket.push(spse);
a=satriaRupStatusAnggaran(S.rupBank[0]);
assert.equal(a.allocated,120,'SPSE contract must not replace its reserved allocation');
assert.equal(a.penetapan,35,'SPSE contract must not appear as e-P award');
assert.equal(a.pending,85,'SPSE still reserved');
assert.equal(satriaRupBagianPagu(spse,S.rupBank[0]),25);
// Detect missing attribution even when multi split is absent: do not infer a split.
delete multi.rupAlokasi;
a=satriaRupStatusAnggaran(S.rupBank[0]);
assert.equal(a.tidakTerbagi,1);
assert.equal(satriaRupBagianPagu(multi,S.rupBank[0]),30);
assert.equal(satriaRupBagianPagu(multi,S.rupBank[1]),30);
// Invalid/double-code RUP excluded from totals and surfaced as anomaly.
S.rupBank.push({...S.rupBank[1],id:'b-dupe'});
m=satriaDashboardRupMetrics();
assert.equal(m.duplicated,1);assert.equal(m.validCount,1);
assert.equal(m.pagu,100,'Duplicate pagu must not inflate aggregate');
assert(html.includes('function satriaDashboardTindakLanjut(ep,bank)'));
assert(html.includes('Kelengkapan E-Purchasing'));
assert(html.includes('Sisa RUP menurut HPS'));
assert(html.includes('Penetapan Bank RUP'));
assert(html.includes('Penetapan / Pagu E-Purchasing'));
console.log('PASS — Award replaces HPS, multi-RUP not double-counted, SPSE isolated, duplicate excluded, dashboard enhanced');
