'use strict';
// Regression: sources belong to the supplier store, never to the first product.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'frontend/refactor/js/01-app-core.js'),'utf8');
const smart=fs.readFileSync(path.join(root,'frontend/refactor/js/17-satria-smart-survey-code.js'),'utf8');
const supplierA='https://katalog.inaproc.id/toko-penyedia-a';
const supplierB='https://katalog.inaproc.id/toko-penyedia-b';
const productA='https://katalog.inaproc.id/penyedia-a/produk-pertama';
const productB='https://katalog.inaproc.id/penyedia-b/produk-pertama';
const state={penyedia:[{id:'a',nama:'Penyedia A',link:supplierA},{id:'b',nama:'Penyedia B',link:supplierB},{id:'c',nama:'Penyedia C',link:''}]};
const items=[{id:'i1',nama:'Produk 1',satuan:'Unit',vol:1,hs:1000000},{id:'i2',nama:'Produk 2',satuan:'Unit',vol:1,hs:1000000}];
const offers=[
 {id:'w1',pen:'a',sumberHarga:productA,tanggalHarga:'2026-11-01',harga:{},nego:{},catalogRefs:{i1:{link:productA,name:'Produk 1'}}},
 {id:'w2',pen:'b',sumberHarga:productB,tanggalHarga:'2026-11-01',harga:{},nego:{},catalogRefs:{i1:{link:productB,name:'Produk 1'}}},
 {id:'w3',pen:'c',sumberHarga:productA,tanggalHarga:'2026-11-01',harga:{},nego:{},catalogRefs:{i1:{link:productA,name:'Produk 1'}}}
];
const p={id:'p1',rup:'RUP1',nama:'Paket',penawaran:offers,items};
const helper=core.slice(core.indexOf('function satriaOfferSupplierCatalogLink('),core.indexOf('function satriaNegoReviewFingerprint('));
assert(helper.includes('function satriaOfferPriceSource('),'helper sumber ditemukan');
const ctx={S:state};vm.createContext(ctx);vm.runInContext(helper,ctx);
const priceSource=ctx.satriaOfferPriceSource;
assert.equal(priceSource(offers[0]),supplierA,'penawaran lama: link master mengalahkan produk pertama');
assert.equal(priceSource(offers[1]),supplierB,'sumber tiap penyedia independen');
assert.equal(priceSource(offers[2]),'','produk lama tidak dianggap sumber toko bila master kosong');
state.penyedia[0].link='https://katalog.inaproc.id/toko-penyedia-a-baru';
assert.equal(priceSource(offers[0]),state.penyedia[0].link,'perubahan link Data Master terbaca tanpa migrasi destruktif');
state.penyedia[0].link=supplierA;
offers[2].sumberHarga='Referensi dokumen 456';
assert.equal(priceSource(offers[2]),'Referensi dokumen 456','referensi manual nonproduk tidak dihapus');

const listeners={};const events=[];const inputs={};
const surveyCtx={S:state,P:id=>id===p.id?p:null,PY:id=>state.penyedia.find(x=>x.id===id)||{nama:'-'},
 document:{addEventListener:(event,callback)=>{(listeners[event]||(listeners[event]=[])).push(callback)},dispatchEvent:()=>{}},
 CustomEvent:function(event,opts){return {event,detail:opts?.detail}},
 window:{},URL,Date,Number,Math,Set,FileReader:function(){},setTimeout,clearTimeout,
 sync:(kind,msg)=>events.push(msg),render:()=>{},toast:()=>{},confirm:()=>true,
 survei:()=>'',fNego:()=>'',satriaOfferNegoBreakdown:()=>({verified:false})};
vm.createContext(surveyCtx);vm.runInContext(smart,surveyCtx);
function save(wid,iid,productUrl,amount){
 const supplier=state.penyedia.find(x=>x.id===offers.find(w=>w.id===wid).pen);
 const fields={name:'Produk '+iid,seller:supplier.nama,link:productUrl,beforeTax:String(amount),taxAmount:'0',date:'2026-11-08',unit:'Unit',spec:'',imageUrl:''};
 const panel={dataset:{pid:'p1',wid,iid},querySelector(sel){const match=sel.match(/^\[data-smart-field="([^"]+)"\]$/);
  if(match){const key=match[1];return {get value(){return key==='displayPrice'?String(amount):fields[key]||''},set value(value){fields[key]=String(value)}}}
  if(sel==='[data-smart-equation]')return {innerHTML:''};
  if(sel==='[data-smart-status]')return {textContent:''};
  return null;
 }};
 const btn={dataset:{smartAction:'save'},closest:s=>s==='[data-smart-panel]'?panel:null};
 for(const fn of listeners.click||[])fn({target:{closest:s=>s==='[data-smart-action]'?btn:null},preventDefault(){},stopImmediatePropagation(){}});
}
save('w1','i1',productA,5000);
assert.equal(offers[0].sumberHarga,supplierA,'simpan produk pertama mengisi link toko penyedia');
assert.equal(offers[0].catalogRefs.i1.link,productA,'URL produk pertama tetap disimpan per item');
save('w1','i2','https://katalog.inaproc.id/penyedia-a/produk-kedua',6000);
assert.equal(offers[0].sumberHarga,supplierA,'simpan produk kedua tidak mengganti sumber');
assert.equal(offers[0].catalogRefs.i2.link,'https://katalog.inaproc.id/penyedia-a/produk-kedua');
save('w2','i1',productB,7000);
assert.equal(offers[1].sumberHarga,supplierB,'penyedia kedua memakai link toko sendiri');
assert.equal(offers[0].sumberHarga,supplierA,'penyedia pertama tidak terubah');
offers[2].sumberHarga='';
save('w3','i1','https://katalog.inaproc.id/penyedia-c/produk',8000);
assert.equal(offers[2].sumberHarga,'','jika link master kosong jangan buat bukti palsu dari URL produk');
assert.equal(offers[2].catalogRefs.i1.link,'https://katalog.inaproc.id/penyedia-c/produk');
assert(events.filter(x=>x.includes('Smart Survey')).length===4,'semua penyimpanan diproses');
assert(core.includes('value="${esc(satriaOfferPriceSource(w))}"'),'UI penawaran membaca sumber yang tepat');
assert(core.includes("const source=String(pen.link||'').trim();"),'Dokumen memakai link toko penyedia');
assert(!smart.includes("w.sumberHarga=link||"),'URL produk tak boleh menimpa sumber penawaran');
console.log('PASS: link toko per penyedia, data lama, 4 simpan Smart Survey, sumber kosong, sumber dokumen, isolasi URL per produk');
