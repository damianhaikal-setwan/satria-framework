/* SATRIA NEXT 3.0.59.39 — Smart Analisis Kewajaran Harga & Audit Evidence.
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
const safeImage=v=>{const x=clean(v);if(/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(x))return x;if(/^satria-media:\/\/[0-9a-f-]{36}\/(?:opd|shared)\//i.test(x))return x;return /^https:\/\//i.test(x)?safeURL(x):''};
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
   const refPrice=positive(ref.displayPrice),link=safeURL(ref.link),img=safeImage(ref.imageUrl),date=clean(ref.date);
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
   if(!link)gaps.push('tautan toko/referensi belum dicatat (bukan bukti harga produk)');
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
function safeLink(url){const s=safeURL(url);return s?`<a class="spha-link-open" target="_blank" rel="noopener noreferrer" href="${escLocal(s)}">Buka toko/sumber ↗</a><small class="spha-url-full">${escLocal(s)}</small>`:'Belum ada URL';}
function getAnalysis(p){const names={};for(const y of S.penyedia||[])names[String(y.id)]=y.nama;const valid=pemenang(p);return analyze(p,{suppliers:names,validWinnerId:valid?.w?.id||''});}
function priceGapText(value,percent){if(value===null)return 'belum dapat dihitung';if(value===0)return 'sama dengan acuan';return `${rpLocal(Math.abs(value))} (${fmtPercent(Math.abs(percent))}) ${value>0?'lebih rendah':'lebih tinggi'}`;}
function productNarrative(f){
 const unit=f.unit||'satuan';
 if(f.chosenValue===null)return `Harga ${f.name} belum dicatat secara lengkap sehingga belum dapat disimpulkan. Periksa kembali penawaran dan harga hasil negosiasi.`;
 const selected=f.chosenBasis==='negosiasi penyedia ditetapkan';
 let out=`Untuk pengadaan ${f.name} sebanyak ${f.qty} ${unit}, `;
 if(selected){
  out+=`${f.chosenName} mencantumkan harga tayang ${rpLocal(f.selfTayang)} per ${unit}. Setelah negosiasi, harganya menjadi ${rpLocal(f.chosenValue)} per ${unit}.`;
  if(f.negoSaving!==null){
   if(f.negoSaving>0)out+=` Negosiasi menurunkan harga sebesar ${rpLocal(f.negoSaving)} (${fmtPercent(f.negoSavingPct)}) per ${unit}.`;
   else if(f.negoSaving<0)out+=` Harga setelah negosiasi justru naik ${rpLocal(-f.negoSaving)} per ${unit} dan perlu dijelaskan.`;
  }
 }else out+=`harga tayang terendah yang tercatat adalah ${rpLocal(f.chosenValue)} per ${unit} dari ${f.chosenName}. Penyedia terpilih belum ditetapkan sehingga perbandingan ini belum menjadi hasil akhir.`;
 if(f.hpsDelta!==null)out+=` Dibandingkan HPS satuan ${rpLocal(f.hpsUnit)}, harga tersebut ${priceGapText(f.hpsDelta,f.hpsDeltaPct)}.`;
 const others=(f.offers||[]).filter(o=>o.supplier!==f.chosenName);
 if(!others.length)out+=' Tidak ada penawaran penyedia lain untuk barang ini.';
 for(const o of others){
  if(o.listed===null){out+=` ${o.supplier} belum mencatat harga untuk barang yang sama.`;continue;}
  const diff=o.listed-f.chosenValue;
  out+=` Sebagai pembanding, ${o.supplier} menawarkan ${o.refName||'produk yang dicatat'} dengan harga tayang ${rpLocal(o.listed)} per ${unit}`;
  if(diff!==0)out+=`, yaitu ${rpLocal(Math.abs(diff))} ${diff>0?'lebih tinggi':'lebih rendah'} daripada harga yang sedang dianalisis`;
  else out+=`, sama secara nominal dengan harga yang sedang dianalisis`;
  out+='.';
  if(o.nego!==null&&o.nego!==o.listed)out+=` Hasil negosiasi ${o.supplier}, apabila dicatat, adalah ${rpLocal(o.nego)} per ${unit}.`;
  if(o.specWarnings?.length)out+=` Namun, terdapat perbedaan produk yang perlu diperiksa (${o.specWarnings.join('; ')}), sehingga selisih itu belum dapat dijadikan perbandingan yang setara.`;
  else if(!o.canCompare)out+=' Kesamaan barang, satuan, dan bukti harga masih perlu dipastikan sebelum nilai tersebut digunakan sebagai dasar penilaian.';
  else out+=' Perbandingan angka ini tetap perlu dilengkapi pemeriksaan kesamaan produk dan biaya pembeliannya.';
 }
 if(f.hpsDelta<0)out+=' Harga satuan di atas HPS memerlukan penjelasan khusus meskipun nilai keseluruhan paket mungkin masih di bawah HPS.';
 return out;
}
function comparisonRows(f){return (f.offers||[]).filter(o=>o.supplier!==f.chosenName).map(o=>{
 const price=o.listed;
 const note=o.specWarnings?.length?'Produk berbeda atau perlu diperiksa kesesuaiannya':o.canCompare?'Periksa kesesuaian barang dan biaya':'Keterangan barang atau sumber harga perlu diperiksa';
 return `<div class="spha-peer-line"><b>${escLocal(o.supplier)}</b>: ${rpLocal(price)}<small>${escLocal(o.refName||'Produk belum dijelaskan')}${price===null?' · Harga belum dicatat':' · '+note}</small></div>`;
}).join('')||'<small>Belum ada penyedia lain dalam paket ini.</small>';}
function productPriceTable(a){return `<div class="spha-scroll"><table class="spha-table spha-price-detail"><colgroup><col style="width:24%"><col style="width:13%"><col style="width:17%"><col style="width:17%"><col style="width:29%"></colgroup><thead><tr><th>Barang dan jumlah</th><th>HPS satuan</th><th>${a.winner?'Harga penyedia terpilih':'Harga yang tercatat (belum final)'}</th><th>Selisih terhadap HPS</th><th>Harga penyedia pembanding</th></tr></thead><tbody>${a.productFindings.map(f=>`<tr><td><b>${escLocal(f.name)}</b><small>${escLocal(f.qty)} ${escLocal(f.unit)}</small></td><td class="n">${rpLocal(f.hpsUnit)}</td><td class="n"><b>${rpLocal(f.chosenValue)}</b><small>${escLocal(f.chosenName||'Belum ditetapkan')}</small><small>${a.winner?'Hasil negosiasi':'Harga tercatat; belum final'}</small></td><td class="n">${escLocal(priceGapText(f.hpsDelta,f.hpsDeltaPct))}</td><td>${comparisonRows(f)}</td></tr>`).join('')||'<tr><td colspan="5">Rincian barang belum tersedia.</td></tr>'}</tbody></table></div>`;}
function productAnalysis(a){return `<div class="spha-product-narratives">${a.productFindings.map((f,i)=>`<article class="spha-product-story"><h4>${i+1}. ${escLocal(f.name)} — ${escLocal(f.qty)} ${escLocal(f.unit)}</h4><p>${escLocal(productNarrative(f))}</p></article>`).join('')}</div>`;}
function rulesAtTransaction(p){
 // Date is a recorded phase date, NOT proof of the true transaction/contract date.
 const phase=validDate(p?.tglPenetapan)?p.tglPenetapan:validDate(p?.tglNego)?p.tglNego:validDate(p?.tglSurvei)?p.tglSurvei:'';
 const catalogRule=!phase?'Periksa tanggal pelaksanaan untuk menentukan peraturan katalog yang relevan.':phase<'2026-09-01'?'Tanggal fase yang tercatat mendahului 1 September 2026; telaah Peraturan LKPP Nomor 9 Tahun 2021 yang berlaku sebelum digantikan.':'Tanggal fase yang tercatat mulai 1 September 2026; telaah Peraturan LKPP Nomor 2 Tahun 2026.';
 return {phase,catalogRule};
}
function regulationNotes(p){const r=rulesAtTransaction(p);return `<div class="spha-rules"><p><b>Dasar pertimbangan pengadaan:</b> Perpres Nomor 16 Tahun 2018 sebagaimana diubah Perpres Nomor 12 Tahun 2021 dan Perpres Nomor 46 Tahun 2025 (periksa ketentuan yang berlaku pada saat pelaksanaan). <b>Katalog Elektronik:</b> ${escLocal(r.catalogRule)}</p><p>Jumlah sumber pembanding tidak dipaksakan harus tiga. Referensi harga digunakan menurut kecukupan bukti yang tersedia dan karakter produk/metode e-Purchasing. Harga dari sumber berbeda hanya dibandingkan setelah volume/satuan, spesifikasi/fungsi, pajak, ongkos kirim, layanan, lokasi, dan tanggalnya diperiksa. Harga katalog bukan otomatis harga final; hasil negosiasi dan bukti menjadi dasar analisis. <b>Catatan:</b> tanggal fase yang tercatat bukan bukti tanggal penerapan ketentuan pada transaksi.</p><p class="spha-source-note">Sumber peraturan: jdih.lkpp.go.id — Peraturan LKPP 2/2026 dan Perpres 46/2025; peraturan.bpk.go.id — Perpres 46/2025. Verifikasi dokumen resmi jika lampiran ini akan dipakai untuk pemeriksaan.</p></div>`;}
function needTable(a){return `<div class="spha-scroll"><table class="spha-table spha-needs"><thead><tr><th>No.</th><th>Barang kebutuhan</th><th>Volume</th><th>HPS satuan</th><th>HPS total item</th></tr></thead><tbody>${a.productFindings.map((f,i)=>`<tr><td>${i+1}</td><td>${escLocal(f.name)}<small>${escLocal(f.spec)}</small></td><td>${escLocal(f.qty)} ${escLocal(f.unit)}</td><td class="n">${rpLocal(f.hpsUnit)}</td><td class="n">${rpLocal(f.hpsUnit*f.qty)}</td></tr>`).join('')}</tbody></table></div>`;}
function efficiencyBox(a){const w=a.winner,d=a.delta;return `<div class="spha-efficiency"><b>Nilai HPS paket:</b> ${rpLocal(a.packet.hps)}<br><b>Hasil negosiasi penyedia yang ditetapkan${w?' ('+escLocal(w.name)+')':''}:</b> ${rpLocal(w?.negoTotal)}<br><b>Selisih nominal terhadap HPS:</b> ${d===null?'Belum dapat dihitung':`${rpLocal(Math.abs(d))} (${fmtPercent(a.packet.hps>0?Math.abs(d)/a.packet.hps*100:NaN)}) ${d>=0?'di bawah HPS':'di atas HPS'}`}<p class="spha-note">Selisih HPS adalah efisiensi nominal terhadap estimasi, bukan pembuktian bahwa harga produk sebanding dengan harga pasar. Nilai total sudah termasuk ongkos kirim yang tercatat; PPN tidak ditambahkan kembali pada harga tayang yang sudah tercatat termasuk pajak.</p></div>`;}
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
 return `<tr><td><b>${escLocal(i.name)}</b><small>${escLocal(i.spec)}</small></td><td class="n">${escLocal(i.qty)} ${escLocal(i.unit)}</td><td class="n">${rpLocal(i.hpsUnit)}</td>${i.refs.map(d=>`<td class="n"><b>${rpLocal(d.listedUnit)}</b><small>Nego ${rpLocal(d.negUnit)}</small><small>${d.specWarnings.length?'⚠ Produk tampak berbeda':d.evidenceOK?'Harga tercatat':'Catatan sumber perlu diperiksa'}</small></td>`).join('')}<td><b>${escLocal(status)}</b><small>${escLocal(note)}</small></td></tr>`;
 }).join('')||'<tr><td colspan="5">Belum ada rincian barang.</td></tr>'}</tbody></table></div>`;}
function resultTable(a){return `<div class="spha-scroll"><table class="spha-table"><thead><tr><th>Penyedia</th><th>Harga tayang + ongkir</th><th>Nego + ongkir</th><th>Keterangan</th><th>Keterangan sumber harga</th></tr></thead><tbody>${a.offers.map(o=>`<tr><td><b>${escLocal(o.name)}</b>${a.winner?.id===o.id?'<small>✓ Penyedia yang ditetapkan</small>':''}</td><td class="n">${rpLocal(o.tayangTotal)}</td><td class="n">${rpLocal(o.negoTotal)}${!o.fullNego?'<small>Negosiasi belum lengkap</small>':''}</td><td>${o.fullTayang?'Harga tayang lengkap':'Harga belum lengkap'}<small>${escLocal(o.source||'Sumber belum ada')} · ${prettyDate(o.sourceDate)}</small></td><td>${o.detail.filter(x=>x.evidenceOK).length}/${o.detail.length}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada penawaran penyedia yang dicatat.</td></tr>'}</tbody></table></div>`;}
function printMatrix(a){
 const offers=a.winner?[a.winner,...a.offers.filter(o=>o.id!==a.winner.id)]:a.offers;
 return `<div class="spha-scroll"><table class="spha-table spha-matrix-print"><thead><tr><th>Barang dan spesifikasi</th><th>Volume</th><th>HPS satuan</th>${offers.map(o=>`<th>${escLocal(o.name)}<small>${a.winner?.id===o.id?'Penyedia terpilih':'Penyedia pembanding'}</small><small>Harga tayang / negosiasi</small></th>`).join('')}<th>Keterangan</th></tr></thead><tbody>${a.items.map(item=>{
 const cells=offers.map(o=>{
  const d=item.refs.find(x=>x.offer.id===o.id);
  if(!d)return '<td>Belum ada harga yang dicatat</td>';
  return `<td class="n"><b>${rpLocal(d.listedUnit)}</b><small>Nego: ${rpLocal(d.negUnit)}</small>${d.specWarnings.length?`<small>Produk berbeda: ${escLocal(d.refName||'periksa spesifikasi')}</small>`:''}</td>`;
 });
 const flagged=item.refs.filter(x=>x.specWarnings.length);
 const note=flagged.length?`Ada ${flagged.length} penawaran produk yang perlu diperiksa kesetaraannya.`:'Periksa kesamaan spesifikasi dan biaya pembelian.';
 return `<tr><td><b>${escLocal(item.name)}</b><small>${escLocal(item.spec)}</small></td><td class="n">${escLocal(item.qty)} ${escLocal(item.unit)}</td><td class="n">${rpLocal(item.hpsUnit)}</td>${cells.join('')}<td>${escLocal(note)}</td></tr>`;
 }).join('')||'<tr><td colspan="5">Belum ada rincian barang.</td></tr>'}</tbody></table></div>`;
}
function printRecap(a){return `<div class="spha-scroll"><table class="spha-table spha-recap"><thead><tr><th>Penyedia</th><th>Harga tayang dan ongkir</th><th>Hasil negosiasi dan ongkir</th><th>Keterangan</th></tr></thead><tbody>${a.offers.map(o=>`<tr><td><b>${escLocal(o.name)}</b>${a.winner?.id===o.id?'<small>Penyedia terpilih</small>':''}</td><td class="n">${rpLocal(o.tayangTotal)}</td><td class="n">${rpLocal(o.negoTotal)}</td><td>${o.fullTayang?'Harga tayang tercatat untuk seluruh barang':'Masih terdapat harga tayang yang belum dicatat'}${!o.fullNego?'<small>Negosiasi belum lengkap</small>':''}${o.negoTotal!==null&&a.packet.hps>0&&o.negoTotal>a.packet.hps?'<small>Nilai hasil negosiasi melebihi HPS paket</small>':''}</td></tr>`).join('')||'<tr><td colspan="4">Belum ada penawaran penyedia.</td></tr>'}</tbody></table></div>`;}
// Lampiran foto hanya mengambil gambar yang benar-benar disimpan pada penawaran.
// SATRIA_MEDIA menyiapkan URL privat secara asinkron; jangan membuat foto contoh atau memalsukan sumber.
function productPhotoAppendix(a){
 const entries=[];
 const ordered=[...(a.winner?[a.winner]:[]),...a.offers.filter(o=>o.id!==a.winner?.id)];
 for(const o of ordered)for(const d of o.detail){const image=safeImage(d.img);if(!image)continue;entries.push({o,d,image});}
 if(!entries.length)return `<h3 class="spha-photo-heading">Lampiran Foto Barang</h3><p>Belum ada foto barang yang tersimpan pada penawaran paket ini. Foto dapat ditambahkan melalui Penawaran &amp; Negosiasi tanpa mengubah perhitungan harga.</p>`;
 const chunks=[];for(let i=0;i<entries.length;i+=6)chunks.push(entries.slice(i,i+6));
 return chunks.map((group,page)=>`<section class="spha-photo-sheet"><h3>Lampiran Foto Barang${chunks.length>1?' — '+(page+1)+'/'+chunks.length:''}</h3><p>Foto produk yang dicatat dalam Penawaran &amp; Negosiasi; ditampilkan menurut penyedia dan barang. Periksa kembali kesesuaian foto dengan produk pada sumber aslinya.</p><div class="spha-photo-grid">${group.map(({o,d,image})=>`<article class="spha-photo-card"><div class="spha-photo-frame"><img src="${escLocal(image)}" alt="Foto ${escLocal(d.item)} dari ${escLocal(o.name)}" loading="eager" decoding="sync" onerror="this.style.display='none';this.parentElement.classList.add('spha-photo-missing')"></div><div class="spha-photo-info"><b>${escLocal(d.item)}</b><span>${escLocal(o.name)}${a.winner?.id===o.id?' — Penyedia terpilih':''}</span><small>${escLocal(d.refName||'Nama produk belum dicatat')}</small><small>Harga tayang: ${rpLocal(d.listedUnit)}</small></div></article>`).join('')}</div></section>`).join('');
}
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
 return `<section class="spha-page"><div class="spha-hero"><div><span class="spha-kicker">✦ SATRIA NEXT • SMART PRICE ANALYSIS</span><h2>Analisis harga tiap produk.<br><em>Langsung jelas selisihnya.</em></h2><p>Bandingkan HPS, harga tayang, negosiasi, dan referensi produk lain per barang. SATRIA menyusun alasan dan dokumen otomatis tanpa input ulang.</p><div class="spha-hero-tags"><span>TA ${escLocal(p.tahun)}</span><span>RUP ${escLocal(p.rup||'—')}</span><span>${escLocal(O(p.opd).singkat)}</span></div></div><div class="spha-hero-art">↗<small>PRICE<br>INSIGHT</small></div></div><div class="spha-toolbar"><label>Paket yang dianalisis<select data-spha-select>${list.map(q=>`<option value="${escLocal(q.id)}" ${q.id===p.id?'selected':''}>${escLocal(q.rup||'—')} · ${escLocal(q.nama)}</option>`).join('')}</select></label><a class="spha-btn muted" href="#paket/${encodeURIComponent(p.id)}">Kembali ke paket</a><button type="button" class="spha-btn" data-spha-action="document" data-pid="${escLocal(p.id)}">Pratinjau dokumen & PDF</button></div><div class="spha-foot"><b>Cara membaca:</b> setiap penyedia mencatat produk dan harga yang ditawarkannya sendiri. Penyedia 1, 2, dan seterusnya sama-sama menjadi sumber perbandingan harga; penyedia terpilih ditentukan setelah evaluasi dan negosiasi. Produk alternatif tambahan tidak menggantikan penawaran penyedia lain.</div>${summary(a)}<div class="spha-two"><section class="spha-card"><div class="spha-cardhead"><h3>Perbandingan total paket</h3><span>Harga lengkap</span></div>${barCompare(a)}<p class="spha-hint">Harga termasuk ongkir tercatat. Negosiasi parsial tidak dihitung sebagai total akhir. Nilai PPN tidak ditambahkan lagi dari harga bruto.</p></section><section class="spha-card"><div class="spha-cardhead"><h3>Pertimbangan hasil perbandingan</h3><span>Periksa bukti</span></div><div class="spha-assessment">${escLocal(a.assessment)}</div><p>${escLocal(n.status)}</p><p class="spha-hint">${escLocal(n.caveat)}</p></section></div><section class="spha-card spha-focus"><div class="spha-cardhead"><h3>Analisis beda harga per item & pertimbangan</h3><span>Fokus utama</span></div><p>Perbandingan disusun dari HPS satuan, harga yang ditawarkan, hasil negosiasi, dan harga produk yang dicatat dari penyedia lain. <b>Harga yang terlihat lebih murah belum otomatis wajar.</b> Ongkir berada pada perhitungan total paket.</p>${productPriceTable(a)}${productAnalysis(a)}</section><section class="spha-card"><h3>Daftar harga yang ditawarkan setiap penyedia</h3><p>Semua penawaran harga tetap ditampilkan. Harga dari produk yang berbeda ukuran, jenis, atau satuan perlu dijelaskan sebelum digunakan sebagai pembanding.</p>${matrix(a)}</section><section class="spha-card"><h3>Rekap penawaran dan negosiasi</h3>${resultTable(a)}</section><section class="spha-card"><h3>Daftar sumber harga dan bukti pendukung</h3><p>Tautan yang tercatat dapat menuju toko e-Katalog, bukan halaman produk. Untuk bukti harga setiap produk, gunakan catatan penawaran dan dokumen/screenshot asli pada waktu pengadaan.</p>${evidenceTable(a)}</section><section class="spha-card"><h3>Daftar cek bukti yang perlu ditinjau</h3><p>Rincian yang perlu dicocokkan kembali dengan bukti asli, terutama apabila ukuran, merek, atau satuan produk berbeda.</p>${evidenceActionList(a)}</section><section class="spha-card"><h3>Barang dan sumber harga yang perlu diperiksa</h3>${issueList(a)}</section><div class="spha-foot">Perhitungan mengikuti penawaran yang tersimpan saat laporan dibuka. Untuk kebutuhan BPK, cocokkan URL/screenshot dan bukti asli; hasil otomatis bukan penilaian final kewajaran atau pengesahan transaksi.</div></section>`;
}
// Dokumen resmi mengikuti susunan kertas kerja contoh pengguna.
// Data dihitung dari paket/penawaran aktif pada saat laporan dibuka, tanpa menyimpan ulang.
const valueText=v=>clean(v)||'Belum dicatat';
function docIdentity(p){
 const akun=(S.akun||[]).find(x=>String(x.id)===String(p.akunId||''));
 const row=(label,value)=>`<tr><th>${escLocal(label)}</th><td>${escLocal(valueText(value)).replace(/\n/g,'<br>')}</td></tr>`;
 const program=typeof progOf==='function'?progOf(p):p.program;
 const kegiatan=typeof kegOf==='function'?kegOf(p):p.kegiatan;
 const subRaw=typeof subOf==='function'?subOf(p):(p.subKeg||p.sub);
 const sub=/KODE-DEMO-001|Kegiatan Simulasi/i.test(clean(subRaw))?'':subRaw;
 const kode=akun?[akun.kode,akun.nama].filter(Boolean).join(' — '):'';
 return `<table class="spha-example-identity"><tbody>
 ${row('Program',program)}${row('Kegiatan',kegiatan)}${row('Sub Kegiatan',sub)}${row('Akun Belanja',kode)}
 ${row('Kode RUP',p.rup)}${row('Nama Paket',p.nama)}
 <tr><th>Pagu Anggaran</th><td>${rpLocal(p.pagu)}</td></tr>
 ${row('Metode Pengadaan',p.metodePemilihan||'E-Purchasing (Katalog Elektronik)')}
 </tbody></table>`;
}
function exampleNeedTable(a){return `<div class="spha-scroll"><table class="spha-table spha-example-needs"><thead><tr><th>No.</th><th>Nama Barang / Spesifikasi</th><th>Vol.</th><th>Satuan</th><th>HPS per Unit (Rp)</th><th>Jumlah HPS (Rp)</th></tr></thead><tbody>${a.productFindings.map((f,i)=>`<tr><td>${i+1}</td><td><b>${escLocal(f.name)}</b>${f.spec&&f.spec!==f.name&&f.spec!=='Spesifikasi belum dirinci'?`<small>${escLocal(f.spec)}</small>`:''}</td><td class="n">${escLocal(f.qty)}</td><td>${escLocal(f.unit)}</td><td class="n">${rpLocal(f.hpsUnit)}</td><td class="n">${rpLocal(money(f.hpsUnit*f.qty))}</td></tr>`).join('')}<tr><th colspan="5" style="text-align:right">Jumlah HPS</th><th class="n">${rpLocal(a.packet.hps)}</th></tr></tbody></table></div>`;}
function exampleProviders(a){
 const ordered=a.winner?[a.winner,...a.offers.filter(x=>x.id!==a.winner.id)]:a.offers;
 if(!ordered.length)return '<p>Belum terdapat penawaran penyedia yang dicatat untuk paket ini.</p>';
 return `<p>Perbandingan harga dilakukan terhadap ${ordered.length} penyedia yang telah dicatat dalam Penawaran &amp; Negosiasi, yaitu:</p><ol class="spha-example-sources">${ordered.map((o,i)=>`<li><b>${escLocal(o.name)}</b> — ${a.winner?(a.winner.id===o.id?'penyedia terpilih':'penyedia pembanding'):(i===0?'penawaran yang sedang dikaji':'penyedia pembanding')}${o.source?` (${escLocal(o.source)})`:''}.</li>`).join('')}</ol><p>Harga yang dibandingkan adalah harga tayang per satuan yang tercatat. Hasil negosiasi penyedia terpilih juga digunakan untuk menilai nilai pembelian. Perbedaan merek, model, ukuran, satuan, pajak, pengiriman, atau layanan diperiksa sebelum harga dianggap sebanding.</p>`;
}
function exampleCompareStatus(f){
 const offered=(f.offers||[]).filter(x=>x.supplier!==f.chosenName&&x.listed!==null);
 if(f.chosenValue===null)return 'Harga belum lengkap';
 if(f.hpsDelta<0)return 'Harga satuan melebihi HPS; perlu alasan';
 if(!offered.length)return 'Belum ada harga pembanding';
 if(offered.some(x=>x.specWarnings?.length))return 'Kesetaraan produk perlu diperiksa';
 if(offered.some(x=>!x.canCompare))return 'Periksa rincian barang dan sumber harga';
 return 'Harga dapat dipertimbangkan setelah pemeriksaan barang';
}
function exampleCompareTable(a){
 return `<div class="spha-scroll"><table class="spha-table spha-example-compare"><colgroup><col style="width:5%"><col style="width:24%"><col style="width:16%"><col style="width:25%"><col style="width:13%"><col style="width:17%"></colgroup><thead><tr><th>No.</th><th>Item Barang</th><th>Harga Tayang ${a.winner?'Penyedia Terpilih':'Penawaran yang Dikaji'}</th><th>Harga Penyedia Pembanding</th><th>Selisih Harga Satuan</th><th>Hasil Perbandingan</th></tr></thead><tbody>${a.productFindings.map((f,i)=>{
 const own=(f.offers||[]).find(o=>o.supplier===f.chosenName);
 const ownPrice=own?.listed??null;
 const others=(f.offers||[]).filter(o=>o.supplier!==f.chosenName);
 const comparisons=others.map(o=>{const product=o.refName&&normalize(o.refName)!==normalize(f.name)?`<small>Produk: ${escLocal(o.refName)}</small>`:'';return `<div class="spha-example-peer"><b>${escLocal(o.supplier)}</b><small>${rpLocal(o.listed)}${o.specWarnings?.length?' · Periksa kesetaraan':''}</small>${product}</div>`;}).join('')||'Tidak ada penyedia lain';
 const diffs=others.map(o=>{if(ownPrice===null||o.listed===null)return '<div>—</div>';const d=money(o.listed-ownPrice);return `<div class="spha-example-peer">${d===0?'Sama':rpLocal(Math.abs(d))+' '+(d>0?'lebih rendah':'lebih tinggi')}</div>`;}).join('')||'—';
 return `<tr><td>${i+1}</td><td><b>${escLocal(f.name)}</b><small>${escLocal(f.qty)} ${escLocal(f.unit)}</small></td><td class="n"><b>${rpLocal(ownPrice)}</b><small>${escLocal(f.chosenName||'Belum ditetapkan')}</small></td><td>${comparisons}</td><td>${diffs}</td><td>${escLocal(exampleCompareStatus(f))}</td></tr>`;
 }).join('')}</tbody></table></div>`;
}
function exampleItemAnalysis(f){
 const unit=f.unit||'satuan';
 const chosenOffer=(f.offers||[]).find(x=>x.supplier===f.chosenName);
 if(!chosenOffer||chosenOffer.listed===null)return `Harga penawaran ${f.name} belum tercatat lengkap. Perbandingan dan pertimbangan harga baru dapat disusun setelah data tersedia.`;
 const listPrice=chosenOffer.listed;
 let sentences='';
 if(f.chosenBasis==='negosiasi penyedia ditetapkan')sentences+=`Setelah negosiasi, harga ${f.chosenName} menjadi ${rpLocal(f.chosenValue)} per ${unit}.`;
 if(f.hpsDelta!==null)sentences+=` Dibandingkan HPS sebesar ${rpLocal(f.hpsUnit)} per ${unit}, harga hasil ${f.chosenBasis==='negosiasi penyedia ditetapkan'?'negosiasi':'penawaran'} ${priceGapText(f.hpsDelta,f.hpsDeltaPct)}.`;
 const comparisons=(f.offers||[]).filter(o=>o.supplier!==f.chosenName);
 if(!comparisons.length)sentences+=' Belum terdapat penyedia lain yang dicatat sebagai pembanding.';
 for(const c of comparisons){
  if(c.listed===null){sentences+=` Harga penawaran ${c.supplier} belum tersedia.`;continue;}
  const delta=money(c.listed-listPrice);
  sentences+=` ${c.supplier} mencantumkan harga ${rpLocal(c.listed)} per ${unit}`;
  sentences+=delta===0?', sama dengan harga tayang penyedia yang dikaji.':`, ${rpLocal(Math.abs(delta))} ${delta>0?'lebih tinggi':'lebih rendah'} dibandingkan harga tayang ${f.chosenName}.`;
  if(c.specWarnings?.length)sentences+=` Akan tetapi, produk yang ditawarkan mempunyai perbedaan yang perlu diteliti (${c.specWarnings.join('; ')}), sehingga selisih tersebut belum dapat dijadikan dasar pembanding yang setara.`;
  else if(!c.canCompare)sentences+=' Keterangan produk dan bukti harga masih perlu dicocokkan sebelum digunakan sebagai pembanding langsung.';
  else sentences+=' Harga tersebut menjadi bahan pertimbangan, dengan tetap memastikan kesamaan spesifikasi dan biaya pengiriman.';
 }
 if(f.chosenSpecWarnings?.length)sentences+=` Produk penyedia yang dipilih juga perlu dicocokkan dengan kebutuhan (${f.chosenSpecWarnings.join('; ')}).`;
 if(f.hpsDelta<0)sentences+=' Harga hasil negosiasi di atas HPS satuan memerlukan penjelasan tersendiri berdasarkan kondisi dan bukti yang sebenarnya.';
 return sentences.trim();
}
function exampleItemConclusion(f){
 const comparators=(f.offers||[]).filter(o=>o.supplier!==f.chosenName&&o.listed!==null);
 if(f.chosenValue===null)return 'Harga belum dapat dinilai karena hasil penawaran atau negosiasi belum lengkap.';
 if(f.hpsDelta<0)return 'Harga satuan melebihi HPS; alasan dan bukti pendukung perlu ditelaah sebelum dinyatakan dapat diterima.';
 if(!comparators.length)return 'Belum tersedia penawaran pembanding dalam paket ini; kewajaran harga perlu dipertimbangkan berdasarkan informasi harga lain yang tersedia.';
 if(comparators.some(o=>o.specWarnings?.length))return 'Penawaran pembanding berbeda produk atau ukuran; selisih harga tidak cukup untuk menyatakan barang telah sebanding.';
 return 'Harga dapat menjadi bahan pertimbangan setelah kesetaraan barang, biaya dan bukti harga dipastikan.';
}
function exampleItemNarratives(a){return `<div class="spha-example-narratives">${a.productFindings.map((f,i)=>{
 const own=f.offers.find(o=>o.supplier===f.chosenName);
 return `<article class="spha-example-item"><h4>${i+1}. ${escLocal(f.name)} — ${escLocal(f.qty)} ${escLocal(f.unit)}</h4>
 <p><b>Harga penawaran:</b> ${rpLocal(own?.listed)} per ${escLocal(f.unit||'satuan')} (${escLocal(f.chosenName||'penyedia belum ditentukan')}).</p>
 <p><b>Analisis:</b> ${escLocal(exampleItemAnalysis(f))}</p>
 <p><b>Kesimpulan:</b> ${escLocal(exampleItemConclusion(f))}</p></article>`;
 }).join('')}</div>`;}
function exampleEfficiency(a){
 const w=a.winner;
 return `<div class="spha-example-summary"><p>1. Total HPS paket: <b>${rpLocal(a.packet.hps)}</b>.</p><p>2. Nilai hasil negosiasi ${w?escLocal(w.name):'penyedia terpilih'} termasuk ongkos kirim: <b>${rpLocal(w?.negoTotal)}</b>${w?'': ' (belum tersedia nilai final)'}.</p><p>3. Selisih terhadap HPS: <b>${a.delta===null?'Belum dapat dihitung':`${rpLocal(Math.abs(a.delta))} atau ${fmtPercent(a.packet.hps?Math.abs(a.delta)/a.packet.hps*100:NaN)} ${a.delta>=0?'lebih rendah daripada HPS':'lebih tinggi daripada HPS'}`}</b>.</p></div><p>Selisih terhadap HPS menggambarkan perbedaan antara perkiraan biaya dan hasil negosiasi; bukan dengan sendirinya bukti bahwa seluruh harga satuan sudah wajar. Pajak atau ongkos kirim tidak ditambahkan dua kali apabila sudah termasuk dalam harga yang tercatat.</p>`;
}
function exampleConclusion(a,p){
 const who=a.winner?.name||'penyedia yang sedang dipertimbangkan';
 const history=validDate(p?.tglPenetapan)||validDate(p?.tglBahp)||!!a.winner;
 const intro=`Berdasarkan hasil perbandingan terhadap ${a.productFindings.length} jenis barang dan harga yang dicatat dari ${a.offers.length} penyedia, ${who} ${a.winner?'merupakan penyedia yang telah ditetapkan dalam catatan paket.':'masih memerlukan penetapan sesuai hasil evaluasi pengadaan.'}`;
 const value=a.winner?` Nilai hasil negosiasi ${rpLocal(a.winner.negoTotal)} ${a.delta!==null?(a.delta>=0?'lebih rendah':'lebih tinggi')+' dari HPS sebesar '+rpLocal(Math.abs(a.delta))+'.':''}`:'';
 const caution=`Perbedaan harga tersebut perlu disertai pemeriksaan kesamaan spesifikasi, satuan barang, pajak, biaya pengiriman, tanggal penawaran, dan bukti pendukung.`;
 const rec=history?'Kertas kerja ini digunakan untuk menjelaskan dasar pertimbangan harga pada paket yang telah dicatat, dengan mencocokkan kembali bukti pengadaan aslinya.':'Hasil perbandingan dapat digunakan sebagai bahan pertimbangan sebelum melanjutkan proses e-Purchasing, setelah kelengkapan dan kesesuaian produk dipastikan.';
 return `<ol class="spha-example-conclusion"><li>${escLocal(intro+value)}</li><li>${escLocal(caution)}</li><li>${escLocal(rec)}</li></ol><p class="spha-example-history">Dokumen ini disusun dari catatan yang tersedia pada tanggal penerbitan. Apabila pengadaan telah selesai, dokumen ini bukan bukti bahwa analisis yang sama telah disusun sebelum pelaksanaan transaksi.</p>`;
}
function documentHTML(p){
 const a=getAnalysis(p),stamp=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
 const datePlace=clean(O(p.opd)?.tempat)||'';
 return `<div class="spha-doc spha-audit-paper spha-example-paper" data-spha-document="true">
 ${typeof kop==='function'?kop(p):''}
 <p class="spha-doc-title">DOKUMEN ANALISIS KEWAJARAN HARGA E-PURCHASING</p>
 ${docIdentity(p)}
 <h3>I. LATAR BELAKANG</h3>
 <p>Analisis ini dibuat sebagai kertas kerja Pejabat Pengadaan untuk menilai kewajaran harga per barang pada pengadaan melalui Katalog Elektronik. Penilaian dilakukan dengan membandingkan harga yang ditawarkan, harga dari penyedia lain, HPS, dan hasil negosiasi, dengan memperhatikan kesesuaian kebutuhan serta manfaat penggunaan anggaran.</p>
 <h3>II. DAFTAR KEBUTUHAN BARANG</h3>${exampleNeedTable(a)}
 <h3>III. METODE REFERENSI DAN HARGA PEMBANDING</h3>${exampleProviders(a)}
 <h3>IV. TABEL ANALISIS BEDA HARGA PER ITEM</h3>${exampleCompareTable(a)}
 <h3>V. ANALISIS DAN PERTIMBANGAN KEWAJARAN HARGA</h3>${exampleItemNarratives(a)}
 <h3>VI. REKAPITULASI PROSES E-PURCHASING DAN EFISIENSI ANGGARAN</h3>${exampleEfficiency(a)}
 <h3>VII. KESIMPULAN DAN REKOMENDASI</h3>${exampleConclusion(a,p)}
 <div class="spha-conclusion"><div class="spha-sign"><p>${datePlace?escLocal(datePlace)+', ':''}${escLocal(stamp)}</p><p>Pejabat Pengadaan,</p><div class="spha-sign-space"></div><p><b>${escLocal(PJ(p.pp).nama||'Nama Pejabat Pengadaan belum dicatat')}</b></p><p>NIP. ${escLocal(PJ(p.pp).nip||'—')}</p></div></div>
 ${productPhotoAppendix(a)}
 </div>`;
}
function docChecks(p){const a=getAnalysis(p);return [
 {id:'rup',label:'Kode RUP tersedia',tab:'data',f:'rup',ok:!!p.rup},
 {id:'items',label:'Rincian barang dan HPS lengkap',tab:'rincian',f:null,ok:a.items.length>0&&a.items.every(i=>i.hpsUnit>0&&i.qty>0)},
 {id:'offers',label:'Penawaran penyedia tercatat',tab:'nego',f:null,ok:a.offers.length>0},
 {id:'prices',label:'Harga tayang semua item tercatat',tab:'nego',f:null,ok:a.offers.length>0&&a.offers.every(o=>o.fullTayang)},
 {id:'sources',label:'Harga produk dan tanggal pencatatan sumber sudah tersedia',tab:'nego',f:null,ok:a.offers.length>0&&a.offers.every(o=>o.detail.length>0&&o.detail.every(d=>d.listedUnit!==null&&d.refPrice!==null&&validDate(d.date)))},
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
