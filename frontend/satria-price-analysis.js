/* SATRIA NEXT 3.0.59.37 — Smart Analisis Kewajaran Harga & Audit Evidence.
 * Read-only calculation. No edits to packet, offer, catalog references or winner data.
 * Historical evidence is never created or assigned an earlier date by this module.
 */
(function(root){
'use strict';
const no=(v)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null};
const positive=v=>{const n=no(v);return n!==null&&n>0?n:null};
const clean=v=>String(v===null||v===undefined?'':v).trim();
const normalize=v=>clean(v).toLowerCase().replace(/^\s*(pt\.?|cv\.?|ud\.?|toko)\s+/i,'').replace(/[^\p{L}\p{N}]/gu,'');
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(clean(v))&&(()=>{const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v})();
const safeURL=v=>{try{const u=new URL(clean(v));return ['https:','http:'].includes(u.protocol)?u.href:''}catch(_){return ''}};
// Conservative pre-screen: flags *obvious* catalog-name/model contradictions, not a legal/specification decision.
// Missing hints are never treated as confirmation of equivalence.
function specConflict(item,ref){
 const need=clean([item?.nama,item?.spesifikasi].join(' ')).toLowerCase();
 const shown=clean([ref?.name,ref?.spec].join(' ')).toLowerCase();
 if(!need||!shown)return [];
 const alerts=[];
 const model=s=>{const m=s.match(/\b(?:no\.?|nomor|ukuran)\s*([0-9]+)(?:\s*[\/-]\s*([0-9]+))?/i);return m?m[1]+(m[2]?'/'+m[2]:''):''};
 const expected=model(need),actual=model(shown);
 if(expected&&actual&&expected!==actual)alerts.push('indikasi ukuran/nomor produk berbeda ('+expected+' vs '+actual+')');
 const conflicts=[['faster','pilot'],['snelhecter','biola']];
 for(const [required,alternative] of conflicts){
  if(need.includes(required)&&shown.includes(alternative)&&!shown.includes(required))alerts.push('indikasi model/merek berbeda ('+required+' vs '+alternative+')');
 }
 return alerts;
}
const money=n=>Math.round((Number(n)||0)*100)/100;
const sum=a=>a.reduce((total,v)=>total+(Number(v)||0),0);
const median=values=>{const a=values.slice().sort((x,y)=>x-y);if(!a.length)return null;const middle=Math.floor(a.length/2);return a.length%2?a[middle]:(a[middle-1]+a[middle])/2};
function analyze(p,options={}){
 const items=Array.isArray(p?.items)?p.items:[];
 const offers=Array.isArray(p?.penawaran)?p.penawaran:[];
 const suppliers=options.suppliers||{};
 const nameFor=id=>clean(suppliers[String(id)])||'(penyedia tidak dikenal)';
 const H=sum(items.map(i=>(positive(i.vol)||0)*(positive(i.hs)||0)));
 const pagu=positive(p?.pagu)||0;
 const issues=[];
 const add=(level,code,text)=>{if(!issues.some(x=>x.code===code&&x.text===text))issues.push({level,code,text})};
 if(!items.length)add('Tinggi','NO_ITEMS','Rincian barang/HPS belum tersedia');
 if(!offers.length)add('Tinggi','NO_OFFERS','Belum ada penyedia dalam Penawaran & Negosiasi');
 if(items.some(i=>!positive(i.vol)||!positive(i.hs)))add('Tinggi','BAD_HPS','Volume atau HPS satuan belum valid');
 if(pagu>0&&H>pagu)add('Tinggi','HPS_OVER_PAGU','Total HPS melebihi pagu paket');
 const offersOut=offers.map(w=>{
  const name=nameFor(w.pen),source=clean(w.sumberHarga),sourceDate=clean(w.tanggalHarga);
  const shipping=no(w.ongkir),shippingValid=shipping!==null;
  const fullTayang=items.length>0&&items.every(i=>!!positive(w.harga?.[i.id]));
  const fullNego=items.length>0&&items.every(i=>!!positive(w.nego?.[i.id]));
  const detail=items.map(i=>{
   const ref=w.catalogRefs?.[i.id]||{};
   const list=positive(w.harga?.[i.id]),neg=positive(w.nego?.[i.id]);
   const refPrice=positive(ref.displayPrice),link=safeURL(ref.link),img=safeURL(ref.imageUrl),date=clean(ref.date);
   const priceMatches=!!list&&!!refPrice&&Math.abs(list-refPrice)<=1;
   const unitOK=!clean(ref.unit)||normalize(ref.unit)===normalize(i.satuan);
   const sellerOK=!clean(ref.seller)||normalize(ref.seller)===normalize(name);
   const sellerNote=!sellerOK?'Nama penjual pada bukti berbeda dari penyedia penawaran':'';
   const specWarnings=specConflict(i,ref);
   // Respect the officer's recorded product-assessment result; never treat an
   // explicitly unsuitable or unresolved product as a suitable price comparison.
   const suitability=clean(ref.surveyMeta?.suitability||ref.suitability).toLowerCase();
   if(suitability==='tidak-sesuai')specWarnings.push('produk dinyatakan tidak sesuai dalam catatan pemeriksaan barang');
   if(suitability==='klarifikasi')specWarnings.push('kesesuaian produk masih perlu diklarifikasi');
   const evidenceOK=!!list&&!!link&&validDate(date)&&priceMatches&&unitOK&&sellerOK&&!!source&&validDate(sourceDate);
   const gaps=[];
   if(!list)gaps.push('harga tayang kosong');
   if(!link)gaps.push('URL katalog/referensi tidak tersedia');
   if(!validDate(date))gaps.push('tanggal referensi item belum valid');
   if(!refPrice)gaps.push('harga pada bukti Smart Survey belum tercatat');
   if(refPrice&&list&&!priceMatches)gaps.push('harga Smart Survey tidak cocok dengan harga tayang');
   if(!unitOK)gaps.push('satuan pada bukti dan barang berbeda');
   if(!sellerOK)gaps.push(sellerNote);
   if(!source)gaps.push('sumber penawaran belum diisi');
   if(!validDate(sourceDate))gaps.push('tanggal sumber penawaran belum valid');
   // Even with complete metadata, similarity/equivalence of specifications cannot be certified automatically.
   return {id:String(i.id),specWarnings,comparisonEligible:evidenceOK&&!specWarnings.length,item:clean(i.nama),spec:clean(i.spesifikasi)||'Spesifikasi belum dirinci',qty:positive(i.vol)||0,unit:clean(i.satuan),hpsUnit:positive(i.hs)||0,listedUnit:list,negUnit:neg,refPrice,link,img,date,refName:clean(ref.name),refSpec:clean(ref.spec),refSeller:clean(ref.seller),source,sourceDate,evidenceOK,gaps};
  });
  const tayangTotal=fullTayang&&shippingValid?money(sum(detail.map(x=>x.listedUnit*x.qty))+shipping):null;
  const negoTotal=fullNego&&shippingValid?money(sum(detail.map(x=>x.negUnit*x.qty))+shipping):null;
  const completeEvidence=detail.length>0&&detail.every(x=>x.evidenceOK);
  const existsNego=detail.some(x=>x.negUnit!==null);
  if(!fullTayang)add('Sedang','OFFER_INCOMPLETE_'+w.id,`Harga tayang ${name} belum lengkap untuk seluruh barang`);
  if(existsNego&&!fullNego)add('Sedang','NEGO_PARTIAL_'+w.id,`Negosiasi ${name} belum lengkap; totalnya tidak diperlakukan sebagai total akhir`);
  if(!shippingValid)add('Sedang','SHIP_'+w.id,`Ongkir ${name} belum valid`);
  if(!completeEvidence)add('Sedang','EVIDENCE_'+w.id,`Bukti referensi ${name} masih perlu dilengkapi/diverifikasi`);
  const suspect=detail.filter(d=>d.specWarnings.length);
  if(suspect.length)add('Sedang','SPEC_HINT_'+w.id,`${suspect.length} referensi ${name} berindikasi model/ukuran berbeda dari kebutuhan; periksa bukti dan jangan anggap otomatis setara`);
  if(negoTotal!==null&&H>0&&negoTotal>H)add('Tinggi','NEGO_HPS_'+w.id,`Total negosiasi ${name} melebihi total HPS`);
  if(negoTotal!==null&&pagu>0&&negoTotal>pagu)add('Tinggi','NEGO_PAGU_'+w.id,`Total negosiasi ${name} melebihi pagu`);
  if(detail.some(x=>x.negUnit!==null&&x.listedUnit!==null&&x.negUnit>x.listedUnit))add('Tinggi','NEGO_LIST_'+w.id,`Ada harga negosiasi ${name} melebihi harga tayang item`);
  return {id:String(w.id),supplierId:String(w.pen),name,source,sourceDate,shipping:shippingValid?shipping:null,detail,fullTayang,fullNego,tayangTotal,negoTotal,completeEvidence};
 });
 const itemStats=items.map(i=>{
  const refs=offersOut.map(o=>({offer:o,...o.detail.find(d=>d.id===String(i.id))}));
  const documented=refs.filter(x=>x.comparisonEligible&&x.listedUnit!==null);
  const prices=documented.map(x=>x.listedUnit);
  return {id:String(i.id),name:clean(i.nama),spec:clean(i.spesifikasi)||'Spesifikasi belum dirinci',qty:positive(i.vol)||0,unit:clean(i.satuan),hpsUnit:positive(i.hs)||0,documented:documented.length,recorded:refs.filter(x=>x.listedUnit!==null).length,min:prices.length?Math.min(...prices):null,max:prices.length?Math.max(...prices):null,average:prices.length>=2?sum(prices)/prices.length:null,median:prices.length>=2?median(prices):null,refs};
 });
 const validWinnerId=clean(options.validWinnerId);
 const winner=validWinnerId?offersOut.find(o=>o.id===validWinnerId&&o.negoTotal!==null)||null:null;
 if(p?.pemenangId&&!winner)add('Tinggi','WINNER_NOT_VALID','Penetapan tercatat, tetapi penyedia pemenang belum lolos validasi aplikasi saat ini');
 if(!winner)add('Sedang','NO_VALID_WINNER','Belum ada penetapan yang tercatat lengkap yang dapat dijadikan nilai akhir analisis');
 const documentedCount=offersOut.reduce((n,o)=>n+o.detail.filter(d=>d.evidenceOK).length,0);
 const evidenceTotal=items.length*offersOut.length;
 const comparativeItems=itemStats.filter(i=>i.documented>=2).length;
 if(itemStats.some(x=>x.documented<2))add('Sedang','REFERENCE_INSUFFICIENT','Pada beberapa barang, harga pembanding perlu dicocokkan lagi dengan ukuran, spesifikasi, dan bukti sumbernya. Jumlah pembanding bukan satu-satunya penentu kewajaran.');
 const assessment= !items.length||!offers.length?'Data belum cukup untuk analisis':
   documentedCount===0?'Catatan sumber harga belum cukup untuk menilai kewajaran':'Perbandingan harga tersedia; periksa kesesuaian produk dan bukti sumber';
 const delta=winner&&H>0?money(H-winner.negoTotal):null;
 // Material price comparisons: one product at a time. Proof equivalence is NEVER assumed.
 // Peer prices are only tentative comparators after metadata and obvious model conflicts are screened.
 const productFindings=itemStats.map(item=>{
  const refs=item.refs;
  const chosen=winner?refs.find(x=>x.offer.id===winner.id):
    refs.filter(x=>x.listedUnit!==null).sort((a,b)=>a.listedUnit-b.listedUnit)[0];
  const chosenValue=winner?(chosen?.negUnit??null):(chosen?.listedUnit??null);
  const chosenBasis=winner?'negosiasi penyedia ditetapkan':'harga tayang terendah tercatat (belum ada penetapan)';
  const chosenName=chosen?.offer?.name||'';
  const selfTayang=chosen?.listedUnit??null;
  const negoSaving=chosenValue!==null&&selfTayang!==null?money(selfTayang-chosenValue):null;
  const negoSavingPct=negoSaving!==null&&selfTayang>0?negoSaving/selfTayang*100:null;
  const hpsDelta=chosenValue!==null&&item.hpsUnit>0?money(item.hpsUnit-chosenValue):null;
  const hpsDeltaPct=hpsDelta!==null&&item.hpsUnit>0?hpsDelta/item.hpsUnit*100:null;
  const peers=refs.filter(x=>x.offer.id!==chosen?.offer?.id&&x.comparisonEligible&&x.listedUnit!==null);
  const bestPeer=peers.slice().sort((a,b)=>a.listedUnit-b.listedUnit)[0]||null;
  const peerDifference=bestPeer&&chosenValue!==null?money(bestPeer.listedUnit-chosenValue):null;
  const peerDifferencePct=peerDifference!==null&&bestPeer.listedUnit>0?peerDifference/bestPeer.listedUnit*100:null;
  const peerWarnings=refs.filter(x=>x.offer.id!==chosen?.offer?.id&&!x.comparisonEligible).map(x=>({name:x.offer.name,product:x.refName,reason:x.specWarnings.length?x.specWarnings.join('; '):(x.gaps.length?x.gaps.join('; '):'kesetaraan belum dikonfirmasi')}));
  const pricePerPackage=hpsDelta!==null?money(hpsDelta*item.qty):null; // excludes shipping, never sum as full package delta
  const provisionalIndicator=chosenValue===null?'Harga belum lengkap':hpsDelta<0?'Harga di atas HPS satuan — butuh alasan':bestPeer?'Indikasi harga kompetitif — verifikasi produk':'Di bawah/selaras HPS — referensi belum memadai';
  return {id:item.id,name:item.name,spec:item.spec,qty:item.qty,unit:item.unit,hpsUnit:item.hpsUnit,provisionalIndicator,chosenName,chosenBasis,chosenValue,selfTayang,negoSaving,negoSavingPct,hpsDelta,hpsDeltaPct,pricePerPackage,bestPeer:bestPeer?{supplier:bestPeer.offer.name,unitPrice:bestPeer.listedUnit,refName:bestPeer.refName,link:bestPeer.link}:null,peerDifference,peerDifferencePct,peerCount:peers.length,peerWarnings,chosenHasMetadata:!!chosen?.evidenceOK,chosenSpecWarnings:chosen?.specWarnings||[],offers:refs.map(x=>({supplier:x.offer.name,listed:x.listedUnit,nego:x.negUnit,canCompare:x.comparisonEligible,refName:x.refName,specWarnings:x.specWarnings,gaps:x.gaps}))};
 });
 const comparisonSummary={belowHps:productFindings.filter(x=>x.hpsDelta>0).length,aboveHps:productFindings.filter(x=>x.hpsDelta<0).length,equalHps:productFindings.filter(x=>x.hpsDelta===0).length,hasPeer:productFindings.filter(x=>x.peerCount>0).length,needsPeer:productFindings.filter(x=>x.peerCount===0).length};
 return {packet:{id:String(p?.id||''),rup:clean(p?.rup),name:clean(p?.nama),tahun:p?.tahun,opd:p?.opd,pagu,hps:H,tglSurvei:clean(p?.tglSurvei),tglNego:clean(p?.tglNego),tglPenetapan:clean(p?.tglPenetapan)},offers:offersOut,items:itemStats,issues,winner,delta,referenceCount:documentedCount,evidenceTotal,comparativeItems,assessment,productFindings,comparisonSummary};
}
const api={analyze,safeURL,validDate,median,specConflict};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root)return;
root.SATRIA_PRICE_CORE=Object.freeze(api);
function escLocal(v){return typeof esc==='function'?esc(v):String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
function rpLocal(v){return v===null||v===undefined?'—':rp(v);}
function fmtPercent(v){return Number.isFinite(v)?v.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':'—';}
function safeLink(url){const s=safeURL(url);return s?`<a class="spha-link-open" target="_blank" rel="noopener noreferrer" href="${escLocal(s)}">Buka referensi ↗</a><small class="spha-url-full">${escLocal(s)}</small>`:'Belum ada URL';}
function getAnalysis(p){const names={};for(const y of S.penyedia||[])names[String(y.id)]=y.nama;const valid=pemenang(p);return analyze(p,{suppliers:names,validWinnerId:valid?.w?.id||''});}
function priceGapText(value,percent){if(value===null)return 'belum dapat dihitung';if(value===0)return 'sama dengan acuan';return `${rpLocal(Math.abs(value))} (${fmtPercent(Math.abs(percent))}) ${value>0?'lebih rendah':'lebih tinggi'}`;}
function productNarrative(f){
 const unit=f.unit||'satuan';
 if(f.chosenValue===null)return `Untuk ${f.name}, harga belum cukup lengkap untuk membuat perbandingan. Periksa kembali penawaran harga dan rincian barang.`;
 const isSelected=f.chosenBasis==='negosiasi penyedia ditetapkan';
 let sentence=isSelected?
  `Untuk kebutuhan ${f.name} sebanyak ${f.qty} ${unit}, ${f.chosenName} menawarkan harga awal ${rpLocal(f.selfTayang)} per ${unit} dan hasil negosiasinya sebesar ${rpLocal(f.chosenValue)} per ${unit}.`:
  `Untuk kebutuhan ${f.name} sebanyak ${f.qty} ${unit}, harga tayang ${f.chosenName} tercatat ${rpLocal(f.chosenValue)} per ${unit}. Penyedia akhir belum ditetapkan, sehingga harga ini dipakai hanya untuk melihat posisi penawaran.`;
 if(isSelected&&f.negoSaving!==null){
  sentence+=f.negoSaving>0?` Melalui negosiasi, harga berkurang ${rpLocal(f.negoSaving)} (${fmtPercent(f.negoSavingPct)}) per ${unit}.`:
   f.negoSaving===0?' Harga sesudah negosiasi sama dengan harga tayang.':` Harga hasil negosiasi justru lebih tinggi ${rpLocal(Math.abs(f.negoSaving))} daripada harga tayang; keadaan ini perlu dijelaskan.`;
 }
 if(f.hpsDelta!==null)sentence+=` HPS satuan barang ini adalah ${rpLocal(f.hpsUnit)}, sehingga ${isSelected?'harga hasil negosiasi':'harga tayang yang dibandingkan'} ${priceGapText(f.hpsDelta,f.hpsDeltaPct)} daripada HPS.`;
 const others=(f.offers||[]).filter(o=>o.supplier!==f.chosenName&&o.listed!==null);
 if(!others.length)sentence+=' Belum terdapat harga produk dari penyedia lain dalam catatan penawaran paket ini.';
 for(const o of others){
  sentence+=` Sebagai bahan perbandingan, ${o.supplier} mencantumkan harga tayang ${rpLocal(o.listed)} per ${unit}`;
  if(o.refName)sentence+=` untuk produk ${o.refName}`;
  sentence+='.';
  if(o.specWarnings?.length)sentence+=` Produk tersebut belum dapat langsung disamakan karena ${o.specWarnings.join('; ')}.`;
  else if(!o.canCompare)sentence+=' Sebelum digunakan sebagai dasar kewajaran, keterangan satuan, spesifikasi, sumber harga, atau tanggal pencatatannya masih perlu dicocokkan.';
  else sentence+=' Secara angka, harga ini dapat dijadikan bahan perbandingan, dengan tetap memeriksa kesamaan produk dan komponen biaya.';
 }
 if(f.hpsDelta!==null&&f.hpsDelta<0)sentence+=' Walaupun harga satuan ini di atas HPS satuan, penilaian akhirnya perlu melihat dasar perhitungan HPS, volume, dan hasil keseluruhan paket.';
 sentence+=' Berdasarkan perbandingan tersebut, penilaian kewajaran akhir memerlukan kecocokan spesifikasi barang, kondisi pembelian, dan bukti harga pada waktu pengadaan.';
 return sentence;
}
function productPriceTable(a){return `<div class="spha-scroll"><table class="spha-table spha-price-detail"><colgroup><col style="width:23%"><col style="width:15%"><col style="width:17%"><col style="width:19%"><col style="width:26%"></colgroup><thead><tr><th>Barang / volume</th><th>HPS satuan</th><th>Harga dasar analisis</th><th>Selisih vs HPS</th><th>Harga penyedia lain</th></tr></thead><tbody>${a.productFindings.map(f=>`<tr><td><b>${escLocal(f.name)}</b><small>${escLocal(f.qty)} ${escLocal(f.unit)}</small></td><td class="n">${rpLocal(f.hpsUnit)}</td><td class="n"><b>${rpLocal(f.chosenValue)}</b><small>${escLocal(f.chosenName)}</small><small>${a.winner?'Hasil nego':'Harga tayang indikatif'}</small></td><td class="n"><b>${escLocal(priceGapText(f.hpsDelta,f.hpsDeltaPct))}</b><small>${f.hpsDelta===null?'Belum dapat dinilai':f.hpsDelta<0?'Jelaskan harga satuan di atas HPS':'Pertimbangkan bersama spesifikasi dan bukti harga'}</small></td><td>${f.bestPeer?`<b>${escLocal(f.bestPeer.supplier)}</b> · ${rpLocal(f.bestPeer.unitPrice)}<small>Produk: ${escLocal(f.bestPeer.refName||'Nama belum tersedia')}</small><small>Selisih: ${escLocal(priceGapText(f.peerDifference,f.peerDifferencePct))}</small><small>Bandingkan hanya jika barang dan biayanya setara</small>`:`<b>Belum ada harga penyedia lain yang sesuai untuk perbandingan</b><small>${f.peerWarnings.length} harga lainnya perlu diperiksa kecocokannya</small>`}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada rincian barang.</td></tr>'}</tbody></table></div>`;}
function productAnalysis(a){return `<div class="spha-product-narratives">${a.productFindings.map((f,i)=>`<article class="spha-product-story"><h4>${i+1}. ${escLocal(f.name)} — ${escLocal(f.qty)} ${escLocal(f.unit)}</h4><p>${escLocal(productNarrative(f))}</p></article>`).join('')}</div>`;}
function rulesAtTransaction(p){
 // Date is a recorded phase date, NOT proof of the true transaction/contract date.
 const phase=validDate(p?.tglPenetapan)?p.tglPenetapan:validDate(p?.tglNego)?p.tglNego:validDate(p?.tglSurvei)?p.tglSurvei:'';
 const catalogRule=!phase?'Periksa tanggal pelaksanaan untuk menentukan peraturan katalog yang relevan.':phase<'2026-09-01'?'Tanggal fase yang tercatat mendahului 1 September 2026; telaah Peraturan LKPP Nomor 9 Tahun 2021 yang berlaku sebelum digantikan.':'Tanggal fase yang tercatat mulai 1 September 2026; telaah Peraturan LKPP Nomor 2 Tahun 2026.';
 return {phase,catalogRule};
}
function regulationNotes(p){const r=rulesAtTransaction(p);return `<div class="spha-rules"><p><b>Dasar pertimbangan pengadaan:</b> Perpres Nomor 16 Tahun 2018 sebagaimana diubah Perpres Nomor 12 Tahun 2021 dan Perpres Nomor 46 Tahun 2025 (periksa ketentuan yang berlaku pada saat pelaksanaan). <b>Katalog Elektronik:</b> ${escLocal(r.catalogRule)}</p><p>Jumlah sumber pembanding tidak dipaksakan harus tiga. Referensi harga digunakan menurut kecukupan bukti yang tersedia dan karakter produk/metode e-Purchasing. Harga dari sumber berbeda hanya dibandingkan setelah volume/satuan, spesifikasi/fungsi, pajak, ongkos kirim, layanan, lokasi, dan tanggalnya diperiksa. Harga katalog bukan otomatis harga final; hasil negosiasi dan bukti menjadi dasar analisis. <b>Catatan:</b> tanggal fase yang tercatat bukan bukti tanggal penerapan ketentuan pada transaksi.</p><p class="spha-source-note">Sumber peraturan: jdih.lkpp.go.id — Peraturan LKPP 2/2026 dan Perpres 46/2025; peraturan.bpk.go.id — Perpres 46/2025. Verifikasi dokumen resmi jika lampiran ini akan dipakai untuk pemeriksaan.</p></div>`;}
function needTable(a){return `<div class="spha-scroll"><table class="spha-table spha-needs"><thead><tr><th>No.</th><th>Barang kebutuhan</th><th>Volume</th><th>HPS satuan</th><th>HPS total item</th></tr></thead><tbody>${a.productFindings.map((f,i)=>`<tr><td>${i+1}</td><td>${escLocal(f.name)}<small>${escLocal(f.spec)}</small></td><td>${escLocal(f.qty)} ${escLocal(f.unit)}</td><td class="n">${rpLocal(f.hpsUnit)}</td><td class="n">${rpLocal(f.hpsUnit*f.qty)}</td></tr>`).join('')}</tbody></table></div>`;}
function efficiencyBox(a){const w=a.winner,d=a.delta;return `<div class="spha-efficiency"><b>Nilai HPS paket:</b> ${rpLocal(a.packet.hps)}<br><b>Hasil negosiasi penyedia yang ditetapkan${w?' ('+escLocal(w.name)+')':''}:</b> ${rpLocal(w?.negoTotal)}<br><b>Selisih nominal terhadap HPS:</b> ${d===null?'Belum dapat dihitung':`${rpLocal(Math.abs(d))} (${fmtPercent(a.packet.hps>0?Math.abs(d)/a.packet.hps*100:NaN)}) ${d>=0?'di bawah HPS':'di atas HPS'}`}<p class="spha-note">Selisih HPS adalah efisiensi nominal terhadap estimasi, bukan pembuktian bahwa harga produk sebanding dengan harga pasar. Nilai total sudah termasuk ongkos kirim yang tercatat; SATRIA tidak menambah PPN lagi pada harga bruto.</p></div>`;}
function accessible(p){if(!p||satriaSpseIs(p)||Number(p.tahun)!==Number(S.ui.tahun)||(S.ui.opd!=='all'&&String(p.opd)!==String(S.ui.opd)))return false;const scope=activeCloudScope();return !scope||(scope.opdIds.includes(String(p.opd))&&scope.years.includes(Number(p.tahun)));}
function packetList(){return (S.paket||[]).filter(accessible);}
function available(p){return !!p&&packetList().some(x=>String(x.id)===String(p.id));}
function current(){const pid=String(S.ui.pid||'');return packetList().find(x=>String(x.id)===pid)||(!pid?packetList()[0]:null);}
function prettyDate(v){return validDate(v)?satriaDateId(v):escLocal(v||'—');}
function today(){return new Date().toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function changeLink(p,type='analisa'){return '#'+type+'/'+encodeURIComponent(p.id);}
function matrix(a){return `<div class="spha-scroll"><table class="spha-table"><thead><tr><th>Barang / Kebutuhan</th><th>Vol.</th><th>HPS satuan</th>${a.offers.map(o=>`<th>${escLocal(o.name)}<small>Harga tayang / Negosiasi</small></th>`).join('')}<th>Catatan perbandingan harga</th></tr></thead><tbody>${a.items.map(i=>{
 const priced=i.refs.filter(d=>d.listedUnit!==null);
 const concerns=i.refs.filter(d=>d.specWarnings.length||!d.evidenceOK);
 const status=priced.length>1?`Tercatat ${priced.length} harga penawaran untuk barang ini.`:priced.length===1?'Satu harga penawaran tercatat.':'Harga penawaran belum lengkap.';
 const note=concerns.length?'Ada produk atau keterangan sumber yang masih perlu dicocokkan sebelum harga dibandingkan secara langsung.':'Pastikan kesamaan spesifikasi dan biaya pembelian sebelum menarik kesimpulan.';
 return `<tr><td><b>${escLocal(i.name)}</b><small>${escLocal(i.spec)}</small></td><td class="n">${escLocal(i.qty)} ${escLocal(i.unit)}</td><td class="n">${rpLocal(i.hpsUnit)}</td>${i.refs.map(d=>`<td class="n"><b>${rpLocal(d.listedUnit)}</b><small>Nego ${rpLocal(d.negUnit)}</small><small>${d.specWarnings.length?'⚠ Produk tampak berbeda':d.evidenceOK?'Sumber harga tercatat':'Sumber harga perlu dilengkapi'}</small></td>`).join('')}<td><b>${escLocal(status)}</b><small>${escLocal(note)}</small></td></tr>`;
 }).join('')||'<tr><td colspan="5">Belum ada rincian barang.</td></tr>'}</tbody></table></div>`;}
function resultTable(a){return `<div class="spha-scroll"><table class="spha-table"><thead><tr><th>Penyedia</th><th>Harga tayang + ongkir</th><th>Nego + ongkir</th><th>Keterangan</th><th>Sumber bertaut</th></tr></thead><tbody>${a.offers.map(o=>`<tr><td><b>${escLocal(o.name)}</b>${a.winner?.id===o.id?'<small>✓ Penyedia yang ditetapkan</small>':''}</td><td class="n">${rpLocal(o.tayangTotal)}</td><td class="n">${rpLocal(o.negoTotal)}${!o.fullNego?'<small>Negosiasi belum lengkap</small>':''}</td><td>${o.fullTayang?'Harga tayang lengkap':'Harga belum lengkap'}<small>${escLocal(o.source||'Sumber belum ada')} · ${prettyDate(o.sourceDate)}</small></td><td>${o.detail.filter(x=>x.evidenceOK).length}/${o.detail.length}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada penawaran penyedia yang dicatat.</td></tr>'}</tbody></table></div>`;}
function evidenceTable(a){let idx=0;return `<div class="spha-scroll"><table class="spha-table spha-evidence"><colgroup><col style="width:5%"><col style="width:23%"><col style="width:14%"><col style="width:28%"><col style="width:11%"><col style="width:19%"></colgroup><thead><tr><th>No.</th><th>Barang</th><th>Penyedia</th><th>Referensi / tanggal</th><th>Harga bukti</th><th>Status & catatan</th></tr></thead><tbody>${a.offers.flatMap(o=>o.detail.map(d=>`<tr><td>${++idx}</td><td><b>${escLocal(d.item)}</b><small>${escLocal(d.refName||'Nama produk referensi belum diisi')}</small></td><td>${escLocal(o.name)}</td><td>${safeLink(d.link)}<small>${prettyDate(d.date)}${d.img?` · <a target="_blank" rel="noopener noreferrer" href="${escLocal(d.img)}">Bukti foto ↗</a>`:''}</small></td><td class="n">${rpLocal(d.refPrice)}</td><td><b>${d.specWarnings.length?'⚠ Indikasi beda produk':d.evidenceOK?'Sumber harga tercatat':'Bukti harga perlu diperiksa'}</b>${d.specWarnings.length?`<small>${escLocal(d.specWarnings.join('; '))}</small>`:''}${d.gaps.length?`<small>${escLocal(d.gaps.join('; '))}</small>`:''}</td></tr>`)).join('')||'<tr><td colspan="6">Bukti harga belum tersedia.</td></tr>'}</tbody></table></div>`;}
function narrative(a){const n=a.offers.length,w=a.winner,delta=a.delta;
 const base=`Berdasarkan catatan penawaran yang tersedia, terdapat ${n} penyedia dan ${a.items.length} jenis barang pada paket ini. Total HPS tercatat sebesar ${rpLocal(a.packet.hps)} dengan pagu ${rpLocal(a.packet.pagu)}. Perbandingan dilakukan menurut barang dan satuan yang dibutuhkan. Harga dari setiap penyedia tetap dicantumkan, termasuk apabila produk yang ditawarkan masih perlu diperiksa kesesuaiannya.`;
 const status=w?`Penyedia yang telah ditetapkan adalah ${w.name}, dengan hasil negosiasi untuk seluruh barang termasuk ongkos kirim yang tercatat sebesar ${rpLocal(w.negoTotal)}. ${delta===null?'':(delta>=0?'Jumlah ini lebih rendah daripada total HPS sebesar ':'Jumlah ini lebih tinggi daripada total HPS sebesar ')+rpLocal(Math.abs(delta))+' ('+fmtPercent(a.packet.hps?Math.abs(delta)/a.packet.hps*100:NaN)+').'} `:'Penetapan penyedia belum tercatat secara lengkap. Oleh karena itu, hasil ini merupakan bahan pertimbangan harga, bukan uraian transaksi akhir. ';
 const caveat='Selisih harga terhadap HPS atau penyedia lain belum dengan sendirinya membuktikan harga wajar. Sebelum kesimpulan ditetapkan, perlu dilihat kesamaan merek/model atau spesifikasi, satuan dan jumlah barang, pajak, ongkos kirim, layanan, serta bukti harga pada waktu pengadaan.';
 return {base,status,caveat,conclusion:'Hasil perbandingan angka perlu disertai penjelasan mengenai kesesuaian produk dan bukti sumber harga.'};}
function issueList(a){return `<div class="spha-warnings">${a.issues.length?a.issues.map(x=>`<div class="spha-warning ${x.level==='Tinggi'?'urgent':''}"><span>${x.level==='Tinggi'?'!':'i'}</span><div><b>${escLocal(x.level)}</b><p>${escLocal(x.text)}</p></div></div>`).join(''):'<p>Belum ada masalah struktural terdeteksi; pemeriksaan keaslian dan kesetaraan bukti tetap diperlukan.</p>'}</div>`;}
function barCompare(a){const max=Math.max(1,a.packet.hps,...a.offers.map(o=>o.negoTotal||o.tayangTotal||0));const rows=[{name:'HPS paket',value:a.packet.hps,color:'#7c3aed'},...a.offers.map(o=>({name:o.name,value:o.negoTotal??o.tayangTotal??0,color:o.negoTotal===null?'#94a3b8':'#0ea5e9',provisional:o.negoTotal===null}))];return `<div class="spha-bars">${rows.map(r=>`<div class="spha-bar"><div class="spha-bar-top"><b>${escLocal(r.name)}</b><span>${r.provisional?'Tayang (belum final) · ':''}${rpLocal(r.value)}</span></div><div class="spha-bar-rail"><i style="width:${r.value?Math.max(2,r.value/max*100):0}%;background:${r.color}"></i></div></div>`).join('')}</div>`;}
function summary(a){return `<section class="spha-summary"><div class="spha-metric"><span>HPS paket</span><b>${rpLocal(a.packet.hps)}</b></div><div class="spha-metric"><span>Penawaran tercatat</span><b>${a.offers.length}</b></div><div class="spha-metric"><span>Sumber harga dengan keterangan lengkap</span><b>${a.referenceCount}/${a.evidenceTotal}</b></div><div class="spha-metric"><span>Hasil negosiasi penyedia terpilih</span><b>${rpLocal(a.winner?.negoTotal)}</b></div></section>`;}
function evidenceActionList(a){const rows=a.offers.flatMap(o=>o.detail.filter(d=>!d.evidenceOK||d.specWarnings.length).map(d=>({provider:o.name,item:d.item,reason:[...d.specWarnings,...d.gaps].join('; ')||'Periksa bukti asli'})));return rows.length?`<div class="spha-scroll"><table class="spha-table spha-reviewlist"><thead><tr><th>Penyedia</th><th>Barang</th><th>Perlu diperiksa</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escLocal(r.provider)}</td><td>${escLocal(r.item)}</td><td>${escLocal(r.reason)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Tidak ditemukan kekurangan metadata atau konflik model eksplisit oleh pemeriksaan otomatis; periksa kesetaraan spesifikasi dan bukti asli tetap diperlukan.</p>';}
function page(){const p=current();if(!p)return `<section class="spha-page"><div class="card"><h2>Smart Analisis Kewajaran Harga</h2><p>Tidak ada paket e-Purchasing yang dapat diakses dalam tahun dan filter OPD saat ini.</p><a href="#paket">Kembali ke Paket Pengadaan</a></div></section>`;
 const a=getAnalysis(p),n=narrative(a),list=packetList();
 return `<section class="spha-page"><div class="spha-hero"><div><span class="spha-kicker">✦ SATRIA NEXT • SMART PRICE ANALYSIS</span><h2>Analisis harga tiap produk.<br><em>Langsung jelas selisihnya.</em></h2><p>Bandingkan HPS, harga tayang, negosiasi, dan referensi produk lain per barang. SATRIA menyusun alasan dan dokumen otomatis tanpa input ulang.</p><div class="spha-hero-tags"><span>TA ${escLocal(p.tahun)}</span><span>RUP ${escLocal(p.rup||'—')}</span><span>${escLocal(O(p.opd).singkat)}</span></div></div><div class="spha-hero-art">↗<small>PRICE<br>INSIGHT</small></div></div><div class="spha-toolbar"><label>Paket yang dianalisis<select data-spha-select>${list.map(q=>`<option value="${escLocal(q.id)}" ${q.id===p.id?'selected':''}>${escLocal(q.rup||'—')} · ${escLocal(q.nama)}</option>`).join('')}</select></label><a class="spha-btn muted" href="#paket/${encodeURIComponent(p.id)}">Kembali ke paket</a><button type="button" class="spha-btn" data-spha-action="document" data-pid="${escLocal(p.id)}">Pratinjau dokumen & PDF</button></div><div class="spha-foot"><b>Cara membaca:</b> setiap penyedia mencatat produk dan harga yang ditawarkannya sendiri. Penyedia 1, 2, dan seterusnya sama-sama menjadi sumber perbandingan harga; penyedia terpilih ditentukan setelah evaluasi dan negosiasi. Produk alternatif tambahan tidak menggantikan penawaran penyedia lain.</div>${summary(a)}<div class="spha-two"><section class="spha-card"><div class="spha-cardhead"><h3>Perbandingan total paket</h3><span>Harga lengkap</span></div>${barCompare(a)}<p class="spha-hint">Harga termasuk ongkir tercatat. Negosiasi parsial tidak dihitung sebagai total akhir. Nilai PPN tidak ditambahkan lagi dari harga bruto.</p></section><section class="spha-card"><div class="spha-cardhead"><h3>Pertimbangan hasil perbandingan</h3><span>Periksa bukti</span></div><div class="spha-assessment">${escLocal(a.assessment)}</div><p>${escLocal(n.status)}</p><p class="spha-hint">${escLocal(n.caveat)}</p></section></div><section class="spha-card spha-focus"><div class="spha-cardhead"><h3>Analisis beda harga per item & pertimbangan</h3><span>Fokus utama</span></div><p>Perbandingan disusun dari HPS satuan, harga yang ditawarkan, hasil negosiasi, dan harga produk yang dicatat dari penyedia lain. <b>Harga yang terlihat lebih murah belum otomatis wajar.</b> Ongkir berada pada perhitungan total paket.</p>${productPriceTable(a)}${productAnalysis(a)}</section><section class="spha-card"><h3>Daftar harga yang ditawarkan setiap penyedia</h3><p>Semua penawaran harga tetap ditampilkan. Harga dari produk yang berbeda ukuran, jenis, atau satuan perlu dijelaskan sebelum digunakan sebagai pembanding.</p>${matrix(a)}</section><section class="spha-card"><h3>Rekap penawaran dan negosiasi</h3>${resultTable(a)}</section><section class="spha-card"><h3>Daftar sumber harga dan bukti pendukung</h3><p>Tautan dan tanggal berasal dari catatan penawaran; Tanggal dan tautan mengikuti catatan yang tersimpan; simpan bukti asli untuk lampiran pemeriksaan.</p>${evidenceTable(a)}</section><section class="spha-card"><h3>Daftar cek bukti yang perlu ditinjau</h3><p>Rincian yang perlu dicocokkan kembali dengan bukti asli, terutama apabila ukuran, merek, atau satuan produk berbeda.</p>${evidenceActionList(a)}</section><section class="spha-card"><h3>Barang dan sumber harga yang perlu diperiksa</h3>${issueList(a)}</section><div class="spha-foot">Perhitungan mengikuti penawaran yang tersimpan saat laporan dibuka. Untuk kebutuhan BPK, cocokkan URL/screenshot dan bukti asli; hasil otomatis bukan penilaian final kewajaran atau pengesahan transaksi.</div></section>`;
}
function documentHTML(p){const a=getAnalysis(p),n=narrative(a),stamp=today();return `<div class="spha-doc" data-spha-document="true">${typeof kop==='function'?kop(p):''}<p class="spha-doc-title">ANALISIS PERBANDINGAN DAN KEWAJARAN HARGA PRODUK</p><p style="text-align:center">Bahan pertimbangan harga untuk pengadaan melalui e-Purchasing<br><b>Tanggal penyusunan: ${escLocal(stamp)}</b><br><b>Dokumen untuk ditelaah dan dilengkapi dengan bukti sumber harga</b></p><h3>I. Latar Belakang, Tujuan dan Identitas Paket</h3><p>Dokumen ini disusun berdasarkan catatan harga produk yang ditawarkan penyedia, hasil negosiasi, dan sumber harga yang tersedia. Setiap harga dibandingkan dengan HPS dan harga dari penyedia lain untuk melihat apakah nilai yang dipilih dapat dipertanggungjawabkan. Tanggal penyusunan dokumen dicatat sesuai keadaan sebenarnya; untuk pengadaan yang sudah selesai, dokumen ini tidak dimaksudkan sebagai bukti bahwa analisis telah dibuat sebelum transaksi.</p><table class="spha-doc-info"><tbody><tr><th>Kode RUP</th><td>${escLocal(p.rup||'—')}</td><th>Tahun</th><td>${escLocal(p.tahun)}</td></tr><tr><th>Nama paket</th><td colspan="3">${escLocal(p.nama||'—')}</td></tr><tr><th>OPD</th><td colspan="3">${escLocal(O(p.opd).nama)}</td></tr><tr><th>Pagu paket</th><td>${rpLocal(a.packet.pagu)}</td><th>Total HPS</th><td>${rpLocal(a.packet.hps)}</td></tr><tr><th>Tanggal survei (catatan)</th><td>${prettyDate(p.tglSurvei)}</td><th>Tanggal negosiasi (catatan)</th><td>${prettyDate(p.tglNego)}</td></tr></tbody></table><h3>II. Daftar Kebutuhan dan HPS Per Barang</h3>${needTable(a)}<h3>III. Cara Membandingkan Harga dan Dasar Pertimbangan</h3><p>Harga yang ditawarkan setiap penyedia dicatat menurut barangnya masing-masing. Setelah penyedia terpilih, hasil negosiasi dibandingkan dengan HPS dan penawaran harga produk dari penyedia lain. Perhitungan selisih rupiah dan persentase didasarkan pada harga satuan acuan. Referensi harus sebanding dalam fungsi, kualitas, ukuran, satuan, lokasi/waktu, komponen pajak, layanan serta pengiriman. <b>Harga yang sumbernya sudah tercatat belum tentu berasal dari barang yang setara.</b> Harga bruto tidak ditambah pajak secara asumtif dan ongkir tidak dialokasikan ke item tanpa data.</p>${regulationNotes(p)}<h3>IV. Tabel Analisis Beda Harga Per Item</h3>${productPriceTable(a)}<h3>V. Analisis dan Pertimbangan Kewajaran Setiap Produk</h3>${productAnalysis(a)}<h3>VI. Rekapitulasi Negosiasi dan Efisiensi Nominal</h3>${resultTable(a)}${efficiencyBox(a)}<h3>VII. Kesimpulan dan Catatan Pejabat Pengadaan</h3><p>${escLocal(n.status)}</p><p>Dari ${a.productFindings.length} jenis barang, ${a.comparisonSummary.belowHps} mempunyai nilai perbandingan di bawah HPS satuan dan ${a.comparisonSummary.aboveHps} berada di atas HPS satuan. Semua penawaran penyedia dicantumkan dalam lampiran, termasuk bila sebagian produk belum dapat disamakan karena ukuran atau spesifikasinya berbeda. Selisih tersebut menjadi bahan pertimbangan awal dan perlu dicocokkan dengan kondisi barang, sumber harga, dan kebutuhan pengadaan sebelum disimpulkan kewajarannya.</p><p>${escLocal(n.caveat)}</p><p><b>Rekomendasi sementara:</b> perbandingan harga ini dapat dijadikan bahan pertimbangan dengan menyertakan bukti harga asli. Tindak lanjuti perbedaan spesifikasi dan harga satuan yang membutuhkan klarifikasi. Penyedia terpilih dan hasil transaksi mengikuti dokumen pengadaan yang sebenarnya.</p><div class="spha-conclusion"><h3>Catatan Penutup</h3><p><b>Perbedaan harga dan hasil negosiasi telah dihitung berdasarkan catatan yang tersedia. Penilaian kewajaran akhir perlu mempertimbangkan bukti harga, kesesuaian barang, serta kondisi pembelian yang sebenarnya.</b></p><p><i>Untuk paket historis, tanggal dokumen ini adalah tanggal penyusunan sebenarnya. Bukti pasar pada tanggal transaksi perlu diperiksa terpisah.</i></p><div class="spha-sign"><p>Disusun untuk bahan telaah oleh Pejabat Pengadaan</p><p><b>${escLocal(PJ(p.pp).nama||'Nama Pejabat Pengadaan perlu diperiksa')}</b></p><p>NIP: ${escLocal(PJ(p.pp).nip||'—')}</p><p>Paraf/tanda tangan hanya setelah meninjau isi laporan</p></div></div><h3>VIII. Lampiran A — Daftar Harga yang Ditawarkan dan Hasil Negosiasi</h3>${matrix(a)}<h3>IX. Lampiran B — Daftar Sumber Referensi Harga</h3><p>Alamat URL merupakan catatan sumber, bukan arsip tangkapan layar. Bukti asli dan tanggal pengambilannya perlu dikonfirmasi.</p>${evidenceTable(a)}</div>`;}
function docChecks(p){const a=getAnalysis(p);return [
 {id:'rup',label:'Kode RUP tersedia',tab:'data',f:'rup',ok:!!p.rup},
 {id:'items',label:'Rincian barang dan HPS lengkap',tab:'rincian',f:null,ok:a.items.length>0&&a.items.every(i=>i.hpsUnit>0&&i.qty>0)},
 {id:'offers',label:'Penawaran penyedia tercatat',tab:'nego',f:null,ok:a.offers.length>0},
 {id:'prices',label:'Harga tayang semua item tercatat',tab:'nego',f:null,ok:a.offers.length>0&&a.offers.every(o=>o.fullTayang)},
 {id:'sources',label:'Bukti harga per item memiliki URL/tanggal/harga yang konsisten',tab:'nego',f:null,ok:a.evidenceTotal>0&&a.referenceCount===a.evidenceTotal},
 {id:'technical',label:'Kesetaraan spesifikasi dan keaslian bukti harus diperiksa manual oleh Pejabat Pengadaan',tab:'nego',f:null,ok:false,manual:true}
 ];}
function showDoc(p){if(!available(p))return false;S.ui.dpid=String(p.id);S.ui.dok='analisa';S.ui.pid=null;S.ui.page='dok';location.hash='#dok';render();return true;}
root.SATRIA_PRICE_ANALYSIS=Object.freeze({page,getAnalysis,analyze,documentHTML,docChecks,showDoc});
// Extend the EXISTING document studio instead of making a second print engine.
if(typeof DOCS!=='undefined')DOCS.analisa=documentHTML;
// The document and dashboard read only already-visible package data; events do not write to S.
document.addEventListener('click',function(e){const btn=e.target.closest?.('[data-spha-action]');if(!btn)return;const action=btn.dataset.sphaAction;if(!['document','open'].includes(action))return;e.preventDefault();e.stopImmediatePropagation();const pid=String(btn.dataset.pid||'');const p=packetList().find(x=>String(x.id)===pid);if(!p){toast('Paket tidak tersedia dalam hak akses dan filter tahun/OPD saat ini.');return;}if(action==='document'){showDoc(p);return;}location.hash=changeLink(p);},true);
document.addEventListener('change',function(e){const select=e.target.closest?.('[data-spha-select]');if(!select)return;const p=packetList().find(x=>String(x.id)===String(select.value));if(p)location.hash=changeLink(p);},true);
})(typeof window==='undefined'?null:window);
