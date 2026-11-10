'use strict';
/* Uji regresi: INAPROC 449 × 4.849, PPN efektif 11%, pembulatan total. */
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readIndex} = require('./legacy_index_source.cjs');
const src = readIndex();
const from = (begin, end) => {
 const a=src.indexOf(begin),b=src.indexOf(end,a);
 assert(a>=0 && b>a,`Bagian fungsi tidak ditemukan: ${begin}`);
 return src.slice(a,b);
};
const p={id:'paket',pagu:2424500,tglNego:'2026-11-08',items:[{id:'item',nama:'Barang INAPROC',vol:4849,hs:500}],penawaran:[]};
const w={id:'penawaran',pen:'penyedia',ongkir:0,harga:{item:500},nego:{},negoDetails:{},catalogRefs:{item:{beforeTax:450,taxAmount:50,displayPrice:500,taxMode:'effective11'}}};
const other={id:'penawaran-lain',pen:'penyedia-lain',harga:{item:500},nego:{item:500}};
p.penawaran=[w,other];
const ctx={S:{penyedia:[{id:'penyedia',nama:'Toko A',link:'https://katalog.inaproc.id/toko-a'},{id:'penyedia-lain',nama:'Toko B'}]},
 P:id=>id===p.id?p:undefined,PY:id=>({nama:id}),hps:pkg=>pkg.items.reduce((n,x)=>n+x.vol*x.hs,0),
 sum:(xs,fn)=>xs.reduce((t,x)=>t+fn(x),0),esc:x=>String(x),rp:n=>'Rp '+Math.round(n).toLocaleString('id-ID'),nf:n=>Math.round(n).toLocaleString('id-ID'),
 Math,Number,String,Set,Date,Intl};
vm.createContext(ctx);
vm.runInContext(from('const totPw=', 'const satriaHpsReviewDrafts=new Map();'),ctx);
vm.runInContext(from('function satriaOfferSupplierCatalogLink(', 'function satriaNegoReviewFingerprint('),ctx);
vm.runInContext(from('const KN_TAX=', '/* SATRIA 3.0.47'),ctx);
vm.runInContext(from('function satriaWriteNegotiatedItems(', 'function satriaNegotiationBridgeNotice('),ctx);
vm.runInContext(from('function satriaOfferNegoBreakdown(', 'function fNego('),ctx);
vm.runInContext(from('function satriaDocPricing(', 'function nodis('),ctx);
vm.runInContext('KN.pid="paket"; KN.wid="penawaran"; knSetup(); KN.rows.item.negoBase="449"; KN.rows.item.dirty=true;',ctx);
const row=ctx.knRowCalc(p.items[0]);
assert.equal(row.base,449);
assert.equal(row.tax,49.39);
assert.equal(row.unit,498.39);
assert.equal(row.total,2416693);
assert.equal(ctx.knSummary().total,2416693);
const html=ctx.knPreviewHtml(row);
assert.match(html,/Rp 49,39/);
assert.match(html,/Rp 498,39/);
assert.match(html,/Rp 2\.416\.693/);
const [saved]=ctx.satriaWriteNegotiatedItems(p,w,[row]);
assert.equal(saved.gross,498.39);
assert.equal(w.nego.item,498.39);
assert.equal(w.negoDetails.item.tax,49.39);
assert.equal(w.negoDetails.item.beforeTax,449);
assert.equal(vm.runInContext('totPw(P("paket"),P("paket").penawaran[0],true)',ctx),2416693);
assert.equal(other.nego.item,500,'Penyedia lain tidak berubah');
const breakdown=ctx.satriaOfferNegoBreakdown(w,'item');
assert.equal(breakdown.verified,true);
assert.equal(breakdown.tax,49.39);
assert.equal(breakdown.gross,498.39);
const cells=ctx.satriaOfferNegoCells(w,p.items[0]);
assert.match(cells,/49,39/,'PPN/unit tampil dengan pecahan');
assert.match(cells,/498,39/,'Harga bruto/unit tampil dengan pecahan');
vm.runInContext('KN.scope=""; knSetup();',ctx);
assert.equal(ctx.knRowCalc(p.items[0]).old,498.39,'Nilai bruto tidak hilang setelah dibuka kembali');
assert.equal(ctx.knSummary().total,2416693,'Total tersimpan tetap cocok setelah reload kalkulator');
const taxDoc=ctx.satriaDocPricing(p,w);
assert.equal(taxDoc.verified,true);
assert.equal(taxDoc.net,2177201);
assert.equal(taxDoc.tax,239492);
assert.equal(taxDoc.gross,2416693);
assert.equal(taxDoc.total,2416693);
// Data lama harus tetap utuh bila harganya integer.
const legacy={nego:{item:1000000},negoDetails:{item:{beforeTax:900901,tax:99099,inclusive:1000000}}};
assert.equal(ctx.satriaOfferNegoBreakdown(legacy,'item').verified,true);
// Tarif lain dan custom tetap bekerja.
assert.equal(vm.runInContext('knGross(449,"rate12",0)',ctx),502.88);
assert.equal(vm.runInContext('knGross(449,"zero",0)',ctx),449);
assert.equal(vm.runInContext('knGross(449,"custom",50)',ctx),499);
// Review angka yang tampil untuk saran masih menggunakan pecahan per unit.
const suggested=ctx.knSuggestionPlan([row],p,w);
assert.equal(suggested.items.item.base,450);
assert.equal(suggested.items.item.tax,49.5);
assert.equal(suggested.items.item.gross,499.5);
assert.equal(suggested.total,2422076);
console.log('PASS INAPROC: 449 × 4849 + PPN 11% = 2.416.693; per-unit 498,39; dokumen & penawaran cocok; penyedia lain dan data lama aman');
