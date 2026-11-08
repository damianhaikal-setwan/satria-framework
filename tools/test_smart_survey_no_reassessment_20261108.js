'use strict';
// Regression: Smart Survey captures catalog evidence without re-grading technical suitability.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const pro=fs.readFileSync(path.join(root,'frontend/refactor/js/19-satria-359-smart-survey-pro.js'),'utf8');
const css=fs.readFileSync(path.join(root,'frontend/refactor/css/10-survey-one-door.css'),'utf8');
const analysis=require('../frontend/satria-price-analysis.js');
const link='https://katalog.inaproc.id/penyedia/produk-satu';
const x={id:'p1',nama:'ATK',items:[{id:'i1',nama:'Pulpen Faster',spesifikasi:'Pulpen Faster',vol:2,hs:20000}],penawaran:[]};
const w={id:'w1',pen:'a',catalogRefs:{i1:{link,name:'Pulpen Faster',date:'2026-11-08',beforeTax:10000,taxAmount:0,displayPrice:10000,spec:'Pulpen Faster',surveyMeta:{suitability:'tidak-sesuai',suitabilityNote:'Catatan lama'}}}};
x.penawaran.push(w);
const context={
 S:{paket:[x],penyedia:[{id:'a',nama:'Penyedia'}]},
 window:{SATRIA_SMART_SURVEY:{parseCopiedText:()=>({})},addEventListener(){}},
 document:{readyState:'loading',documentElement:{},addEventListener(){}},
 MutationObserver:class{observe(){}},
 setTimeout(){},clearTimeout(){},console
};
vm.createContext(context);vm.runInContext(pro,context);
const api=context.window.SATRIA_SURVEY_PRO;
const html=api.panel(x,w,x.items[0],w.catalogRefs.i1);
assert(!html.includes('data-s59-field="suitability"'),'manual pass/fail selector removed');
assert(!html.includes('Evaluasi spesifikasi'),'repeated technical evaluation removed');
assert(!html.includes('data-s59-field="suitabilityNote"'),'repeated suitability notes removed');
assert(html.includes('Informasi pendukung produk'),'other catalog metadata remains available');
assert(html.includes('data-s59-field="pdn"'),'PDN remains available');
assert(html.includes('Catatan lama: tidak sesuai'),'legacy caution remains visible');
assert(html.includes('Bukti digital &amp; riwayat')||html.includes('Bukti digital & riwayat'),'evidence history still present');
assert(!css.includes('data-satria-evaluation'),'simple-mode stale selectors removed');
assert.equal(api.score({link,name:'Pulpen Faster',beforeTax:10000,taxAmount:0,displayPrice:10000,date:'2026-11-08',spec:'Pulpen Faster',imageUrl:'pic',evidenceRefs:['photo']},x.items[0]).total,7,'no suitability scoring');
const fieldValues={link,name:'Pulpen Faster',pdn:'pdn',umkk:'ya',shipping:'0',surveyNote:'informasi saja'};
const panel={dataset:{pid:'p1',wid:'w1',iid:'i1'},querySelector(sel){const m=sel.match(/^\[data-(?:smart|s59)-field="([^"]+)"\]$/);return m?{value:fieldValues[m[1]]||''}:null}};
const ref={...w.catalogRefs.i1};
api.afterMainSave({p:x,w,iid:'i1',previous:w.catalogRefs.i1,ref,panel});
assert.equal(ref.surveyMeta.suitability,'tidak-sesuai','old caution remains attached to the same listing');
assert.equal(ref.surveyMeta.suitabilityNote,'Catatan lama');
assert.equal(ref.surveyMeta.pdn,'pdn','other fields still saved');
const alternative={...w.catalogRefs.i1,link:'https://katalog.inaproc.id/penyedia/produk-dua',name:'Produk Dua',surveyMeta:{suitability:'tidak-sesuai'}};
fieldValues.link=alternative.link;fieldValues.name=alternative.name;
const newRef={...w.catalogRefs.i1,link:alternative.link,name:alternative.name};
api.afterMainSave({p:x,w,iid:'i1',previous:w.catalogRefs.i1,ref:newRef,panel});
assert.equal(newRef.surveyMeta.suitability,undefined,'old status not silently copied to another product');
assert.equal(newRef.suitability,undefined);
assert.equal(w.surveyHistory.i1.at(-1).previousAssessment,'tidak-sesuai','legacy status audited in history');
const a=analysis.analyze({id:'p1',items:x.items,pagu:100000,penawaran:[{
 id:'w2',pen:'a',ongkir:0,harga:{i1:10000},nego:{i1:9000},tanggalHarga:'2026-11-08',sumberHarga:'https://katalog.inaproc.id/penyedia',catalogRefs:{i1:{link,name:'Pulpen Faster',seller:'Penyedia',unit:'',displayPrice:10000,date:'2026-11-08'}}
}]},{suppliers:{a:'Penyedia'}});
assert.equal(a.offers[0].detail[0].specWarnings.length,0,'new references do not need a suitability checkbox');
assert.equal(a.offers[0].detail[0].comparisonEligible,true,'price evidence can be evaluated independently');
const bad=analysis.analyze({id:'p1',items:x.items,pagu:100000,penawaran:[{
 id:'w2',pen:'a',ongkir:0,harga:{i1:10000},nego:{i1:9000},tanggalHarga:'2026-11-08',sumberHarga:'https://katalog.inaproc.id/penyedia',catalogRefs:{i1:{link,name:'Pulpen Pilot',seller:'Penyedia',unit:'',displayPrice:10000,date:'2026-11-08'}}
}]},{suppliers:{a:'Penyedia'}});
assert(bad.offers[0].detail[0].specWarnings.length>0,'obvious catalog mismatch is still flagged');
assert.equal(bad.offers[0].detail[0].comparisonEligible,false,'obvious mismatch excluded from price comparisons');
const source=fs.readFileSync(path.join(root,'frontend/satria-price-analysis.js'),'utf8');
assert(!source.includes("toLowerCase()==='sesuai'"),'document conclusion no longer depends on removed checkbox');
assert(source.includes('Kesesuaian dengan kebutuhan/KAK tetap harus dipastikan PPK'),'document makes no automatic technical approval');
console.log('PASS Smart Survey no re-assessment: UI, scoring, old notes, new items, price core, doc warnings');
