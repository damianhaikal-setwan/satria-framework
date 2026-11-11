'use strict';
/* SATRIA Tahap 3: test numerik, integritas referensi dan non-mutasi lintas modul.
 * Pengujian mandiri menggunakan data sintetis; tidak ada perubahan ke data pengguna.
 */
const assert = require('node:assert/strict');
const core = require('../frontend/satria-procurement-core.js');
const eco = require('../frontend/satria-pp-ecosystem.js');
const price = require('../frontend/satria-price-analysis.js');
global.SATRIA_PBJ_POLICY=require('../frontend/pbj2026-policy.js');
let checks=0;
function check(actual, expected, label){assert.equal(actual,expected,label);checks++;}
const bank=[{id:'r1',rup:'12345',opd:'o1',tahun:2026,pagu:150000}, {id:'r2',rup:'67890',opd:'o1',tahun:2026,pagu:50000},{id:'wrong',rup:'333',opd:'o2',tahun:2026}];
const p={id:'p1',opd:'o1',tahun:2026,rup:'12345',nama:'Kebutuhan simulasi',pagu:150000,rupBankId:'r1',rupBankIds:['r1','r2','r1'],jenisPengadaan:'Barang',metodePemilihan:'E-Purchasing',items:[{id:'a',nama:'Barang A',vol:2,hs:25000},{id:'b',nama:'Barang B',vol:3,hs:10000}],penawaran:[{id:'w',pen:'supplier',harga:{a:24500,b:9999.5},nego:{a:24490,b:9999},ongkir:5000,sumberHarga:'Katalog',tanggalHarga:'2026-11-11'}]};
const initial=JSON.stringify(p), offer=p.penawaran[0];
check(core.hpsTotal(p),80000,'HPS total');
check(core.hpsItem(p.items[0]),50000,'HPS item');
check(core.offerGoodsTotal(p,offer,false),78999,'Harga tayang raw rounded after full sum');
check(core.offerGoodsTotal(p,offer,true),78977,'Negosiasi full sum with non-rounded item');
check(core.offerWithShipping(p,offer,'harga',2),83998.5,'Listed two decimal including shipping');
check(core.offerWithShipping(p,offer,'nego',2),83977,'Negotiated two decimal including shipping');
assert.deepEqual(core.rupLinks(p),['r1','r2']);checks++;
const rel=core.rupLinkStatus(p,bank);
check(rel.issues.length,0,'Valid bank links');check(rel.references.length,2,'Two references');
const snapshot=core.packageSnapshot(p,bank);
check(snapshot.hps,80000,'Package snapshot HPS');check(snapshot.offers[0].negosiasi,78977,'Snapshot offer');
check(eco.assess(p).total,80000,'PP workspace HPS');
const analysis=price.analyze(p,{suppliers:{supplier:'Example'}});
check(analysis.packet.hps,80000,'Price analysis HPS');
check(analysis.offers[0].listedTotal,undefined,'Contract output analyzed by price module');
const doc=core.documentHps(p,{mode:'excluded',rate:11});
check(doc.before,80000,'HPS document before');check(doc.tax,8800,'HPS tax per row');check(doc.total,88800,'HPS total document excluded');
const included=core.documentHps(p,{mode:'included',rate:11});
check(included.total,80000,'HPS document included base');
check(included.tax,7928,'HPS document included tax');
const mismatched=core.rupLinkStatus({...p,rupBankIds:['r1','missing','wrong']},bank);
assert.deepEqual(mismatched.missing,['missing']);assert.deepEqual(mismatched.outsideScope,['wrong']);checks+=2;
assert(core.rupLinkStatus({...p,rup:'OTHER'},bank).issues.some(s=>s.includes('Kode RUP')));checks++;
assert(core.rupLinkStatus({...p,rupBankId:'',rupBankIds:[]},bank).legacyMatch);checks++;
assert.deepEqual(core.rupLinks({rupBankId:0,rupBankIds:[0,'','','xyz','xyz']}),['0','xyz']);checks++;
check(JSON.stringify(p),initial,'No source mutation');
// Differential testing vs legacy arithmetic under different volume/price combinations.
for(let iteration=0;iteration<500;iteration++) {
  const items=Array.from({length:(iteration%6)+1},(_,index)=>({
    id:'i'+index,vol:(iteration*0.37+index*0.19)%17,hs:(iteration*1.013+index*2.29)%1000-100
  }));
  const data={items}, w={harga:{},nego:{},ongkir:iteration%19};
  for(const item of items){w.harga[item.id]=(iteration+item.vol)*1.113%1000; if(iteration%3!==1)w.nego[item.id]=(iteration+item.vol)*0.913%999;}
  const oldHps=items.reduce((s,i)=>s+Math.max(0,+i.vol||0)*Math.max(0,+i.hs||0),0);
  const oldTotal=(negotiated)=>Math.round(items.reduce((sum,item)=>sum+Math.max(0,+item.vol||0)*Math.max(0,+((negotiated&&w.nego&&w.nego[item.id]!=null)?w.nego[item.id]:(w.harga&&w.harga[item.id])||0)),0));
  check(core.hpsTotal(data),oldHps,'Differential HPS iteration '+iteration);
  check(core.offerGoodsTotal(data,w,false),oldTotal(false),'Differential price '+iteration);
  check(core.offerGoodsTotal(data,w,true),oldTotal(true),'Differential negotiated '+iteration);
}
check(core.hpsTotal({items:[{vol:-1,hs:100},{vol:NaN,hs:100}]}),0,'Invalid legacy HPS');
check(core.offerGoodsTotal({items:[{id:'a',vol:1,hs:1}]},{harga:{a:0.49}},false),0,'Rounding rupiah');
console.log('PASS Stage3: '+checks+' checks HPS, tax, offers, RUP references, module consistency, non-mutation, 500 differential iterations');
