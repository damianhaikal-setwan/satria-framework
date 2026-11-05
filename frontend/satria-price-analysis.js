/* SATRIA NEXT 3.0.59.33 — Smart Analisis Kewajaran Harga & Audit Evidence.
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
   return {id:String(i.id),item:clean(i.nama),spec:clean(i.spesifikasi)||'Spesifikasi belum dirinci',qty:positive(i.vol)||0,unit:clean(i.satuan),hpsUnit:positive(i.hs)||0,listedUnit:list,negUnit:neg,refPrice,link,img,date,refName:clean(ref.name),refSpec:clean(ref.spec),refSeller:clean(ref.seller),source,sourceDate,evidenceOK,gaps};
  });
  const tayangTotal=fullTayang&&shippingValid?money(sum(detail.map(x=>x.listedUnit*x.qty))+shipping):null;
  const negoTotal=fullNego&&shippingValid?money(sum(detail.map(x=>x.negUnit*x.qty))+shipping):null;
  const completeEvidence=detail.length>0&&detail.every(x=>x.evidenceOK);
  const existsNego=detail.some(x=>x.negUnit!==null);
  if(!fullTayang)add('Sedang','OFFER_INCOMPLETE_'+w.id,`Harga tayang ${name} belum lengkap untuk seluruh barang`);
  if(existsNego&&!fullNego)add('Sedang','NEGO_PARTIAL_'+w.id,`Negosiasi ${name} belum lengkap; totalnya tidak diperlakukan sebagai total akhir`);
  if(!shippingValid)add('Sedang','SHIP_'+w.id,`Ongkir ${name} belum valid`);
  if(!completeEvidence)add('Sedang','EVIDENCE_'+w.id,`Bukti referensi ${name} masih perlu dilengkapi/diverifikasi`);
  if(negoTotal!==null&&H>0&&negoTotal>H)add('Tinggi','NEGO_HPS_'+w.id,`Total negosiasi ${name} melebihi total HPS`);
  if(negoTotal!==null&&pagu>0&&negoTotal>pagu)add('Tinggi','NEGO_PAGU_'+w.id,`Total negosiasi ${name} melebihi pagu`);
  if(detail.some(x=>x.negUnit!==null&&x.listedUnit!==null&&x.negUnit>x.listedUnit))add('Tinggi','NEGO_LIST_'+w.id,`Ada harga negosiasi ${name} melebihi harga tayang item`);
  return {id:String(w.id),supplierId:String(w.pen),name,source,sourceDate,shipping:shippingValid?shipping:null,detail,fullTayang,fullNego,tayangTotal,negoTotal,completeEvidence};
 });
 const itemStats=items.map(i=>{
  const refs=offersOut.map(o=>({offer:o,...o.detail.find(d=>d.id===String(i.id))}));
  const documented=refs.filter(x=>x.evidenceOK&&x.listedUnit!==null);
  const prices=documented.map(x=>x.listedUnit);
  return {id:String(i.id),name:clean(i.nama),spec:clean(i.spesifikasi)||'Spesifikasi belum dirinci',qty:positive(i.vol)||0,unit:clean(i.satuan),hpsUnit:positive(i.hs)||0,documented:documented.length,recorded:refs.filter(x=>x.listedUnit!==null).length,min:prices.length?Math.min(...prices):null,max:prices.length?Math.max(...prices):null,average:prices.length>=2?sum(prices)/prices.length:null,median:prices.length>=2?median(prices):null,refs};
 });
 const validWinnerId=clean(options.validWinnerId);
 const winner=validWinnerId?offersOut.find(o=>o.id===validWinnerId&&o.negoTotal!==null)||null:null;
 if(p?.pemenangId&&!winner)add('Tinggi','WINNER_NOT_VALID','Penetapan tercatat, tetapi penyedia pemenang belum lolos validasi aplikasi saat ini');
 if(!winner)add('Sedang','NO_VALID_WINNER','Belum ada penetapan valid yang dapat dijadikan nilai akhir analisis');
 const documentedCount=offersOut.reduce((n,o)=>n+o.detail.filter(d=>d.evidenceOK).length,0);
 const evidenceTotal=items.length*offersOut.length;
 const comparativeItems=itemStats.filter(i=>i.documented>=2).length;
 if(itemStats.some(x=>x.documented<2))add('Sedang','REFERENCE_INSUFFICIENT','Ada item dengan kurang dari dua referensi bertaut dan lengkap untuk pembanding statistik; cek kebutuhan referensi sesuai kondisi pengadaan');
 const assessment= !items.length||!offers.length?'Data belum cukup untuk analisis':
   documentedCount===0?'Belum ada referensi item yang memenuhi pemeriksaan metadata':'Analisis angka indikatif — kesetaraan spesifikasi dan keaslian bukti harus diperiksa';
 const delta=winner&&H>0?money(H-winner.negoTotal):null;
 return {packet:{id:String(p?.id||''),rup:clean(p?.rup),name:clean(p?.nama),tahun:p?.tahun,opd:p?.opd,pagu,hps:H,tglSurvei:clean(p?.tglSurvei),tglNego:clean(p?.tglNego),tglPenetapan:clean(p?.tglPenetapan)},offers:offersOut,items:itemStats,issues,winner,delta,referenceCount:documentedCount,evidenceTotal,comparativeItems,assessment};
}
const api={analyze,safeURL,validDate,median};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root)return;
root.SATRIA_PRICE_CORE=Object.freeze(api);
function escLocal(v){return typeof esc==='function'?esc(v):String(v).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
function rpLocal(v){return v===null||v===undefined?'—':rp(v);}
function fmtPercent(v){return Number.isFinite(v)?v.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':'—';}
function safeLink(url){const s=safeURL(url);return s?`<a target="_blank" rel="noopener noreferrer" href="${escLocal(s)}">${escLocal(s)}</a>`:'Belum ada URL';}
function getAnalysis(p){const names={};for(const y of S.penyedia||[])names[String(y.id)]=y.nama;const valid=pemenang(p);return analyze(p,{suppliers:names,validWinnerId:valid?.w?.id||''});}
function accessible(p){if(!p||satriaSpseIs(p)||Number(p.tahun)!==Number(S.ui.tahun)||(S.ui.opd!=='all'&&String(p.opd)!==String(S.ui.opd)))return false;const scope=activeCloudScope();return !scope||(scope.opdIds.includes(String(p.opd))&&scope.years.includes(Number(p.tahun)));}
function packetList(){return (S.paket||[]).filter(accessible);}
function available(p){return !!p&&packetList().some(x=>String(x.id)===String(p.id));}
function current(){const pid=String(S.ui.pid||'');return packetList().find(x=>String(x.id)===pid)||(!pid?packetList()[0]:null);}
function prettyDate(v){return validDate(v)?satriaDateId(v):escLocal(v||'—');}
function today(){return new Date().toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function changeLink(p,type='analisa'){return '#'+type+'/'+encodeURIComponent(p.id);}
function matrix(a){return `<div class="spha-scroll"><table class="spha-table"><thead><tr><th>Barang / Kebutuhan</th><th>Vol.</th><th>HPS satuan</th>${a.offers.map(o=>`<th>${escLocal(o.name)}<small>Harga tayang / Nego</small></th>`).join('')}<th>Statistik referensi tercatat</th></tr></thead><tbody>${a.items.map(i=>`<tr><td><b>${escLocal(i.name)}</b><small>${escLocal(i.spec)}</small></td><td class="n">${escLocal(i.qty)} ${escLocal(i.unit)}</td><td class="n">${rpLocal(i.hpsUnit)}</td>${i.refs.map(d=>`<td class="n"><b>${rpLocal(d.listedUnit)}</b><small>Nego ${rpLocal(d.negUnit)}</small><small>${d.evidenceOK?'✓ Metadata bukti lengkap':'⚠ Perlu verifikasi'}</small></td>`).join('')}<td class="n">${i.documented>=2?`Rata-rata ${rpLocal(i.average)}<small>Median ${rpLocal(i.median)}</small><small>Rentang ${rpLocal(i.min)}–${rpLocal(i.max)}</small>`:`${i.documented} referensi bermetadata lengkap<small>Belum cukup untuk rata-rata/median pembanding</small>`}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada rincian barang.</td></tr>'}</tbody></table></div>`;}
function resultTable(a){return `<div class="spha-scroll"><table class="spha-table"><thead><tr><th>Penyedia</th><th>Harga tayang + ongkir</th><th>Nego + ongkir</th><th>Keterangan</th><th>Bukti bertaut</th></tr></thead><tbody>${a.offers.map(o=>`<tr><td><b>${escLocal(o.name)}</b>${a.winner?.id===o.id?'<small>✓ Pemenang valid SATRIA</small>':''}</td><td class="n">${rpLocal(o.tayangTotal)}</td><td class="n">${rpLocal(o.negoTotal)}${!o.fullNego?'<small>Negosiasi belum lengkap</small>':''}</td><td>${o.fullTayang?'Harga tayang lengkap':'Harga belum lengkap'}<small>${escLocal(o.source||'Sumber belum ada')} · ${prettyDate(o.sourceDate)}</small></td><td>${o.detail.filter(x=>x.evidenceOK).length}/${o.detail.length}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada penawaran penyedia yang dicatat.</td></tr>'}</tbody></table></div>`;}
function evidenceTable(a){let idx=0;return `<div class="spha-scroll"><table class="spha-table"><thead><tr><th>No.</th><th>Barang</th><th>Penyedia</th><th>Referensi / tanggal</th><th>Harga bukti</th><th>Status & catatan</th></tr></thead><tbody>${a.offers.flatMap(o=>o.detail.map(d=>`<tr><td>${++idx}</td><td>${escLocal(d.item)}<small>${escLocal(d.refName||'Produk belum diberi nama pada referensi')}</small></td><td>${escLocal(o.name)}</td><td>${safeLink(d.link)}<small>${prettyDate(d.date)}${d.img?` · <a target="_blank" rel="noopener noreferrer" href="${escLocal(d.img)}">Foto/tautan bukti</a>`:''}</small></td><td class="n">${rpLocal(d.refPrice)}</td><td>${d.evidenceOK?'Metadata lengkap • cek spesifikasi asli':'Perlu verifikasi'}${d.gaps.length?`<small>${escLocal(d.gaps.join('; '))}</small>`:''}<small>Kesesuaian spesifikasi belum dapat dinyatakan otomatis.</small></td></tr>`)).join('')||'<tr><td colspan="6">Bukti harga belum tersedia.</td></tr>'}</tbody></table></div>`;}
function narrative(a){const n=a.offers.length,comp=a.comparativeItems,w=a.winner,delta=a.delta;
 const base=`Analisis disusun secara otomatis dari ${n} penawaran dan ${a.items.length} rincian barang yang tercatat dalam SATRIA, dengan total HPS ${rpLocal(a.packet.hps)} serta pagu paket ${rpLocal(a.packet.pagu)}. Dari ${a.evidenceTotal} kombinasi barang–penyedia, ${a.referenceCount} memiliki metadata referensi bertaut yang memenuhi pemeriksaan dasar, dan ${comp} barang memiliki sedikitnya dua referensi bermetadata lengkap untuk perhitungan statistik indikatif.`;
 const status=w?`Penyedia yang saat ini lolos validasi penetapan SATRIA adalah ${w.name} dengan total hasil negosiasi termasuk ongkir ${rpLocal(w.negoTotal)}. ${delta===null?'':(delta>=0?'Nilai tersebut lebih rendah dari HPS sebesar ':'Nilai tersebut melebihi HPS sebesar ')+rpLocal(Math.abs(delta))+' ('+fmtPercent(a.packet.hps?Math.abs(delta)/a.packet.hps*100:NaN)+').'} `:'Tidak ada pemenang valid yang dapat digunakan sebagai nilai penetapan akhir pada laporan ini. ';
 const caveat='Perbandingan nominal tidak otomatis membuktikan kewajaran harga. Harga/PPN, ongkos kirim, volume, kesetaraan spesifikasi, waktu pengambilan data, keaslian referensi, dan kondisi pasar harus dicocokkan dengan bukti asli. Rata-rata dan median merupakan statistik indikatif dari harga yang tercatat dan tidak menjadi dasar tunggal penetapan pemenang.';
 return {base,status,caveat,conclusion:a.assessment+'; pemeriksaan bukti dan pertimbangan akhir dilakukan oleh Pejabat Pengadaan.'};}
function issueList(a){return `<div class="spha-warnings">${a.issues.length?a.issues.map(x=>`<div class="spha-warning ${x.level==='Tinggi'?'urgent':''}"><span>${x.level==='Tinggi'?'!':'i'}</span><div><b>${escLocal(x.level)}</b><p>${escLocal(x.text)}</p></div></div>`).join(''):'<p>Belum ada masalah struktural terdeteksi; pemeriksaan keaslian dan kesetaraan bukti tetap diperlukan.</p>'}</div>`;}
function barCompare(a){const max=Math.max(1,a.packet.hps,...a.offers.map(o=>o.negoTotal||o.tayangTotal||0));const rows=[{name:'HPS paket',value:a.packet.hps,color:'#7c3aed'},...a.offers.map(o=>({name:o.name,value:o.negoTotal??o.tayangTotal??0,color:o.negoTotal===null?'#94a3b8':'#0ea5e9',provisional:o.negoTotal===null}))];return `<div class="spha-bars">${rows.map(r=>`<div class="spha-bar"><div class="spha-bar-top"><b>${escLocal(r.name)}</b><span>${r.provisional?'Tayang (belum final) · ':''}${rpLocal(r.value)}</span></div><div class="spha-bar-rail"><i style="width:${r.value?Math.max(2,r.value/max*100):0}%;background:${r.color}"></i></div></div>`).join('')}</div>`;}
function summary(a){return `<section class="spha-summary"><div class="spha-metric"><span>HPS paket</span><b>${rpLocal(a.packet.hps)}</b></div><div class="spha-metric"><span>Penawaran tercatat</span><b>${a.offers.length}</b></div><div class="spha-metric"><span>Bukti referensi bermetadata lengkap</span><b>${a.referenceCount}/${a.evidenceTotal}</b></div><div class="spha-metric"><span>Nilai penetapan valid</span><b>${rpLocal(a.winner?.negoTotal)}</b></div></section>`;}
function page(){const p=current();if(!p)return `<section class="spha-page"><div class="card"><h2>Smart Analisis Kewajaran Harga</h2><p>Tidak ada paket e-Purchasing yang dapat diakses dalam tahun dan filter OPD saat ini.</p><a href="#paket">Kembali ke Paket Pengadaan</a></div></section>`;
 const a=getAnalysis(p),n=narrative(a),list=packetList();
 return `<section class="spha-page"><div class="spha-hero"><div><span class="spha-kicker">✦ SATRIA NEXT • SMART PRICE ANALYSIS</span><h2>Analisis harga otomatis.<br><em>Bukti tetap nomor satu.</em></h2><p>Ringkasan dan dokumen analisis per paket. Data dibaca dari Penawaran & Negosiasi, tanpa input ulang dan tanpa persetujuan berjenjang.</p><div class="spha-hero-tags"><span>TA ${escLocal(p.tahun)}</span><span>RUP ${escLocal(p.rup||'—')}</span><span>${escLocal(O(p.opd).singkat)}</span></div></div><div class="spha-hero-art">↗<small>PRICE<br>INSIGHT</small></div></div><div class="spha-toolbar"><label>Paket yang dianalisis<select data-spha-select>${list.map(q=>`<option value="${escLocal(q.id)}" ${q.id===p.id?'selected':''}>${escLocal(q.rup||'—')} · ${escLocal(q.nama)}</option>`).join('')}</select></label><a class="spha-btn muted" href="#paket/${encodeURIComponent(p.id)}">Kembali ke paket</a><button type="button" class="spha-btn" data-spha-action="document" data-pid="${escLocal(p.id)}">Pratinjau dokumen & PDF</button></div>${summary(a)}<div class="spha-two"><section class="spha-card"><div class="spha-cardhead"><h3>Perbandingan total paket</h3><span>Harga lengkap</span></div>${barCompare(a)}<p class="spha-hint">Harga termasuk ongkir tercatat. Negosiasi parsial tidak dihitung sebagai total akhir. Nilai PPN tidak ditambahkan lagi dari harga bruto.</p></section><section class="spha-card"><div class="spha-cardhead"><h3>Kesimpulan sementara</h3><span>Perlu verifikasi</span></div><div class="spha-assessment">${escLocal(a.assessment)}</div><p>${escLocal(n.status)}</p><p class="spha-hint">${escLocal(n.caveat)}</p></section></div><section class="spha-card"><h3>Matriks harga per barang</h3><p>Statistik referensi hanya dihitung dari harga dengan metadata sumber yang memenuhi pemeriksaan dasar; kesetaraan spesifikasi tetap perlu diteliti.</p>${matrix(a)}</section><section class="spha-card"><h3>Rekap penawaran dan negosiasi</h3>${resultTable(a)}</section><section class="spha-card"><h3>Audit evidence • daftar referensi</h3><p>Tautan dan tanggal berasal dari catatan Smart Survey; SATRIA tidak menciptakan screenshot atau tanggal bukti baru.</p>${evidenceTable(a)}</section><section class="spha-card"><h3>Data yang memerlukan perhatian</h3>${issueList(a)}</section><div class="spha-foot">Laporan ini dihitung dari data yang tersedia saat dibuka. Untuk kebutuhan BPK, cocokkan URL/screenshot dan bukti asli; hasil otomatis bukan penilaian final kewajaran atau pengesahan transaksi.</div></section>`;
}
function documentHTML(p){const a=getAnalysis(p),n=narrative(a),stamp=today();return `<div class="spha-doc" data-spha-document="true">${typeof kop==='function'?kop(p):''}<p style="text-align:center;font-weight:bold;text-decoration:underline;font-size:14px">LAPORAN ANALISIS KEWAJARAN HARGA DAN REFERENSI HARGA</p><p style="text-align:center">Bahan dokumentasi/pemeriksaan per paket e-Purchasing<br><b>Dibuat dari data SATRIA pada ${escLocal(stamp)}</b></p><h3>I. Identitas Paket</h3><table class="spha-doc-info"><tbody><tr><th>Kode RUP</th><td>${escLocal(p.rup||'—')}</td><th>Tahun</th><td>${escLocal(p.tahun)}</td></tr><tr><th>Nama paket</th><td colspan="3">${escLocal(p.nama||'—')}</td></tr><tr><th>OPD</th><td colspan="3">${escLocal(O(p.opd).nama)}</td></tr><tr><th>Pagu paket</th><td>${rpLocal(a.packet.pagu)}</td><th>Total HPS</th><td>${rpLocal(a.packet.hps)}</td></tr><tr><th>Tanggal survei (catatan)</th><td>${prettyDate(p.tglSurvei)}</td><th>Tanggal negosiasi (catatan)</th><td>${prettyDate(p.tglNego)}</td></tr></tbody></table><h3>II. Metode dan Batasan Analisis</h3><p>Perbandingan otomatis menghitung harga tayang bruto per satuan dikalikan volume, harga negosiasi bruto bila semua item telah diisi, serta ongkos kirim yang tercatat. HPS dibandingkan sebagai nominal paket. Rata-rata/median hanya ditampilkan ketika sedikitnya dua referensi memiliki metadata minimum yang lengkap. Pemeriksaan metadata bukan verifikasi hukum, keaslian, atau kesetaraan spesifikasi.</p><h3>III. Rekap Harga Penyedia</h3>${resultTable(a)}<h3>IV. Matriks Harga Per Item</h3>${matrix(a)}<h3>V. Daftar Referensi dan Bukti Harga</h3><p>Tautan di bawah adalah alamat yang disimpan pada survei, bukan salinan arsip/screenshot. Simpan dan lampirkan bukti asli secara terpisah sesuai permintaan pemeriksa.</p>${evidenceTable(a)}<h3>VI. Hasil Analisis Otomatis</h3><p>${escLocal(n.base)}</p><p>${escLocal(n.status)}</p><p>${escLocal(n.caveat)}</p><h3>VII. Temuan dan Kelengkapan</h3><ol>${a.issues.map(x=>`<li><b>${escLocal(x.level)}:</b> ${escLocal(x.text)}</li>`).join('')||'<li>Tidak ada temuan struktural otomatis; periksa bukti asli dan kesetaraan spesifikasi secara manual.</li>'}</ol><h3>VIII. Kesimpulan Sementara</h3><p><b>${escLocal(n.conclusion)}</b></p><p><i>Laporan ini disusun pada tanggal yang tercantum dari catatan saat ini. Untuk paket historis, laporan ini bukan bukti bahwa analisis telah dilaksanakan sebelum transaksi. Tanggal sumber dan dokumen pendukung harus diperiksa secara terpisah.</i></p><div class="spha-sign"><p>Disusun untuk bahan telaah oleh Pejabat Pengadaan</p><p><b>${escLocal(PJ(p.pp).nama||'Nama Pejabat Pengadaan perlu diperiksa')}</b></p><p>NIP: ${escLocal(PJ(p.pp).nip||'—')}</p><p>Paraf/tanda tangan hanya setelah meninjau dan menyetujui isi laporan</p></div></div>`;}
function docChecks(p){const a=getAnalysis(p);return [
 {id:'rup',label:'Kode RUP tersedia',tab:'data',f:'rup',ok:!!p.rup},
 {id:'items',label:'Rincian barang dan HPS lengkap',tab:'rincian',f:null,ok:a.items.length>0&&a.items.every(i=>i.hpsUnit>0&&i.qty>0)},
 {id:'offers',label:'Penawaran penyedia tercatat',tab:'nego',f:null,ok:a.offers.length>0},
 {id:'prices',label:'Harga tayang semua item tercatat',tab:'nego',f:null,ok:a.offers.length>0&&a.offers.every(o=>o.fullTayang)},
 {id:'sources',label:'Bukti harga per item memiliki URL/tanggal/harga yang konsisten',tab:'nego',f:null,ok:a.evidenceTotal>0&&a.referenceCount===a.evidenceTotal},
 {id:'technical',label:'Kewajaran/kesetaraan spesifikasi perlu peninjauan manual',tab:'nego',f:null,ok:false}
 ];}
function showDoc(p){if(!available(p))return false;S.ui.dpid=String(p.id);S.ui.dok='analisa';S.ui.pid=null;S.ui.page='dok';location.hash='#dok';render();return true;}
root.SATRIA_PRICE_ANALYSIS=Object.freeze({page,getAnalysis,analyze,documentHTML,docChecks,showDoc});
// Extend the EXISTING document studio instead of making a second print engine.
if(typeof DOCS!=='undefined')DOCS.analisa=documentHTML;
// The document and dashboard read only already-visible package data; events do not write to S.
document.addEventListener('click',function(e){const btn=e.target.closest?.('[data-spha-action]');if(!btn)return;const action=btn.dataset.sphaAction;if(!['document','open'].includes(action))return;e.preventDefault();e.stopImmediatePropagation();const pid=String(btn.dataset.pid||'');const p=packetList().find(x=>String(x.id)===pid);if(!p){toast('Paket tidak tersedia dalam hak akses dan filter tahun/OPD saat ini.');return;}if(action==='document'){showDoc(p);return;}location.hash=changeLink(p);},true);
document.addEventListener('change',function(e){const select=e.target.closest?.('[data-spha-select]');if(!select)return;const p=packetList().find(x=>String(x.id)===String(select.value));if(p)location.hash=changeLink(p);},true);
})(typeof window==='undefined'?null:window);
