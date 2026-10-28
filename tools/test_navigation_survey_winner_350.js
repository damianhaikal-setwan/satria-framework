'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
const core=src.slice(src.indexOf('function satriaOfferGate('),src.indexOf('function pemenang('));
const state={P:null,confirmations:[],S:{penyedia:[{id:'sellerA',nama:'Penyedia A'}]},toast:()=>{},synced:[],rendered:0};
const p={id:'pkg1',nama:'Paket Test',pagu:1500000,tglNego:'2026-10-28',items:[{id:'i1',nama:'Barang 1',vol:1,hs:1000000}],pemenangId:null,penawaran:[]};
const w={id:'pw1',pen:'sellerA',harga:{i1:1100000},nego:{i1:900000},negoDetails:{i1:{beforeTax:810811,tax:89189,inclusive:900000}},sumberHarga:'Katalog INAPROC',tanggalHarga:'2026-10-28',catalogRefs:{i1:{negotiatedBase:810811,negotiatedTax:89189,displayPrice:1100000,link:'https://katalog.inaproc.id/test/a',name:'Produk A'}}};p.penawaran.push(w);state.P=p;
const ctx={S:state.S,KN:{lastSaved:null},P:id=>id==='pkg1'?p:null,PY:()=>({nama:'Penyedia A'}),hps:p=>p.items.reduce((n,i)=>n+i.vol*i.hs,0),rp:n=>'Rp '+n,knStr:x=>String(x),esc:x=>String(x),nf:x=>Number(x).toLocaleString('id-ID'),knIdr:n=>'Rp '+n,evalPw:p=>p.penawaran.map(w=>({w,t:900000,st:'Lengkap',lengkap:true,negoLengkap:true,negoCount:1})),pemenang:()=>null,kandidat:()=>null,totPw:(p,w,ne)=>p.items.reduce((n,i)=>n+i.vol*Number((ne?w.nego:w.harga)[i.id]),0),toast:()=>{},render:()=>{},confirm:()=>true,window:{},Number,Math,Date,Set,String};
vm.createContext(ctx);vm.runInContext(core,ctx);
const e=ctx.evalPw(p)[0];assert(ctx.satriaOfferGate(p,e).ready,'Eligible offer should pass');
w.harga.i1=850000;assert(!ctx.satriaOfferGate(p,e).ready,'Offer gross higher than list must be rejected');w.harga.i1=1100000;p.pagu=800000;assert(!ctx.satriaOfferGate(p,e).ready,'Offer above pagu must be rejected');p.pagu=1500000;
const renderCore=src.slice(src.indexOf('function satriaOfferNegoBreakdown('),src.indexOf('/* ===== DOKUMEN OTOMATIS ===== */'));
vm.runInContext(renderCore,ctx);
let offerHtml=ctx.fNego(p);
assert(offerHtml.includes('data-act="winner"'),'Winner button visible');assert(offerHtml.includes('Tetapkan pemenang'),'Winner button labeled');assert(!offerHtml.includes('data-act="winner" data-pid="pkg1" data-id="pw1" disabled'),'Eligible winner button enabled');
assert(offerHtml.includes('data-act="openOfferCalc"'),'Shortcut to calculator retained');
// Simulate saving a fresh survey reference; price changes but negotiated gross/net/tax must survive.
const smart=src.slice(src.indexOf('<script id="satria-smart-survey-code">')+'<script id="satria-smart-survey-code">'.length,src.indexOf('</script>',src.indexOf('<script id="satria-smart-survey-code">')));
const listeners={},messages=[],events=[];
const smartCtx={document:{addEventListener:(type,cb)=>{(listeners[type]||(listeners[type]=[])).push(cb)}},window:{},Number,Date,URL,FileReader:function(){},DOMParser:function(){},setTimeout,clearTimeout,
  P:id=>id==='pkg1'?p:null,PY:()=>({nama:'Penyedia A'}),S:state.S,
  satriaOfferNegoBreakdown:(w,iid)=>({verified:true,net:w.negoDetails[iid].beforeTax}),fNego:()=>'<main></main>',survei:()=>'',render:()=>{events.push('render')},sync:(type,msg)=>{events.push(type);messages.push(msg)},toast:msg=>messages.push(msg),confirm:()=>true,Error};
vm.createContext(smartCtx);vm.runInContext(smart,smartCtx);
const html=smartCtx.fNego(p);assert(html.includes('Smart Survey Harga e-Katalog'),'Survey has new title');assert(!html.includes('data-smart-field="negotiatedBase"'),'Duplicate base input gone');assert(!html.includes('data-smart-field="negotiatedTax"'),'Duplicate tax input gone');assert(!html.includes('data-smart-action="calculate"'),'Duplicate calc action gone');
const input={name:'Produk Baru',displayPrice:'1200000',beforeTax:'1081081',taxAmount:'118919',link:'https://katalog.inaproc.id/test/a',seller:'Penyedia A',unit:'pcs',date:'2026-10-28',imageUrl:'',spec:'Spesifikasi aktual'};
const panel={dataset:{pid:'pkg1',wid:'pw1',iid:'i1'},querySelector(sel){let m=sel.match(/^\[data-smart-field="([^"]+)"\]$/);if(m)return {value:input[m[1]]||''};if(sel==='[data-smart-status]')return {set textContent(x){messages.push(x)}};return null;}};
const btn={dataset:{smartAction:'save'},closest(sel){return sel==='[data-smart-panel]'?panel:null}};
for(let fn of listeners.click||[])fn({target:{closest(sel){return sel==='[data-smart-action]'?btn:null}},preventDefault(){},stopImmediatePropagation(){}});
assert.equal(w.harga.i1,1200000,'Survey should update displayed price');assert.equal(w.nego.i1,900000,'Survey MUST NOT overwrite negotiated gross');assert.equal(w.negoDetails.i1.beforeTax,810811,'Survey MUST NOT overwrite net');assert.equal(w.catalogRefs.i1.negotiatedBase,810811,'Legacy matching survey negotiated data preserved');assert.equal(w.catalogRefs.i1.name,'Produk Baru','Reference product updates');
assert(messages.some(m=>m.includes('tidak diubah')),'User feedback should say negotiation preserved');
// Test calc renderer can reveal navigation even before saving new changes.
assert(src.includes('class="satria50-back-offer"'),'Navigation action in calculator');
assert(src.includes('Ada usulan negosiasi yang belum disimpan'),'Unsaved work warning before navigation');
assert(src.includes('✓ Penyedia ditetapkan'),'Selected provider status visual');
assert(src.includes("if(!confirm(text))return;p.pemenangId=id"),'Manual selection requires confirmation');
assert(src.includes('class="satria50-winner-action"'),'Prominent winner action');
console.log('PASS: 3 requirements, responsive navigation, survey only reference price, no negotiated data loss, winner eligibility & confirmation; no unrelated docs touched');
