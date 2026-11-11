

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const satriaSafeMediaSrc=value=>esc(window.SATRIA_CORE_GUARDS.imageSrc(value));
const nf=n=>Math.round(+n||0).toLocaleString('id-ID');
const rp=n=>'Rp '+nf(n);
/* SATRIA 3.0.59.18 — tanggal dokumen memakai zona tanggal lokal; tidak mengubah tanggal sumber. */
function satriaDateId(value, weekday=false){
 const raw=String(value??'').trim();if(!raw)return '-';
 const m=/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw);
 if(!m)return raw; // Bukan ISO, biarkan data sumber tampil untuk diperiksa, jangan mengarang.
 const y=+m[1],mon=+m[2],day=+m[3],d=new Date(y,mon-1,day,12);
 if(d.getFullYear()!==y||d.getMonth()!==mon-1||d.getDate()!==day)return raw;
 const label=d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
 return weekday?d.toLocaleDateString('id-ID',{weekday:'long'})+', '+label:label;
}
const tg=d=>satriaDateId(d,true);
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const NUMF=['vol','hs','pagu','masaHk','seq'];
const sum=(a,f)=>a.reduce((s,x)=>s+(+f(x)||0),0);
const P=id=>S.paket.find(p=>p.id===id);
const O=id=>S.opd.find(o=>o.id===id)||{nama:'-',singkat:'-',unit:'',bidang:'',alamat:''};
const PJ=id=>S.pejabat.find(x=>x.id===id)||{nama:'-',nip:'-'};
const PY=id=>S.penyedia.find(y=>y.id===id)||{nama:'(penyedia dihapus)'};
const kodeNama=c=>(S.kode.find(k=>k.kode===c)||{nama:c}).nama;
const hps=p=>window.SATRIA_PROCUREMENT_CORE.hpsTotal(p);
// Pecahan bruto per unit (mis. 498,39) dipertahankan hingga penjumlahan total,
// baru total penawaran dibulatkan ke rupiah. Harga lama integer tidak berubah.
const totPw=(p,w,nego=false)=>window.SATRIA_PROCUREMENT_CORE.offerGoodsTotal(p,w,nego);
/* SATRIA 3.0.59.52 — batas total HPS dan pagu; harga item di atas HPS
   ditandai untuk penilaian kewajaran tanpa mekanisme persetujuan tambahan.
   Catatan review historis lama dipertahankan sebagai arsip opsional. */
/* 3.0.59.25 — Draf review tidak boleh hilang akibat render global.
   Draf hanya disimpan selama sesi tab; baru menjadi catatan transaksi setelah Simpan. */
const satriaHpsReviewDrafts=new Map();
function satriaHpsReviewKey(pid,wid){return JSON.stringify([String(pid),String(wid)]);}
function satriaHpsReviewFields(p,w){
 const draft=satriaHpsReviewDrafts.get(satriaHpsReviewKey(p.id,w.id));
 return draft||{reason:String(w.hpsTotalReview?.reason||''),evidence:String(w.hpsTotalReview?.evidence||''),accepted:false};
}
function satriaHpsReviewCapture(panel){
 if(!panel)return;
 const pid=panel.getAttribute('data-hps-review-pid'),wid=panel.getAttribute('data-hps-review-wid');
 if(!pid||!wid)return;
 satriaHpsReviewDrafts.set(satriaHpsReviewKey(pid,wid),{
   reason:panel.querySelector('[data-hps-review-reason]')?.value||'',
   evidence:panel.querySelector('[data-hps-review-evidence]')?.value||'',
   accepted:!!panel.querySelector('[data-hps-review-check]')?.checked
 });
}
function satriaNegoAboveUnit(p,w){
 return (p.items||[]).filter(i=>Number(w?.nego?.[i.id]||0)>Number(i.hs||0));
}
// Sumber pada penawaran adalah tautan toko milik penyedia dari Data Master.
// URL produk tetap berada di catalogRefs[itemId].link, tidak boleh dijadikan URL toko.
function satriaOfferSupplierCatalogLink(w){
 const pen=(S.penyedia||[]).find(y=>String(y.id)===String(w?.pen));
 return String(pen?.link||'').trim();
}
function satriaOfferPriceSource(w){
 const supplierLink=satriaOfferSupplierCatalogLink(w);
 if(supplierLink)return supplierLink;
 const stored=String(w?.sumberHarga||'').trim();
 // Data lama bisa berisi URL produk yang disalin otomatis oleh Smart Survey.
 // Jangan tampilkan URL produk sebagai tautan toko bila Data Master belum dilengkapi.
 if(stored&&Object.values(w?.catalogRefs||{}).some(ref=>String(ref?.link||'').trim()===stored))return '';
 return stored;
}
function satriaNegoReviewFingerprint(p,w){
 return JSON.stringify({paket:String(p.id),pagu:Number(p.pagu||0),ongkir:Number(w.ongkir||0),tanggalNego:String(p.tglNego||''),sumberHarga:satriaOfferPriceSource(w),tanggalHarga:String(w.tanggalHarga||''),
  rincian:(p.items||[]).map(i=>[String(i.id),Number(i.vol||0),Number(i.hs||0),Number(w.nego?.[i.id]||0),Number(w.harga?.[i.id]||0)])});
}
function satriaNegoReviewValid(p,w){
 const r=w?.hpsTotalReview;
 return !!(r&&r.mode==='historical-total'&&typeof r.reason==='string'&&r.reason.trim().length>=15&&
  typeof r.evidence==='string'&&r.evidence.trim().length>=5&&typeof r.recordedAt==='string'&&
  r.fingerprint===satriaNegoReviewFingerprint(p,w));
}
function evalPw(p){
 const H=hps(p);
 return (p.penawaran||[]).map(w=>{
  const items=p.items||[];
  const lengkap=items.length>0&&items.every(i=>Number.isFinite(+w.harga?.[i.id])&&+w.harga[i.id]>0);
  const negoCount=items.filter(i=>w.nego&&w.nego[i.id]!=null&&w.nego[i.id]!==''&&Number.isFinite(+w.nego[i.id])&&+w.nego[i.id]>0).length;
  const negoLengkap=items.length>0&&negoCount===items.length,negoAda=negoCount>0;
  const ongkir=Number(w.ongkir||0),shipping=Number.isFinite(ongkir)&&ongkir>=0?ongkir:0;
  const tayang=totPw(p,w,false)+shipping,t=totPw(p,w,true)+shipping;
  const over=satriaNegoAboveUnit(p,w).length>0;
  let st;
  if(negoAda&&!negoLengkap)st='Negosiasi parsial';
  else if(!lengkap)st='Harga tayang belum lengkap';
  else if(!(tayang>0))st='Belum diisi';
  else if(negoLengkap){
   if(t>H)st='Gugur (> Total HPS)';
   else if(Number(p.pagu)>0&&t>Number(p.pagu))st='Gugur (> Pagu)';
   else if(items.some(i=>Number(w.nego?.[i.id]||0)>Number(w.harga?.[i.id]||0)))st='Gugur (nego > tayang)';
   else if(over)st='Memenuhi batas total HPS • periksa kewajaran satuan';
   else st='Memenuhi HPS — hasil negosiasi';
  }else st='Harga tayang tercatat — menunggu negosiasi';
  return{w,t,tayang,st,lengkap,negoAda,negoLengkap,negoCount};
 });
}
function kandidat(p){
 return evalPw(p).filter(e=>e.lengkap&&e.tayang>0&&(!e.negoAda||e.negoLengkap)&&
  (e.negoLengkap?e.t:e.tayang)<=hps(p)&&(!(Number(p.pagu)>0)||(e.negoLengkap?e.t:e.tayang)<=Number(p.pagu))&&
  (!e.negoLengkap||(p.items||[]).every(i=>Number(e.w.nego?.[i.id]||0)<=Number(e.w.harga?.[i.id]||0))))
 .sort((a,b)=>(a.negoLengkap?a.t:a.tayang)-(b.negoLengkap?b.t:b.tayang))[0]||null;
}
function satriaOfferGate(p,e){
 const errors=[];if(!e)return {ready:false,errors:['Penawaran tidak ditemukan']};
 if(!(p.items||[]).length)errors.push('Rincian HPS belum ada');
 if((p.items||[]).some(i=>!(Number(i.vol)>0)||!(Number(i.hs)>0)))errors.push('Volume atau HPS satuan tidak valid');
 if(!e.lengkap)errors.push('Harga tayang belum lengkap');
 if(!e.negoLengkap)errors.push('Negosiasi '+e.negoCount+'/'+(p.items||[]).length+' item');
 if(!(e.t>0))errors.push('Total negosiasi tidak valid');
 if(e.t>hps(p))errors.push('Total hasil negosiasi melebihi total HPS paket');
 if(Number(p.pagu)>0&&e.t>Number(p.pagu))errors.push('Total hasil negosiasi melebihi pagu paket');
 if((p.items||[]).some(i=>{const listed=Number(e.w.harga?.[i.id])||0,gross=Number(e.w.nego?.[i.id])||0;return gross>0&&listed>0&&gross>listed}))errors.push('Ada harga akhir negosiasi per unit melebihi harga tayang');
 if(!p.tglNego)errors.push('Tanggal negosiasi belum diisi');
 if(!satriaOfferPriceSource(e.w)||!e.w.tanggalHarga)errors.push('Sumber dan tanggal harga belum lengkap');
 if(!Number.isFinite(Number(e.w.ongkir||0))||Number(e.w.ongkir||0)<0)errors.push('Ongkos kirim harus angka tidak negatif');
 const over=satriaNegoAboveUnit(p,e.w);
 // Di atas HPS satuan adalah indikator kewajaran, bukan persetujuan tambahan.
 // Batas total HPS, pagu dan kelengkapan tetap dijaga. Riwayat review lama tidak dihapus.
 return {ready:errors.length===0,errors,unitPriceWarnings:over.map(i=>({id:i.id,nama:i.nama,hps:i.hs,nego:e.w.nego?.[i.id]})),needsReview:false,reviewed:!!over.length&&satriaNegoReviewValid(p,e.w)};
}
function pemenang(p){if(!p.pemenangId)return null;const e=evalPw(p).find(x=>x.w.id===p.pemenangId);return satriaOfferGate(p,e).ready?e:null}
const kontrak=p=>{const w=pemenang(p);return w?w.t:0};
function stt(p){if(!p.items.length)return'Draf';if(!p.penawaran.length)return'Survei';if(!p.tglDpp)return'Siap DPP';if(!pemenang(p))return'Perlu evaluasi/negosiasi';if(!p.tglBahp)return'Menunggu BA Hasil';if(!p.tglSppbj)return'Menunggu SPPBJ';return'Selesai'}
function terb(n){n=Math.floor(+n||0);const a=['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
const f=x=>x<12?a[x]:x<20?f(x-10)+' belas':x<100?f(Math.floor(x/10))+' puluh'+(x%10?' '+f(x%10):''):x<200?'seratus'+(x%100?' '+f(x%100):''):x<1000?f(Math.floor(x/100))+' ratus'+(x%100?' '+f(x%100):''):x<2000?'seribu'+(x%1000?' '+f(x%1000):''):x<1e6?f(Math.floor(x/1000))+' ribu'+(x%1000?' '+f(x%1000):''):x<1e9?f(Math.floor(x/1e6))+' juta'+(x%1e6?' '+f(x%1e6):''):f(Math.floor(x/1e9))+' miliar'+(x%1e9?' '+f(x%1e9):'');
return (n===0?'nol':f(n))+' rupiah'}

/* ===== DATA DEMO SINTETIS =====
   Seluruh identitas, alamat, RUP, akun, dan nilai pada seed ini adalah placeholder.
   Jangan gunakan data demo ini sebagai transaksi atau dokumen resmi. */
const SEED={
pemda:{nama:'INSTANSI PEMERINTAH DEMO',kota:'Kota Contoh',provinsi:'Provinsi Contoh',sumber:'Dana Simulasi'},
tahun:[2026],
penomoran:{NODIS:'NODIS',PPBJ:'PPBJ',DPP:'DPP',BAHR:'BAHR-DPP',BAHEPE:'BAHEPE',BAHP:'BAHP',KKNEGO:'KKNEGO'},
meta:{program:'Program Demo',kegiatan:'Kegiatan Simulasi',rekening:'REKENING-DEMO - Data contoh, bukan rekening nyata',output:'Output simulasi untuk demonstrasi aplikasi'},
users:[{id:'demo-admin',nama:'Admin Demo',username:'demo',role:'Admin',opd:'all',aktif:true}],
akun:[{id:'akun-demo',kode:'REKENING-DEMO',nama:'Rekening contoh (bukan rekening nyata)',link:''}],
unit:[{id:'unit-demo',opd:'o1',kode:'UNIT-DEMO',bidang:'Unit Contoh'}],
opd:[{id:'o1',nama:'Organisasi Perangkat Daerah Demo',singkat:'OPD DEMO',alamat:'Alamat Contoh, Indonesia',kontak:'Kontak contoh',tempat:'Lokasi contoh untuk demonstrasi.'}],
pejabat:[
{id:'p1',opd:'o1',peran:'PPK',nama:'Nama Pejabat Demo 1',nip:'000000000000000000'},
{id:'p2',opd:'o1',peran:'PP',nama:'Nama Pejabat Demo 2',nip:'000000000000000000'},
{id:'p3',opd:'o1',peran:'Kabid',nama:'Nama Pejabat Demo 3',nip:'000000000000000000'}],
penyedia:[
{id:'y1',nama:'Penyedia Contoh 1',alamat:'Alamat Contoh',bentuk:'Badan Usaha Demo',status:'Aktif',tipe:'Perlu verifikasi',link:''},
{id:'y2',nama:'Penyedia Contoh 2',alamat:'Alamat Contoh',bentuk:'Perorangan Demo',status:'Aktif',tipe:'Perlu verifikasi',link:''}],
kode:[{id:'KODE-DEMO-001',kode:'KODE-DEMO-001',nama:'Kegiatan Simulasi'}],
paket:[{id:'k1',tahun:2026,opd:'o1',unit:'unit-demo',seq:1,nama:'PAKET DEMO — JANGAN DIGUNAKAN UNTUK TRANSAKSI',rup:'DEMO-RUP-0001',pagu:1000000,sumber:'Dana Simulasi',sub:'KODE-DEMO-001',ppk:'p1',pp:'p2',kabid:'p3',masaHk:7,tglNodis:'',tglDpp:'',tglBahp:'',tglSppbj:'',batas:'',pemenangId:null,lokasiPengiriman:'Lokasi Contoh',jenisPengadaan:'Barang (Simulasi)',metodePemilihan:'Metode Simulasi',tglSurvei:'',tglNego:'',tglPenetapan:'',tglEvaluasi:'',items:[{id:'i1',nama:'Barang Contoh',spesifikasi:'Spesifikasi simulasi',merek:'Contoh',pdn:'Perlu verifikasi',linkProduk:'',vol:1,satuan:'Unit',hs:100000}],penawaran:[]}]
};
let S;
function init(){S=JSON.parse(JSON.stringify(SEED));S.rupBank=[];S.sampah=[];normalizeData();S.ui={page:'dash',tahun:S.tahun[0],opd:'all',pid:null,dpid:'k1',dok:'nodis',ptab:'data',mtab:'ppk'};S.log=[];S.dirty=false;S.chat=[];S.chatCtx=null;S.ui.user=S.users[0].id}

/* SATRIA 2026-11-02 — guard identitas resmi: nilai SEED/demo tidak boleh menjadi identitas dokumen.
   Tidak mengubah state, snapshot cloud, atau data historis yang disimpan. */
function satriaIdentityPlaceholder(value){
 const v=String(value??'').trim();
 return !v||/\b(?:demo|contoh|dummy|simulasi|testing)\b/i.test(v)||/^instansi pemerintah\b/i.test(v);
}
function satriaPemdaOfficial(field){
 const v=String(S?.pemda?.[field]??'').trim();
 return satriaIdentityPlaceholder(v)?'':v;
}
function satriaMasterScopeName(){
 if(S?.ui?.opd&&S.ui.opd!=='all'){
  const o=(S.opd||[]).find(x=>String(x.id)===String(S.ui.opd));
  if(o&&!satriaIdentityPlaceholder(o.nama))return o.singkat||o.nama;
 }
 return satriaPemdaOfficial('nama')||'Semua OPD — identitas Pemda belum diatur';
}
/* ===== FILTER & SINKRONISASI ANTAR MENU ===== */
function activeCloudScope(){
  if(!window.SATRIA_CLOUD_CONFIGURED||!window.SATRIA_CLOUD_ROLE||window.SATRIA_CLOUD_ROLE==='admin') return null;
  const user=(S?.users||[]).find(x=>x.id===S?.ui?.user)||(S?.users||[])[0];
  return {
    opdIds:Array.isArray(user?.opd)?user.opd.map(String):[],
    years:Array.isArray(user?.years)?user.years.map(Number).filter(Number.isFinite):[]
  };
}
const filt=(t=S.ui.tahun)=>{
  const year=Number(t),scope=activeCloudScope();
  if(!Number.isFinite(year)) return [];
  if(scope&&(!scope.years.includes(year)||!scope.opdIds.length)) return [];
  return (S.paket||[]).filter(p=>!satriaSpseIs(p)&&(S.ui.plife==='arsip'?!!p.arsip:!p.arsip)&&Number(p.tahun)===year&&(S.ui.opd==='all'||String(p.opd)===String(S.ui.opd))&&(!scope||scope.opdIds.includes(String(p.opd))));
};
const MOD={paket:['Ringkasan Utama','Dokumen terkait'],pagu:['Ringkasan Utama','Dokumen Pengadaan','Nota Dinas','Laporan dan Analisis'],items:['Ringkasan Utama','Nota Dinas','DPP','SPPBJ','BA Hasil'],nego:['Ringkasan Utama','BA Hasil','Laporan dan Analisis'],pemenang:['Ringkasan Utama','SPPBJ','BA Hasil','Laporan dan Analisis'],settings:['Kop semua dokumen'],master:['Form Paket Pengadaan','Dokumen Pengadaan']};
function sync(k,label){S.dirty=true;persistRevision++;S.persistError='';S.log.unshift({t:new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),label,mods:MOD[k]||['Data aplikasi']});S.log=S.log.slice(0,25);toast('Perubahan dicatat: '+((MOD[k]||['Data aplikasi']).join(', ')));if(typeof window.SATRIA_AUTO_SYNC_REQUEST==='function')window.SATRIA_AUTO_SYNC_REQUEST(k,label)}
function toast(m){const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2600)}

/* ===== TAMPILAN ===== */

/* SATRIA 3.0.46 — Kalkulator Negosiasi e-Katalog per barang. Semua nilai rupiah = unit. */
const KN_TAX={effective11:{name:'Efektif 11% (contoh golongan 12%, DPP nilai lain)',rate:.11},rate12:{name:'PPN 12% penuh',rate:.12},zero:{name:'Tanpa PPN',rate:0},custom:{name:'Nominal pajak per unit (manual)',rate:null}};
const KN={pid:'',wid:'',basis:'both',rows:{},scope:'',source:'',refDate:'',negDate:'',warn:'',lastSaved:null};
const knIdr=n=>rp(Number.isFinite(n)?n:0);
const knRoundCents=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const knUnitNum=n=>Number(n||0).toLocaleString('id-ID',{maximumFractionDigits:2});
const knIdrUnit=n=>'Rp '+knUnitNum(n);
const knNum=v=>{let s=String(v??'').trim().replace(/[^\d.,-]/g,'');if(!s||s.startsWith('-'))return 0;const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.'),last=Math.max(comma,dot);const tail=last>=0?s.slice(last+1):'';const decimal=last>=0&&tail.length>0&&tail.length<=2;const whole=decimal?s.slice(0,last):s;const digits=whole.replace(/\D/g,'');const cents=decimal?Number('0.'+tail):0;const n=(digits?Number(digits):0)+cents;return Number.isSafeInteger(Math.round(n))?Math.round(n):Number.NaN};
const knStr=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const knIso=()=>new Date().toLocaleDateString('en-CA');
function knProfile(ref){const k=ref?.taxMode;if(k==='effective11'||k==='rate12'||k==='zero'||k==='custom')return k;return 'effective11'}
function knGross(base,mode,taxManual){const n=Math.round(Number(base)||0);return knRoundCents(n+(mode==='custom'?Math.round(Number(taxManual)||0):n*(KN_TAX[mode]?.rate||0)))}
function knOffer(){const p=P(KN.pid);const w=p?.penawaran?.find(x=>x.id===KN.wid);return {p,w};}
function knSetup(){const {p,w}=knOffer();const key=p?.id+'|'+w?.id;if(KN.scope===key)return;KN.scope=key;KN.rows={};KN.source=satriaOfferPriceSource(w);KN.refDate=w?.tanggalHarga||'';KN.negDate=p?.tglNego||'';KN.warn='';if(!p||!w)return;
 for(const it of p.items||[]){const ref=w.catalogRefs?.[it.id]||{},details=w.negoDetails?.[it.id]||{},taxMode=KN_TAX[details.taxMode]?details.taxMode:knProfile(ref);const gross=Math.max(0,Number(w.harga?.[it.id])||Number(ref.displayPrice)||0);const saved=Number(w.nego?.[it.id])||0;
 const validRef=Number(ref.beforeTax)>0&&Number(ref.taxAmount)>=0&&Math.abs(Number(ref.beforeTax)+Number(ref.taxAmount)-gross)<=1;
 const initialBase=validRef?Math.round(Number(ref.beforeTax)):gross?Math.round(gross/(1+(KN_TAX[taxMode]?.rate||0))):0;
 const priorNet=details.beforeTax||ref.negotiatedBase,priorTax=details.tax??ref.negotiatedTax;const oldBase=Number(priorNet)>0&&Number(priorTax)>=0&&Math.abs(Number(priorNet)+Number(priorTax)-saved)<=1?Math.round(Number(priorNet)):0;
 KN.rows[it.id]={display:gross?String(gross):'',displayBasis:'inclusive',sourceBase:initialBase,sourceExact:validRef,negoBase:oldBase?String(oldBase):'',taxMode,manualTax:taxMode==='custom'?String(Math.max(0,Number(details.tax??ref.negotiatedTax)||0)):'',saved,dirty:false,ref};
 }
}

/* SATRIA 3.0.46 — pagu-constrained e-Katalog proposal; never treats net as gross. */
function knDisplayGross(d){
 const input=knNum(d.display);
 if(!Number.isSafeInteger(input)||input<=0)return 0;
 if(d.displayBasis==='beforeTax')return knGross(input,d.taxMode,d.taxMode==='custom'?knNum(d.ref?.taxAmount||0):0);
 return input;
}
function knMaxBase(ceiling,mode,manualTax){
 if(!Number.isSafeInteger(ceiling)||ceiling<0)return 0;
 let lo=0,hi=ceiling,answer=0;
 while(lo<=hi){const middle=Math.floor((lo+hi)/2),gross=knGross(middle,mode,manualTax);
  if(gross<=ceiling){answer=middle;lo=middle+1}else hi=middle-1;}
 return answer;
}
function knSuggestionPlan(rows,p,w){
 const pagu=Math.round(Number(p.pagu)||0),hpsTotal=Math.round(hps(p)),ongkir=Math.max(0,Math.round(Number(w.ongkir)||0));
 const available=pagu-ongkir;
 const errors=[];
 if(!Number.isSafeInteger(pagu)||pagu<=0)errors.push('Pagu paket belum valid.');
 if(!Number.isSafeInteger(hpsTotal)||hpsTotal<=0)errors.push('Total HPS belum tersedia.');
 if(available<=0)errors.push('Pagu tidak mencukupi biaya pengiriman.');
 if(rows.some(x=>!Number.isFinite(x.qty)||x.qty<=0||!Number.isFinite(Number(x.it.hs))||Number(x.it.hs)<=0))errors.push('Ada volume atau HPS satuan yang belum valid.');
 const valid=!errors.length,ratio=valid?Math.min(1,available/hpsTotal):0;
 const items={};let total=ongkir,complete=valid;
 for(const x of rows){
  const hs=Math.floor(Number(x.it.hs)||0);
  const proportional=valid?Math.floor(hs*ratio):0;
  const cap=valid?Math.max(0,Math.min(hs,proportional,x.display>0?x.display:hs)):0;
  const manual=x.d.taxMode==='custom'?knNum(x.d.manualTax):0;
  const manualMissing=x.d.taxMode==='custom'&&String(x.d.manualTax)==='';
  const base=valid&&!manualMissing?knMaxBase(cap,x.d.taxMode,manual):0;
  const gross=base>0?knGross(base,x.d.taxMode,manual):0;
  const tax=gross-base;
  const rowReady=valid&&!manualMissing&&base>0&&gross<=hs&&gross<=cap&&gross>0;
  const subtotal=rowReady?gross*x.qty:0;
  if(!rowReady)complete=false;
  total+=subtotal;
  items[x.it.id]={hs,cap,base,gross,tax,subtotal,ready:rowReady,manualMissing,ratio};
 }
 if(valid&&total>pagu)errors.push('Pembulatan harga tidak memenuhi pagu; periksa kuantitas pecahan.');
 if(valid&&total>hpsTotal+ongkir)errors.push('Total usulan melebihi HPS barang ditambah ongkir.');
 return {ready:complete&&!errors.length,ratio,pagu,hpsTotal,ongkir,available,total:Math.round(total),items,errors};
}
function knSuggestionHtml(x){
 const a=x.suggestion;if(!a)return '';
 const message=!a.ready?(a.manualMissing?'Isi nominal PPN manual dahulu.':'HPS, pagu, volume atau pajak belum memungkinkan usulan harga.'):
 `Batas harga akhir/unit: ${knIdr(a.cap)}. Hasil tawaran ${knIdrUnit(a.gross)} sudah termasuk pajak dan tidak melampaui HPS satuan.`;
 return `<div class="kn45-suggestion" data-kn-suggestion="${knStr(x.it.id)}">
 <div class="kn45-suggestion-head"><span>✦ SARAN TAWARAN BERDASARKAN HPS & PAGU</span><b>${a.ready?'Batas aman':'Perlu data'}</b></div>
 <div class="kn45-suggestion-grid"><div><small>Usulan tawaran SEBELUM PPN/unit</small><strong>${a.ready?knIdr(a.base):'—'}</strong></div><div><small>PPN/unit</small><strong>${a.ready?knIdrUnit(a.tax):'—'}</strong></div><div><small>Harga akhir/unit</small><strong>${a.ready?knIdrUnit(a.gross):'—'}</strong></div><div><small>Jumlah × volume</small><strong>${a.ready?knIdr(a.subtotal):'—'}</strong></div></div>
 <p>${knStr(message)}</p><button type="button" class="kn45-use" data-kn-action="useSuggested" data-kn-iid="${knStr(x.it.id)}" ${!a.ready||x.display<=0?'disabled':''}>Isi harga nego dengan saran SATRIA</button>
 </div>`;
}
function knPlanHtml(s){const a=s.plan;
 return `<section class="kn45-plan"><div class="kn44-section-heading"><h3>Jawaban kalkulator: Berapa harga yang harus ditawarkan?</h3><p>Perhitungan menggunakan HPS satuan dan sisa pagu setelah ongkos kirim. Jika total HPS lebih besar dari anggaran tersedia, plafon tiap barang diturunkan secara proporsional.</p></div>
 <div class="kn45-plan-metrics"><div><small>Pagu paket</small><strong>${knIdr(a.pagu)}</strong></div><div><small>Total HPS</small><strong>${knIdr(a.hpsTotal)}</strong></div><div><small>Anggaran tersedia untuk barang (pagu − ongkir)</small><strong>${knIdr(a.available)}</strong></div><div><small>Simulasi total SEMUA saran + ongkir</small><strong>${a.ready?knIdr(a.total):'Belum dapat dihitung'}</strong></div></div>
 <p class="kn45-plan-note ${a.errors.length?'kn44-error':''}">${a.errors.length?knStr(a.errors.join(' • ')):(a.ready?`Seluruh saran berada dalam batas pagu, dengan sisa ${knIdr(a.pagu-a.total)}. Potongan tiap barang tetap perlu dinegosiasikan dan disepakati penyedia.`:'Beberapa barang belum memiliki perhitungan pajak/HPS yang valid.')}</p>
 <button type="button" data-kn-action="useAllSuggested" ${!a.ready?'disabled':''}>Gunakan seluruh saran harga sebelum PPN (belum menyimpan)</button></section>`;
}
function knChangeDisplayBasis(d,mode){
 if(mode===d.displayBasis)return;
 const gross=knDisplayGross(d);
 if(mode==='beforeTax'){
  const base=knMaxBase(gross,d.taxMode,d.taxMode==='custom'?knNum(d.ref?.taxAmount||0):0);
  d.display=base?String(base):'';
 }else d.display=gross?String(gross):'';
 d.displayBasis=mode;
}

function knRowCalc(it){const d=KN.rows[it.id];if(!d)return null;
 const qty=Number(it.vol)||0,display=knDisplayGross(d),base=knNum(d.negoBase);
 const tax=d.taxMode==='custom'?knNum(d.manualTax):knRoundCents(base*(KN_TAX[d.taxMode]?.rate||0));const unit=knRoundCents(base+tax),touched=d.dirty;
 const errs=[];if(touched){
  if(!Number.isFinite(qty)||qty<=0)errs.push('Volume tidak valid');
  if(!display)errs.push('Isi harga tayang');
  if(!base)errs.push('Isi harga nego sebelum pajak');
  if(!Number.isSafeInteger(base)||!Number.isSafeInteger(Math.round(unit*100)))errs.push('Nominal terlalu besar atau tidak valid');
  // Harga di atas harga tayang/HPS dicatat sesuai fakta untuk evaluasi, bukan kesalahan input.
  // Kelayakan pemenang tetap dinilai terpisah melalui satriaOfferGate().
  if(d.taxMode==='custom'&&String(d.manualTax)==='')errs.push('Isi PPN manual');
 }
 const warnings=[];const recordedGross=touched?unit:(knNum(d.saved)>0?knNum(d.saved):unit);
 if(recordedGross>0&&display>0&&recordedGross>display)warnings.push('Harga akhir nego melebihi harga tayang');
 if(recordedGross>0&&recordedGross>Number(it.hs||0))warnings.push('Harga akhir nego melebihi HPS satuan');
 return {it,d,qty,display,base,tax,unit,old:Number(d.saved)||0,touched,errs,warnings,total:Math.round(qty*unit),initial:Math.round(qty*display)};
}
function knSummary(){const {p,w}=knOffer();if(!p||!w)return null;
 const rows=(p.items||[]).map(knRowCalc).filter(Boolean),all=rows.length,count=rows.filter(x=>x.touched).length;
 const ready=rows.filter(x=>x.touched&&!x.errs.length);
 const previews=rows.map(x=>({...x,chosen:x.touched&&!x.errs.length?x.unit:(x.old||x.display),isFinal:(x.touched&&!x.errs.length)||!!x.old}));
 const ongkir=Math.max(0,Number(w.ongkir)||0),total=Math.round(previews.reduce((sum,x)=>sum+x.qty*x.chosen,0)+ongkir);
 const h=Number(hps(p))||0,pagu=Number(p.pagu)||0,cap=Math.min(pagu,h+ongkir);
 const plan=knSuggestionPlan(rows,p,w);for(const x of rows)x.suggestion=plan.items[x.it.id];
 return {p,w,rows,all,count,ready,previews,ongkir,total,h,pagu,cap,plan,remaining:cap-total,complete:previews.every(x=>x.isFinal),invalid:rows.filter(x=>x.touched&&x.errs.length)};
}
function knRowHtml(x){const {it,d,qty,display,base,tax,unit,old,errs,touched}=x;const ref=d.ref||{};
 const safe=knStr(it.id);const done=old>0;const specs=knStr(ref.name||it.nama||'');const initialNet=d.sourceBase;
 return `<article class="kn44-item" data-kn-item="${safe}">
 <div class="kn44-item-head"><div><span class="kn44-eyebrow">RINCIAN HPS • ${knStr(it.sat||'unit')}</span><h3>${knStr(it.nama)}</h3>${ref.name?`<p class="kn44-muted">Produk tayang: ${knStr(ref.name)}</p>`:''}</div><span class="kn44-flag">${done?'Ada nego tersimpan':'Belum dinegosiasi'}</span></div>
 <div class="kn44-item-metas"><span>Jumlah <b>${nf(qty)}</b></span><span>HPS/unit <b>${knIdr(Number(it.hs)||0)}</b></span><span>Harga nego sebelum PPN tersimpan <b>${old?knIdr(Number(d.negoBase)||0):'—'}</b></span></div>
 <div class="kn44-fields">
 <label>Harga tayang / unit (sesuai basis di bawah)<input data-kn-field="display" data-kn-iid="${safe}" inputmode="numeric" type="text" value="${knStr(d.display)}" placeholder="contoh 1276500"><small>Dari Penawaran/Smart Survey. Pilih apakah nilai yang Anda ketik sudah termasuk pajak.</small></label>
 <label>Harga tayang yang diketik<select data-kn-field="displayBasis" data-kn-iid="${safe}"><option value="inclusive" ${d.displayBasis==='inclusive'?'selected':''}>Sudah termasuk PPN</option><option value="beforeTax" ${d.displayBasis==='beforeTax'?'selected':''}>Harga sebelum PPN</option></select></label>
 <div class="kn44-info"><span>Harga produk sebelum pajak (referensi)</span><strong>${initialNet?knIdr(initialNet):'Belum tersedia'}</strong><small>${initialNet?(d.sourceExact?'Sesuai rincian pajak Smart Survey':'Estimasi dari harga tayang dan mode PPN'):'Isi harga tayang terlebih dahulu'}</small></div>
 <label>Harga kesepakatan SEBELUM pajak (Rp)<input data-kn-field="negoBase" data-kn-iid="${safe}" inputmode="numeric" type="text" value="${knStr(d.negoBase)}" placeholder="ketik harga nego bersih"><small>Angka inilah yang diisi ke kolom Nego Harga Sebelum Pajak e-Katalog.</small></label>
 <label>Perlakuan PPN<select data-kn-field="taxMode" data-kn-iid="${safe}">${Object.entries(KN_TAX).map(([key,v])=>`<option value="${key}" ${key===d.taxMode?'selected':''}>${knStr(v.name)}</option>`).join('')}</select></label>
 <label class="kn44-tax-manual" ${d.taxMode==='custom'?'':'hidden'}>PPN nominal manual / unit<input data-kn-field="manualTax" data-kn-iid="${safe}" inputmode="numeric" type="text" value="${knStr(d.manualTax)}" placeholder="Nominal PPN"></label>
 </div>
 <div class="kn45-suggestion-slot">${knSuggestionHtml(x)}</div><div class="kn44-result" data-kn-result="${safe}">${knPreviewHtml(x)}</div>
 <div class="kn44-row-actions"><button type="button" class="g" data-kn-action="copyBase" data-kn-iid="${safe}" title="Menyalin harga sebelum pajak dari tayangan katalog, bukan batas HPS">Gunakan harga dasar tayang</button><button type="button" data-kn-action="saveOne" data-kn-iid="${safe}">Simpan negosiasi barang ini</button></div>
 </article>`;
}
function knPreviewHtml(x){const valid=x.base>0&&x.display>0&&x.qty>0&&(x.d.taxMode!=='custom'||x.d.manualTax!=='');const err=x.touched?x.errs:[];
 const warning=x.warnings.length?'⚠ '+x.warnings.join(' • ')+'. HPS satuan menjadi indikator kewajaran; penetapan hanya dapat dicatat apabila total HPS/pagu dan syarat lainnya terpenuhi.':'';
 const hint=warning|| (valid?`Selisih harga tayang − nego / unit: ${knIdrUnit(x.display-x.unit)}. ${x.touched?'Belum disimpan.':'Tinjau lalu simpan jika berubah.'}`:'Masukkan harga negosiasi yang sebenarnya sebelum pajak.');
 return `<div><small>Harga nego sebelum PPN / unit</small><strong>${x.base?knIdr(x.base):'—'}</strong></div><div><small>PPN hasil nego / unit</small><strong>${knIdrUnit(x.tax)}</strong></div><div><small>Hasil nego termasuk PPN / unit</small><strong>${x.base?knIdrUnit(x.unit):'—'}</strong></div><div><small>Total nego × ${nf(x.qty)}</small><strong>${x.base?knIdr(x.total):'—'}</strong></div><p class="kn44-message ${err.length||warning?'kn44-error':''}">${err.length?knStr(err.join(' • ')):knStr(hint)} ${valid?'PPN dihitung per unit hingga dua desimal; pembulatan rupiah dilakukan pada total transaksi.':''}</p>`;}
function vKalk(){const L=filt();if(KN.pid&&!L.some(p=>p.id===KN.pid)){KN.pid='';KN.wid='';KN.scope=''}
 const choose=(id,opts,value)=>`<select data-kn-select="${id}">${opts.map(([v,t])=>`<option value="${knStr(v)}" ${String(v)===String(value)?'selected':''}>${knStr(t)}</option>`).join('')}</select>`;
 const p=P(KN.pid),ww=p?.penawaran||[];if(p&&!ww.some(w=>w.id===KN.wid)){KN.wid=ww[0]?.id||'';KN.scope=''}knSetup();const s=knSummary();
 let h=`<section class="kn44-page"><header class="kn44-hero"><div><span class="kn44-hero-tag">SATRIA • E-PURCHASING</span><h2>Kalkulator Negosiasi Harga</h2><p>Catat <b>harga penawaran dan hasil negosiasi sebenarnya</b>, termasuk bila lebih tinggi dari HPS satuan. HPS satuan adalah indikator kewajaran, bukan alasan otomatis untuk mengunci penetapan jika total memenuhi batas paket. Periksa bukti dan spesifikasi sebelum keputusan. Saran harga dalam batas HPS/pagu hanya referensi negosiasi, bukan pengubah nilai penawaran.</p></div><span class="kn44-hero-icon" aria-hidden="true">↘ Rp</span></header>
 <div class="kn44-navline"><span>ALUR KERJA · <b>Kalkulator Nego</b> → Penawaran & Negosiasi</span>${s?'<button type="button" data-kn-action="viewOffer" class="satria50-back-offer">↗ Buka Penawaran & Negosiasi</button>':''}</div><div class="kn44-toolbar"><label>Paket pengadaan${choose('pid',[['','— Pilih paket —'],...L.map(x=>[x.id,`${x.rup||'-'} • ${x.nama}`])],KN.pid)}</label><label>Penyedia${choose('wid',ww.length?ww.map(w=>[w.id,PY(w.pen).nama]):[['','— Tambahkan penyedia pada Paket —']],KN.wid)}</label><div class="kn45-cap-note"><b>Batas evaluasi</b><small>Di atas total HPS/pagu tidak dapat ditetapkan<br>HPS satuan = indikator kewajaran</small></div></div>`;
 if(!s){h+=`<div class="kn44-empty"><h3>Pilih paket dan penyedia terlebih dahulu.</h3><p>Buat rincian HPS, tambahkan penyedia dan harga tayang di Paket Pengadaan, kemudian hitung negosiasi dari sini.</p></div></section>`;return h}
 if(!s.rows.length){h+=`<div class="kn44-empty">Paket belum memiliki rincian barang. Buka Paket Pengadaan → Rincian Kebutuhan dan HPS.</div></section>`;return h}
 h+=`${satriaNegotiationBridgeNotice(s)}<div class="kn44-summary" data-kn-summary>${knSummaryHtml(s)}</div><div data-kn-plan>${knPlanHtml(s)}</div><section class="kn44-reference"><div class="kn44-section-heading"><h3>Informasi sumber negosiasi</h3><p>Informasi ini bisa disimpan bersama hasil penawaran. Tidak otomatis mengesahkan bukti harga.</p></div><div class="kn44-metadata"><label>Sumber harga / URL katalog<input data-kn-global="source" type="text" value="${knStr(KN.source)}" ${satriaOfferSupplierCatalogLink(s.w)?'readonly title="Tautan toko dikelola pada Data Master → Penyedia"':''} placeholder="URL atau dokumen referensi"></label><label>Tanggal referensi<input data-kn-global="refDate" type="date" value="${knStr(KN.refDate)}"></label><label>Tanggal negosiasi<input data-kn-global="negDate" type="date" value="${knStr(KN.negDate)}"></label></div></section><section class="kn44-items"><div class="kn44-section-heading"><h3>Negosiasi per barang</h3><p>Harga tayang dan nilai kesepakatan adalah <b>harga satuan</b>. Anda boleh menyimpan satu barang dahulu; barang lain tidak akan berubah.</p></div>${s.rows.map(knRowHtml).join('')}</section>
 <div class="kn44-bottom" data-kn-bottom><div><strong>${s.count} barang diedit</strong><p>Hanya baris yang Anda ubah yang akan diterapkan. Negosiasi lama pada barang lain tetap aman.</p></div><div class="satria50-bottom-actions"><button type="button" data-kn-action="viewOffer" class="satria50-back-offer">Lihat Harga per Rincian Barang ↗</button><button type="button" data-kn-action="saveChanged">Simpan semua perubahan (${s.count})</button></div></div></section>`;return h}
function knSummaryHtml(s){const valid=s.pagu>0&&s.h>0&&s.total<=s.pagu&&s.total<=s.h&&!s.previews.some(x=>x.warnings.length);
 return `<div class="kn44-metric"><small>HPS paket</small><strong>${knIdr(s.h)}</strong></div><div class="kn44-metric"><small>Pagu paket</small><strong>${knIdr(s.pagu)}</strong></div><div class="kn44-metric"><small>Ongkir terpisah</small><strong>${knIdr(s.ongkir)}</strong></div><div class="kn44-metric kn44-highlight"><small>Total sementara dari harga yang tersimpan / diedit</small><strong>${knIdr(s.total)}</strong></div><div class="kn44-summary-note ${!valid?'kn44-error':''}">${s.invalid.length?`${s.invalid.length} baris memerlukan koreksi. `:''}Batas HPS: ${knIdr(s.h)}; pagu: ${knIdr(s.pagu)}. <b>${valid?'Total paket tidak melampaui HPS paket dan pagu termasuk ongkir.':'Periksa harga tayang, HPS satuan, total HPS (termasuk ongkir), dan pagu. Harga satuan di atas HPS menjadi catatan kewajaran, bukan pengunci penetapan jika total paket memenuhi batas.'}</b> ${s.complete?'Semua item memiliki nilai negosiasi tersimpan atau usulan valid.':'Sebagian item belum memiliki negosiasi final; total ini SEMENTARA.'} Angka pajak merupakan simulasi sampai diverifikasi.</div>`;
}
function knUpdate(){const s=knSummary();if(!s)return;const summary=document.querySelector('[data-kn-summary]');if(summary)summary.innerHTML=knSummaryHtml(s);const planSlot=document.querySelector('[data-kn-plan]');if(planSlot)planSlot.innerHTML=knPlanHtml(s);for(const x of s.rows){const sugg=document.querySelector(`[data-kn-item="${CSS.escape(String(x.it.id))}"] .kn45-suggestion-slot`);if(sugg)sugg.innerHTML=knSuggestionHtml(x);const target=document.querySelector(`[data-kn-result="${CSS.escape(String(x.it.id))}"]`);if(target)target.innerHTML=knPreviewHtml(x);const manual=document.querySelector(`[data-kn-item="${CSS.escape(String(x.it.id))}"] .kn44-tax-manual`);if(manual)manual.hidden=x.d.taxMode!=='custom';const info=document.querySelector(`[data-kn-item="${CSS.escape(String(x.it.id))}"] .kn44-info`);if(info){const val=info.querySelector('strong'),caption=info.querySelector('small');if(val)val.textContent=x.d.sourceBase?knIdr(x.d.sourceBase):'Belum tersedia';if(caption)caption.textContent=x.d.sourceBase?(x.d.sourceExact?'Sesuai rincian pajak Smart Survey':'Estimasi dari harga tayang dan mode PPN'):'Isi harga tayang terlebih dahulu'}}const bottom=document.querySelector('[data-kn-bottom]');if(bottom){const count=bottom.querySelector('strong'),btn=bottom.querySelector('button');if(count)count.textContent=s.count+' barang diedit';if(btn)btn.textContent=`Simpan semua perubahan (${s.count})`;}}
/* SATRIA 3.0.47 — SINGLE SOURCE OF TRUTH: Calc Nego -> Penawaran.nego[item.id].
   Kalkulator memasukkan harga SEBELUM PPN; tabel menampilkannya di kolom Harga Nego.
   w.nego tetap bruto untuk kompatibilitas total/14 dokumen, detail net/pajak disimpan di negoDetails.
   Akses referensi langsung, bukan menyalin ke koleksi harga kedua. */
function satriaWriteNegotiatedItems(p,w,selected){
 if(!p||!(p.penawaran||[]).some(x=>x===w))throw Error('Penyedia tidak termasuk paket aktif.');
 if(!Array.isArray(selected)||!selected.length)throw Error('Tidak ada barang untuk disimpan.');
 const itemIds=new Set((p.items||[]).map(i=>String(i.id)));
 const seen=new Set(),updates=[];
 for(const x of selected){
  const iid=String(x.it?.id??'');
  if(!itemIds.has(iid)||seen.has(iid))throw Error('ID rincian barang tidak ditemukan atau ganda.');
  seen.add(iid);
  const gross=Number(x.unit),net=Number(x.base),tax=Number(x.tax),listed=Number(x.display);
  // Nilai > HPS / harga tayang merupakan hasil evaluasi yang perlu direkam, bukan angka invalid.
  const grossCents=Math.round(gross*100),taxCents=Math.round(tax*100);
  if(![net,listed,grossCents,taxCents].every(Number.isSafeInteger)||gross<=0||net<=0||tax<0||listed<=0||
     Math.abs(gross*100-grossCents)>0.000001||Math.abs(tax*100-taxCents)>0.000001||grossCents!==net*100+taxCents)
   throw Error('Nominal atau rekonsiliasi pajak tidak valid untuk '+String(x.it.nama||iid));
  updates.push({iid,gross:grossCents/100,net,tax:taxCents/100,listed,mode:String(x.d.taxMode||'')});
 }
 w.harga=w.harga||{};w.nego=w.nego||{};w.negoDetails=w.negoDetails||{};
 const now=new Date().toISOString();
 for(const x of updates){
  w.harga[x.iid]=x.listed;
  w.nego[x.iid]=x.gross;
  w.negoDetails[x.iid]={beforeTax:x.net,tax:x.tax,inclusive:x.gross,taxMode:x.mode,source:'Kalkulator Negosiasi SATRIA',calculatedAt:now};
  const ref=w.catalogRefs?.[x.iid];
  if(ref){ref.negotiatedBase=x.net;ref.negotiatedTax=x.tax;ref.taxMode=x.mode;ref.calculatedAt=now;if(x.listed!==Number(ref.displayPrice))ref.displayPrice=x.listed;}
 }
 if(!updates.every(x=>w.nego[x.iid]===x.gross))throw Error('Gagal merekonsiliasi harga nego pada tabel penawaran.');
 return updates;
}
function satriaNegotiationBridgeNotice(s){
 const saved=KN.lastSaved;
 if(!saved||String(saved.pid)!==String(s.p.id)||String(saved.wid)!==String(s.w.id))return '';
 const match=saved.entries.every(x=>Number(s.w.nego?.[x.iid])===x.gross);
 return `<div class="kn47-bridge ${match?'':'kn47-bridge-error'}" role="status" aria-live="polite"><div><b>${match?'✓ Harga negosiasi telah masuk ke tabel penawaran':'⚠ Harga perlu diperiksa kembali'}</b><p>${match?`${saved.entries.length} barang milik ${knStr(PY(s.w.pen).nama)} tersimpan ke kolom <strong>Harga nego</strong> di Paket Pengadaan. Kolom Harga Nego menampilkan usulan <strong>SEBELUM PPN/unit</strong>; total tetap memakai harga akhir termasuk PPN.`:'Data harga berubah sejak penyimpanan. Periksa kembali penawaran dan sumber harga.'}</p></div><button type="button" data-kn-action="viewOffer">Lihat Harga per Rincian Barang ↗</button></div>`;
}
function satriaClearStaleNegoDetails(w,iid,newGross){
 const detail=w?.negoDetails?.[iid];
 if(!detail||Number(detail.inclusive)===Number(newGross))return;
 delete w.negoDetails[iid];
 const ref=w.catalogRefs?.[iid];
 if(ref){delete ref.negotiatedBase;delete ref.negotiatedTax;delete ref.calculatedAt;}
}
function knSave(items){const s=knSummary();if(!s||cur().role==='Viewer'){toast('Anda tidak memiliki izin mengubah penawaran.');return}
 const selected=s.rows.filter(x=>items?items.includes(x.it.id):x.touched);if(!selected.length){toast('Belum ada perubahan yang dipilih.');return}
 const faults=selected.filter(x=>x.errs.length);if(faults.length){alert('Perbaiki isian:\n'+faults.map(x=>`${x.it.nama}: ${x.errs.join(', ')}`).join('\n'));return}
 if(selected.some(x=>x.unit<=0||!Number.isSafeInteger(Math.round(x.unit*100))||!Number.isSafeInteger(x.total)||x.total<=0)){alert('Nominal negosiasi tidak valid atau melebihi batas angka aman.');return}
 const allFinal=s.previews.every(x=>x.isFinal);const overLimit=selected.some(x=>x.warnings.length)||(s.h>0&&(s.total-s.ongkir)>s.h)||(s.pagu>0&&s.total>s.pagu);
 const overwritten=selected.filter(x=>x.old>0&&x.old!==x.unit);const changedDisplay=selected.filter(x=>Math.round(Number(s.w.harga?.[x.it.id])||0)!==x.display);const note=overwritten.length?`\n${overwritten.length} harga negosiasi lama akan diganti.`:'';
 if(!confirm(`Simpan negosiasi ${selected.length} barang untuk ${PY(s.w.pen).nama}?${note}${changedDisplay.length?`\n${changedDisplay.length} harga tayang juga akan diperbarui.`:''}\nBarang lain tidak diubah.${overLimit?'\n⚠ NILAI DI ATAS HARGA TAYANG/HPS/PAGU: tetap dicatat untuk evaluasi, tetapi penawaran tidak dapat ditetapkan sebelum memenuhi seluruh batas dan memastikan data dan bukti pendukung yang diperlukan tersedia.':''}${!allFinal?'\nNilai paket masih sementara hingga semua item dinegosiasi.':''}`))return;
 let updates;
 try{updates=satriaWriteNegotiatedItems(s.p,s.w,selected)}catch(err){alert('Negosiasi tidak dapat disimpan: '+err.message);return}
 if(satriaOfferSupplierCatalogLink(s.w))s.w.sumberHarga=satriaOfferSupplierCatalogLink(s.w);else if(KN.source.trim())s.w.sumberHarga=KN.source.trim();if(KN.refDate)s.w.tanggalHarga=KN.refDate;if(KN.negDate)s.p.tglNego=KN.negDate;
 KN.lastSaved={pid:s.p.id,wid:s.w.id,entries:updates.map(x=>({iid:x.iid,gross:x.gross}))};
 KN.scope='';sync('nego',`Negosiasi ${updates.length} rincian tersimpan ke Harga nego penyedia ${PY(s.w.pen).nama}`);render();toast(`${updates.length} harga nego otomatis masuk ke tabel Harga per Rincian Barang.`);}
// Input uses in-memory draft and refreshes result panels only; never rerender on every keystroke.
document.addEventListener('input',event=>{const t=event.target;if(!t?.matches?.('[data-kn-field],[data-kn-global]'))return;if(!t.closest('.kn44-page'))return;event.stopImmediatePropagation();
 const global=t.dataset.knGlobal;if(global){KN[global]=t.value;return}const d=KN.rows[t.dataset.knIid];if(!d)return;d[t.dataset.knField]=t.value;if(t.dataset.knField==='display'){const gross=knDisplayGross(d);const rate=KN_TAX[d.taxMode]?.rate||0;const refBase=Number(d.ref?.beforeTax)||0;const refTax=Number(d.ref?.taxAmount)||0;d.sourceExact=refBase>0&&Math.abs(refBase+refTax-gross)<=1;d.sourceBase=d.sourceExact?refBase:(gross?Math.round(gross/(1+rate)):0)}d.dirty=true;knUpdate();},true);
document.addEventListener('change',event=>{const t=event.target;if(!t?.closest?.('.kn44-page'))return;event.stopImmediatePropagation();
 const select=t.dataset.knSelect;if(select){if(select==='pid'){KN.pid=t.value;KN.wid='';KN.scope=''}else if(select==='wid'){KN.wid=t.value;KN.scope=''}else if(select==='basis')KN.basis=t.value;render();return}
 const field=t.dataset.knField;if(field){const d=KN.rows[t.dataset.knIid];if(!d)return;if(field==='displayBasis'){knChangeDisplayBasis(d,t.value);const entry=t.closest('[data-kn-item]')?.querySelector('[data-kn-field="display"]');if(entry)entry.value=d.display;}else d[field]=t.value;if(field==='display'||field==='taxMode'||field==='displayBasis'){const gross=knDisplayGross(d);const rate=KN_TAX[d.taxMode]?.rate||0;const refBase=Number(d.ref?.beforeTax)||0,refTax=Number(d.ref?.taxAmount)||0;d.sourceExact=refBase>0&&Math.abs(refBase+refTax-gross)<=1;d.sourceBase=d.sourceExact?refBase:(gross?Math.round(gross/(1+rate)):0)}d.dirty=true;knUpdate()}
},true);
document.addEventListener('click',event=>{const b=event.target.closest?.('[data-kn-action]');if(!b||!b.closest('.kn44-page'))return;event.preventDefault();event.stopImmediatePropagation();const action=b.dataset.knAction,iid=b.dataset.knIid;
 if(action==='viewOffer'){const {p,w}=knOffer();if(!p||!w){S.ui.page='paket';S.ui.ptab='nego';S.ui.pid=p?.id||null;if(p){S.ui.tahun=Number(p.tahun);S.ui.opd=String(p.opd)}location.hash=p?'#paket/'+encodeURIComponent(p.id):'#paket';render();return}if(Object.values(KN.rows||{}).some(x=>x.dirty)&&!confirm('Ada usulan negosiasi yang belum disimpan. Beralih ke tabel Penawaran & Negosiasi tanpa menyimpan perubahan tersebut?'))return;S.ui.tahun=Number(p.tahun);S.ui.opd=String(p.opd);S.ui.ptab='nego';S.ui.page='paket';S.ui.pid=p.id;S.ui.knFocusWid=w.id;location.hash='#paket/'+encodeURIComponent(p.id);render();return;}
 if(action==='useAllSuggested'){const s=knSummary();if(!s?.plan.ready)return;for(const x of s.rows){const a=x.suggestion;if(!a?.ready)continue;x.d.negoBase=String(a.base);x.d.dirty=true;const input=document.querySelector(`[data-kn-item="${CSS.escape(String(x.it.id))}"] [data-kn-field="negoBase"]`);if(input)input.value=x.d.negoBase;}knUpdate();toast('Usulan sebelum PPN telah diisikan. Periksa dan simpan setelah negosiasi disepakati.');}
 else if(action==='useSuggested'){const x=knSummary()?.rows.find(x=>x.it.id===iid),a=x?.suggestion;if(!a?.ready)return;x.d.negoBase=String(a.base);x.d.dirty=true;const input=b.closest('[data-kn-item]')?.querySelector('[data-kn-field="negoBase"]');if(input)input.value=x.d.negoBase;knUpdate();}
 else if(action==='saveChanged')knSave(null);else if(action==='saveOne')knSave([iid]);else if(action==='copyBase'){const d=KN.rows[iid];if(d?.sourceBase){d.negoBase=String(d.sourceBase);d.dirty=true;const input=b.closest('[data-kn-item]')?.querySelector('[data-kn-field="negoBase"]');if(input)input.value=d.negoBase;knUpdate()}else toast('Harga dasar belum tersedia. Isi harga tayang terlebih dahulu.')}
},true);
// SATRIA 3.0.36: CSV RUP template and robust RFC4180 quoted-field reader.
function satriaCSVtoRows(text){
 const grid=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
  else if(c===','&&!quoted){row.push(field);field=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))grid.push(row);row=[];field=''}else field+=c;
 }
 if(quoted)throw Error('Tanda kutip CSV belum ditutup.');row.push(field);if(row.some(v=>v.trim()))grid.push(row);
 if(grid.length<2)throw Error('CSV harus memiliki header dan minimal satu baris data.');
 const headers=grid.shift().map(x=>x.trim());
 const keys=['rup','nama','pagu'];if(keys.some(k=>!headers.includes(k)))throw Error('Header wajib: rup,nama,pagu.');
 return grid.map((cells,idx)=>{if(cells.length!==headers.length)throw Error('Baris '+(idx+2)+' memiliki '+cells.length+' kolom, seharusnya '+headers.length+'.');const r={};headers.forEach((k,i)=>r[k]=cells[i].trim());return r});
}
document.addEventListener('click',e=>{if(e.target?.id!=='rupCsvTemplate')return;
 const csv='rup,nama,opd,tahun,pagu,sub,sumber,masaHk,jenisPengadaan,metodePemilihan,lokasiPengiriman,bulan\r\n"67122699","Contoh Paket ATK","",2026,1924800,"","APBD",7,"Barang","E-Purchasing dengan Negosiasi Harga","","Oktober 2026"\r\n';
 const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='SATRIA-Template-Input-RUP.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
});
const NAV=[['dash','Ringkasan Utama'],['paket','Paket Pengadaan'],['kerja','Ruang Kerja PP'],['kalk','Kalkulator Nego'],['input','Input RUP'],['spse','Monitoring SPSE'],['monitor','Pusat Monitoring'],['finance','Keuangan & Kontrak'],['quality','Kualitas Data'],['brief','Executive Briefing 4.1'],['satria360','SATRIA 360°'],['dok','Dokumen Pengadaan'],['lap','Laporan dan Analisis'],['master','Data Master'],['set','Pengaturan Sistem'],['care','Perawatan SATRIA'],['user','Pengguna dan Hak Akses'],['panduan','Panduan Penggunaan'],['chat','Asisten SATRIA'],['sampah','Sampah & Pemulihan']];
const kpi=(l,v)=>`<div class="card kpi"><span>${l}</span><b>${v}</b></div>`;
const pill=p=>`<span class=pill title="Kelengkapan: ${esc((window.SATRIA&&SATRIA.lifecycle)?({draf:'Draf',berjalan:'Berjalan',lengkap:'Lengkap',arsip:'Diarsipkan'})[SATRIA.lifecycle(p)]:'-')}">${stt(p)}</span>`;
function tabelPaket(L){
  if(!L.length) return '<p class=mut>Belum ada paket pada filter ini.</p>';
  const sorted = L.slice().sort((a,b)=>a.seq-b.seq);
  if(window.matchMedia && window.matchMedia('(max-width: 767px)').matches){
    return `<div class="satria-mobile-paket-list">${sorted.map(p=>`<article class="satria-mobile-paket-card"><div class="satria-mobile-paket-meta"><span>RUP ${esc(p.rup||'-')}</span><span>TA ${esc(p.tahun)}</span></div><a class="satria-mobile-paket-title" href="#paket/${esc(p.id)}">${esc(p.nama||'Paket tanpa nama')}</a><div class="satria-mobile-paket-sub">${esc(satriaSubKegiatan(p)||'Belum diisi')}</div><div class="satria-mobile-paket-amount"><div><small>Pagu</small><b>${rp(p.pagu)}</b></div><div><small>HPS</small><b>${rp(hps(p))}</b></div></div><div class="satria-mobile-paket-footer">${pill(p)}<a href="#paket/${esc(p.id)}">Buka detail →</a></div></article>`).join('')}</div>`;
  }
  window.__paketVirtualData = sorted;
  // Defer render to after DOM
  setTimeout(function runPaketVirtualInit(tries=0){
    if(typeof attachPaketVirtualScroll==='function' && typeof renderPaketVirtualSlice==='function'){
      attachPaketVirtualScroll(); renderPaketVirtualSlice();
    } else if(tries<40){ setTimeout(()=>runPaketVirtualInit(tries+1), 50); }
  }, 50);
  return `
    <div class="satria-virtual-table">
      <div class="satria-virtual-header">
        <div>No</div><div>Kode RUP</div><div>Nama paket</div><div>Sub kegiatan</div><div class="n">Pagu (Rp)</div><div class="n">HPS (Rp)</div><div class="n">Nilai kontrak (Rp)</div><div>Tahap pengadaan</div>
      </div>
      <div id="paketVirtualViewport" class="satria-virtual-viewport" style="height: ${Math.min(560, Math.max(60, sorted.length*56+8))}px;">
        <div id="paketVirtualSpacer" style="height:${sorted.length*56}px; position:relative;">
          <div id="paketVirtualContent" style="position:absolute; top:0; left:0; right:0;"></div>
        </div>
      </div>
      <div class="satria-virtual-footer">
        <span>${sorted.length} paket</span>
        <span class="mut">Klik nama paket untuk membuka detail</span>
      </div>
    </div>
  `;
}

/* Status proses & tindak lanjut memakai filter Dashboard; tanpa menyimpan/mengubah data. */
function satriaDashboardTindakLanjut(ep,bank){
 const started=ep.filter(p=>(p.items||[]).length>0).length;
 const awarded=ep.filter(p=>satriaRupPenetapanPaket(p)>0).length;
 const waiting=ep.length-awarded;
 const incomplete=ep.filter(p=>gaps(p).length>0).length;
 const rupReview=bank.issueCount;
 const monitoring=satriaSpseMetrics(satriaSpseRows());
 return `<section class="card satria-dashboard-followup" aria-label="Status proses dan tindak lanjut">
  <div class="row" style="justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><h3>Status Proses &amp; Tindak Lanjut</h3><a href="#quality">Periksa Kualitas Data</a></div>
  <p class="mut">Khusus TA/OPD terpilih. Paket e-Purchasing mengikuti filter arsip Dashboard, sedangkan SPSE dipantau pada modul tersendiri. Angka ini berasal dari data SATRIA terakhir dimuat, bukan konfirmasi status resmi eksternal.</p>
  <div class="satria-rup-dash-stats">
   <div><span>Paket E-P dengan rincian</span><b>${started} / ${ep.length}</b><small>Sudah mempunyai item HPS</small></div>
   <div><span>Paket E-P ditetapkan valid</span><b>${awarded}</b><small>Lolos validasi pemenang/negosiasi</small></div>
   <div><span>Paket E-P belum ditetapkan</span><b>${waiting}</b><small>Periksa survei dan proses negosiasi</small></div>
   <div><span>Administrasi E-P belum lengkap</span><b>${incomplete}</b><small>Butuh pemeriksaan kelengkapan</small></div>
   <div><span>RUP perlu pemeriksaan</span><b>${rupReview}</b><small>Termasuk referensi RUP tak cocok</small></div>
   <div><span>SPSE: tahapan terlambat</span><b>${monitoring.late}</b><small>${monitoring.count} paket monitoring SPSE</small></div>
   <div><span>SPSE: pembayaran terverifikasi</span><b>${rp(monitoring.paid)}</b><small>Tidak termasuk E-Purchasing</small></div>
  </div>
  <p class="mut" style="margin-top:10px">Tindak lanjut: <a href="#input">periksa saldo Bank RUP</a> · <a href="#paket">lengkapi paket e-Purchasing</a> · <a href="#spse">periksa SPSE</a>. Penetapan, kontrak, dan pembayaran adalah peristiwa berbeda.</p>
 </section>`;
}

function vDash(){
 const L=filt(),ep=L.filter(p=>!satriaSpseIs(p)),pagu=sum(L,p=>p.pagu),paguEp=sum(ep,p=>p.pagu),k=sum(ep,kontrak);
 const totalHps=sum(ep,hps);
 const dashData=satriaDashboardMetrics(L);
 const bankDash=satriaDashboardRupMetrics();
 const efisiensi=dashData.hpsGap;
 const pctEf=dashData.settledHps?((efisiensi/dashData.settledHps)*100).toFixed(1):0;
 const pctKontrak=paguEp?((k/paguEp)*100).toFixed(1):0;
 const lengkap=ep.filter(p=>gaps(p).length===0).length;
 const pctPatuh=ep.length?((lengkap/ep.length)*100).toFixed(0):0;
 const kpi=(l,v,icon,sub,accent)=>`<div class="card kpi satria-kpi" style="--kpi-accent:${accent}"><div class="kpi-icon" style="background:linear-gradient(135deg,${accent} 0%, color-mix(in srgb, ${accent} 70%, white) 100%)">${icon}</div><div class="kpi-content"><span class="kpi-label">${l}</span><b class="kpi-value">${v}</b><span class="kpi-sub">${sub}</span></div><div class="kpi-glow"></div></div>`;
 return `<div class="satria-command-header"><div class="satria-command-title"><div class="satria-command-badge"><span class="dot"></span> RINGKASAN UTAMA</div><h2>Ringkasan Utama SATRIA</h2><p>Integrated Government Intelligence Platform • Analitik RUP, HPS, Penetapan &amp; Monitoring • Framework Version ${(document.querySelector('meta[name="satria-release-version"]')?.content || "3.0.59.53")}</p></div><div class="satria-command-meta"><div class="satria-meta-card"><span>TA Aktif</span><b>${S.ui.tahun}</b></div><div class="satria-meta-card"><span>Paket</span><b>${L.length}</b></div><div class="satria-meta-card"><span>Kelengkapan data</span><b>${pctPatuh}%</b></div></div></div>
 <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
  ${kpi('Jumlah Paket',L.length,'🏛','Paket sesuai filter tahun/OPD','#0F766E')}
  ${kpi('Pagu Bank RUP (unik)',bankDash.validCount?rp(bankDash.pagu):'—','📚','Nilai Bank RUP tersimpan • unik per OPD/TA/kode','#0891B2')}
  ${kpi('Alokasi RUP menurut HPS',bankDash.validCount?rp(bankDash.usedHps):'—','📐','Rincian HPS / cadangan / konsolidasi','#0F766E')}
  ${kpi('Total Penetapan Bank RUP',bankDash.validCount?rp(bankDash.settled+bankDash.settledUnattributed):'—','🏅','Pemenang valid sekali per paket • multi-RUP belum dibagi','#0F766E')}
  ${kpi('Cadangan / Alokasi Belum Final',bankDash.validCount?rp(bankDash.pending):'—','📋','Alokasi belum final termasuk konsolidasi','#F59E0B')}
  ${kpi('Sisa RUP menurut HPS',bankDash.validCount?rp(bankDash.freeHps):'—','🧾','Sisa estimasi sebelum substitusi penetapan','#0891B2')}
  ${kpi('Sisa RUP setelah Penetapan',bankDash.validCount?rp(bankDash.free):'—','🧮','Pagu dikurangi penetapan valid dan cadangan','#14B8A6')}
  ${kpi('Pagu Paket Tercatat',rp(pagu),'📊','Dapat berbeda dari penggunaan RUP','#0891B2')}
  ${kpi('Penetapan / Pagu E-Purchasing',pctKontrak+'%','🧠','Penetapan valid '+rp(k)+' • denominator hanya paket e-P','#14B8A6')}
  ${kpi('Kelengkapan E-Purchasing',pctPatuh+'%','🔐','Paket lengkap '+lengkap+'/'+ep.length+' • SPSE tidak dihitung','#10B981')}
  ${kpi('Selisih HPS–Negosiasi',rp(efisiensi)+' • '+pctEf+'%','⚡','Hanya paket yang telah ditetapkan','#2563EB')}
 </div>
 <div class="card satria-overview"><h3 style="display:flex;align-items:center;gap:10px"><span style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#0F766E,#0891B2);display:grid;place-items:center;color:#fff">◈</span> Strategic Analytics Overview <span class="badge" style="margin-left:auto;background:linear-gradient(135deg,#0F766E,#0891B2);color:#fff;border:0">SATRIA NEXT • Analitik Terintegrasi</span></h3><p class="mut">Analitik paket mengikuti filter tahun, OPD dan status arsip. Bank RUP dihitung per OPD/tahun, termasuk paket arsip agar konsisten dengan Input RUP. Dua saldo ditampilkan: menurut HPS/cadangan dan setelah mengganti HPS paket yang memiliki penetapan valid. Penetapan konsolidasi multi-RUP tidak diasumsikan tersebar otomatis. Penetapan bukan pembayaran; selisih HPS–negosiasi bukan penghematan kas.</p><div class="satria-metrics-row"><div><span>Selisih HPS–Negosiasi</span><b>${rp(efisiensi)}</b><small>Bukan efisiensi kas</small></div><div><span>Total HPS</span><b>${rp(totalHps)}</b><small>Estimasi kebutuhan</small></div><div><span>Nilai Penetapan</span><b>${rp(k)}</b><small>Bukan realisasi pembayaran</small></div><div><span>Paket E-P Lengkap</span><b>${lengkap}/${ep.length}</b><small>Administrasi e-Purchasing, bukan SPSE</small></div></div></div>
 ${satriaDashboardRupOverview(bankDash)}
 ${satriaDashboardTindakLanjut(ep,bankDash)}
 ${satriaSpseDashboardWidget()}
 <div class="chart-grid">
   <div class="chart-card wide"><div class="kh-accent" style="background:linear-gradient(90deg,#0F766E,#0891B2,#14B8A6)"></div><div class="chart-title">Tren Paket: Pagu Tercatat, HPS & Penetapan <span class="badge" style="background:rgba(15,118,110,.1);color:#0F766E;border:1px solid rgba(15,118,110,.15)">Tren Multi Tahun</span></div><div id="chartMultiYear" style="width:100%;height:340px"><div class="s348-empty">Menyiapkan grafik...</div></div><div class="d3-legend" id="legendMultiYear"></div><div class="d3-tooltip" id="tooltipMulti"></div></div>
   <div class="chart-card half"><div class="kh-accent" style="background:linear-gradient(90deg,#0F766E,#0891B2)"></div><div class="chart-title">Kapasitas Pagu RUP</div><div id="chartDonut" style="width:100%;height:280px; display:grid; place-items:center"><div class="s348-empty">Menyiapkan grafik...</div></div><div class="d3-legend" id="legendDonut" style="justify-content:center"></div></div>
   <div class="chart-card half"><div class="kh-accent" style="background:linear-gradient(90deg,#0891B2,#14B8A6)"></div><div class="chart-title">Efficiency Analytics</div><div id="chartBarPaket" style="width:100%;height:280px"><div class="s348-empty">Menyiapkan grafik...</div></div></div>
   <div class="chart-card third"><div class="kh-accent" style="background:linear-gradient(90deg,#10B981,#14B8A6)"></div><div class="chart-title">Governance Status</div><div id="chartStatus" style="width:100%;height:240px; display:grid; place-items:center"><div class="s348-empty">Menyiapkan grafik...</div></div></div>
   <div class="chart-card third"><div class="kh-accent" style="background:linear-gradient(90deg,#2563EB,#0891B2)"></div><div class="chart-title">Performance Matrix</div><div id="chartHpsPagu" style="width:100%;height:240px"><div class="s348-empty">Menyiapkan grafik...</div></div></div>
   <div class="chart-card third"><div class="kh-accent" style="background:linear-gradient(90deg,#0F766E,#14B8A6)"></div><div class="chart-title">Analitik Pagu Paket per OPD</div><div id="chartOpd" style="width:100%;height:240px"><div class="s348-empty">Menyiapkan grafik...</div></div></div>
 </div>
 <div class="card" style="margin-top:14px"><h3>Perbandingan Bank RUP & Paket • Multi Tahun</h3><p class="mut">Pagu Bank RUP unik per OPD/tahun/kode. Alokasi HPS memakai rincian atau cadangan; setelah penetapan valid pada paket RUP tunggal, nilai pemenang menggantikan alokasi estimasi. Sisa diperlihatkan dengan kedua pendekatan. Nilai pagu paket dan penetapan paket (seluruh paket terfilter) adalah indikator lain; jangan dijumlahkan ke pagu sumber.</p><div class="table-wrap"><table><tr><th>Tahun</th><th class=n>Paket</th><th class=n>Pagu RUP unik</th><th class=n>Alokasi HPS/cadangan RUP</th><th class=n>Sisa RUP menurut HPS</th><th class=n>Penetapan Bank RUP</th><th class=n>Sisa RUP setelah penetapan</th><th class=n>Pagu Paket Tercatat</th><th class=n>Nilai Penetapan</th><th class=n>Selisih HPS–Nego</th><th class=n>Rasio Penetapan/Pagu Paket</th></tr>
 ${S.tahun.map(t=>{const x=filt(t),data=satriaDashboardMetrics(x),rd=satriaDashboardRupMetrics(t),pg=data.pagu,kt=data.committed,ef=data.hpsGap;const pct=pg?((kt/pg)*100).toFixed(1):0;return `<tr><td><b>${t}</b></td><td class=n>${x.length}</td><td class=n>${rd.validCount?rp(rd.pagu):'—'}</td><td class=n>${rd.validCount?rp(rd.usedHps):'—'}</td><td class=n>${rd.validCount?rp(rd.freeHps):'—'}</td><td class=n>${rd.validCount?rp(rd.settled):'—'}</td><td class=n>${rd.validCount?rp(rd.free):'—'}</td><td class=n>${rp(pg)}</td><td class=n>${rp(kt)}</td><td class=n>${rp(ef)}</td><td class=n>${pct}%</td></tr>`}).join('')}</table></div></div>
 <div class="card"><h3>Paket Pengadaan • TA ${S.ui.tahun}</h3>${tabelPaket(L)}</div>
 <div class="card"><h3>Governance Intelligence • Aktivitas Perubahan Data Lokal</h3>${S.log.length?S.log.map(l=>`<div style="padding:8px 0;border-bottom:1px solid var(--bd);display:flex;gap:12px"><span style="font-weight:700;color:#0F766E;min-width:120px">${l.t}</span><span>${esc(l.label)}</span><span class=pill style="margin-left:auto;background:rgba(15,118,110,.1);color:#0F766E;border:1px solid rgba(15,118,110,.15)">${l.mods.join(', ')}</span></div>`).join(''):'<span class=mut>Belum ada aktivitas perubahan data lokal. Log ini bukan bukti sinkronisasi berhasil ke Supabase.</span>'}</div>`;
}

function paketListForView(){
 const ids=(window.SATRIA&&SATRIA.searchPaketIds)?SATRIA.searchPaketIds(S.ui.q):null;
 let base=filt();
 const pl=S.ui.plife;
 if(pl&&pl!=='all') base=base.filter(p=>SATRIA.lifecycle(p)===pl);
 return ids?base.filter(p=>ids.has(p.id)):base;
}
function paketEmptyState(){
 const scope=activeCloudScope();
 const opdLabel=S.ui.opd==='all'?'OPD yang ditugaskan':(O(S.ui.opd).singkat||'OPD terpilih');
 const query=String(S.ui.q||'').trim();
 return `<div class="satria-empty-state"><div class="satria-empty-icon">⌕</div><strong>Belum ada paket untuk filter ini</strong><p>Filter aktif: <b>${esc(opdLabel)}</b> · Tahun Anggaran <b>${Number(S.ui.tahun)||'-'}</b>${query?` · Pencarian <b>“${esc(query)}”</b>`:''}.</p><small>${scope?'Data hanya ditampilkan jika OPD dan tahun termasuk assignment akun Anda. Jika seharusnya ada paket, minta admin memeriksa assignment dan data paket pada Supabase.':'Coba pilih OPD/tahun lain atau kosongkan kata pencarian.'}</small></div>`;
}
function paketListMarkup(){const rows=paketListForView();return rows.length?tabelPaket(rows):paketEmptyState()}
/* ===== INPUT RUP (manual & JSON) ===== */
const RUP_JENIS=['Barang','Jasa Lainnya','Jasa Konsultansi','Pekerjaan Konstruksi'];
const RUP_SUMBER=['APBD','APBN','DAK','DAU','DBH','PAD','Lainnya'];
/* Contoh struktur aaData untuk impor, bukan respons API SiRUP yang dijamin tetap. */
const RUP_SIRUP=`{
    "aaData": [
        [
            "68401050",
            "Belanja Makanan dan Minuman Aktivitas Lapangan",
            "52800000",
            "E-Purchasing",
            "APBD, APBD",
            "68401050",
            "January 2026"
        ]
    ],
    "iTotalDisplayRecords": 1,
    "sEcho": 4
}`;
const RUP_TPL=`[
  {
    "rup": "67122700",
    "nama": "Pengadaan Alat Tulis Kantor",
    "tahun": 2026,
    "pagu": 25000000,
    "sumber": "APBD",
    "sub": "",
    "masaHk": 7,
    "jenisPengadaan": "Barang",
    "metodePemilihan": "E-Purchasing dengan Negosiasi Harga",
    "lokasiPengiriman": "Gudang Dinas",
    "items": [
      { "nama": "Kertas HVS A4", "spesifikasi": "80 gsm", "merek": "", "vol": 10, "satuan": "Rim", "hs": 55000 }
    ]
  }
]`;
/* PATCH IMPOR RUP JSON — 2026-10-29. Tambahan respons DataTables SiRUP data:[{id,paket,pagu,...}]. Bank RUP saja. */
function uniqSumber(v){
  return [...new Set((Array.isArray(v)?v.join(','):String(v??'')).split(',').map(s=>s.trim()).filter(Boolean))].join(', ');
}
function rupField(row,aliases){
  if(!row||typeof row!=='object'||Array.isArray(row))return undefined;
  const norm=v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,'');
  const byName=new Map(Object.keys(row).map(k=>[norm(k),row[k]]));
  for(const name of aliases){const val=byName.get(norm(name));if(val!==null&&val!==undefined&&String(val).trim()!=='')return val;}
  return undefined;
}
function rupText(value){
  const v=Array.isArray(value)?value.join(', '):String(value??'');
  return v.replace(/<[^>]*>/g,'').trim();
}
function rupRupiah(value){
  if(typeof value==='number')return Number.isSafeInteger(value)&&value>0?value:NaN;
  let s=String(value??'').trim().replace(/^rp\.?\s*/i,'').replace(/\s/g,'');
  if(!/^\d[\d.,]*$/.test(s))return NaN;
  // Pecahan rupiah hanya diterima jika ,00 atau .00; angka pecahan lain ditolak.
  if(/[.,]\d{2}$/.test(s)){
    if(!/[.,]00$/.test(s))return NaN;
    s=s.slice(0,-3);
  }
  if(!/^\d+$/.test(s)&&!/^\d{1,3}([.,]\d{3})+$/.test(s))return NaN;
  const n=Number(s.replace(/[.,]/g,''));
  return Number.isSafeInteger(n)&&n>0?n:NaN;
}
function rupFromSirup(a){
  const raw=rupText(a[6]);
  const yr=raw.match(/(?:19|20)\d{2}/);
  const BULAN={january:'Januari',february:'Februari',march:'Maret',april:'April',may:'Mei',june:'Juni',july:'Juli',august:'Agustus',september:'September',october:'Oktober',november:'November',december:'Desember'};
  const namaBulan=raw.replace(/[0-9]/g,'').trim().toLowerCase();
  const bulan=BULAN[namaBulan]?(BULAN[namaBulan]+(yr?' '+yr[0]:'')):raw;
  return {rup:rupText(a[0]??a[5]),nama:rupText(a[1]),pagu:a[2],metodePemilihan:rupText(a[3]),sumber:uniqSumber(a[4]),tahun:yr?Number(yr[0]):undefined,bulan};
}
function rupBulanNormal(value){
  const raw=rupText(value);
  const x=raw.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+((?:19|20)\d{2})$/i);
  if(!x)return raw;
  const bulan=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const eng=['january','february','march','april','may','june','july','august','september','october','november','december'];
  return bulan[eng.indexOf(x[1].toLowerCase())]+' '+x[2];
}
function rupOpdKey(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function rupParseRow(r,i,defTahun,defOpd,defSub,allowSirupOpdFallback=true){
  const e=m=>({ok:false,err:'Data #'+(i+1)+': '+m});
  if(Array.isArray(r))r=rupFromSirup(r);
  if(!r||typeof r!=='object')return e('baris harus berupa objek JSON atau array aaData.');
  const get=(...names)=>rupField(r,names);
  // DataTables SiRUP bentuk objek: {data:[{id,paket,pagu,satuanKerja,pemilihan,...}]}.
  // Jangan anggap setiap field `id` umum sebagai kode RUP kecuali bentuk SiRUP dikenali.
  const isSirupRecord=get('id')!==undefined&&get('paket')!==undefined&&get('pagu')!==undefined;
  const rup=rupText(get('rup','kodeRup','kode_rup','noRup','nomorRup','kodePaket','idRup')??(isSirupRecord?get('id'):undefined));
  if(!rup||rup.length>100)return e('kode RUP wajib diisi (maksimal 100 karakter).');
  const nama=rupText(get('nama','namaPaket','nama_paket','namaPengadaan','namaRup','uraianPekerjaan')??(isSirupRecord?get('paket'):undefined));
  if(!nama||nama.length>1000)return e('nama paket wajib diisi (maksimal 1000 karakter).');
  const y=get('tahun','tahunAnggaran','tahun_anggaran','tahunPaket','ta');
  const yearHint=rupText(get('bulan','bulanPelaksanaan','jadwalPelaksanaan','waktuPelaksanaan','pemilihan')).match(/(?:19|20)\d{2}/);
  const tahun=Number(y===undefined?(yearHint?yearHint[0]:defTahun):y);
  if(!Number.isInteger(tahun)||!S.tahun.includes(tahun))return e('tahun anggaran '+String(y??defTahun)+' belum terdaftar di Pengaturan Sistem.');
  const opdValue=get('opd','kodeOpd','idOpd','namaOpd','satker','namaSatker','perangkatDaerah','organisasi','satuanKerja');
  const opdKey=rupOpdKey(opdValue);
  const selectedKey=rupOpdKey(defOpd);
  const matches=key=>key&&(S.opd||[]).find(o=>[o.id,o.singkat,o.nama].some(v=>rupOpdKey(v)===key));
  const direct=matches(opdKey),selected=matches(selectedKey);
  // OPD yang disebut jelas di JSON selalu diutamakan. Jika nama SiRUP berbeda
  // dari Data Master, operator HARUS memilih pemetaan di dropdown, dan UI memperingatkan.
  // Fallback dilarang bila file berisi beberapa satuanKerja berbeda.
  const od=direct||(!opdValue?selected:(isSirupRecord&&allowSirupOpdFallback?selected:undefined));
  if(!od)return e(opdValue?'OPD SiRUP "'+rupText(opdValue)+'" tidak cocok dengan Data Master; pilih OPD tujuan yang benar sebelum impor.':'OPD tidak ada pada baris; pilih OPD tujuan di atas sebelum impor.');
  const opd=od.id;
  const scope=activeCloudScope();
  if(scope&&(!scope.opdIds.includes(String(opd))||!scope.years.includes(tahun)))return e('OPD/tahun di luar assignment akun Anda.');
  const pagu=rupRupiah(get('pagu','paguPaket','pagu_anggaran','paguAnggaran','nilaiPagu','jumlahPagu','nilaiAnggaran'));
  if(!Number.isSafeInteger(pagu)||pagu<=0)return e('pagu harus berupa rupiah positif tanpa pecahan dan dalam batas angka aman.');
  const sub=satriaValidSubCode(get('sub','subKegiatan','kodeSubKegiatan','kode_sub_kegiatan')??defSub??'');
  if(sub&&!(S.kode||[]).some(k=>k.kode===sub))return e('kode sub kegiatan "'+sub+'" tidak ada di Data Master.');
  const items=[];
  const rawItems=get('items','rincian','rincianBarang');
  if(rawItems!==undefined&&!Array.isArray(rawItems))return e('rincian/items harus berbentuk array.');
  for(let j=0;j<(rawItems||[]).length;j++){
    const it=rawItems[j];
    if(!it||typeof it!=='object'||Array.isArray(it))return e('item #'+(j+1)+' tidak valid.');
    if(!rupText(it.nama))return e('item #'+(j+1)+' belum memiliki nama.');
    const vol=Number(it.vol),hs=rupRupiah(it.hs);
    if(!Number.isFinite(vol)||vol<=0||!Number.isSafeInteger(hs)||hs<=0)return e('volume dan harga satuan item "'+rupText(it.nama)+'" harus lebih dari 0.');
    items.push({id:uid('i'),nama:rupText(it.nama),spesifikasi:rupText(it.spesifikasi),merek:rupText(it.merek),pdn:'Perlu verifikasi',linkProduk:'',vol,satuan:rupText(it.satuan)||'Unit',hs});
  }
  const unit=((S.unit||[]).find(u=>String(u.opd)===String(opd))||{}).id||'';
  return {ok:true,p:{id:uid('k'),tahun,opd,unit,seq:0,nama,rup,pagu,sumber:uniqSumber(get('sumber','sumberDana','sumber_dana','sumberAnggaran')??satriaPemdaOfficial('sumber')),sub,
    bulanPelaksanaan:rupBulanNormal(get('bulan','bulanPelaksanaan','jadwalPelaksanaan','waktuPelaksanaan','pemilihan')),
    ppk:pjId(opd,'PPK')||'',pp:pjId(opd,'PP')||'',kabid:pjId(opd,'Kabid')||'',
    masaHk:Number(get('masaHk'))||7,
    jenisPengadaan:rupText(get('jenisPengadaan','jenis_pengadaan')),
    metodePemilihan:rupText(get('metodePemilihan','metodePengadaan','metode_pemilihan','metode')),
    klasifikasiSumber:rupText(get('jenisPengadaan','jenis_pengadaan'))&&rupText(get('metodePemilihan','metodePengadaan','metode_pemilihan','metode'))?'Ada di file impor':'Perlu verifikasi',
    // SiRUP 'lokasi' hanya menunjukkan wilayah, bukan alamat pengiriman atau lokasi kerja rinci.
    lokasiPengiriman:rupText(get('lokasiPengiriman'))||'',
    tglSurvei:'',tglEvaluasi:'',tglNego:'',tglPenetapan:'',tglNodis:'',tglDpp:'',tglSppbj:'',tglBahp:'',batas:'',pemenangId:null,items,penawaran:[]}};
}
function rupListFromJson(data,depth=0){
  if(Array.isArray(data))return data;
  if(!data||typeof data!=='object'||depth>3)return null;
  for(const k of ['aaData','paket','packages','rows','results','rups','daftarRup','daftarRUP','records','data']){
    const v=rupField(data,[k]);
    if(v!==undefined){const list=rupListFromJson(v,depth+1);if(list)return list;}
  }
  return rupField(data,['rup','kodeRup','kode_rup','noRup','nomorRup','kodePaket'])!==undefined?[data]:null;
}
const SATRIA_RUP_JENIS=['Barang','Jasa Lainnya','Pekerjaan Konstruksi','Jasa Konsultansi'];
const SATRIA_RUP_METODE=['E-Purchasing','E-Purchasing dengan Negosiasi Harga','Pengadaan Langsung','Dikecualikan','Tender','Tender Cepat','Seleksi','Penunjukan Langsung','Metode lainnya'];
function satriaRupClassState(r){
 const jenis=String(r?.jenisPengadaan||'').trim(),metode=String(r?.metodePemilihan||'').trim();
 const missing=[];
 if(!jenis)missing.push('jenis pengadaan');
 if(!metode)missing.push('metode pengadaan');
 const unusual=!!jenis&&!SATRIA_RUP_JENIS.includes(jenis)||!!metode&&!SATRIA_RUP_METODE.some(v=>v.toLowerCase()===metode.toLowerCase());
 return {jenis,metode,missing,unusual,confirmed:!!r?.klasifikasiDiperiksaPada};
}
function satriaRupClassSelect(values,current,attr,label){
 const selected=String(current||'');
 const options=['',...values,...(selected&&!values.includes(selected)?[selected]:[])];
 return `<label>${label}<select ${attr}>${options.map(v=>`<option value="${esc(v)}" ${selected===v?'selected':''}>${esc(v||'— Perlu verifikasi dari SiRUP —')}</option>`).join('')}</select></label>`;
}
function rupBankKey(p){return String(p.opd)+'|'+Number(p.tahun)+'|'+String(p.rup).trim().toLowerCase();}
/* SATRIA RELASI RUP: Bank RUP unik per OPD/TA/kode, tetapi boleh dipakai banyak Paket.
   rupBankId dipertahankan untuk kompatibilitas backup/dokumen lama.
   rupBankIds adalah referensi tambahan untuk konsolidasi; identitas Paket selalu p.id. */
function satriaRupLinks(p){
 return window.SATRIA_PROCUREMENT_CORE.rupLinks(p);
}
function satriaRupLinked(p,r){
 return satriaRupLinks(p).includes(String(r.id))||(!satriaRupLinks(p).length&&rupBankKey(p)===rupBankKey(r));
}
function satriaRupRelated(p){
 return (S.rupBank||[]).filter(r=>satriaRupLinked(p,r));
}
/* SATRIA 2026-11-03 — rekonsiliasi penggunaan RUP dari rincian paket.
   RUP tunggal: apabila SELURUH rincian lengkap, gunakan total Volume x HPS satuan.
   Belum lengkap: cadangkan p.pagu (konservatif). Tidak mengubah p.pagu/dokumen.
   Multi-RUP: pembagian manual tetap wajib, karena asal setiap rincian tak bisa ditebak.
   Nilai HPS adalah estimasi alokasi, bukan realisasi pembayaran/kas. */
function satriaRupRincianPenggunaan(p){
 const items=Array.isArray(p?.items)?p.items:[];
 let total=0;
 if(!items.length)return {complete:false,nilai:0,alasan:'Rincian belum diisi'};
 for(const i of items){
   const v=Number(i.vol),hs=Number(i.hs);
   if(!String(i.nama||'').trim()||!Number.isFinite(v)||v<=0||!Number.isFinite(hs)||hs<=0)
     return {complete:false,nilai:0,alasan:'Rincian belum lengkap'};
   const row=Math.round(v*hs);
   if(!Number.isSafeInteger(row)||row<=0||!Number.isSafeInteger(total+row))
     return {complete:false,nilai:0,alasan:'Nilai rincian tidak valid'};
   total+=row;
 }
 return {complete:true,nilai:total,alasan:'Otomatis dari volume × HPS satuan'};
}
function satriaRupPenggunaanPaket(p){
 const details=satriaRupRincianPenggunaan(p),pagu=Number(p?.pagu||0);
 // Multi-RUP tidak boleh menyimpulkan asal biaya rincian tanpa atribusi eksplisit.
 if(satriaRupLinks(p).length>1)return {nilai:pagu,mode:'konsolidasi',rincian:details};
 if(details.complete&&details.nilai<=pagu)return {nilai:details.nilai,mode:'otomatis',rincian:details};
 // Jika HPS lebih besar dari pagu, angka HPS tetap dihitung agar saldo tidak terlalu besar.
 if(details.complete&&details.nilai>pagu)return {nilai:details.nilai,mode:'melebihi',rincian:details};
 return {nilai:pagu,mode:'cadangan',rincian:details};
}
function satriaRupAlokasiDetail(p){
 const ids=satriaRupLinks(p),total=Number(p?.pagu||0),raw=p?.rupAlokasi;
 if(ids.length===0)return {map:{},complete:true,ids};
 if(ids.length===1)return {map:{[ids[0]]:total},complete:true,ids};
 const map={};
 const valid=raw&&typeof raw==='object'&&!Array.isArray(raw)&&ids.every(id=>{
   const value=raw[id];
   if(!Number.isSafeInteger(value)||value<0)return false;
   map[id]=value;return true;
 })&&Object.keys(raw).every(id=>ids.includes(id))&&ids.reduce((n,id)=>n+map[id],0)===total;
 if(valid)return {map,complete:true,ids};
 // Tanpa rincian, setiap tautan dianggap memakai seluruh pagu (pengamanan konservatif).
 return {map:Object.fromEntries(ids.map(id=>[id,total])),complete:false,ids};
}
function satriaRupPetaAlokasiAwal(p){
 const x=satriaRupAlokasiDetail(p),ids=x.ids;
 if(x.complete)return {...x.map};
 return Object.fromEntries(ids.map((id,i)=>[id,i===0?Number(p.pagu||0):0]));
}
/* Perhitungan Bank RUP tidak mengubah data transaksi.
   Penetapan tervalidasi mengganti, bukan menambah, estimasi HPS paket tunggal.
   Konsolidasi multi-RUP tidak diasumsikan pembagian nilai penetapannya;
   alokasi yang sudah diberikan tetap dicadangkan sambil menunggu atribusi resmi.
   Monitoring SPSE tetap menggunakan alokasi, kontrak/pembayarannya ada di modul SPSE. */
function satriaRupPenetapanPaket(p){
 if(satriaSpseIs(p))return 0;
 const amount=Number(kontrak(p)); // kontrak() hanya mengembalikan nilai pemenang yang lolos gate
 return Number.isSafeInteger(amount)&&amount>0?amount:0;
}
function satriaRupBagianHps(p,r){
 if(!satriaRupLinked(p,r))return 0;
 const ids=satriaRupLinks(p);
 if(ids.length<=1)return satriaRupPenggunaanPaket(p).nilai;
 return Number(satriaRupAlokasiDetail(p).map[String(r.id)]||0);
}
function satriaRupBagianPagu(p,r){
 if(!satriaRupLinked(p,r))return 0;
 // Tanpa pembagian nilai akhir multi-RUP, gunakan alokasi eksplisit/cadangan.
 if(satriaRupLinks(p).length>1)return satriaRupBagianHps(p,r);
 return satriaRupPenetapanPaket(p)||satriaRupBagianHps(p,r);
}
function satriaRupStatusAnggaran(r,excludeId='',state=S){
 const linked=(state.paket||[]).filter(p=>String(p.id)!==String(excludeId||'')&&satriaRupLinked(p,r));
 const batas=Number(r.pagu);
 const allocatedHps=linked.reduce((sum,p)=>sum+satriaRupBagianHps(p,r),0);
 const allocated=linked.reduce((sum,p)=>sum+satriaRupBagianPagu(p,r),0);
 const penetapan=linked.reduce((sum,p)=>sum+(satriaRupLinks(p).length<=1?satriaRupPenetapanPaket(p):0),0);
 const pending=allocated-penetapan;
 const penetapanBelumTerbagi=linked.filter(p=>satriaRupLinks(p).length>1&&satriaRupPenetapanPaket(p)>0).length;
 const tidakTerbagi=linked.filter(p=>!satriaRupAlokasiDetail(p).complete).length;
 const totalPaguPaket=linked.reduce((sum,p)=>sum+(satriaRupLinks(p).length>1?satriaRupBagianHps(p,r):Number(p.pagu||0)),0);
 const otomatis=linked.filter(p=>satriaRupLinks(p).length<=1&&satriaRupPenggunaanPaket(p).mode==='otomatis').length;
 const cadangan=linked.filter(p=>satriaRupLinks(p).length<=1&&satriaRupPenggunaanPaket(p).mode==='cadangan').length;
 const melebihi=linked.filter(p=>satriaRupLinks(p).length<=1&&satriaRupPenggunaanPaket(p).mode==='melebihi').length;
 const valid=Number.isSafeInteger(batas)&&batas>0&&[allocated,allocatedHps,penetapan,pending,totalPaguPaket].every(Number.isSafeInteger)&&allocated>=0&&allocatedHps>=0&&penetapan>=0&&pending>=0;
 return {batas,allocated,allocatedHps,penetapan,pending,sisa:batas-allocated,sisaHps:batas-allocatedHps,
   linked,tidakTerbagi,penetapanBelumTerbagi,otomatis,cadangan,melebihi,totalPaguPaket,valid};
}
/* SATRIA DASHBOARD 2026-11-03 — pembacaan Bank RUP TANPA MUTASI DATA.
   Pagu RUP unik per OPD/TA/kode; penggunaan HARUS sama dengan Input RUP.
   Semua paket terhubung (termasuk arsip) dihitung, supaya saldo bank tidak
   berubah akibat filter lifecycle Dashboard. Tidak sama dengan realisasi kas.
   Grup RUP duplikat / pagu tidak valid dikeluarkan dari angka total dan
   diberi status pemeriksaan, bukan disatukan secara spekulatif. */
function satriaDashboardRupMetrics(tahun=S.ui.tahun){
 const year=Number(tahun),scope=activeCloudScope();
 const allowedOpd=opd=>(S.ui.opd==='all'||String(opd)===String(S.ui.opd))&&(!scope||scope.opdIds.includes(String(opd)));
 const allowedYear=Number.isInteger(year)&&(!scope||scope.years.includes(year));
 const bank=allowedYear?(S.rupBank||[]).filter(r=>Number(r.tahun)===year&&allowedOpd(r.opd)):[];
 const packages=allowedYear?(S.paket||[]).filter(p=>Number(p.tahun)===year&&allowedOpd(p.opd)):[];
 // Indeks sekali untuk menghindari pemindaian seluruh paket pada setiap RUP.
 // Tetap memakai satriaRupStatusAnggaran agar perhitungan persis sama dengan Input RUP.
 const byRef=new Map(),byLegacy=new Map();
 for(const p of (S.paket||[])){
  const ids=satriaRupLinks(p);
  if(ids.length){for(const id of ids){if(!byRef.has(id))byRef.set(id,[]);byRef.get(id).push(p)}}
  else{const key=rupBankKey(p);if(!byLegacy.has(key))byLegacy.set(key,[]);byLegacy.get(key).push(p)}
 }
 const forRup=r=>[...(byRef.get(String(r.id))||[]),...(byLegacy.get(rupBankKey(r))||[])];
 const groups=new Map();
 for(const r of bank){const key=rupBankKey(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 const out={tahun:year,rupCount:groups.size,validCount:0,pagu:0,used:0,usedHps:0,settled:0,pending:0,
   free:0,freeHps:0,over:0,overHps:0,shared:0,unused:0,draft:0,missingSplit:0,
   awardsUnassigned:0,settledUnattributed:0,overDetail:0,needsAlign:0,duplicated:0,invalid:0,excluded:0,
   unlinked:0,rows:[],packages:packages.length};
 const linkedIds=new Set(),uncountedMultiAwards=new Set();
 for(const group of groups.values()){
  const r=group[0];
  if(group.length>1){
   out.duplicated++;out.excluded++;
   out.rows.push({rup:r,status:'Duplikat Bank RUP',level:3,valid:false,pagu:null,used:null,free:null,linked:0,note:'Ada '+group.length+' entri dengan kode yang sama; tidak dimasukkan dalam total'});
   for(const x of group)for(const p of forRup(x))linkedIds.add(String(p.id));
   continue;
  }
  const x=satriaRupStatusAnggaran(r,'',{paket:forRup(r)});
  if(!x.valid){
   out.invalid++;out.excluded++;
   out.rows.push({rup:r,status:'Nilai RUP tidak valid',level:3,valid:false,pagu:null,used:null,free:null,linked:x.linked.length,note:'Periksa nilai pagu/angka penggunaan'});
   x.linked.forEach(p=>linkedIds.add(String(p.id)));
   continue;
  }
  out.validCount++;out.pagu+=x.batas;out.used+=x.allocated;out.usedHps+=x.allocatedHps;
  out.settled+=x.penetapan;out.pending+=x.pending;
  out.free+=Math.max(0,x.sisa);out.over+=Math.max(0,-x.sisa);
  out.freeHps+=Math.max(0,x.sisaHps);out.overHps+=Math.max(0,-x.sisaHps);
  out.awardsUnassigned+=x.penetapanBelumTerbagi;
  for(const p of x.linked){
   if(satriaRupLinks(p).length>1&&satriaRupPenetapanPaket(p)>0&&!uncountedMultiAwards.has(String(p.id))){
    uncountedMultiAwards.add(String(p.id));out.settledUnattributed+=satriaRupPenetapanPaket(p);
   }
  }
  if(x.linked.length>1)out.shared++;
  if(!x.linked.length)out.unused++;
  out.draft+=x.cadangan;out.missingSplit+=x.tidakTerbagi;
  out.overDetail+=x.melebihi;
  if(x.totalPaguPaket>x.batas)out.needsAlign++;
  x.linked.forEach(p=>linkedIds.add(String(p.id)));
  const issues=[];
  if(x.sisa<0)issues.push('Melebihi pagu RUP');
  if(x.tidakTerbagi)issues.push('Konsolidasi belum dibagi');
  if(x.melebihi)issues.push('Rincian melampaui pagu paket');
  if(x.totalPaguPaket>x.batas)issues.push('Pagu paket perlu rekonsiliasi');
  if(x.cadangan)issues.push('Ada cadangan sementara');
  if(x.penetapanBelumTerbagi)issues.push('Penetapan konsolidasi multi-RUP belum diatribusikan');
  out.rows.push({rup:r,status:issues[0]||(x.linked.length?'Terhitung':'Belum digunakan'),
   level:x.sisa<0||x.tidakTerbagi||x.melebihi?3:issues.length?2:0,
   valid:true,pagu:x.batas,used:x.allocated,usedHps:x.allocatedHps,penetapan:x.penetapan,
   pending:x.pending,free:x.sisa,freeHps:x.sisaHps,
   linked:x.linked.length,note:issues.join(' · ')});
 }
 // Paket tanpa referensi RUP tidak boleh dimasukkan ke alokasi Bank RUP diam-diam.
 out.unlinked=packages.filter(p=>!linkedIds.has(String(p.id))).length;
 out.rows.sort((a,b)=>b.level-a.level||(b.linked-a.linked)||String(a.rup.rup).localeCompare(String(b.rup.rup),'id'));
 out.issueCount=out.duplicated+out.invalid+out.unlinked+out.rows.filter(r=>r.valid&&r.level>0).length;
 return out;
}
function satriaDashboardRupOverview(m){
 const rupAmount=m.validCount?rp(m.pagu):'—';
 const rupUse=m.validCount?rp(m.used):'—';
 const rupFree=m.validCount?rp(m.free):'—';
 const rupHps=m.validCount?rp(m.usedHps):'—';
 const rupAward=m.validCount?rp(m.settled):'—';
 const rupAwardUnattributed=m.validCount?rp(m.settledUnattributed):'—';
 const rupFreeHps=m.validCount?rp(m.freeHps):'—';
 const alerts=[];
 if(m.excluded)alerts.push(m.excluded+' RUP tidak bisa dimasukkan ke total (duplikat / nilai tidak valid)');
 if(m.over)alerts.push('Penggunaan terhitung melewati pagu pada beberapa RUP sebesar '+rp(m.over));
 if(m.missingSplit)alerts.push(m.missingSplit+' tautan konsolidasi membutuhkan pembagian alokasi per RUP');
 if(m.draft)alerts.push(m.draft+' penggunaan RUP masih menggunakan cadangan pagu paket sementara');
 if(m.needsAlign)alerts.push(m.needsAlign+' RUP mempunyai total pagu paket tercatat lebih besar dari pagu sumber; perlu rekonsiliasi');
 if(m.unlinked)alerts.push(m.unlinked+' paket belum memiliki referensi Bank RUP yang cocok');
 if(m.awardsUnassigned)alerts.push(m.awardsUnassigned+' tautan paket konsolidasi dengan penetapan belum memiliki atribusi nilai akhir per RUP; sementara tetap dihitung menggunakan alokasi konservatif');
 const top=m.rows.slice(0,12);
 return `<div class="card satria-rup-dashboard" data-dash-rup-summary="1">
   <div class="row" style="justify-content:space-between;gap:12px;align-items:center"><h3>Kontrol Pagu Bank RUP • TA ${esc(String(m.tahun))}</h3><a href="#input" class="satria-rup-dash-link">Buka Input RUP</a></div>
   <p class="mut">Satu kode RUP dihitung satu kali per OPD/tahun. Ada <b>dua cara melihat saldo</b>: estimasi HPS/cadangan, dan sisa setelah penetapan valid. Paket yang sudah ditetapkan menggunakan nilai pemenang <b>menggantikan</b> HPS paket tersebut (tidak dikurangi dua kali); paket yang belum ditetapkan tetap memakai HPS lengkap atau cadangan. Konsolidasi multi-RUP tetap memakai alokasi yang tercatat sampai nilai akhir dapat diatribusikan dengan jelas. Termasuk paket arsip; <b>bukan realisasi pembayaran atau saldo kas</b>. Angka mengikuti data lokal/cloud terakhir dimuat.</p>
   <div class="satria-rup-dash-stats">
     <div><span>Pagu RUP unik</span><b>${rupAmount}</b><small>${m.validCount} dari ${m.rupCount} referensi valid</small></div>
     <div><span>Alokasi menurut HPS / cadangan</span><b>${rupHps}</b><small>Estimasi sebelum substitusi penetapan</small></div>
     <div><span>Sisa menurut HPS</span><b>${rupFreeHps}</b><small>Tidak sama dengan sisa setelah penetapan</small></div>
     <div><span>Total penetapan teratribusi</span><b>${rupAward}</b><small>Hanya pemenang valid paket RUP tunggal</small></div>
     <div><span>Penetapan multi-RUP belum terbagi</span><b>${rupAwardUnattributed}</b><small>Dihitung sekali per paket; belum mengurangi saldo sebagai penetapan</small></div>
     <div><span>Cadangan / alokasi belum final</span><b>${m.validCount?rp(m.pending):'—'}</b><small>Termasuk alokasi konsolidasi multi-RUP</small></div>
     <div><span>Sisa setelah penetapan</span><b>${rupFree}</b><small>Saldo kapasitas, bukan pembayaran</small></div>
     <div><span>RUP dipakai berulang</span><b>${m.shared}</b><small>RUP dengan 2 paket atau lebih</small></div>
     <div><span>RUP belum digunakan</span><b>${m.unused}</b><small>Termasuk dalam pagu RUP unik</small></div>
     <div><span>Perlu pemeriksaan</span><b>${m.issueCount}</b><small>Indikator kualitas, bukan keputusan otomatis</small></div>
   </div>
   ${!m.rupCount?'<p class="mut">Belum ada Bank RUP pada OPD dan tahun yang dipilih. Pagu paket dan HPS tetap tersedia di analitik paket, tetapi saldo RUP tidak dapat disimpulkan.</p>':''}
   ${alerts.length?`<div class="satria-rup-alerts"><b>Perlu perhatian operator:</b><ul>${alerts.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`:'<p class="mut">Tidak ditemukan anomali berdasarkan pemeriksaan saldo Bank RUP lokal untuk filter ini.</p>'}
   ${top.length?`<div class="table-wrap"><table class="satria-rup-dash-table"><thead><tr><th>RUP</th><th>Paket terkait</th><th class="n">Pagu RUP</th><th class="n">HPS/cadangan</th><th class="n">Penetapan</th><th class="n">Sisa HPS</th><th class="n">Sisa setelah penetapan</th><th>Status</th></tr></thead><tbody>${top.map(x=>`<tr><td><b>${esc(x.rup.rup||'-')}</b><small style="display:block;white-space:normal">${esc(x.rup.nama||'')}</small></td><td>${x.linked} paket</td><td class="n">${x.valid?rp(x.pagu):'—'}</td><td class="n">${x.valid?rp(x.usedHps):'—'}</td><td class="n">${x.valid?rp(x.penetapan):'—'}</td><td class="n ${x.freeHps<0?'bad':''}">${x.valid?rp(x.freeHps):'—'}</td><td class="n ${x.free<0?'bad':''}">${x.valid?rp(x.free):'—'}</td><td style="white-space:normal"><b class="${x.level===3?'bad':x.level===2?'warn':'mut'}">${esc(x.status)}</b>${x.note?`<small style="display:block">${esc(x.note)}</small>`:''}</td></tr>`).join('')}</tbody></table></div>
   <p class="mut" style="margin-top:8px">Ditampilkan ${top.length} dari ${m.rows.length} RUP, mendahulukan yang perlu diperiksa. Periksa semua RUP dan ubah rincian melalui menu Input RUP / Paket Pengadaan. Dashboard tidak mengubah data.</p>`:''}
 </div>`;
}
function satriaRupPeriksaAlokasiPaket(p,nominal,forcedMap){
 const amount=Number(nominal);
 if(!Number.isSafeInteger(amount)||amount<=0)return {ok:false,msg:'Pagu paket harus bilangan rupiah positif yang valid.'};
 const rincian=satriaRupRincianPenggunaan(p);
 if(rincian.complete&&rincian.nilai>amount)return {ok:false,msg:'Total rincian/HPS ('+rp(rincian.nilai)+') tidak boleh melebihi pagu paket ('+rp(amount)+').'};
 const ids=satriaRupLinks(p);
 if(!ids.length){
   const legacy=(S.rupBank||[]).find(r=>rupBankKey(p)===rupBankKey(r));
   if(legacy){
     const status=satriaRupStatusAnggaran(legacy,p.id),pakai=rincian.complete?rincian.nilai:amount;
     if(!status.valid||amount>status.batas||pakai>status.sisa)return {ok:false,msg:'Penggunaan paket melebihi sisa RUP '+legacy.rup+' ('+rp(Math.max(0,status.sisa))+').'};
   }
   return {ok:true,map:null};
 }
 let map;
 if(ids.length===1)map={[ids[0]]:rincian.complete?rincian.nilai:amount};
 else if(forcedMap)map=Object.fromEntries(ids.map(id=>[id,Number(forcedMap[id])]));
 else{
   const details=satriaRupAlokasiDetail(p);
   if(!details.complete)return {ok:false,msg:'Paket konsolidasi belum memiliki pembagian per RUP. Simpan pembagian pada Keterkaitan RUP.'};
   map={...details.map};
   const primary=String(p.rupBankId||ids[0]),delta=amount-Number(p.pagu||0);
   map[primary]=Number(map[primary]||0)+delta;
 }
 if(ids.some(id=>!Number.isSafeInteger(map[id])||map[id]<0)||(ids.length>1&&ids.reduce((n,id)=>n+map[id],0)!==amount))
   return {ok:false,msg:'Jumlah alokasi per RUP harus sama dengan pagu paket. Periksa pembagiannya.'};
 for(const id of ids){
   const r=(S.rupBank||[]).find(x=>String(x.id)===id);
   if(!r)return {ok:false,msg:'Referensi Bank RUP tidak ditemukan: '+id};
   const status=satriaRupStatusAnggaran(r,p.id);
   if(!status.valid)return {ok:false,msg:'Nilai pagu RUP '+r.rup+' belum valid.'};
   if(ids.length===1&&amount>status.batas)return {ok:false,msg:'Pagu paket tidak boleh lebih tinggi daripada pagu sumber RUP '+r.rup+'.'};
   if(map[id]>status.sisa)return {ok:false,msg:'Penggunaan pada RUP '+r.rup+' ('+rp(map[id])+') melebihi sisa '+rp(Math.max(0,status.sisa))+'. Periksa rincian paket lain atau pagu sumber resmi.'};
 }
 return {ok:true,map:ids.length>1?map:null};
}
function satriaRupUjiPerubahanRincian(p,items){
 const next={...p,items},rincian=satriaRupRincianPenggunaan(next);
 // Input sementara yang belum lengkap boleh diedit; saldonya dihitung sebagai cadangan.
 if(!rincian.complete)return {ok:true,pending:true};
 return satriaRupPeriksaAlokasiPaket(next,p.pagu);
}
function satriaRupSetPaguPaket(p,nominal){
 const check=satriaRupPeriksaAlokasiPaket(p,nominal);
 if(!check.ok){toast(check.msg);render();return false}
 if(Number(p.pagu)===Number(nominal))return true;
 const result=SATRIA.tx('pagu','Alokasi pagu paket '+p.id+' menjadi '+rp(nominal),()=>{
   p.pagu=Number(nominal);
   if(satriaRupLinks(p).length>1)p.rupAlokasi=check.map;
 });
 return result!==null;
}
function satriaRupLinkValidation(p,bank=S.rupBank||[]){
 const ids=satriaRupLinks(p);
 return ids.map(id=>{
  const r=bank.find(x=>String(x.id)===id);
  if(!r)return 'Referensi Bank RUP '+id+' sudah tidak ditemukan';
  if(String(r.opd)!==String(p.opd)||Number(r.tahun)!==Number(p.tahun))return 'Referensi RUP '+r.rup+' berbeda OPD atau tahun dari paket';
  return null;
 }).filter(Boolean);
}
/* Patch pembaruan SiRUP hanya untuk field yang benar-benar disediakan sumber.
   Isian manual (rincian, masaHk, lokasi, sub, catatan) tidak boleh dibersihkan. */
function satriaRupSourcePatch(raw,p){
 const row=Array.isArray(raw)?rupFromSirup(raw):raw;
 const has=(...names)=>rupField(row,names)!==undefined;
 const patch={};
 if(has('nama','namaPaket','nama_paket','namaPengadaan','namaRup','uraianPekerjaan')||has('paket'))patch.nama=p.nama;
 if(has('pagu','paguPaket','pagu_anggaran','paguAnggaran','nilaiPagu','jumlahPagu','nilaiAnggaran'))patch.pagu=p.pagu;
 if(has('sumber','sumberDana','sumber_dana','sumberAnggaran'))patch.sumber=p.sumber;
 if(has('bulan','bulanPelaksanaan','jadwalPelaksanaan','waktuPelaksanaan','pemilihan'))patch.bulanPelaksanaan=p.bulanPelaksanaan;
 if(has('metodePemilihan','metodePengadaan','metode_pemilihan','metode'))patch.metodePemilihan=p.metodePemilihan;
 if(has('jenisPengadaan','jenis_pengadaan','jenisBelanja'))patch.jenisPengadaan=p.jenisPengadaan;
 return patch;
}
function satriaRupDiff(old,patch){
 return Object.fromEntries(Object.entries(patch).filter(([key,val])=>String(old[key]??'')!==String(val??'')));
}

function rupReadJson(text,defOpd,defSub,mode='skip'){
  const result={rows:[],updates:[],skips:0,errs:[],warnings:[],detail:[],total:0};
  const raw=String(text||'').replace(/^\uFEFF/,'').trim();
  if(!raw){result.errs.push('Pilih file JSON/CSV atau tempel JSON terlebih dahulu.');return result;}
  if(raw.length>5*1024*1024){result.errs.push('Ukuran JSON melampaui batas 5 MB. Pisahkan berkas menjadi beberapa bagian.');return result;}
  let data;
  try{data=JSON.parse(raw)}catch(err){result.errs.push('Format JSON tidak valid: '+err.message);return result;}
  const list=rupListFromJson(data);
  if(!list||!list.length){result.errs.push('Tidak ditemukan daftar RUP. Gunakan array, aaData, paket, data, rows, atau results.');return result;}
  if(list.length>10000){result.errs.push('Maksimal 10.000 baris per impor. Pisahkan file menjadi beberapa bagian.');return result;}
  result.total=list.length;
  // SiRUP menyediakan dua bentuk berbeda: data[] (objek lengkap) dan aaData[] (7 kolom ringkas).
  // aaData tidak memiliki jenis pengadaan/satuan kerja: jangan menebaknya dari nama paket.
  if(data&&Array.isArray(data.aaData))result.warnings.push('JSON aaData SiRUP adalah daftar ringkas: tidak memuat jenis pengadaan dan identitas satuan kerja. Pilih OPD tujuan secara sadar; untuk klasifikasi gunakan JSON data lengkap dari sumber yang sama. Jangan impor kedua file sebagai 86 RUP berbeda.');
  if(data&&Array.isArray(data.data))result.warnings.push('JSON data SiRUP berisi objek lengkap. Jenis pengadaan dan metode dari sumber dibaca apa adanya; jadwal pemilihan bukan bukti tanggal mulai pemilihan.');
  // Catatan sumber khusus DataTables SiRUP; satu halaman bisa berisi < total rekap.
  const sirupEntries=list.filter(x=>x&&!Array.isArray(x)&&typeof x==='object'&&rupField(x,['id'])!==undefined&&rupField(x,['paket'])!==undefined&&rupField(x,['pagu'])!==undefined);
  const sirupSources=[...new Set(sirupEntries.map(x=>rupText(rupField(x,['satuanKerja']))).filter(Boolean))];
  const allowSirupOpdFallback=sirupSources.length<=1;
  if(sirupSources.length>1)result.warnings.push('Terdapat '+sirupSources.length+' satuan kerja berbeda; OPD harus cocok per baris dengan Data Master. Pemilihan OPD default tidak akan dipakai untuk pemetaan silang.');
  if(sirupSources.length===1&&defOpd){
    const key=rupOpdKey(sirupSources[0]);
    const sourceExists=(S.opd||[]).some(o=>[o.id,o.nama,o.singkat].some(v=>rupOpdKey(v)===key));
    const target=(S.opd||[]).find(o=>[o.id,o.nama,o.singkat].some(v=>rupOpdKey(v)===rupOpdKey(defOpd)));
    if(!sourceExists&&target)result.warnings.push('Konfirmasi pemetaan satuan kerja SiRUP "'+sirupSources[0]+'" → OPD SATRIA "'+(target.nama||target.singkat||target.id)+'". Pilihan OPD ini ditentukan operator, bukan SiRUP.');
  }
  if(sirupEntries.length){
    const years=[...new Set(sirupEntries.map(x=>rupText(rupField(x,['pemilihan'])).match(/(?:19|20)\d{2}/)?.[0]).filter(Boolean))];
    if(years.length)result.warnings.push('Tahun '+years.join(', ')+' dibaca dari kolom jadwal pemilihan SiRUP. Pastikan sesuai tahun anggaran sebelum menyimpan.');
  }
  if(data&&!Array.isArray(data)){
    const totalFound=rupField(data,['iTotalRecords','recordsTotal','iTotalDisplayRecords']);
    if(totalFound!==undefined&&Number.isFinite(Number(totalFound))&&Number(totalFound)>list.length){
      result.warnings.push('Sumber melaporkan '+totalFound+' paket, sedangkan JSON ini memuat '+list.length+' baris. Kemungkinan hanya satu halaman hasil; periksa halaman lain sebelum menganggap impor lengkap.');
    }
  }
  const seen=new Set(),existing=new Map((S.rupBank||[]).map(r=>[rupBankKey(r),r]));
  list.forEach((row,i)=>{
    const x=rupParseRow(row,i,S.ui.tahun,defOpd,defSub,allowSirupOpdFallback);
    if(!x.ok){result.errs.push(x.err);return;}
    const p=x.p,key=rupBankKey(p);
    if(!p.jenisPengadaan||!p.metodePemilihan)result.missingClass=(result.missingClass||0)+1;
    if(seen.has(key)){result.errs.push('Data #'+(i+1)+': RUP '+p.rup+' duplikat di dalam file untuk OPD/tahun yang sama.');return;}
    seen.add(key);
    const old=existing.get(key);
    const detail={rup:p.rup,nama:p.nama,opd:O(p.opd).singkat||O(p.opd).nama,tahun:p.tahun,pagu:p.pagu,jenis:p.jenisPengadaan,metode:p.metodePemilihan,status:old?(mode==='update'?'Perbarui':'Lewati'):'Baru'};
    result.detail.push(detail);
    if(old){
      if(mode==='update'){
        const patch=satriaRupDiff(old,satriaRupSourcePatch(row,p));
        if(Object.keys(patch).length){result.updates.push({id:old.id,p,patch});detail.status='Perbarui: '+Object.keys(patch).join(', ');}
        else {result.skips++;detail.status='Tidak berubah';}
      }else result.skips++;
    }else result.rows.push(p);
  });
  if(result.missingClass)result.warnings.push(result.missingClass+' baris tidak memuat jenis atau metode pengadaan. Kolom tersebut tidak diisi otomatis; periksa di Bank RUP sesuai sumber asli sebelum menyusun dokumen.');
  return result;
}
const rupPreview=r=>({errs:r.errs,rows:r.rows,updates:r.updates,skips:r.skips,warnings:r.warnings||[],detail:r.detail,total:r.total});
/* Bank RUP adalah daftar sumber lintas OPD/tahun, bukan daftar paket pada filter header.
   Hak akses Supabase tetap dibatasi di sini sebelum filter tampilan diterapkan. */
function satriaBankAccessibleRows(){
 const scope=activeCloudScope();
 return (S.rupBank||[]).filter(r=>!scope||(scope.opdIds.includes(String(r.opd))&&scope.years.includes(Number(r.tahun))));
}
function satriaBankRows(){
 const opd=String(S.ui.rupBankOpd||'all');
 const year=String(S.ui.rupBankYear||'all');
 const query=String(S.ui.rupSearch||'').trim().toLocaleLowerCase('id-ID');
 return satriaBankAccessibleRows().filter(r=>
   (opd==='all'||String(r.opd)===opd)&&
   (year==='all'||Number(r.tahun)===Number(year))&&
   (!query||[r.rup,r.nama,r.metodePemilihan,r.jenisPengadaan,r.sumber,r.asal].join(' ').toLocaleLowerCase('id-ID').includes(query))
 );
}
function satriaBankRow(p){return {id:uid('rup'),rup:p.rup,nama:p.nama,opd:p.opd,tahun:p.tahun,pagu:p.pagu,sumber:p.sumber,bulanPelaksanaan:p.bulanPelaksanaan||'',metodePemilihan:p.metodePemilihan||'',jenisPengadaan:p.jenisPengadaan||'',klasifikasiSumber:p.klasifikasiSumber||'Perlu verifikasi',sub:p.sub||'',masaHk:p.masaHk||7,lokasiPengiriman:p.lokasiPengiriman||'',items:Array.isArray(p.items)?p.items:[],asal:'Impor JSON/CSV SiRUP',importedAt:new Date().toISOString()};}
/* SATRIA 3.0.42 — RUP manual unsaved draft protection.
   Never write an incomplete RUP to Bank RUP or cloud; restore only the UI draft. */
const RUP_MANUAL_FIELD_IDS=['rupMCode','rupMName','rupMOpd','rupMYear','rupMBudget','rupMSource','rupMMethod','rupMType','rupMProvenance','rupMNotes'];
function rupManualCapture(){
  if(!S||!S.ui||S.ui.page!=='input')return;
  const code=document.getElementById('rupMCode');
  if(!code||!code.closest('#main'))return;
  const draft={...(S.ui.rupManualDraft||{})};
  for(const id of RUP_MANUAL_FIELD_IDS){
    const element=document.getElementById(id);
    if(element)draft[id]=element.value;
  }
  S.ui.rupManualDraft=draft;
  if(draft.rupMOpd)S.ui.rupManualOpd=String(draft.rupMOpd);
}
function rupManualDraftValue(id,defaultValue=''){
  const draft=S.ui&&S.ui.rupManualDraft;
  return draft&&Object.prototype.hasOwnProperty.call(draft,id)?String(draft[id]??''):String(defaultValue??'');
}
function rupManualClearDraft(){
  S.ui.rupManualDraft=null;
  S.ui.rupManualOpd='';
  S.ui.rupManualSkipCapture=true;
}

function satriaRupClassificationPanel(r){
 const state=satriaRupClassState(r),linked=(S.paket||[]).filter(p=>satriaRupLinked(p,r));
 const legacy=/^Impor JSON\/CSV/.test(String(r.asal||''))&&!r.klasifikasiSumber&&!state.confirmed;
 const label=state.missing.length?'Perlu verifikasi: '+state.missing.join(' dan '):state.unusual?'Nilai sumber belum dikenali — cocokkan SiRUP':state.confirmed?'Sudah diperiksa operator':'Terisi dari data — cocokkan dengan SiRUP';
 const selectJenis=satriaRupClassSelect(SATRIA_RUP_JENIS,state.jenis,'data-rup-class-kind="'+esc(r.id)+'"','Jenis Pengadaan');
 const selectMetode=satriaRupClassSelect(SATRIA_RUP_METODE,state.metode,'data-rup-class-method="'+esc(r.id)+'"','Metode Pengadaan');
 return `<div class="satria-rup-identity" aria-label="Klasifikasi RUP"><span><b>Jenis:</b> ${esc(state.jenis||'Perlu verifikasi')}</span><span><b>Metode:</b> ${esc(state.metode||'Perlu verifikasi')}</span><small class="${state.missing.length||state.unusual||legacy?'warn':'mut'}">${esc(label)}${legacy?' · Klasifikasi impor lama belum dapat ditelusuri; periksa sumber asli.':''}</small></div><details class="satria-rup-classifier no-print"><summary>Periksa / koreksi jenis & metode RUP</summary><div class="satria-rup-classifier-fields">${selectJenis}${selectMetode}<button type="button" class="g" data-act="rupclasssave" data-id="${esc(r.id)}">Simpan klasifikasi Bank RUP</button></div><small>Hanya Bank RUP ini yang diperbarui. Paket yang sudah dibuat tidak otomatis diubah, agar dokumen lama dan pilihan resmi tidak bergeser diam-diam. Pemeriksaan operator bukan pengesahan SiRUP.</small>${linked.some(p=>String(p.jenisPengadaan||'')!==state.jenis||String(p.metodePemilihan||'')!==state.metode)?'<small class="warn">Terdapat paket terkait dengan klasifikasi berbeda. Periksa masing-masing paket sebelum menghasilkan dokumen.</small>':''}</details>`;
}
function vInputRup(){
 const scope=activeCloudScope(),opds=(S.opd||[]).filter(o=>!scope||scope.opdIds.includes(String(o.id)));
 const cloudRole=String(window.SATRIA_CLOUD_ROLE||'').toLowerCase();
 const usingCloud=!!window.SATRIA_CLOUD_CONFIGURED;
 const cloudName=cloudRole==='admin'?'Admin Supabase — seluruh OPD organisasi':cloudRole==='operator'?(window.SATRIA_CLOUD_MEMBER?.account_type==='ppkom'?'PPKom Supabase — satu OPD/tahun penugasan':'Operator Supabase — terbatas OPD/tahun assignment'):cloudRole==='viewer'?'Viewer Supabase — hanya baca':'Belum login Supabase';
 const roleNote=usingCloud?cloudName:'Mode lokal — pilihan Admin di header bukan autentikasi Supabase';
 const localWarning=usingCloud&&!cloudRole?'<p class="mut">Masuk melalui tombol Supabase dan tarik snapshot organisasi agar daftar OPD cloud tersedia. Pilihan Admin lokal tidak memberikan hak cloud.</p>':'';
 const opdsListed=(S.opd||[]).length;
 const status=`<section class="card satria-rup-role-status" aria-label="Status akses Input RUP"><b>Status akses: ${esc(roleNote)}</b><p class="mut">OPD pada master: ${opdsListed} · OPD dapat dipilih: ${opds.length}. Admin Supabase dapat bekerja pada seluruh OPD <b>yang sudah tercatat dalam Data Master organisasi</b>; tidak dapat memilih OPD yang belum tersedia.</p>${localWarning}${usingCloud&&cloudRole&&cloudRole!=='admin'?'<p class="mut">Untuk lintas OPD, masuk menggunakan akun dengan membership Admin organisasi, bukan mengubah nama user pada header.</p>':''}<p class="mut">Jika OPD tujuan belum muncul, tambahkan lebih dahulu melalui Pengaturan Sistem, lalu simpan/sinkronkan dan tarik ulang snapshot cloud. <a href="#set">Buka Pengaturan Sistem</a>.</p></section>`;
 const head=`<div class="row satria-page-heading"><div><h2>Bank RUP SiRUP</h2><p class="mut">Impor daftar RUP terlebih dahulu. RUP yang masuk ke bank belum menjadi paket pekerjaan; pilih <b>Buat paket</b> ketika akan mulai mengerjakannya.</p></div></div>`;
 if(!opds.length)return head+status+'<div class="card">Belum ada OPD yang dapat dipilih. Pastikan OPD tersedia di Data Master dan, untuk Operator, telah di-assign pada akun Supabase.</div>';
 // Pilihan OPD manual tidak lagi memakai default impor JSON yang dapat tertinggal dari OPD sebelumnya.
 const inOpds=value=>opds.some(o=>String(o.id)===String(value));
 const filteredOpd=S.ui.opd!=='all'&&inOpds(S.ui.opd)?String(S.ui.opd):'';
 const draftOpd=rupManualDraftValue('rupMOpd',S.ui.rupManualOpd||'');
 const manualOpd=inOpds(draftOpd)?String(draftOpd):(filteredOpd||(opds.length===1?String(opds[0].id):''));
 const defOpd=inOpds(S.ui.rupDefOpd)?String(S.ui.rupDefOpd):(filteredOpd||(opds.length===1?String(opds[0].id):''));
 const pv=S.ui.rupPrev;
 const imported=satriaBankAccessibleRows(),list=satriaBankRows();
 const bankOpd=String(S.ui.rupBankOpd||'all'),bankYear=String(S.ui.rupBankYear||'all');
 const bankOpds=opds.filter(o=>imported.some(r=>String(r.opd)===String(o.id)));
 const bankYears=[...new Set(imported.map(r=>Number(r.tahun)).filter(Number.isInteger))].sort((a,b)=>b-a);
 const rupManualCount=imported.filter(r=>String(r.asal||'').startsWith('Input manual')).length;
 const rupImportCount=imported.filter(r=>String(r.asal||'').startsWith('Impor JSON/CSV')).length;
 const rupLegacyCount=imported.length-rupManualCount-rupImportCount;
 const needsClass=imported.filter(r=>{const x=satriaRupClassState(r);return x.missing.length||x.unusual;}).length;
 const preview=!pv?'':`<section class="card" aria-live="polite" id="rupImportPreview">
 <h3>Pratinjau impor — ${pv.total} baris</h3>
 <p><b>Baru: ${pv.rows.length}</b> · <b>Perbarui: ${pv.updates.length}</b> · <b>Lewati: ${pv.skips}</b> · <b class="${pv.errs.length?'bad':'ok'}">Kesalahan: ${pv.errs.length}</b></p>
 ${pv.errs.length?`<p class="bad"><b>Impor dibatalkan seluruhnya sampai semua kesalahan diperbaiki.</b></p><ul>${pv.errs.slice(0,25).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${pv.errs.length>25?`<small class="mut">Masih ada ${pv.errs.length-25} kesalahan lainnya. Periksa seluruh file.</small>`:''}`:
 `<p class="mut">Tidak ada data yang disimpan saat pratinjau. Tekan Impor untuk konfirmasi dan menyimpan perubahan.</p>`}
 ${(pv.warnings||[]).length?`<div role="status"><b>Perhatian:</b><ul>${pv.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
 ${pv.detail.length?`<div style="overflow-x:auto"><table><thead><tr><th>Kode RUP</th><th>Nama paket</th><th>OPD / TA</th><th>Pagu</th><th>Jenis</th><th>Metode</th><th>Tindakan</th></tr></thead><tbody>${pv.detail.slice(0,30).map(x=>`<tr><td>${esc(x.rup)}</td><td>${esc(x.nama)}</td><td>${esc(x.opd)} / ${x.tahun}</td><td>${rp(x.pagu)}</td><td>${esc(x.jenis||'Perlu verifikasi')}</td><td>${esc(x.metode||'Perlu verifikasi')}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>${pv.detail.length>30?`<small class="mut">Menampilkan 30 dari ${pv.detail.length} baris valid.</small>`:''}`:''}
 </section>`;
 const manual=`<section class="card satria-rup-manual"><h3>Input RUP Manual — khusus konsolidasi / tidak tersedia di SiRUP</h3><p class="mut">Simpan RUP ke <b>Bank RUP</b> terlebih dahulu. Tidak langsung membuat Paket Pengadaan. Salin identitas RUP berdasarkan bukti/sumber yang Anda miliki.</p>
 <div class="satria-rup-form">
 <div class="fg"><label for="rupMCode">Kode RUP / Identitas referensi *</label><input id="rupMCode" autocomplete="off" value="${esc(rupManualDraftValue('rupMCode'))}" placeholder="Kode RUP resmi atau kode internal konsolidasi" required></div>
 <div class="fg"><label for="rupMName">Nama paket / konsolidasi *</label><textarea id="rupMName" rows="2" placeholder="Nama paket sesuai dokumen sumber">${esc(rupManualDraftValue('rupMName'))}</textarea></div>
 <div class="fg"><label for="rupMOpd">OPD tujuan RUP *</label><select id="rupMOpd" required>${!manualOpd?'<option value="" selected disabled>— Pilih OPD tujuan —</option>':''}${opds.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===manualOpd?'selected':''}>${esc(o.singkat||o.nama)}</option>`).join('')}</select><small class="mut">OPD ini menentukan kepemilikan RUP; pilihan tidak selalu sama dengan OPD saat impor JSON.</small></div>
 <div class="fg"><label for="rupMYear">Tahun anggaran *</label><select id="rupMYear">${S.tahun.filter(t=>!scope||scope.years.includes(Number(t))).map(t=>`<option value="${t}" ${Number(t)===Number(rupManualDraftValue('rupMYear',S.ui.tahun))?'selected':''}>${t}</option>`).join('')}</select></div>
 <div class="fg"><label for="rupMBudget">Pagu (Rp) *</label><input id="rupMBudget" type="number" min="1" step="1" inputmode="numeric" value="${esc(rupManualDraftValue('rupMBudget'))}" placeholder="Contoh: 75000000"></div>
 <div class="fg"><label for="rupMSource">Sumber dana</label><input id="rupMSource" placeholder="APBD / lainnya" value="${esc(rupManualDraftValue('rupMSource',satriaPemdaOfficial('sumber')))}"></div>
 <div class="fg"><label for="rupMMethod">Metode pemilihan</label><select id="rupMMethod"><option value="" ${rupManualDraftValue('rupMMethod','')===''?'selected':''}>— Belum diketahui / pilih dari sumber —</option>${SATRIA_RUP_METODE.map(v=>`<option value="${esc(v)}" ${rupManualDraftValue('rupMMethod','')===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>
 <div class="fg"><label for="rupMType">Jenis pengadaan</label><select id="rupMType"><option value="" ${rupManualDraftValue('rupMType','')===''?'selected':''}>— Belum diketahui / pilih dari sumber —</option>${SATRIA_RUP_JENIS.map(v=>`<option value="${esc(v)}" ${rupManualDraftValue('rupMType','')===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div>
 <div class="fg"><label for="rupMProvenance">Asal/bukti referensi *</label><input id="rupMProvenance" value="${esc(rupManualDraftValue('rupMProvenance'))}" placeholder="Misalnya: Dokumen konsolidasi nomor ..."></div>
 <div class="fg"><label for="rupMNotes">Keterangan</label><textarea id="rupMNotes" rows="2" placeholder="Alasan belum muncul di SiRUP dan keterangan tambahan">${esc(rupManualDraftValue('rupMNotes'))}</textarea></div>
 </div><div class="row" style="margin-top:12px"><button type="button" data-act="rupmanualsave">+ Simpan ke Bank RUP</button><button type="button" class="g" data-act="rupmanualclear">Bersihkan draf</button></div><p class="mut" aria-live="polite" style="margin-top:8px">Isi formulir dipertahankan saat berpindah kolom atau tampilan dimuat ulang di dalam aplikasi. Belum masuk Bank RUP sampai tombol Simpan ditekan.</p><p class="mut" style="margin-top:10px">Jika belum ada kode RUP resmi, gunakan identitas internal yang jelas dan tandai statusnya sebagai <b>perlu verifikasi</b>. Jangan menganggap kode internal sebagai kode SiRUP resmi.</p></section>`;
 return head+status+manual+`<div class="card"><h3>1. Impor daftar RUP</h3><p class="mut">Unggah JSON hasil ekspor SiRUP yang Anda miliki, atau CSV. Tempel JSON juga didukung. Mendukung <code>aaData</code> 7 kolom (ringkas, tanpa jenis pengadaan) dan <code>data</code> berisi objek SiRUP (<code>id</code>, <code>paket</code>, <code>pagu</code>, <code>jenisPengadaan</code>, <code>metode</code>, <code>satuanKerja</code>, <code>pemilihan</code>). <b>Disarankan impor JSON data lengkap</b>. Jangan mengimpor keduanya sebagai paket berbeda. Contoh berdasarkan JSON SiRUP yang diberikan pengguna; format SiRUP dapat berubah. Sistem tidak mengambil data langsung dari SiRUP/EXFATH dalam mode HTML lokal.</p>
 <div class="row" style="gap:8px;flex-wrap:wrap;margin:10px 0"><a class="btn g" href="https://sirup.inaproc.id/sirup/rekap/klpd/D209" target="_blank" rel="noopener noreferrer">Buka Rekap SiRUP D209 ↗</a><a class="btn g" href="https://sirup.inaproc.id/sirup/caripaketctr/index" target="_blank" rel="noopener noreferrer">Buka Cari Paket SiRUP ↗</a></div>
 <small class="mut">Referensi situs resmi dibuka di tab baru. Untuk saat ini SATRIA <b>tidak</b> menarik data otomatis dari situs tersebut. Ambil JSON/CSV sesuai akses yang Anda miliki, lalu masukkan di bawah. Harap jangan memasukkan cookie, token, atau kata sandi SiRUP ke SATRIA. Tautan rekap D209 tidak menetapkan OPD tujuan secara otomatis.</small>
 <div class="fg" style="margin-top:12px"><label for="rupDefOpd">OPD tujuan untuk data yang tidak memiliki kolom OPD</label><select id="rupDefOpd"><option value="" ${!defOpd?'selected':''}>— Pilih OPD tujuan (jika tidak ada pada JSON) —</option>${opds.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===defOpd?'selected':''}>${esc(o.singkat||o.nama)}</option>`).join('')}</select><small class="mut">Untuk data SiRUP dengan <code>satuanKerja</code> berbeda dari nama OPD di Data Master, pilih OPD tujuannya secara sadar dan periksa peringatan pratinjau. Jika berisi lebih dari satu satuan kerja, data harus cocok per baris dengan Data Master; SATRIA tidak memaksakan satu OPD default.</small></div>
 <div class="fg" style="margin-top:10px"><label for="rupDupMode">Jika kode RUP + OPD + tahun sudah ada</label><select id="rupDupMode"><option value="skip" ${(S.ui.rupDupMode||'skip')==='skip'?'selected':''}>Lewati data lama (aman, disarankan)</option><option value="update" ${S.ui.rupDupMode==='update'?'selected':''}>Perbarui data Bank RUP yang lama</option></select><small class="mut">Perbarui hanya mengubah data Bank RUP, tidak menimpa paket pengadaan yang sudah dibuat.</small></div>
 <div class="row" style="margin:12px 0;gap:8px;flex-wrap:wrap"><input id="rupFile" type="file" accept=".json,.csv,application/json,text/csv,text/plain"><button type="button" class="g" id="rupCsvTemplate">Template CSV</button><button type="button" class="g" data-act="rupclipboard">Tempel JSON dari clipboard</button><button type="button" class="g" data-act="rupexample" data-kind="sirup">Contoh JSON aaData</button><button type="button" class="g" data-act="rupexample" data-kind="json">Contoh JSON objek</button></div>
 <textarea id="rupJsonIn" spellcheck="false" style="min-height:150px;width:100%;font:12px/1.5 monospace" placeholder="Tempel JSON hasil ekspor di sini">${esc(S.ui.rupJson||'')}</textarea>
 <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button type="button" class="g" data-act="rupvalidate">Periksa data</button><button type="button" data-act="rupimport">Impor ke Bank RUP</button></div><small class="mut">Impor maksimal 5 MB dan 10.000 RUP per berkas. Semua perubahan dilakukan sekaligus setelah konfirmasi, tanpa menghapus data lain.</small></div>${preview}
 <div class="card"><h3>2. Bank RUP — data tersimpan (${imported.length})</h3><div class="satria-rup-class-summary"><b>${needsClass} RUP belum lengkap klasifikasinya</b><span>Jenis dan metode kosong tidak lagi diisi dengan asumsi. Gunakan koreksi per RUP sesuai data SiRUP resmi; paket lama tidak diganti otomatis.</span></div>
 <p class="mut">Menampilkan <b>${list.length} dari ${imported.length} RUP</b> sesuai filter Bank RUP dan hak akses akun. Input manual: <b>${rupManualCount}</b> · Impor JSON/CSV: <b>${rupImportCount}</b>${rupLegacyCount?' · Sumber lain/backup: <b>'+rupLegacyCount+'</b>':''}. Bank RUP tidak otomatis mengikuti filter OPD/tahun pada header. Data di sini belum menjadi paket pengadaan sampai tombol Buat paket dipilih.</p>
 <div class="row" style="gap:8px;align-items:end;flex-wrap:wrap;margin:10px 0">
 <label class="fg" style="flex:1;min-width:170px">Filter OPD Bank RUP<select id="rupBankOpdFilter"><option value="all" ${bankOpd==='all'?'selected':''}>Semua OPD yang diizinkan</option>${bankOpds.map(o=>`<option value="${esc(o.id)}" ${bankOpd===String(o.id)?'selected':''}>${esc(o.singkat||o.nama)}</option>`).join('')}</select></label>
 <label class="fg" style="flex:1;min-width:135px">Filter tahun Bank RUP<select id="rupBankYearFilter"><option value="all" ${bankYear==='all'?'selected':''}>Semua tahun</option>${bankYears.map(y=>`<option value="${y}" ${bankYear===String(y)?'selected':''}>${y}</option>`).join('')}</select></label>
 <button type="button" class="g" data-act="rupbankreset">Tampilkan semua RUP</button>
 </div>
 <input id="rupBankSearch" type="search" placeholder="Cari kode RUP, nama, jenis, metode, atau sumber..." value="${esc(S.ui.rupSearch||'')}" style="width:100%;margin-bottom:12px" aria-label="Pencarian Bank RUP">
 ${list.length?`<div class="satria-rup-grid">${list.map(r=>{const status=satriaRupStatusAnggaran(r),linked=status.linked,existing=linked[0];const available=status.valid&&status.sisa>0;return `<article class="satria-rup-card"><div><small>RUP ${esc(r.rup)} · TA ${r.tahun} · ${esc(O(r.opd).singkat||O(r.opd).nama)}</small><h3>${esc(r.nama)}</h3><p><b>Pagu RUP ${rp(r.pagu)}</b></p>${satriaRupClassificationPanel(r)}<p class="mut" style="margin:3px 0;font-size:12px">Sumber: ${esc(r.asal||'Data lama / backup')}${r.statusVerifikasi?' · '+esc(r.statusVerifikasi):''}</p><div class="satria-rup-budget-status" role="status"><div><b>HPS / cadangan: ${rp(status.allocatedHps)}</b> · Sisa HPS: <b class="${status.sisaHps<0?'bad':'mut'}">${rp(status.sisaHps)}</b></div><div><b>Total penetapan valid: ${rp(status.penetapan)}</b> · <b>Alokasi belum final: ${rp(status.pending)}</b></div><div><b class="${status.sisa<0?'bad':available?'ok':'warn'}">Sisa setelah penetapan: ${rp(status.sisa)}</b></div><small>${linked.length} paket: ${status.otomatis} dihitung otomatis dari rincian, ${status.cadangan-status.linked.filter(satriaSpseIs).length} cadangan sementara, ${status.linked.filter(satriaSpseIs).length} monitoring SPSE${status.tidakTerbagi?', '+status.tidakTerbagi+' konsolidasi tanpa pembagian':''}${status.penetapanBelumTerbagi?', '+status.penetapanBelumTerbagi+' penetapan multi-RUP belum teratribusi':''}.</small>${status.totalPaguPaket>status.batas?'<small class="warn">Pagu paket yang masih tercatat berjumlah '+rp(status.totalPaguPaket)+' (lebih tinggi dari pagu RUP). Periksa dan gunakan tombol Samakan pagu paket dengan rincian sebelum menerbitkan dokumen baru.</small>':''}${status.melebihi?'<small class="bad">Ada paket yang rincian/HPS-nya melebihi pagu paket. Periksa paket terkait.</small>':''}${status.sisa<0?'<small class="bad">Jumlah terpakai melebihi pagu RUP. Periksa rincian dan sumber anggaran.</small>':''}<small class="mut">Nilai penetapan tervalidasi menggantikan HPS untuk paket RUP tunggal, tidak dijumlahkan dua kali. Penetapan konsolidasi multi-RUP belum dialokasikan otomatis. SPSE tetap memakai cadangan alokasi; nilai kontraknya ditampilkan terpisah. Ini bukan realisasi pembayaran; pagu RUP sumber tidak berubah.</small></div>${linked.length?`<div class="satria-rup-linked-list" style="margin-top:10px;border-top:1px solid var(--bd);padding-top:8px"><b style="font-size:12px">Paket yang memakai RUP ini:</b>${linked.map(p=>{const u=satriaRupPenggunaanPaket(p),v=satriaRupBagianPagu(p,r);const multi=satriaRupLinks(p).length>1;return `<div style="padding:7px 0;border-bottom:1px solid var(--bd);font-size:12px"><div><b>${esc(p.nama||p.id)}</b></div><div>Terhitung ${rp(v)} · ${multi?'Pembagian konsolidasi':satriaSpseIs(p)?'Monitoring SPSE (alokasi)':satriaRupPenetapanPaket(p)>0?'Nilai penetapan valid (pengganti HPS)':u.mode==='otomatis'?'Otomatis dari rincian lengkap':u.mode==='cadangan'?'Cadangan sementara (rincian belum lengkap)':'Rincian melebihi pagu paket'} · HPS ${rp(hps(p))} · ${satriaRupPenetapanPaket(p)>0?'Penetapan '+rp(satriaRupPenetapanPaket(p))+' · ':''}Pagu paket tercatat ${rp(p.pagu)}</div><div class="row" style="gap:5px;margin-top:5px"><button type="button" class="g" data-act="rupopen" data-id="${esc(p.id)}" style="height:31px;padding:0 10px">Buka rincian</button>${!multi&&u.mode==='otomatis'&&u.nilai!==Number(p.pagu)?`<button type="button" class="g" data-act="rupalign" data-id="${esc(p.id)}" style="height:31px;padding:0 10px">Samakan pagu paket dengan rincian</button>`:''}</div></div>`}).join('')}</div>`:''}</div><div class="satria-rup-create-budget" style="margin-top:10px"><label style="display:block;font-weight:700;font-size:12px;margin-bottom:4px">Cadangan pagu paket baru (opsional, Rp)</label><input type="number" data-rup-budget-input="${esc(r.id)}" min="1" max="${Math.max(0,status.sisa)}" step="1" inputmode="numeric" placeholder="Kosongkan untuk memakai sisa ${esc(nf(Math.max(0,status.sisa)))}" aria-label="Cadangan pagu paket baru RUP ${esc(r.rup)}" ${available?'':'disabled'} style="width:100%;max-width:370px"><small class="mut" style="display:block;margin-top:5px">Sebelum penetapan valid: rincian HPS lengkap atau cadangan pagu. Sesudah penetapan valid: nilai akhir pemenang menggantikan estimasi paket tunggal. Penetapan multi-RUP tetap memerlukan atribusi per RUP.</small></div><div class="row" style="gap:8px;flex-wrap:wrap;margin-top:9px"><button type="button" data-act="rupcreate" data-id="${esc(r.id)}" ${available?'':'disabled'}>${existing?'Buat paket lagi':'Buat paket dari RUP'}</button>${existing?`<button type="button" class="g" data-act="rupopen" data-id="${esc(existing.id)}">Buka paket terkait (${linked.length})</button>`:''}<button type="button" class="g" data-act="rupremove" data-id="${esc(r.id)}">Hapus dari bank</button></div>${!available?'<small class="warn">Belum ada sisa RUP. Pastikan semua rincian paket telah lengkap dan sesuai; jangan mengurangi angka yang sudah disahkan tanpa pemeriksaan.</small>':''}</article>`}).join('')}</div>`:`<div class="satria-empty-state"><strong>${imported.length?'Tidak ada RUP yang cocok dengan filter Bank RUP.':'Belum ada RUP tersimpan pada akses akun ini.'}</strong><p>${imported.length?'Pilih Tampilkan semua RUP untuk melihat kembali hasil input manual dan impor JSON.':'Simpan RUP manual atau impor JSON/CSV untuk menambah data Bank RUP.'}</p></div>`}</div>`;
}

function vPaket(){const demoJumlah=satriaSubDemoJumlah();const demoNotice=demoJumlah?`<div class="card satria-sub-demo-warning" role="alert"><b>Perlu koreksi: ${demoJumlah} referensi subkegiatan berisi kode contoh bawaan SATRIA.</b><p>Kode KODE-DEMO-001 bukan subkegiatan paket nyata. Sumber asli dan isian subkegiatan lain tetap dipertahankan.</p><button type="button" data-act="satriaFixDemoSub">Bersihkan kode contoh pada paket/Bank RUP</button></div>`:'';return `<div class="row satria-page-heading"><div><h2>Paket Pengadaan TA ${S.ui.tahun}</h2><p class="mut">Daftar paket mengikuti filter OPD dan tahun aktif.</p></div><button type="button" data-act="newpaket">+ Pilih RUP dari Bank</button></div>${demoNotice}${satriaHumanPaketOverview()}<div class="card satria-paket-card"><div class="row satria-paket-toolbar"><label for="qPaket">Cari paket</label><input id="qPaket" type="search" autocomplete="off" placeholder="Cari kode RUP atau nama paket…" value="${esc(S.ui.q||'')}" aria-controls="paketTableResult"/><select id="pLife" aria-label="Filter kelengkapan data paket" style="max-width:200px">${[["all","Semua kelengkapan"],["draf","Draf · belum ada kode RUP"],["berjalan","Berjalan · data belum lengkap"],["lengkap","Lengkap"],["arsip","Diarsipkan"]].map(([v,l])=>`<option value="${v}" ${(S.ui.plife||"all")===v?"selected":""}>${l}</option>`).join("")}</select><span class="satria-result-count">${paketListForView().length} paket</span></div><div id="paketTableResult" aria-live="polite">${paketListMarkup()}</div></div>`}

function readiness(p){const reuse=S.paket.filter(x=>x.id!==p.id&&rupBankKey(x)===rupBankKey(p)&&String(p.rup||'').trim()).length;const H=hps(p);
const C=[['Kode RUP',!!p.rup],['Pagu',p.pagu>0],['Rincian barang',p.items.length>0],['HPS ≤ pagu',H>0&&H<=p.pagu],['Penawaran',p.penawaran.length>0],['Pemenang',!!pemenang(p)],['Tgl DPP',!!p.tglDpp],['PPK aktif',!!p.ppk && S.pejabat.some(x=>String(x.id)===String(p.ppk)&&String(x.opd)===String(p.opd)&&x.aktif!==false)],['Tgl BA Hasil',!!p.tglBahp]];
return `<div class=row style="margin-bottom:10px">${C.map(([t,ok])=>`<span class=pill style="background:${ok?'#dff5e8':'#fde3e0'}">${ok?'✔':'✖'} ${t}</span>`).join('')}</div>${reuse?'<p class=mut>ℹ Kode RUP ini juga digunakan '+reuse+' paket lain. Periksa alokasi pagu dan nomor dokumen tiap paket agar tidak dihitung/diterbitkan ganda.</p>':''}`}
function vDetail(p){
 if(!p)return '<div class=card>Paket tidak ditemukan.</div>';
 const H=hps(p),dl=S.ui.ptab;
 const warn=(!String(p.jenisPengadaan||'').trim()||!String(p.metodePemilihan||'').trim()?'<p class="warn">Jenis atau metode pengadaan belum diketahui. Periksa informasi pada Bank RUP dan Data Paket sebelum menggunakan generator dokumen.</p>':'')+(H>p.pagu?`<p class=bad>⚠ HPS melebihi pagu (selisih ${rp(H-p.pagu)})</p>`:'')+(window.satriaLifeRow?window.satriaLifeRow(p):'');
 const dataIssues=[];
 if(!String(p.rup||'').trim())dataIssues.push(['Kode RUP belum diisi','data']);
 if(!(p.pagu>0))dataIssues.push(['Pagu belum diisi','data']);
 if(!(p.items||[]).length)dataIssues.push(['Rincian barang belum ada','rincian']);
 if(H>p.pagu)dataIssues.push(['HPS melebihi pagu','rincian']);
 if((p.items||[]).some(i=>!i.nama||!(+i.vol>0)||!(+i.hs>0)))dataIssues.push(['Nama, volume, atau harga rincian belum lengkap','rincian']);
 if((p.penawaran||[]).length&&!pemenang(p))dataIssues.push(['Penawaran/negosiasi belum memenuhi syarat penetapan','nego']);
 const quickFix=dataIssues.length?`<div class="satria335-fixpanel"><b>Periksa sebelum mencetak dokumen (${dataIssues.length})</b><p class=mut>Perubahan Data Paket, rincian HPS dan penawaran terhubung. Lengkapi bagian berikut agar perhitungan dokumen mutakhir.</p><div class="satria335-fixlinks">${dataIssues.map(([msg,tab])=>`<button class="g" data-act="ptab" data-tab="${tab}">${esc(msg)} →</button>`).join('')}</div></div>`:'';
 const body=dl==='data'?fData(p):dl==='rincian'?fItems(p):fNego(p);
 const tabs=[['data','Data Paket'],['rincian','Rincian Kebutuhan dan HPS'],['nego','Penawaran dan Negosiasi']];
 return `<div class="row satria342-detail-heading" style="justify-content:space-between"><div><a href="#paket">← Daftar paket</a><h2 style="margin:6px 0">${esc(p.nama)}</h2>${pill(p)} <span class=mut>TA ${p.tahun} · ${esc(O(p.opd).singkat)} · No. ${p.seq}</span></div>
 <div class=row><a class="btn g" href="#brief/${encodeURIComponent(p.id)}">Executive Briefing paket ↗</a><button class=g data-act="copy" data-id="${p.id}">Salin ke TA ${p.tahun+1}</button><button class=d data-act="delpaket" data-id="${p.id}">Hapus</button></div></div>
 <div class="card satria342-detail-workspace" style="margin-top:16px">${warn}${satriaHumanWorkflow(p)}<details class="satria-human-technical"><summary>Periksa kelengkapan teknis & data yang perlu diperbaiki</summary><div class="satria-human-technical-inner">${readiness(p)}${quickFix}</div></details><div class="row satria342-workflow-tabs" role="group" aria-label="Tahap pekerjaan paket">${tabs.map(([k,t])=>`<button type="button" class="${k===dl?'satria342-tab-current':'g'}" data-act="ptab" data-tab="${k}" data-step="${k}" aria-pressed="${k===dl}">${t}</button>`).join('')}</div><div class="satria342-stage-content">${body}</div></div>`;
}
function klfVal(pg,b){return {kode:pg[b+'Kode']??'',nama:pg[b+'Nama']??pg[b]??''}}
function klfLines(kode,nama){const kd=String(kode).split('\n'),nm=String(nama).split('\n');const out=[];for(let i=0;i<Math.max(kd.length,nm.length);i++){const t=[(kd[i]||'').trim(),(nm[i]||'').trim()].filter(Boolean).join(' ');if(t)out.push(t)}return out}
function klfCompose(pg){for(const b of ['program','kegiatan','subKeg']){const {kode,nama}=klfVal(pg,b);pg[b+'Kode']=String(kode);pg[b+'Nama']=String(nama);pg[b]=klfLines(kode,nama).join('\n')}}
function klfField(p,b,label,ph){const {kode,nama}=klfVal(p,b);const txt=klfLines(kode,nama).join('\n');return `<div class="fg" style="grid-column:1/-1"><label>${label}</label><div class="row" style="gap:8px;flex-wrap:nowrap;align-items:flex-start"><textarea rows=2 style="width:160px;flex-shrink:0" placeholder="Kode, mis. 5.1.0.1" data-col="paket" data-id="${p.id}" data-f="${b}Kode">${esc(kode)}</textarea><textarea rows=2 style="flex:1;min-width:0" placeholder="${ph}" data-col="paket" data-id="${p.id}" data-f="${b}Nama">${esc(nama)}</textarea></div><p class="mut" style="margin:4px 0 0;font-size:12px;white-space:pre-line">Tampil:\n${esc(txt)||'-'}</p><p class="mut" style="margin:2px 0 0;font-size:11px">Satu baris untuk satu ${label.toLowerCase()}. Tekan Enter untuk menambah baris.</p></div>`}
function fData(p){
 const KL=klasifikasiDetail(p);
 const F=(l,h)=>`<div class=fg><label>${l}</label>${h}</div>`;
 const I=(f,t='text')=>`<input type="${t}" value="${esc(p[f])}" data-col="paket" data-id="${p.id}" data-f="${f}">`;
 const SEL=(f,o)=>`<select data-col="paket" data-id="${p.id}" data-f="${f}">${o.map(([v,t])=>`<option value="${v}" ${v===p[f]?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
 const TA=(f,v)=>`<textarea rows=3 data-col="paket" data-id="${p.id}" data-f="${f}" style="width:100%">${esc(v)}</textarea>`;
 const F2=(l,h)=>`<div class=fg style="grid-column:1/-1"><label>${l}</label>${h}</div>`;
 const pj=peran=>S.pejabat.filter(x=>x.opd===p.opd&&x.peran===peran&&(x.aktif!==false||[p.ppk,p.pp,p.kabid].includes(x.id))).map(x=>[x.id,x.nama+(x.aktif===false?' (nonaktif)':'')]);
 return `<div class="grid satria342-data-form" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
 <div class="satria342-section-head"><span>01</span><div><b>Identitas & Anggaran</b><small>Informasi dari Bank RUP dan rincian pelaksanaan</small></div></div>
 ${F('Nama paket',I('nama'))}${F('Kode RUP',I('rup'))}${F('Pagu (Rp)',`<div style="display:flex;align-items:center;gap:8px"><span style="font-weight:700;color:var(--mut)">Rp</span><input data-cur="1" data-col="paket" data-id="${p.id}" data-f="pagu" inputmode="numeric" value="${nf(p.pagu)}" style="flex:1;text-align:right;font-variant-numeric:tabular-nums"></div>`)}${F2('Kontrol alokasi pagu Bank RUP',`<div class="satria-rup-budget-detail">${satriaRupRelated(p).map(r=>{const s=satriaRupStatusAnggaran(r,p.id);const own=satriaRupBagianPagu(p,r);return `<div><b>RUP ${esc(r.rup)}</b> · Pagu RUP ${rp(s.batas)} · Penggunaan terhitung ${rp(own)} · Paket lain ${rp(s.allocated)} · <b class="${s.sisa<0?'bad':'mut'}">Sisa untuk paket ini / lainnya ${rp(s.sisa)}</b></div>`}).join('')||'<span class="mut">Paket belum terhubung ke Bank RUP.</span>'}<small class="mut">RUP tunggal: rincian HPS atau cadangan dipakai sebelum penetapan valid, dan nilai penetapan menggantikannya setelah valid. Nilai penetapan multi-RUP tidak boleh dibagi otomatis. Pagu Bank RUP sumber tetap.</small></div>`)}${F('Bulan pelaksanaan (dari SiRUP)',I('bulanPelaksanaan'))}${F('Sumber dana',SEL('sumber',[...new Set(['APBD','APBN','DAK','DAU','DBH','PAD','Lainnya',p.sumber].filter(Boolean))].map(x=>[x,x])))}
 ${F('OPD',SEL('opd',S.opd.map(o=>[o.id,o.singkat])))}${F('Unit/Bagian',SEL('unit',S.unit.filter(u=>u.opd===p.opd&&(u.aktif!==false||String(u.id)===String(p.unit))).map(u=>[u.id,u.kode+' — '+u.bidang+(u.aktif===false?' (nonaktif)':'')])))}${F('Nomor urut (otomatis)',`<input value="${esc(p.seq||nextSeq(p.tahun,p.opd))}" readonly aria-readonly="true" title="Dikelola otomatis oleh sistem">`)}
 ${F2('Keterkaitan RUP & Konsolidasi',`<div class="satria-rup-link-manager"><p class="mut">Satu RUP dapat digunakan pada banyak paket. Untuk paket konsolidasi, hubungkan lebih dari satu RUP dengan OPD dan tahun yang sama; identitas dan HPS paket tidak ikut berubah otomatis.</p><div class="row" style="gap:8px;flex-wrap:wrap">${(S.rupBank||[]).filter(r=>satriaRupLinks(p).includes(String(r.id))).map(r=>`<span class="pill">RUP ${esc(r.rup)} ${String(r.id)===String(p.rupBankId)?'(utama)':''} <button type="button" class="g" data-act="rupunlink" data-id="${esc(p.id)}" data-rup="${esc(r.id)}" style="min-height:28px;height:28px;padding:0 9px" title="Lepas referensi, tidak menghapus RUP">Lepas</button></span>`).join('')||'<span class="mut">Belum ditautkan eksplisit ke Bank RUP (paket lama tetap dapat menggunakan kode RUP yang sama).</span>'}</div><div class="row" style="margin-top:8px;gap:8px"><select id="rupLinkAdd" style="max-width:420px"><option value="">— Pilih RUP untuk ditautkan —</option>${(S.rupBank||[]).filter(r=>String(r.opd)===String(p.opd)&&Number(r.tahun)===Number(p.tahun)&&!satriaRupLinks(p).includes(String(r.id))).map(r=>`<option value="${esc(r.id)}">${esc(r.rup+' — '+r.nama)}</option>`).join('')}</select><button type="button" data-act="ruplink" data-id="${esc(p.id)}">Tautkan RUP</button></div>${satriaRupLinks(p).length>1?`<div style="border:1px solid var(--bd);border-radius:10px;padding:12px;margin:10px 0"><b>Pembagian pagu paket untuk konsolidasi multi-RUP</b><p class="mut" style="margin:4px 0">Jumlah alokasi seluruh RUP harus tepat ${rp(p.pagu)}. Satu paket dihitung sebesar alokasinya pada tiap RUP, bukan seluruh pagunya pada setiap RUP.</p><div class="row" style="gap:10px;flex-wrap:wrap">${satriaRupLinks(p).map(rid=>{const x=(S.rupBank||[]).find(y=>String(y.id)===rid);const m=satriaRupPetaAlokasiAwal(p);return `<label style="display:flex;flex-direction:column;gap:5px"><small>RUP ${esc(x?.rup||rid)}</small><input type="number" min="0" step="1" inputmode="numeric" data-rup-split="${esc(rid)}" value="${esc(m[rid]||0)}" style="max-width:180px"></label>`}).join('')}</div><button type="button" data-act="rupallocsave" data-id="${esc(p.id)}" style="margin-top:9px">Simpan pembagian RUP</button>${satriaRupAlokasiDetail(p).complete?'':'<p class="warn">Pembagian konsolidasi lama belum tersimpan. Sistem memakai perhitungan konservatif hingga disimpan.</p>'}</div>`:''}<small class="mut">Pagu Bank RUP tetap sebagai referensi resmi. Untuk konsolidasi beberapa RUP, gunakan pembagian alokasi agar tidak dihitung ganda; dokumen saat ini memakai kode RUP utama.</small></div>`)}
 <div class="satria342-section-head"><span>02</span><div><b>Program, Kegiatan & Subkegiatan</b><small>Isi per baris agar susunan tetap rapi di dokumen</small></div></div>
 ${klfField(p,'program','Program','Nama program, mis. program 1')}${klfField(p,'kegiatan','Kegiatan','Nama kegiatan, mis. kegiatan 1')}${klfField(p,'subKeg','Sub kegiatan','Nama sub kegiatan, mis. sub kegiatan 1')}${F2('Sumber klasifikasi',`<p class=mut style="margin:0">Program: ${esc(KL.program.src)} · Kegiatan: ${esc(KL.kegiatan.src)} · Output: ${esc(KL.output.src)} · Sub kegiatan: ${esc(KL.subKeg.src)}. Kolom yang dikosongkan kembali mengikuti sumber yang tertera.</p>`)}
 
 
 <div class="satria342-section-head"><span>03</span><div><b>Rekening & Output</b><small>Data anggaran sebagai dasar dokumen pengadaan</small></div></div>
 ${F('Rekening anggaran (dari Data Master)',`<select data-col="paket" data-id="${p.id}" data-f="akunId"><option value="">— pilih akun anggaran —</option>${S.akun.filter(a=>a.aktif!==false||String(a.id)===String(p.akunId)).map(a=>`<option value="${a.id}" ${a.id===p.akunId?'selected':''}>${esc(a.kode+' - '+a.nama+(a.aktif===false?' (nonaktif)':''))}</option>`).join('')}</select>${S.akun.length?'':'<p class=mut>Belum ada akun anggaran. Tambahkan di Data Master → Akun Anggaran.</p>'}`)}${F2('Output (bisa diisi manual)',TA('output',outOf(p)))}
 <div class="satria342-section-head"><span>04</span><div><b>Penanggung Jawab & Pelaksanaan</b><small>Pejabat, metode pemilihan, dan lokasi penyerahan</small></div></div>
 ${F('PPK',SEL('ppk',pj('PPK')))}${F('Pejabat Pengadaan',SEL('pp',pj('PP')))}${F('Kepala Bidang',SEL('kabid',pj('Kabid')))}
 ${F('Jenis pengadaan',SEL('jenisPengadaan',[['','— Perlu verifikasi sumber —'],['Barang','Barang'],['Jasa Lainnya','Jasa Lainnya'],['Jasa Konsultansi','Jasa Konsultansi'],['Pekerjaan Konstruksi','Pekerjaan Konstruksi']]))}${F('Metode pemilihan',SEL('metodePemilihan',[...new Set(['','E-Purchasing','E-Purchasing dengan Negosiasi Harga','Tender','Tender Cepat','Seleksi','Pengadaan Langsung','Dikecualikan','Penunjukan Langsung','Metode lainnya',p.metodePemilihan].filter(x=>x===''||!!x))].map(x=>[x,x||'— Perlu verifikasi sumber —'])))}${F2('Lokasi/alamat penyerahan',TA('lokasiPengiriman',p.lokasiPengiriman||O(p.opd).tempat||O(p.opd).alamat||''))}
 <div class="satria342-section-head"><span>05</span><div><b>Jadwal & Dokumen</b><small>Tanggal yang menjadi sumber informasi keluaran PDF</small></div></div>
 ${F('Masa pelaksanaan (hari kerja)',I('masaHk','number'))}${F('Batas akhir pekerjaan',I('batas','date'))}${F('Tanggal survei harga',I('tglSurvei','date'))}${F('Tanggal evaluasi penyedia',I('tglEvaluasi','date'))}${F('Tanggal negosiasi',I('tglNego','date'))}${F('Tanggal penetapan',I('tglPenetapan','date'))}
 ${F('Tanggal Nota Dinas',I('tglNodis','date'))}${F('Tanggal DPP',I('tglDpp','date'))}${F('Tanggal SPPBJ',I('tglSppbj','date'))}${F('Tanggal BA Hasil',I('tglBahp','date'))}</div>`;
}
/* SATRIA 2026-11-09 — Rincian & HPS dengan draf eksplisit.
   Input tidak memakai virtual scroll / type=number sehingga scroll dan blur
   tidak mengubah volume atau menulis ke paket. Simpan dilakukan atomik. */
const satriaHpsEditDrafts=new Map();
function satriaHpsDraftKey(pid){
 const uid=window.SATRIA_CLOUD_MEMBER?.id||('local:'+String(S?.ui?.user||'unknown'));
 return JSON.stringify([String(uid),String(pid)]);
}
function satriaHpsCanEdit(p){
 if(!p||!canWrite())return false;
 const scope=activeCloudScope();
 return !scope||(scope.opdIds.includes(String(p.opd))&&scope.years.includes(Number(p.tahun)));
}
function satriaHpsDraft(p){
 const key=satriaHpsDraftKey(p.id);
 if(!satriaHpsEditDrafts.has(key))satriaHpsEditDrafts.set(key,{
   baseline:JSON.stringify(p.items||[]),
   items:(p.items||[]).map(i=>({...i,vol:Number.isFinite(Number(i.vol))&&!Number.isInteger(Number(i.vol))?String(i.vol).replace('.',','):String(i.vol??''),hs:String(i.hs??'')})),
   dirty:false
 });
 return satriaHpsEditDrafts.get(key);
}
function satriaHpsDraftPending(){return [...satriaHpsEditDrafts.values()].some(d=>d.dirty);}
function satriaHpsDraftVolume(value){
 const raw=String(value??'').trim().replace(/\s/g,'');
 // Format Indonesia: 4.849 = 4849 barang; 1,5 = satu setengah.
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw))return Number(raw.replace(/\./g,'').replace(',','.'));
 if(/^\d+(?:,\d+)?$/.test(raw))return Number(raw.replace(',','.'));
 if(/^\d+\.\d{1,2}$/.test(raw))return Number(raw);
 return NaN;
}
function satriaHpsDraftHarga(value){
 const raw=String(value??'').trim().replace(/^Rp\s*/i,'').replace(/\s/g,'');
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(raw))return NaN;
 return Number(raw.replace(/\./g,''));
}
function satriaHpsDraftTotals(d){
 let total=0;
 for(const it of d.items){
  const qty=satriaHpsDraftVolume(it.vol),price=satriaHpsDraftHarga(it.hs);
  if(!Number.isFinite(qty)||!Number.isSafeInteger(price)||qty<=0||price<=0)return null;
  total+=qty*price;
 }
 return Number.isSafeInteger(Math.round(total))?total:null;
}
function satriaHpsDraftMarkup(p){
 const d=satriaHpsDraft(p),count=d.items.length,H=hps(p),preview=satriaHpsDraftTotals(d);
 const editable=satriaHpsCanEdit(p);
 const diff=(+p.pagu||0)-H;
 const field=(it,name,label,value,mode='text')=>`<label class="satria-hps-field satria-hps-${name}"><span>${label}</span><input type="text" inputmode="${mode}" autocomplete="off" data-hps-edit="1" data-pid="${esc(p.id)}" data-id="${esc(it.id)}" data-f="${name}" aria-label="${label}" value="${esc(value)}" ${editable?'':'disabled'}></label>`;
 const rows=d.items.map((it,index)=>{
  const qty=satriaHpsDraftVolume(it.vol),price=satriaHpsDraftHarga(it.hs);
  const subtotal=Number.isFinite(qty)&&Number.isFinite(price)?rp(qty*price):'—';
  return `<div class="satria-hps-entry" data-hps-row="${esc(it.id)}">
    <strong class="satria-hps-num">${index+1}</strong>
    ${field(it,'nama','Nama barang',it.nama||'')}
    ${field(it,'vol','Volume',it.vol??'','decimal')}
    ${field(it,'satuan','Satuan',it.satuan||'')}
    ${field(it,'hs','HPS satuan (Rp)',it.hs===undefined?'':String(it.hs).match(/^\d+$/)?nf(it.hs):it.hs,'numeric')}
    <span class="satria-hps-subtotal" data-hps-subtotal="${esc(it.id)}">${subtotal}</span>
    <button type="button" class="d satria-hps-remove" data-act="hpsdraftdel" data-pid="${esc(p.id)}" data-id="${esc(it.id)}" ${editable?'':'disabled'} title="Tandai barang untuk dihapus setelah Simpan">Hapus</button>
   </div>`;
 }).join('');
 return `<section class="satria342-section-intro" aria-label="Ringkasan rincian dan HPS"><div class="satria342-intro-text"><span class="satria342-eyebrow">TAHAP 02 / RINCIAN & HPS</span><h3>Susun kebutuhan barang</h3><p>Isi semua barang dahulu, lalu klik <b>Simpan Semua Rincian</b>. Angka tersimpan, negosiasi dan dokumen tidak berubah selama masih berupa draf.</p></div><div class="satria342-stat-grid"><div><small>Barang tersimpan</small><strong>${p.items.length}</strong></div><div><small>HPS tersimpan</small><strong>${rp(H)}</strong></div><div class="${diff<0?'satria342-over-budget':''}"><small>${diff<0?'Melebihi pagu':'Sisa pagu'}</small><strong>${rp(Math.abs(diff))}</strong></div></div></section>
 <section class="satria-hps-draft" data-hps-draft="${esc(p.id)}">
  <div class="satria-hps-draft-intro"><div><strong>Isi rincian — ${count} barang</strong><p>Baris tidak dibuat ulang saat digeser. Volume tidak berubah dengan roda mouse. Contoh: 4.849 (ribuan), 1,5 (pecahan). Gunakan Tab untuk berpindah kolom.</p></div><span class="pill" data-hps-status aria-live="polite">${d.dirty?'● Ada isian belum disimpan':'✓ Semua rincian tersimpan'}</span></div>
  <div class="satria-hps-scroller" role="region" aria-label="Daftar isian rincian kebutuhan dan HPS" tabindex="0"><div class="satria-hps-grid-head"><span>No.</span><span>Nama barang</span><span>Volume</span><span>Satuan</span><span>HPS satuan</span><span>Jumlah</span><span>Aksi</span></div>${rows||'<p class="mut" style="padding:16px">Belum ada barang. Klik Tambah Barang untuk mulai.</p>'}</div>
  <div class="satria-hps-draft-bottom"><div class="satria-hps-actions"><button type="button" class="g" data-act="hpsdraftadd" data-pid="${esc(p.id)}" ${editable?'':'disabled'}>+ Tambah Barang</button><button type="button" data-act="hpsdraftsave" data-pid="${esc(p.id)}" ${editable?'':'disabled'}>Simpan Semua Rincian</button><button type="button" class="g" data-act="hpsdraftdiscard" data-pid="${esc(p.id)}" ${editable?'':'disabled'}>Batalkan Perubahan</button></div><div class="satria-hps-preview"><small>Total sementara (belum tersimpan)</small><strong data-hps-preview>${preview===null?'Lengkapi volume & HPS':rp(preview)}</strong><small>Pagu: ${rp(p.pagu)} · ${count} barang</small></div></div>
  <p class="mut satria-hps-guidance">Perubahan baru memengaruhi HPS, penawaran, dan dokumen setelah <b>Simpan Semua Rincian</b>. Isian yang belum disimpan dipertahankan saat berpindah tab di sesi ini; memuat ulang/menutup browser akan membuang draf.</p>
 </section>`;
}
function fItems(p){return satriaHpsDraftMarkup(p);}
function satriaHpsDraftSave(p){
 if(!satriaHpsCanEdit(p)){toast('Tidak memiliki izin menyimpan rincian paket ini.');return false;}
 const d=satriaHpsEditDrafts.get(satriaHpsDraftKey(p.id));if(!d||!d.dirty){toast('Tidak ada perubahan rincian untuk disimpan.');return false;}
 if(JSON.stringify(p.items||[])!==d.baseline){toast('Data rincian paket sudah berubah dari sumber lain. Periksa lalu batalkan draf untuk memuat data terbaru.');return false;}
 const seen=new Set(),next=[];
 for(let i=0;i<d.items.length;i++){
  const r=d.items[i],nama=String(r.nama||'').trim(),satuan=String(r.satuan||'').trim(),vol=satriaHpsDraftVolume(r.vol),hs=satriaHpsDraftHarga(r.hs);
  if(!r.id||seen.has(String(r.id))){toast('ID barang tidak valid/duplikat. Penyimpanan dibatalkan.');return false;}seen.add(String(r.id));
  if(!nama||!satuan||!Number.isFinite(vol)||vol<=0||!Number.isSafeInteger(hs)||hs<=0){toast('Barang '+(i+1)+': isi nama, satuan, volume positif dan HPS satuan positif yang valid.');return false;}
  if(!Number.isSafeInteger(Math.round(vol*hs))){toast('Barang '+(i+1)+': total melebihi batas angka aman.');return false;}
  next.push({...r,nama,satuan,vol,hs});
 }
 const guard=satriaRupUjiPerubahanRincian(p,next);
 if(!guard.ok){toast('Rincian belum disimpan: '+guard.msg);return false;}
 const removed=(p.items||[]).filter(i=>!seen.has(String(i.id)));
 if(window.SATRIA_CLOUD_CONFIGURED&&removed.length){
   toast('Penghapusan item melalui penyimpanan draf gabungan tidak diizinkan di cloud. Arsipkan item satu per satu saat draf bersih; bukti harga/negosiasi tetap dilindungi.');
   return false;
 }
 if(!next.length&&removed.length&&!confirm('Semua barang pada paket ini akan dihapus setelah disimpan. Lanjutkan?'))return false;
 const hasHistory=!!p.pemenangId||(p.penawaran||[]).some(w=>
   Object.values(w.harga||{}).some(x=>Number(x)>0)||Object.values(w.nego||{}).some(x=>Number(x)>0));
 if(hasHistory&&!confirm('Paket ini sudah memiliki harga penawaran atau negosiasi. Menyimpan rincian dapat mengubah hasil perhitungan HPS, indikator, dan dokumen paket INI. Paket lain tidak diubah. Lanjutkan setelah memeriksa backup dan angka historis?'))return false;
 const priced=removed.filter(i=>(p.penawaran||[]).some(w=>[w.harga,w.nego,w.negoDetails,w.catalogRefs].some(m=>m&&Object.prototype.hasOwnProperty.call(m,i.id))));
 if(priced.length&&!confirm('Ada '+priced.length+' barang yang telah memiliki data penawaran/negosiasi. Menghapusnya akan menghapus juga harga dan referensi terkait barang tersebut. Lanjutkan menyimpan penghapusan?'))return false;
 const result=SATRIA.tx('items','Simpan seluruh rincian & HPS paket '+String(p.rup||p.id),()=>{
  // Local edits are archived WITH their dependent prices before the active
  // item and its provider references are changed. Cloud uses a separate RPC.
  if(!window.SATRIA_CLOUD_CONFIGURED)for(const it of removed){
    const offerRefs=[];
    for(const w of (p.penawaran||[])){
      const values={};
      for(const field of ['harga','nego','negoDetails','catalogRefs']){
        if(w[field]&&Object.prototype.hasOwnProperty.call(w[field],it.id))values[field]=w[field][it.id];
      }
      if(Object.keys(values).length)offerRefs.push({offerId:w.id,values});
    }
    window.SATRIA_CORE_GUARDS.archiveSpecial(S,'item',String(it.id),{paketId:p.id,item:it,offerRefs},cur().nama);
  }
  p.items=next;
  for(const it of removed)for(const w of (p.penawaran||[]))for(const field of ['harga','nego','negoDetails','catalogRefs'])if(w[field])delete w[field][it.id];
  return true;
 });
 if(result===null)return false;
 satriaHpsEditDrafts.delete(satriaHpsDraftKey(p.id));
 render();
 return true;
}
/* SATRIA 3.0.49 — Tabel Harga Nego = harga SEBELUM PPN per unit.
   Mesin akuntansi lama dan dokumen tetap menyimpan nominal BRUTO di w.nego;
   rinciannya wajib dapat direkonsiliasi dari kalkulator/Smart Survey.
   Nominal lama yang tidak memiliki rincian pajak tidak diterka sebagai net. */
function satriaOfferNegoBreakdown(w,iid){
 const raw=w?.nego?.[iid],gross=Number(raw);
 if(raw===undefined||raw===null||raw===''||!Number.isFinite(gross)||gross<=0)return {net:null,tax:null,gross:0,verified:false,legacy:false};
 const sources=[
  {base:w?.negoDetails?.[iid]?.beforeTax,tax:w?.negoDetails?.[iid]?.tax,origin:'Kalkulator Nego'},
  {base:w?.catalogRefs?.[iid]?.negotiatedBase,tax:w?.catalogRefs?.[iid]?.negotiatedTax,origin:'Smart Survey'}
 ];
 for(const x of sources){
  const base=Number(x.base),tax=Number(x.tax);
  if(x.base!==undefined&&x.base!==null&&x.base!==''&&Number.isSafeInteger(base)&&base>0&&
     Number.isSafeInteger(Math.round(tax*100))&&tax>=0&&Math.abs(base+tax-gross)<0.005)
   return {net:base,tax,gross,verified:true,legacy:false,origin:x.origin};
 }
 return {net:null,tax:null,gross,verified:false,legacy:true};
}
function satriaOfferNegoCells(w,it){
 const d=satriaOfferNegoBreakdown(w,it.id);
 const description=d.verified?`<small class="kn47-origin">✓ ${esc(d.origin)}</small>`:
  d.legacy?'<small class="mut">⚠ Data lama: PPN belum dirinci. Periksa di Kalkulator Nego.</small>':
  '<small class="mut">Isi di Kalkulator Nego</small>';
 return `<td class=n><input class=n type=text readonly aria-label="Harga nego sebelum PPN ${esc(it.nama)}" title="Harga nego diisi melalui Kalkulator Nego" value="${d.verified?nf(d.net):''}" placeholder="${d.legacy?'Verifikasi pajak':'Dari kalkulator'}" style="width:100%;text-align:right;font-variant-numeric:tabular-nums;min-width:145px;background:#f6f8ff">${description}</td><td class=n>${d.verified?Number(d.tax).toLocaleString('id-ID',{maximumFractionDigits:2}):'—'}</td><td class=n><strong>${d.gross?Number(d.gross).toLocaleString('id-ID',{maximumFractionDigits:2}):'—'}</strong>${d.legacy?'<small class="mut">Nilai lama: pajak belum terverifikasi</small>':''}</td>`;
}
function fNego(p){
 const used=p.penawaran.map(w=>w.pen);
 const opts=S.penyedia.filter(y=>!used.includes(y.id)&&y.aktif!==false).map(y=>`<option value="${y.id}">${esc(y.nama)}</option>`).join('');
 const W=pemenang(p),C=kandidat(p);
 const numOffers=(p.penawaran||[]).length;
 const negoComplete=evalPw(p).filter(e=>e.negoLengkap).length;
 let s=`<section class="satria342-section-intro satria342-nego-intro" aria-label="Ringkasan survei dan negosiasi"><div class="satria342-intro-text"><span class="satria342-eyebrow">TAHAP 03 / SURVEI & NEGOSIASI</span><h3>Bandingkan dan negosiasikan penawaran</h3><p>Lengkapi harga tayang, hasil negosiasi dan bukti referensi sebelum menetapkan penyedia. Total sementara bukan nilai kontrak final.</p></div><div class="satria342-stat-grid"><div><small>Penyedia</small><strong>${numOffers}</strong></div><div><small>Negosiasi lengkap</small><strong>${negoComplete}/${numOffers}</strong></div><div><small>HPS paket</small><strong>${rp(hps(p))}</strong></div></div></section><div class="row satria342-provider-picker"><div class=fg style="max-width:420px"><label>Tambah penyedia ke survei</label><select data-addpw="${p.id}"><option value="">— pilih penyedia —</option>${opts}</select></div></div><br>`;
 s+=`<div class="spha-quick"><div><h3>✦ Smart Analisis Kewajaran Harga</h3><p>Perbandingan otomatis dari ${numOffers} penawaran. Lihat bukti per item, hasil negosiasi, dan cetak laporan pemeriksaan tanpa input ulang.</p></div><button type="button" class="spha-btn" data-spha-action="open" data-pid="${esc(p.id)}">Analisis harga &amp; bukti →</button></div>`;
 if(p.koreksiPenyediaPerluVerifikasi)s+=`<p class=warn><b>⚠ Koreksi identitas penyedia pernah dilakukan.</b> Periksa ulang bukti dan dokumen yang telah terbit (BA Hasil/SPPBJ/surat pesanan). ${p.koreksiPenyediaPerluVerifikasi.ditetapkanUlangPada?'Penetapan sudah dikonfirmasi ulang di SATRIA; ':'Penetapan harus dikonfirmasi ulang; '}koreksi data SATRIA tidak mengubah transaksi resmi. <small>${esc(p.koreksiPenyediaPerluVerifikasi.dari||'')} → ${esc(p.koreksiPenyediaPerluVerifikasi.ke||'')}</small></p>`;
 s+=W?`<p><b>Pemenang ditetapkan:</b> ${esc(PY(W.w.pen).nama)} · nilai kontrak <b>${rp(W.t)}</b> <button class=g data-act="autowin" data-pid="${p.id}">Batalkan penetapan</button></p>`:C?`<p class=warn><b>Kandidat otomatis (belum ditetapkan):</b> ${esc(PY(C.w.pen).nama)} · ${rp(C.negoLengkap?C.t:C.tayang)}. Isi tanggal negosiasi dan harga nego untuk setiap item, lalu tetapkan pemenang.</p>`:'<p class=warn>Belum ada kandidat yang memenuhi kelengkapan dan batas HPS.</p>';if(!W&&p.pemenangId)s+=`<p class=bad>Penetapan sebelumnya tidak lagi valid karena data harga berubah. <button class=g data-act="autowin" data-pid="${p.id}">Batalkan penetapan yang tidak valid</button></p>`;
 s+=evalPw(p).map(({w,t,st,lengkap,negoLengkap,negoCount})=>{const missing=(p.items||[]).filter(i=>!(w.nego&&w.nego[i.id]!=null&&w.nego[i.id]!==''&&Number.isFinite(+w.nego[i.id])&&+w.nego[i.id]>0));const {ready,errors:causes}=satriaOfferGate(p,{w,t,lengkap,negoLengkap,negoCount});
  const above=satriaNegoAboveUnit(p,w),review=w.hpsTotalReview,validReview=satriaNegoReviewValid(p,w),reviewDraft=above.length?satriaHpsReviewFields(p,w):null;
  const otherProviders=(S.penyedia||[]).filter(y=>y.aktif!==false&&String(y.id)!==String(w.pen)&&!(p.penawaran||[]).some(z=>z!==w&&String(z.pen)===String(y.id)));
  const supplierStoreLink=satriaOfferSupplierCatalogLink(w);
  const supplierStoreHref=/^https?:\/\/[^\s\"'<>]+$/i.test(supplierStoreLink)?supplierStoreLink:'';
  const oldCorrections=Array.isArray(w.koreksiIdentitasPenyedia)?w.koreksiIdentitasPenyedia:[];
  const correctionPanel=`<details class="satria-offer-provider-correction" data-provider-correction-pid="${esc(p.id)}" data-provider-correction-wid="${esc(w.id)}"><summary>✎ Koreksi identitas penyedia (salah pilih saat input)</summary>
   <p class="warn"><b>Hanya untuk salah input identitas.</b> Nilai penawaran, harga negosiasi, sumber harga, tanggal dan bukti yang tersimpan harus benar-benar milik penyedia pengganti. Jika tidak, catat penawaran penyedia sebenarnya dari awal. Perubahan ini tidak mengubah kontrak atau transaksi pada sistem resmi.</p>
   <div class="fg"><label>Penyedia yang benar</label><select data-provider-correction-target><option value="">— Pilih penyedia yang sebenarnya —</option>${otherProviders.map(y=>`<option value="${esc(y.id)}">${esc(y.nama)}</option>`).join('')}</select></div>
   <div class="fg"><label>Alasan/kronologi koreksi (wajib)</label><textarea data-provider-correction-reason maxlength="1200" rows="2" placeholder="Contoh: keliru memilih penyedia pada pencatatan RUP; penawaran dan transaksi sebenarnya berasal dari ..."></textarea></div>
   <div class="fg"><label>Referensi bukti asli (wajib)</label><input data-provider-correction-evidence maxlength="300" placeholder="Nomor/tanggal pesanan, hasil negosiasi, BA atau bukti relevan"></div>
   <label class="satria-hps-review-check"><input type="checkbox" data-provider-correction-confirm> Saya telah mencocokkan seluruh harga, tanggal, bukti dan identitas penyedia dengan transaksi asli. Saya memahami penetapan harus dikonfirmasi ulang.</label>
   <button type="button" class="g" data-act="correctOfferProvider" data-pid="${esc(p.id)}" data-id="${esc(w.id)}" ${otherProviders.length?'':'disabled title="Tambahkan penyedia yang benar ke Data Master terlebih dahulu"'}>Simpan koreksi identitas penyedia</button>
   ${otherProviders.length?'':'<p class="mut">Belum tersedia penyedia pengganti. Tambahkan CV Muria di Data Master → Penyedia, lalu kembali ke sini.</p>'}
   </details>`;
  const correctionHistory=oldCorrections.length?`<details class="satria-offer-provider-history"><summary>Riwayat koreksi penyedia (${oldCorrections.length})</summary><ul>${oldCorrections.slice().reverse().map(x=>`<li><b>${esc(x.dariNama||x.dari||'')}</b> → <b>${esc(x.keNama||x.ke||'')}</b> · ${esc(x.pada||'')} · oleh ${esc(x.oleh||'-')}<p>${esc(x.alasan||'')}</p><small>Bukti: ${esc(x.bukti||'-')}</small></li>`).join('')}</ul></details>`:'';

  const reviewPanel=above.length?`<div class="satria-hps-total-review" data-hps-review-pid="${esc(p.id)}" data-hps-review-wid="${esc(w.id)}" role="group" aria-label="Evaluasi harga satuan di atas HPS">
   <b>⚠ ${above.length} item melebihi HPS satuan</b><p>HPS paket: <b>${rp(hps(p))}</b> · Total negosiasi + ongkir: <b>${rp(t)}</b> · Pagu paket: <b>${rp(p.pagu)}</b>.</p>
   <p><b>Indikator kewajaran saja.</b> Item di atas HPS satuan tidak mengunci penetapan apabila total negosiasi, pagu, kelengkapan dan bukti memenuhi syarat. Catatan historis di bawah ini opsional dan tidak berfungsi sebagai persetujuan.</p>
   <details><summary>${validReview?'Lihat catatan historis':'Catat alasan/bukti historis (opsional)'}</summary>
   <div class="fg"><label>Alasan/kronologi harga satuan (opsional; jika disimpan min. 15 karakter)</label><textarea rows="2" maxlength="1200" data-hps-review-reason="${esc(w.id)}" placeholder="Uraikan fakta transaksi sebelumnya, alasan harga item, dan verifikasi terhadap total HPS">${esc(reviewDraft.reason)}</textarea></div>
   <div class="fg"><label>Referensi bukti transaksi (opsional; jika disimpan wajib diisi)</label><input maxlength="300" data-hps-review-evidence="${esc(w.id)}" value="${esc(reviewDraft.evidence)}" placeholder="Nomor surat pesanan/BA negosiasi, tanggal, dan referensi sumber"></div>
   <label class="satria-hps-review-check"><input type="checkbox" data-hps-review-check="${esc(w.id)}" ${reviewDraft.accepted?'checked':''}> Saya telah membandingkan catatan dengan bukti yang ada dan memahami bahwa review aplikasi bukan pengesahan hukum.</label>
   <div class="row"><button type="button" data-act="saveHpsTotalReview" data-pid="${esc(p.id)}" data-id="${esc(w.id)}">Simpan catatan historis (opsional)</button>${review?`<button type="button" class="g" data-act="removeHpsTotalReview" data-pid="${esc(p.id)}" data-id="${esc(w.id)}">Arsipkan catatan historis</button>`:''}</div>
   </details>
   <p class="mut">${validReview?'Catatan tercatat: '+esc(review.recordedAt||'')+' oleh '+esc(review.actor||'operator')+'.':review?'Catatan lama tidak cocok lagi dengan rincian terkini.':'Pencatatan alasan opsional.'} Pemeriksaan total HPS, pagu, sumber, dan kelengkapan tetap wajib.</p>
   </div>`:'';
  return `<div class="card satria-offer-card satria342-offer-card" data-offer-wid="${esc(w.id)}"><div class="satria-offer-head"><b class="satria-offer-name">${esc(PY(w.pen).nama)}</b><div class="satria50-offer-badges"><span class="pill satria-offer-status">${esc(st)}</span>${W?.w?.id===w.id?'<span class="satria50-winner-badge">✓ Penyedia ditetapkan</span>':''}</div></div><div class="satria-offer-summary"><div><small>Harga tayang</small><strong>${rp(totPw(p,w,false))}</strong></div><div><small>${negoLengkap?'Hasil negosiasi':'Total sementara (belum final)'}</small><strong>${rp(t)}</strong></div></div><div class="satria-offer-progress"><span>${negoCount} dari ${p.items.length} item dinegosiasi</span><progress max="${Math.max(1,p.items.length)}" value="${negoCount}"></progress></div>${reviewPanel}${!ready?`<p class="satria-offer-warning">Belum dapat ditetapkan: ${esc(causes.join(' • ')||'Lengkapi evaluasi')}. ${missing.length?'Item belum nego: '+esc(missing.slice(0,4).map(i=>i.nama).join(', '))+(missing.length>4?' dan '+(missing.length-4)+' lainnya':'')+'.':''}</p>`:''}<div class="satria-offer-actions"><button type="button" class="g kn47-open-calc" data-act="openOfferCalc" data-pid="${esc(p.id)}" data-id="${esc(w.id)}">↗ Kalkulator Nego</button><button type="button" class="satria50-winner-action" data-act="winner" data-pid="${esc(p.id)}" data-id="${esc(w.id)}" ${W?.w?.id===w.id?'disabled title="Penyedia ini sudah ditetapkan"':ready?'':'disabled title="Lengkapi seluruh syarat sebelum penetapan"'}>${W?.w?.id===w.id?'✓ Sudah ditetapkan':'✓ Tetapkan pemenang'}</button><button class=d data-act="delpw" data-pid="${p.id}" data-id="${w.id}">Hapus penawaran</button></div>${correctionPanel}${correctionHistory}
 <div class=grid><div class=fg><label>Sumber/bukti harga</label><input value="${esc(satriaOfferPriceSource(w))}" ${satriaOfferSupplierCatalogLink(w)?'readonly title="Tautan e-Katalog penyedia diatur di Data Master → Penyedia"':''} data-col="offerMeta" data-pid="${p.id}" data-pw="${w.id}" data-f="sumberHarga" placeholder="Link toko dari Data Master / referensi manual"><small class="mut">${supplierStoreLink?`Mengikuti Data Master → Penyedia. URL produk tersimpan terpisah pada Smart Survey.${supplierStoreHref?` <a href="${esc(supplierStoreHref)}" target="_blank" rel="noopener noreferrer">Buka toko e-Katalog penyedia ↗</a>`:''}`:'Link toko belum dicatat pada Data Master → Penyedia. Isi di Data Master untuk sumber resmi penyedia.'}</small></div><div class=fg><label>Tanggal harga</label><input type=date value="${esc(w.tanggalHarga||'')}" data-col="offerMeta" data-pid="${p.id}" data-pw="${w.id}" data-f="tanggalHarga"></div><div class=fg><label>Ongkos kirim (Rp, dicatat terpisah)</label><input inputmode=numeric value="${nf(w.ongkir||0)}" data-col="offerMeta" data-pid="${p.id}" data-pw="${w.id}" data-f="ongkir"></div><div class=fg><label>Catatan/ketentuan</label><input value="${esc(w.catatan||'')}" data-col="offerMeta" data-pid="${p.id}" data-pw="${w.id}" data-f="catatan"></div></div>
 <p class=mut>Ongkos kirim dicatat terpisah dan dihitung satu kali dalam total evaluasi HPS dan pagu paket. Pastikan komponen ongkir dan pajak cocok dengan transaksi sebenarnya sebelum menetapkan penyedia.</p>
 <div class="satria342-offer-table-title"><b>Harga per rincian barang</b><span>Harga Nego = <strong>usulan tawaran SEBELUM PPN/unit</strong> dari Kalkulator Nego. Harga akhir dipakai untuk total dan dokumen.</span></div><div class="satria-offer-table"><table><tr><th>Barang</th><th class=n>Vol</th><th class=n>HPS</th><th class=n>Harga tayang termasuk PPN</th><th class=n>Harga Nego SEBELUM PPN/unit</th><th class=n>PPN/unit</th><th class=n>Harga akhir/unit</th></tr>
 ${p.items.map(it=>`<tr><td>${esc(it.nama)}</td><td class=n>${it.vol}</td><td class=n>${nf(it.hs)}</td>
 <td class=n><input class=n type=text inputmode=numeric value="${w.harga[it.id]?nf(w.harga[it.id]):''}" data-col="harga" data-rp="1" data-pid="${p.id}" data-pw="${w.id}" data-id="${it.id}" style="width:100%;text-align:right;font-variant-numeric:tabular-nums"></td>
 ${satriaOfferNegoCells(w,it)}</tr>`).join('')}</table></div></div>`}).join('');
 return s;
}

/* ===== DOKUMEN OTOMATIS ===== */
/* SATRIA 3.0.43: jangan biarkan fixture demonstrasi mengisi paket nyata.
   Data pengguna tidak dihapus saat membaca; nilai demo lama dapat dibersihkan secara eksplisit. */
function satriaIsDemoPaket(p){
  return String(p?.rup||'').trim()==='DEMO-RUP-0001' || /^PAKET DEMO\b/i.test(String(p?.nama||''));
}
function satriaIsDemoSubCode(value){return String(value??'').trim()==='KODE-DEMO-001';}
function satriaValidSubCode(value){
  const code=String(value??'').trim();
  return satriaIsDemoSubCode(code)?'':code;
}
function satriaSubKegiatanDetail(p){
  if(!p)return {v:'',src:'belum diisi'};
  const realDemo=satriaIsDemoPaket(p);
  const manual=String(p.subKeg??'').trim();
  if(manual && (realDemo || !/\bKODE-DEMO-001\b|^Kegiatan Simulasi$/i.test(manual)))return {v:manual,src:'paket'};
  const manualLines=klfLines(p.subKegKode??'',p.subKegNama??'').join('\n').trim();
  if(manualLines && (realDemo||!/\bKODE-DEMO-001\b|^Kegiatan Simulasi$/i.test(manualLines)))return {v:manualLines,src:'paket'};
  const rawCode=String(p.sub??'').trim();
  if(!rawCode || (satriaIsDemoSubCode(rawCode)&&!realDemo))return {v:'',src:'belum diisi'};
  const k=(S.kode||[]).find(x=>String(x.kode)===rawCode);
  const name=String(k?.nama||'').trim();
  return {v:name?rawCode+' — '+name:rawCode,src:k?'Data Master':'paket'};
}
function satriaSubKegiatan(p){return satriaSubKegiatanDetail(p).v;}
function satriaPaketAdaSubDemo(p){
  return !!p&&!satriaIsDemoPaket(p)&&satriaIsDemoSubCode(p.sub)
    && !String(p.subKeg??'').trim() && !String(p.subKegKode??'').trim() && !String(p.subKegNama??'').trim();
}
function satriaSubDemoJumlah(){
  return (S.paket||[]).filter(satriaPaketAdaSubDemo).length
    +(S.rupBank||[]).filter(r=>satriaIsDemoSubCode(r.sub)&&String(r.rup||'')!=='DEMO-RUP-0001').length;
}
function klasifikasiDetail(p){
  const validCode=satriaValidSubCode(p.sub);
  const k=validCode?(S.kode||[]).find(x=>String(x.kode)===validCode)||{}:{};
  const pick=(manual,dm,meta)=>{
    if(String(manual??'').trim())return {v:String(manual),src:'paket'};
    if(String(dm??'').trim())return {v:String(dm),src:'Data Master'};
    const fallback=String(meta??'').trim();
    // Seed bukan sumber program/kegiatan/output resmi untuk paket nyata.
    if(!satriaIsDemoPaket(p)&&['Program Demo','Kegiatan Simulasi','Output simulasi untuk demonstrasi aplikasi'].includes(fallback))return {v:'',src:'belum diisi'};
    return fallback?{v:fallback,src:'default Pengaturan'}:{v:'',src:'belum diisi'};
  };
  return {
    program:pick(p.program,k.program,S.meta?.program),
    kegiatan:pick(p.kegiatan,k.kegiatan,S.meta?.kegiatan),
    output:pick(p.output,k.output,S.meta?.output),
    subKeg:satriaSubKegiatanDetail(p)
  };
}
function klasifikasi(p){const d=klasifikasiDetail(p);return {program:d.program.v,kegiatan:d.kegiatan.v,output:d.output.v,subKeg:d.subKeg.v}}
const progOf=p=>klasifikasi(p).program;const outOf=p=>klasifikasi(p).output;const kegOf=p=>klasifikasi(p).kegiatan;const subOf=p=>klasifikasi(p).subKeg;
const vf=n=>(+n||0).toLocaleString('id-ID',{maximumFractionDigits:2});
const OP=p=>O(p.opd);
const unitOf=p=>(S.unit||[]).find(u=>u.id===p.unit)||(S.unit||[]).find(u=>u.opd===p.opd)||{kode:'',bidang:''};
const nomor=(t,p)=>`${S.penomoran?.[t]||'[KODE DOKUMEN]'}/${p.rup||'[KODE RUP]'}/${OP(p).singkat||'[SINGKATAN OPD]'}${unitOf(p).kode?'/'+unitOf(p).kode:''}`;
const kop=p=>{const o=OP(p);if(satriaSafeMediaSrc(o.kop))return `<div class="kop kop-image"><img src="${satriaSafeMediaSrc(o.kop)}" alt="Kop ${esc(o.singkat)}" style="width:100%;display:block;max-height:42mm;object-fit:contain"></div>`;const namaPemda=satriaPemdaOfficial('nama');return `<div class="kop kop-text" style="text-align:center;margin-bottom:10px">${S.pemda.logo?`<img src="${satriaSafeMediaSrc(S.pemda.logo)}" alt="Logo pemerintah daerah" style="height:56px;max-width:100%;object-fit:contain;margin-bottom:6px"><br>`:''}<div style="font-size:15px;font-weight:bold">${esc(namaPemda||'[Nama pemerintah daerah belum diatur]')}</div><div style="font-size:14px;font-weight:bold">${esc(satriaIdentityPlaceholder(o.nama)?'[Nama OPD belum diatur]':o.nama.toUpperCase())}</div><div style="font-size:11px;margin-top:4px">${esc(o.alamat)}</div><div style="font-size:11px">${esc(o.kontak||'')}</div><hr style="border:0;border-top:2.5px solid #000;margin:10px 0 4px"></div>`};
const SATRIA_FOOTER='';
const sig=(x,jab)=>`<div style="float:right;text-align:center;width:300px;margin-top:24px">${jab}<br>${(x.ttd||x.cap)?`<div style="height:70px">${x.ttd?`<img src="${satriaSafeMediaSrc(x.ttd)}" alt="Tanda tangan" style="height:60px;vertical-align:middle">`:''}${x.cap?`<img src="${satriaSafeMediaSrc(x.cap)}" alt="Stempel" style="height:65px;vertical-align:middle;margin-left:-16px">`:''}</div>`:'<br><br><br>'}<b><u>${esc(x.nama)}</u></b><br>NIP. ${esc(x.nip)}</div><div style="clear:both"></div>`;
const itemLabel=i=>esc(i.nama);
function tabelItems(p){const H=hps(p);return `<table class="tbl-items-standard"><thead><tr><th>No</th><th>Nama Barang dan Spesifikasi</th><th>Vol</th><th>Satuan</th><th>Harga Satuan (Rp)</th><th>Jumlah (Rp)</th></tr></thead><tbody>${p.items.map((i,n)=>`<tr><td>${n+1}</td><td>${itemLabel(i)}</td><td>${vf(i.vol)}</td><td>${esc(i.satuan)}</td><td style="text-align:right">${nf(i.hs)}</td><td style="text-align:right">${nf(i.vol*i.hs)}</td></tr>`).join('')}<tr><th colspan=5 style="text-align:right">Jumlah</th><th style="text-align:right">${nf(H)}</th></tr></tbody></table><p><i>Terbilang: ${terb(H)}</i></p>`}

/* SATRIA 3.0.59.18 — Rekonsiliasi dokumen, tidak mengubah data penawaran. */
function satriaDocPricing(p,w){
 const rows=Array.isArray(p.items)?p.items:[];
 let net=0,tax=0,gross=0,valid=rows.length>0;
 for(const item of rows){
  const qty=Number(item.vol)||0, unit=Number(w?.nego?.[item.id]);
  const d=w?.negoDetails?.[item.id];
  const base=Number(d?.beforeTax),ppn=Number(d?.tax),included=Number(d?.inclusive);
  if(!(qty>0)||!Number.isFinite(unit)||unit<=0){valid=false;continue;}
  gross+=qty*unit;
  if(!d||!Number.isFinite(base)||!Number.isFinite(ppn)||base<0||ppn<0||Math.abs(base+ppn-unit)>1||
     (Number.isFinite(included)&&included>0&&Math.abs(included-unit)>1))valid=false;
  else {net+=qty*base;tax+=qty*ppn;}
 }
 const shipping=Math.max(0,Number(w?.ongkir)||0);
 // Dasar + pajak diperiksa pada nilai tepat, kemudian disajikan bulat pada subtotal.
 const grossRounded=Math.round(gross),netRounded=Math.round(net);
 return {net:netRounded,tax:valid?grossRounded-netRounded:Math.round(tax),gross:grossRounded,
  shipping,total:Math.round(gross+shipping),verified:valid};
}
/* Template dokumen dipisahkan ke satria-document-templates.js (Tahap 4). */


/* SATRIA 3.0.40 — narrow document-output sanitizer (templates, not arbitrary rich HTML).
   This protects the document preview from user-supplied markup in fields. */
function satriaSafeDocHtml(source){
 const t=document.createElement('template');t.innerHTML=String(source??'');
 const forbidden='script,iframe,object,embed,applet,form,input,button,select,textarea,meta,link,base,style,svg,math,video,audio,source';
 t.content.querySelectorAll(forbidden).forEach(n=>n.remove());
 t.content.querySelectorAll('*').forEach(el=>{
   [...el.attributes].forEach(a=>{
     const key=a.name.toLowerCase(),v=a.value.trim();
     if(key.startsWith('on')||key==='srcdoc'||key==='formaction'||key==='xlink:href')el.removeAttribute(a.name);
     else if((key==='href'||key==='src') && !(
       /^(https?:\/\/)/i.test(v)||
       (key==='src' && /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(v))||
       (key==='src' && /^satria-media:\/\/[0-9a-f-]{36}\/(?:opd|shared)\//i.test(v))||
       /^(?:\.\/|\.\.\/)[a-z0-9_./%-]+$/i.test(v)
     ))el.removeAttribute(a.name);
     else if(key==='style' && /(?:url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding)/i.test(v))el.removeAttribute(a.name);
   });
   if(el.tagName==='A')el.setAttribute('rel','noopener noreferrer');
 });
 return t.innerHTML;
}

function satria35912DocumentWarnings(p,doc){
 const notes=[];
 const dppId=String(p.docPpkSettings?.[doc]?.ppkId || (doc==='dpp'||doc==='reviu'?p.dppPpkId:p.ppk)||p.ppk||'');
 const packetId=String(p.ppk||'');
 if(dppId&&packetId&&dppId!==packetId && ['idkb','sppbj','spek','bahp','reviu','dpp','metode'].includes(doc)){
  const a=satriaDppSigner(p),b=PJ(p.ppk);
  notes.push('PPK penandatangan '+doc.toUpperCase()+' ('+String((S.pejabat||[]).find(x=>String(x.id)===dppId)?.nama||'belum ditemukan')+') berbeda dari PPK paket ('+String(b?.nama||'belum ditemukan')+'). Pastikan kewenangan sebelum disahkan. Pilihan pejabat tidak diganti otomatis.');
 }
 if(doc==='sppbj') notes.push('Dokumen nomor 6 adalah Surat Perintah Pengadaan kepada Pejabat Pengadaan, bukan surat penunjukan pemenang. Pastikan nomor, tujuan, dan tata naskah dinas yang berlaku.');
 if(doc==='metode') notes.push('Isian Persyaratan Lain Yang Diperlukan berstatus Perlu konfirmasi. Lengkapi/validasi secara resmi sebelum formulir ditandatangani.');
 if(doc==='reviu') notes.push('Isi hasil reviu harus dicocokkan dengan berita acara pemeriksaan yang benar-benar dilakukan dan bukti paket.');
 if(doc==='bahepe'||doc==='rfi'||doc==='survei') notes.push('Periksa PDN/UMKM, spesifikasi, dan bukti katalog pada setiap referensi penyedia; hasil pembanding bukan penetapan pemenang otomatis.');
 if(doc==='kknego' && p.pemenangId && !pemenang(p))notes.push('Pemenang tersimpan belum lolos pemeriksaan harga/HPS/pagu. Perbaiki penawaran dan penetapan sebelum pengesahan.');
 return notes;
}
function satria35912WarningPanel(p,doc){
 const a=satria35912DocumentWarnings(p,doc);if(!a.length)return '';
 return `<section class="card no-print" style="border:1px solid #d9a441;background:#fffbeb;margin:12px 0" role="note"><b style="color:#7c4808">Pemeriksaan khusus sebelum pengesahan</b><ul style="margin:8px 0 0 18px;font-size:12px">${a.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><small>Catatan ini tidak dimasukkan ke PDF dan tidak mengganti pejabat atau keputusan pengguna.</small></section>`;
}
function warnDoc(p){
 const m=docMiss(p,S.ui.dok);
 const pj=[['PPK',p.ppk],['Pejabat Pengadaan',p.pp],['Kabid',p.kabid]].filter(([,id])=>!S.pejabat.some(x=>x.id===id)).map(([r])=>'pejabat '+r);
 const all=[...m,...pj];
 return all.length?`<div class="card no-print" style="border-color:#e0a800"><b class=warn>Dokumen belum lengkap</b><p class=mut>Perlu: ${all.join(', ')}. Lengkapi melalui menu Paket Pengadaan atau Data Master.</p></div>`:'';
}
function vDok(){
 const L=filt(),selected=P(S.ui.dpid),p=selected&&!satriaSpseIs(selected)?selected:L[0];
 if(!p)return '<div class=card>Belum ada paket pada tahun ini. Tambahkan paket melalui menu Paket Pengadaan.</div>';
 const T=[['nodis','1 Nota Dinas'],['idkb','2 Identifikasi Kebutuhan Pengadaan'],['rfi','3 Hasil Permintaan Informasi (RFI)'],['bahepe','4 Berita Acara Evaluasi Penyedia'],['metode','5 Formulir Penetapan E-Purchasing'],['sppbj','6 Surat Perintah Pengadaan kepada PP'],['spek','7 Spesifikasi Teknis'],['dpp','8 Dokumen Persiapan Pengadaan (DPP)'],['lamp','9 Lampiran Referensi Harga'],['reviu','10 Berita Acara Reviu DPP'],['bahp','11 Berita Acara Hasil Pemilihan'],['survei','12 Survei Harga'],['hpsnego','13 HPS dan Negosiasi'],['kknego','14 Kertas Kerja Negosiasi'],['analisa','15 Analisis Kewajaran Harga & Bukti']];
 const docContent = DOCS[S.ui.dok] ? satriaSafeDocHtml(DOCS[S.ui.dok](p)) : '<p class=mut>Dokumen tidak tersedia</p>';
 return `
    <div class="card no-print satria-dok-toolbar">
      <div class="row" style="gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div class="fg" style="min-width:300px;flex:1">
          <label>Pilih Entitas / Program (Kode RUP)</label>
          <select id="selPaket" class="satria-select">${L.slice().sort((a,b)=>String(a.rup).localeCompare(String(b.rup))).map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.rup)} — ${esc(x.nama)}</option>`).join('')}</select>
        </div>
        <button data-act="print" class="satria-btn-primary" style="height:40px;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
          Cetak / PDF
        </button>
      </div>
      <div class="doc-tabs-scroll" style="margin-top:12px">
        ${T.map(([k,t])=>`<button class="master-tab ${k===S.ui.dok?'active':''}" data-act="dtype" data-tab="${k}" title="${t}">${t}</button>`).join('')}
      </div>
      <p class="mut" style="margin:10px 0 0;font-size:12px">Seluruh template dokumen diselaraskan dengan struktur contoh workbook. Data/bukti yang tidak tersedia ditandai untuk verifikasi. • Lazy load + virtual scroll aktif • Generated by SATRIA Framework</p>
    </div>
    ${window.SATRIA_DOC_PPK?.panel?.(p,S.ui.dok)||''}${S.ui.dok==='dpp'?(window.SATRIA_DPP_PREFLIGHT?.panel?.(p)||''):''}${S.ui.dok==='dpp'?(window.SATRIA_DPP_FORMAT?.panel?.(p)||''):''}
    ${warnDoc(p)}
    ${window.SATRIA_PBJ_WORKSPACE?.panel?.(p)||''}
      ${window.SATRIA_HPS_GENERATOR?.panel?.(p)||''}
    <div id="dokLazyContainer" class="satria-doc-lazy-container">
      <div class="doc doc-${S.ui.dok} ${S.ui.dok==='rfi'?'doc-landscape':'doc-portrait'}" data-document-type="${esc(S.ui.dok)}" data-lazy="true">
        ${docContent}
      </div>
    </div>
  `;
}

/* SATRIA AUDIT 2026-11-03 — Laporan & Analisis menggunakan indikator yang sejenis.
   Pagu RUP unik tidak dijumlahkan ulang per paket. Penetapan e-Purchasing
   bukan pembayaran SPSE; selisih HPS hanya dihitung untuk paket yang terpilih. */
function satriaLaporanData(){
 const byGroup=new Map();
 const selectedOpd=String(S.ui.opd||'all');
 const bankIds=new Set((S.rupBank||[]).map(r=>String(r.id)));
 const bankKeys=new Set((S.rupBank||[]).map(r=>rupBankKey(r)));
 const scope=activeCloudScope();
 const allowed=(opd,year)=>(selectedOpd==='all'||String(opd)===selectedOpd)&&(!scope||(scope.opdIds.includes(String(opd))&&scope.years.includes(Number(year))));
 function group(t,o){const id=String(t)+'|'+String(o);if(!byGroup.has(id))byGroup.set(id,{tahun:Number(t),opd:String(o),rup:0,terpakai:0,sisa:0,rupValid:0,rupPerluCek:0,ep:0,spse:0,paguPaket:0,hps:0,penetapan:0,hematHps:0,epTerpilih:0,nilaiKontrak:0,bayar:0,spseTerlambat:0,spseMasalah:0,paketTanpaRup:0,kontrakPerluCek:0});return byGroup.get(id)}
 // Reuse the audited Bank RUP engine, including legacy links and multi-RUP splits.
 const years=new Set([...(S.tahun||[]).map(Number),...(S.rupBank||[]).map(r=>Number(r.tahun)),...(S.paket||[]).map(p=>Number(p.tahun))]);
 for(const year of years){if(!Number.isInteger(year))continue;
  const metrics=satriaDashboardRupMetrics(year);
  for(const item of metrics.rows){const r=item.rup;if(!r||!allowed(r.opd,year))continue;const g=group(year,r.opd);
   if(!item.valid){g.rupPerluCek++;continue}
   g.rupValid++;g.rup+=item.pagu;g.terpakai+=item.used;g.sisa+=item.free;
   if(item.level>0)g.rupPerluCek++;
  }
 }
 for(const p of S.paket||[]){if(!allowed(p.opd,p.tahun))continue;
  const g=group(p.tahun,p.opd);g.paguPaket+=Number(p.pagu)||0;
  const links=satriaRupLinks(p);if(links.length?!links.every(id=>bankIds.has(id)):!bankKeys.has(rupBankKey(p)))g.paketTanpaRup++;
  if(satriaSpseIs(p)){
    g.spse++;const m=p.spseMonitoring||{};
    const cv=satriaSpseContractValue(m);
    // Do not report a draft contract value as contracted without a contract number.
    if(cv>0&&String(m.contractNo||'').trim())g.nilaiKontrak+=cv;
    g.bayar+=satriaSpsePayments(m,true);
    if((cv>0&&!String(m.contractNo||'').trim())||satriaSpsePayments(m,true)>Math.max(0,cv))g.kontrakPerluCek++;
    g.spseTerlambat+=(m.stages||[]).filter(x=>satriaSpseStageAlert(x)==='Terlambat').length;
    g.spseMasalah+=(m.issues||[]).filter(x=>x.status!=='Selesai').length;
  }else{
    g.ep++;const hp=hps(p);g.hps+=hp;
    // This is an award/selected supplier estimate, not an executed contract.
    const selected=pemenang(p);
    if(selected){const val=Number(selected.t)||0;g.penetapan+=val;g.hematHps+=hp-val;g.epTerpilih++}
  }
 }
 return [...byGroup.values()].sort((a,b)=>a.tahun-b.tahun||a.opd.localeCompare(b.opd,'id'));
}
function satriaLaporanCsvCell(value){return window.SATRIA_CORE_GUARDS.csvCell(value)}
function satriaLaporanDownloadCsv(filename,headers,rows){
 const lines=[headers,...rows].map(row=>row.map(satriaLaporanCsvCell).join(','));
 const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
/* SATRIA 2026-11-09 — laporan pengadaan menurut rekening anggaran.
 * Read-only: akunId paket -> Data Master akun, tanpa menebak dari RUP/meta.
 * Pembatasan OPD dan tahun berasal dari scope cloud yang sama dengan laporan utama.
 * Pagu di sini adalah penjumlahan pagu PAKET, bukan pagu unik DPA/RUP/rekening.
 */
function satriaLaporanRekeningScope(){
 const scope=activeCloudScope(),selectedOpd=String(S.ui.opd||'all');
 return (S.paket||[]).filter(p=>
   (selectedOpd==='all'||String(p.opd)===selectedOpd)&&
   (!scope||(scope.opdIds.includes(String(p.opd))&&scope.years.includes(Number(p.tahun))))
 );
}
function satriaLaporanRekeningId(p){
 const id=String(p?.akunId??'').trim();
 return id?'akun:'+id:'tanpa';
}
function satriaLaporanRekeningNama(key,akunById){
 if(key==='tanpa')return {kode:'—',nama:'Belum ditautkan ke rekening',status:'tanpa'};
 const id=key.slice(5),a=akunById.get(id);
 return a?{kode:String(a.kode||'—'),nama:String(a.nama||'Tanpa uraian'),status:'valid'}:
   {kode:'—',nama:'Rekening tidak ditemukan di Data Master (ID: '+id+')',status:'hilang'};
}
function satriaLaporanRekeningRows(){
 const scoped=satriaLaporanRekeningScope();
 const akunById=new Map((S.akun||[]).map(a=>[String(a.id),a]));
 const options=new Map(scoped.map(p=>[satriaLaporanRekeningId(p),satriaLaporanRekeningNama(satriaLaporanRekeningId(p),akunById)]));
 const years=[...new Set(scoped.map(p=>Number(p.tahun)).filter(Number.isInteger))].sort((a,b)=>b-a);
 const validYears=new Set(years.map(String));
 const year=String(S.ui.lapRekeningTahun||'all');
 const selectedYear=year==='all'||validYears.has(year)?year:'all';
 const key=String(S.ui.lapRekeningAkun||'all');
 const selectedKey=key==='all'||options.has(key)?key:'all';
 const query=String(S.ui.lapRekeningCari||'').trim().toLocaleLowerCase('id-ID');
 const filtered=scoped.filter(p=>{
   if(selectedYear!=='all'&&String(p.tahun)!==selectedYear)return false;
   const k=satriaLaporanRekeningId(p);
   if(selectedKey!=='all'&&k!==selectedKey)return false;
   if(!query)return true;
   const a=options.get(k);
   return [p.nama,p.rup,p.id,a?.kode,a?.nama,O(p.opd).nama,O(p.opd).singkat].some(v=>String(v??'').toLocaleLowerCase('id-ID').includes(query));
 });
 const groups=new Map(),details=[];
 for(const p of filtered){
   const key=satriaLaporanRekeningId(p),account=options.get(key);
   const id=JSON.stringify([Number(p.tahun),String(p.opd),key]);
   if(!groups.has(id))groups.set(id,{tahun:Number(p.tahun),opd:String(p.opd),key,...account,
     total:0,ep:0,spse:0,pagu:0,hps:0,penetapan:0,selisihHps:0,ditetapkan:0,kontrak:0,bayar:0});
   const g=groups.get(id),spse=satriaSpseIs(p),m=p.spseMonitoring||{};
   const hv=spse?0:hps(p);
   const winner=spse?null:pemenang(p);
   const award=winner?Number(winner.t)||0:0;
   // Selisih hanya dihitung untuk paket dengan penetapan tervalidasi; jangan
   // kurangi total HPS paket yang masih dalam proses dengan nilai nol.
   const selisihHps=winner?hv-award:null;
   const contract=spse&&String(m.contractNo||'').trim()?satriaSpseContractValue(m):0;
   const paid=spse?satriaSpsePayments(m,true):0;
   g.total++;g.pagu+=Number(p.pagu)||0;
   if(spse){g.spse++;g.kontrak+=contract;g.bayar+=paid}
   else{g.ep++;g.hps+=hv;g.penetapan+=award;if(winner){g.ditetapkan++;g.selisihHps+=selisihHps}}
   details.push({tahun:Number(p.tahun),opd:String(p.opd),key,...account,
     id:String(p.id),rup:String(p.rup||''),paketNama:String(p.nama||''),rekeningStatus:account.status,spse,
     pagu:Number(p.pagu)||0,hps:hv,penetapan:award,selisihHps,kontrak:contract,bayar:paid,
     status:spse?String(m.status||'Belum diisi'):stt(p)});
 }
 const sort=(a,b)=>b.tahun-a.tahun||String(a.opd).localeCompare(String(b.opd),'id')||String(a.kode).localeCompare(String(b.kode),'id')||String(a.nama).localeCompare(String(b.nama),'id');
 return {groups:[...groups.values()].sort(sort),details:details.sort(sort),options,years,
   selectedYear,selectedKey,query,totalScope:scoped.length};
}
function vLaporanRekening(){
 const data=satriaLaporanRekeningRows(),groups=data.groups,details=data.details;
 const total=groups.reduce((a,g)=>{for(const k of ['total','ep','spse','pagu','hps','penetapan','selisihHps','ditetapkan','kontrak','bayar'])a[k]+=g[k];return a},
   {total:0,ep:0,spse:0,pagu:0,hps:0,penetapan:0,selisihHps:0,ditetapkan:0,kontrak:0,bayar:0});
 const without=details.filter(p=>p.rekeningStatus==='tanpa'||p.rekeningStatus==='hilang').length;
 const unique=new Set(details.filter(p=>p.rekeningStatus==='valid').map(p=>p.key)).size;
 const options=[...data.options.entries()].sort((a,b)=>a[1].kode.localeCompare(b[1].kode,'id')).map(([k,a])=>`<option value="${esc(k)}" ${data.selectedKey===k?'selected':''}>${esc(a.kode+' — '+a.nama)}</option>`).join('');
 const groupRows=groups.map(g=>`<tr class="${g.status!=='valid'?'satria-rek-warning':''}"><td>${esc(g.tahun)}</td><td>${esc(O(g.opd).singkat||O(g.opd).nama||g.opd)}</td><td><b>${esc(g.kode)}</b><small>${esc(g.nama)}</small></td><td class="n">${g.total}</td><td class="n">${g.ep}</td><td class="n">${g.spse}</td><td class="n">${g.ditetapkan}</td><td class="n">${g.ep-g.ditetapkan}</td><td class="n">${rp(g.pagu)}</td><td class="n">${rp(g.hps)}</td><td class="n">${rp(g.penetapan)}</td><td class="n">${g.ditetapkan?rp(g.selisihHps):'—'}</td><td class="n">${rp(g.kontrak)}</td><td class="n">${rp(g.bayar)}</td></tr>`).join('');
 const detailRows=details.slice(0,300).map(p=>`<tr class="${p.rekeningStatus==='tanpa'||p.rekeningStatus==='hilang'?'satria-rek-warning':''}"><td>${esc(p.tahun)}</td><td>${esc(O(p.opd).singkat||O(p.opd).nama||p.opd)}</td><td><b>${esc(p.kode)}</b><small>${esc(p.nama)}</small></td><td><b>${esc(p.paketNama)}</b><small>RUP: ${esc(p.rup||'—')} · ${p.spse?'SPSE':'E-Purchasing'}</small></td><td class="n">${rp(p.pagu)}</td><td class="n">${rp(p.hps)}</td><td class="n">${rp(p.penetapan)}</td><td class="n">${p.selisihHps===null?'—':rp(p.selisihHps)}</td><td class="n">${rp(p.kontrak)}</td><td class="n">${rp(p.bayar)}</td><td>${esc(p.status)}</td><td><button type="button" class="g" data-act="lapRekeningOpen" data-id="${esc(p.id)}">Buka</button></td></tr>`).join('');
 return `<section class="card satria-rek" id="satriaLaporanRekening" aria-label="Laporan pengadaan per rekening anggaran">
 <div class="satria-rek-heading"><div><span class="satria-rek-eyebrow">ANALISIS REKENING ANGGARAN</span><h3>Pengadaan Berdasarkan Kode Rekening</h3><p class="mut">Rekap e-Purchasing dan SPSE berdasarkan <b>Rekening Anggaran</b> yang dipilih pada Data Paket. OPD mengikuti filter di header SATRIA; tahun dan rekening dapat difilter di bawah.</p></div><div class="satria-rek-actions"><button type="button" class="g" data-act="lapRekeningCsv">Ekspor Rekap CSV</button><button type="button" class="g" data-act="lapRekeningDetailCsv">Ekspor Paket CSV</button></div></div>
 <div class="satria-rek-filter"><label>Tahun Anggaran<select id="lapRekeningTahun"><option value="all">Semua tahun yang dapat diakses</option>${data.years.map(y=>`<option value="${y}" ${data.selectedYear===String(y)?'selected':''}>${y}</option>`).join('')}</select></label><label>Rekening Anggaran<select id="lapRekeningAkun"><option value="all">Semua rekening</option>${options}</select></label><label>Cari paket, RUP, atau kode rekening<input id="lapRekeningCari" type="search" placeholder="Ketik lalu Enter / klik Cari" value="${esc(S.ui.lapRekeningCari||'')}"></label><button type="button" class="g" data-act="lapRekeningCari">Cari</button><button type="button" class="g" data-act="lapRekeningReset">Reset</button></div>
 <div class="satria-rek-kpi"><div><small>Rekening tercatat</small><b>${unique}</b></div><div><small>Paket terfilter</small><b>${total.total}</b></div><div><small>Pagu paket tercatat</small><b>${rp(total.pagu)}</b></div><div class="satria-rek-kpi-key"><small>Total HPS E-P</small><b>${rp(total.hps)}</b></div><div class="satria-rek-kpi-key"><small>Total Penetapan E-P</small><b>${rp(total.penetapan)}</b></div><div><small>Selisih HPS–Penetapan*</small><b>${total.ditetapkan?rp(total.selisihHps):'—'}</b></div><div><small>Kontrak SPSE tercatat</small><b>${rp(total.kontrak)}</b></div></div>
 ${without?`<p class="satria-rek-attention" role="status">⚠ ${without} paket belum ditautkan ke rekening atau mengacu pada rekening yang tidak ditemukan di Data Master. Lengkapi Data Paket → Rekening Anggaran agar laporannya akurat.</p>`:''}
 <p class="mut satria-rek-note">*Selisih HPS–Penetapan hanya untuk ${total.ditetapkan} paket e-Purchasing dengan penetapan valid; bukan penghematan kas. Paket yang belum ditetapkan tidak ikut selisih. Nilai negatif tetap ditampilkan. Pagu yang tampil adalah <b>jumlah pagu paket tercatat</b>, bukan pagu DPA/rekening unik atau sisa anggaran. HPS, penetapan e-Purchasing, kontrak SPSE, dan pembayaran adalah indikator berbeda; jangan dijumlahkan sebagai realisasi belanja. Laporan bersifat baca-saja dan mencakup paket arsip dalam cakupan akun.</p>
 <h4>Rekap per rekening · Tahun · OPD</h4><div class="table-wrap satria-rek-scroll"><table><thead><tr><th>TA</th><th>OPD</th><th>Kode / Uraian Rekening</th><th>Paket</th><th>E-P</th><th>SPSE</th><th>E-P ditetapkan</th><th>E-P belum ditetapkan</th><th>Pagu paket</th><th>HPS E-P</th><th>Penetapan E-P</th><th>Selisih HPS–Penetapan*</th><th>Kontrak SPSE</th><th>Bayar SPSE terverifikasi</th></tr></thead><tbody>${groupRows||'<tr><td colspan="14">Tidak ada paket yang sesuai filter.</td></tr>'}</tbody></table></div>
 <h4>Daftar paket penyusun rekap</h4><div class="table-wrap satria-rek-scroll"><table><thead><tr><th>TA</th><th>OPD</th><th>Rekening</th><th>Nama Paket / RUP</th><th>Pagu paket</th><th>HPS</th><th>Penetapan</th><th>Selisih HPS–Penetapan*</th><th>Kontrak SPSE</th><th>Bayar SPSE terverifikasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${detailRows||'<tr><td colspan="14">Tidak ada paket yang sesuai filter.</td></tr>'}</tbody></table></div><small class="mut">Menampilkan ${Math.min(details.length,300)} dari ${details.length} paket. Ekspor CSV memuat <b>semua</b> paket yang cocok dengan filter. Tombol Buka menuju paket sesuai penugasan OPD/tahun akun.</small>
 </section>`;
}
function satriaLaporanRekeningCsv(detail=false){
 const {groups,details}=satriaLaporanRekeningRows();
 if(detail){
   const headers=['TA','OPD','Kode rekening','Uraian rekening','Kondisi rekening','ID Paket','Kode RUP','Nama paket','Jalur','Pagu paket tercatat','HPS E-P','Penetapan E-P','Selisih HPS–Penetapan (penetapan valid saja)','Kontrak SPSE dengan nomor kontrak','Bayar SPSE terverifikasi','Status','Tanggal negosiasi','Tanggal kontrak SPSE','Arsip'];
   const rows=details.map(p=>[p.tahun,O(p.opd).singkat||O(p.opd).nama||p.opd,p.kode,p.nama,p.rekeningStatus,p.id,p.rup,p.paketNama,p.spse?'SPSE':'E-Purchasing',p.pagu,p.hps,p.penetapan,p.selisihHps===null?'':p.selisihHps,p.kontrak,p.bayar,p.status, (S.paket||[]).find(x=>String(x.id)===p.id)?.tglNego||'',(S.paket||[]).find(x=>String(x.id)===p.id)?.spseMonitoring?.contractDate||'',(S.paket||[]).find(x=>String(x.id)===p.id)?.arsip===true?'Ya':'Tidak']);
   return satriaLaporanDownloadCsv('satria-paket-per-rekening.csv',headers,rows);
 }
 const headers=['TA','OPD','Kode rekening','Uraian rekening','Kondisi rekening','Jumlah paket','Paket E-P','Paket SPSE','Pagu paket tercatat','HPS E-P','Penetapan E-P','Selisih HPS–Penetapan (penetapan valid saja)','Kontrak SPSE dengan nomor kontrak','Bayar SPSE terverifikasi','Paket E-P ditetapkan valid','Paket E-P belum ditetapkan'];
 const rows=groups.map(g=>[g.tahun,O(g.opd).singkat||O(g.opd).nama||g.opd,g.kode,g.nama,g.status,g.total,g.ep,g.spse,g.pagu,g.hps,g.penetapan,g.ditetapkan?g.selisihHps:'',g.kontrak,g.bayar,g.ditetapkan,g.ep-g.ditetapkan]);
 return satriaLaporanDownloadCsv('satria-rekap-per-rekening.csv',headers,rows);
}

/* SATRIA 3.0.59.49 — audit kelengkapan laporan.
 * Hanya baca dari cakupan laporan rekening aktif (OPD/TA/rekening/pencarian).
 * Temuan adalah pekerjaan verifikasi data, BUKAN keputusan kelayakan hukum.
 */
const SATRIA_LAP_AUDIT_LABELS={
 'rekening-kosong':'Rekening belum ditautkan',
 'rekening-hilang':'Rekening tidak ditemukan',
 'rup-kosong':'Referensi Bank RUP perlu periksa',
 'rup-scope':'RUP tertaut ke OPD/TA berbeda',
 'pagu-kosong':'Pagu paket belum valid',
 'hps-belum':'Rincian HPS belum lengkap',
 'hps-pagu':'HPS melampaui pagu paket',
 'penetapan-gate':'Penetapan tercatat perlu verifikasi ulang',
 'kontrak-nomor':'Nilai kontrak SPSE tanpa nomor kontrak',
 'kontrak-pagu':'Kontrak SPSE melampaui pagu paket',
 'bayar-kontrak':'Pembayaran SPSE terverifikasi melebihi kontrak',
 'bayar-bukti':'Pembayaran SPSE tanpa kontrak bernomor'
};
function satriaLaporanAuditRows(){
 const filtered=satriaLaporanRekeningRows();
 const byId=new Map((S.paket||[]).map(p=>[String(p.id),p]));
 const byRupId=new Map((S.rupBank||[]).map(r=>[String(r.id),r]));
 const rupKeys=new Set((S.rupBank||[]).map(r=>rupBankKey(r)));
 const findings=[];
 const summary={paket:filtered.details.length,ep:0,spse:0,ditetapkan:0,menunggu:0,kontrak:0,
   arsip:0,temuanPaket:0,temuan:0,hps:0,penetapan:0,pagu:0,bayar:0};
 for(const d of filtered.details){
  const p=byId.get(d.id);if(!p)continue;
  const spse=d.spse,items=Array.isArray(p.items)?p.items:[];
  const h=Number(d.hps)||0,pg=Number(p.pagu),win=spse?null:pemenang(p);
  const add=(kode,catatan)=>findings.push({kode,kategori:SATRIA_LAP_AUDIT_LABELS[kode],catatan, tahun:d.tahun,opd:d.opd,
    rekening:d.kode, paket:d.paketNama,rup:d.rup,id:d.id,jalur:spse?'SPSE':'E-Purchasing'});
  summary.pagu+=Number.isFinite(pg)?pg:0;
  summary.hps+=h;summary.penetapan+=Number(d.penetapan)||0;summary.bayar+=Number(d.bayar)||0;
  if(p.arsip===true)summary.arsip++;
  if(spse){summary.spse++;if(d.kontrak>0)summary.kontrak++}
  else{summary.ep++;if(win)summary.ditetapkan++;else summary.menunggu++}
  if(d.rekeningStatus==='tanpa')add('rekening-kosong','Pilih rekening anggaran pada Data Paket.');
  else if(d.rekeningStatus==='hilang')add('rekening-hilang','Akun rekening yang dirujuk tidak ada di Data Master.');
  const refs=satriaRupLinks(p);
  if(refs.length){
   const missing=refs.filter(id=>!byRupId.has(String(id)));
   if(missing.length)add('rup-kosong','ID RUP tertaut tidak ditemukan di Bank RUP.');
   const cross=refs.filter(id=>{const r=byRupId.get(String(id));return r&&(String(r.opd)!==String(p.opd)||Number(r.tahun)!==Number(p.tahun))});
   if(cross.length)add('rup-scope','RUP yang ditautkan memiliki OPD atau tahun berbeda.');
  }else if(!rupKeys.has(rupBankKey(p)))add('rup-kosong','Kode RUP paket tidak ditemukan pada Bank RUP untuk OPD dan tahun yang sama.');
  if(!Number.isFinite(pg)||pg<=0)add('pagu-kosong','Pagu paket belum berupa nilai positif.');
  if(!spse){
   if(!items.length||items.some(i=>!String(i.nama||'').trim()||!Number.isFinite(Number(i.vol))||Number(i.vol)<=0||!Number.isFinite(Number(i.hs))||Number(i.hs)<=0))
    add('hps-belum','Periksa nama barang, volume, dan HPS satuan.');
   if(Number.isFinite(pg)&&pg>0&&h>pg)add('hps-pagu','HPS terhitung melebihi pagu paket; periksa nilai sumber.');
   if(p.pemenangId&&!win)add('penetapan-gate','Ada ID pemenang tersimpan, tetapi penetapan tidak lolos validasi data saat ini. Jangan menyimpulkan nilainya nol tanpa memeriksa bukti historis.');
  }else{
   const m=p.spseMonitoring||{},cv=Number(satriaSpseContractValue(m))||0,
     paid=Number(satriaSpsePayments(m,true))||0,hasNo=!!String(m.contractNo||'').trim();
   if(cv>0&&!hasNo)add('kontrak-nomor','Nilai kontrak tercatat tetapi nomor kontrak kosong.');
   if(Number.isFinite(pg)&&pg>0&&cv>pg)add('kontrak-pagu','Nilai kontrak termasuk addendum melebihi pagu paket.');
   if(paid>Math.max(cv,0))add('bayar-kontrak','Pembayaran terverifikasi lebih besar dari nilai kontrak yang tercatat.');
   if(paid>0&&!hasNo)add('bayar-bukti','Ada pembayaran terverifikasi tetapi nomor kontrak kosong.');
  }
 }
 summary.temuan= findings.length;
 summary.temuanPaket=new Set(findings.map(f=>f.id)).size;
 const selected=String(S.ui.lapAuditJenis||'all');
 const visible=selected==='all'||SATRIA_LAP_AUDIT_LABELS[selected]?selected:'all';
 const counts=Object.fromEntries(Object.keys(SATRIA_LAP_AUDIT_LABELS).map(k=>[k,0]));
 findings.forEach(f=>counts[f.kode]++);
 return {summary,findings,counts,selected:visible,shown:findings.filter(f=>visible==='all'||f.kode===visible),filtered};
}
function vLaporanAudit(){
 const {summary,counts,selected,shown}=satriaLaporanAuditRows();
 const options=Object.entries(SATRIA_LAP_AUDIT_LABELS).filter(([id])=>counts[id]>0)
  .map(([id,label])=>`<option value="${esc(id)}" ${selected===id?'selected':''}>${esc(label)} (${counts[id]})</option>`).join('');
 const rows=shown.slice(0,200).map(f=>`<tr><td>${esc(f.tahun)}</td><td>${esc(O(f.opd).singkat||O(f.opd).nama||f.opd)}</td>
  <td><b>${esc(f.paket)}</b><small>RUP: ${esc(f.rup||'—')} · Rekening: ${esc(f.rekening)}</small></td><td>${esc(f.jalur)}</td>
  <td><b>${esc(f.kategori)}</b><small>${esc(f.catatan)}</small></td><td><button type="button" class="g" data-act="lapRekeningOpen" data-id="${esc(f.id)}">Buka</button></td></tr>`).join('');
 return `<section class="card satria-rek satria-lap-audit" id="satriaLaporanAudit" aria-label="Audit kelengkapan laporan">
  <div class="satria-rek-heading"><div><span class="satria-rek-eyebrow">AUDIT DATA • BACA SAJA</span><h3>Kelengkapan & Tindak Lanjut Laporan</h3>
  <p class="mut">Mengikuti filter tahun, rekening, pencarian, dan OPD pada laporan di atas. Temuan menandai data yang perlu diperiksa, bukan keputusan kepatuhan atau perubahan transaksi.</p></div>
  <div class="satria-rek-actions"><button type="button" class="g" data-act="lapAuditCsv">Ekspor Temuan CSV</button></div></div>
  <div class="satria-rek-kpi"><div><small>Total paket</small><b>${summary.paket}</b></div><div><small>E-P sudah ditetapkan valid</small><b>${summary.ditetapkan}</b></div><div><small>E-P belum ditetapkan valid</small><b>${summary.menunggu}</b></div><div><small>Paket SPSE</small><b>${summary.spse}</b></div><div><small>Arsip dalam cakupan</small><b>${summary.arsip}</b></div><div class="satria-rek-kpi-key"><small>Paket perlu diperiksa</small><b>${summary.temuanPaket}</b></div><div><small>Total catatan pemeriksaan</small><b>${summary.temuan}</b></div><div><small>Kontrak SPSE bernomor</small><b>${summary.kontrak}</b></div></div>
  <div class="satria-lap-audit-toolbar"><label>Jenis temuan<select id="lapAuditJenis"><option value="all">Semua temuan (${summary.temuan})</option>${options}</select></label><small>Menampilkan ${Math.min(shown.length,200)} dari ${shown.length} temuan. CSV memuat seluruh temuan sesuai filter.</small></div>
  <div class="table-wrap satria-rek-scroll"><table><thead><tr><th>TA</th><th>OPD</th><th>Nama Paket / RUP / Rekening</th><th>Jalur</th><th>Temuan / Tindak Lanjut</th><th>Aksi</th></tr></thead><tbody>${rows||(summary.paket?'<tr><td colspan="6">Tidak ditemukan masalah kelengkapan pada data yang terfilter. Tetap cocokkan dengan dokumen resmi.</td></tr>':'<tr><td colspan="6">Tidak ada paket pada cakupan filter ini.</td></tr>')}</tbody></table></div>
  <p class="mut satria-rek-note">Status penetapan memakai validasi SATRIA saat laporan dibuka. Pemenang historis yang tidak memenuhi validasi terkini ditandai untuk pemeriksaan, tidak dihapus. Pemeriksaan tidak mencakup dokumen eksternal atau saldo DPA yang tidak tersimpan di SATRIA.</p>
 </section>`;
}
function satriaLaporanAuditCsv(){
 const {shown}=satriaLaporanAuditRows();
 return satriaLaporanDownloadCsv('satria-audit-kelengkapan-pengadaan.csv',
 ['Tahun','OPD','Kode Rekening','Nama Paket','RUP','ID Paket','Jalur','Jenis Temuan','Catatan Tindak Lanjut'],
 shown.map(f=>[f.tahun,O(f.opd).singkat||O(f.opd).nama||f.opd,f.rekening,f.paket,f.rup,f.id,f.jalur,f.kategori,f.catatan]));
}
/* SATRIA NEXT 3.0.59.50 — Visual command center laporan (baca-saja).
 * Semua grafik berbagi sumber/filter/scope server laporan rekening & audit.
 * Tanpa library eksternal; data nominal tidak direkayasa dan tidak dijumlah
 * silang antara HPS, penetapan, kontrak, maupun pembayaran.
 */
const SATRIA_LV_METRICS={hps:'HPS E-Purchasing',penetapan:'Penetapan E-Purchasing',pagu:'Pagu paket tercatat'};
function satriaLaporanVisualData(){
 const rekening=satriaLaporanRekeningRows(),audit=satriaLaporanAuditRows();
 const totals={paket:0,ep:0,spse:0,ditetapkan:0,hps:0,penetapan:0,pagu:0,kontrak:0,bayar:0};
 const accounts=new Map(),yearMap=new Map();
 for(const g of rekening.groups){
  for(const k of Object.keys(totals))if(k in g)totals[k]+=Number(g[k])||0;
  let a=accounts.get(g.key);
  if(!a){a={key:g.key,kode:g.kode,nama:g.nama,status:g.status,paket:0,hps:0,penetapan:0,pagu:0};accounts.set(g.key,a)}
  for(const k of ['hps','penetapan','pagu'])a[k]+=Number(g[k])||0;
  a.paket+=g.total;
  let y=yearMap.get(g.tahun);
  if(!y){y={tahun:g.tahun,hps:0,penetapan:0,pagu:0};yearMap.set(g.tahun,y)}
  for(const k of ['hps','penetapan','pagu'])y[k]+=Number(g[k])||0;
 }
 totals.paket=rekening.details.length;
 totals.ep=audit.summary.ep;
 totals.spse=audit.summary.spse;
 totals.ditetapkan=audit.summary.ditetapkan;
 return {rekening,audit,totals,
  accounts:[...accounts.values()].sort((a,b)=>b.hps-a.hps||b.paket-a.paket),
  years:[...yearMap.values()].sort((a,b)=>a.tahun-b.tahun)};
}
function satriaLaporanVisualCompact(n){
 const v=Math.abs(Number(n)||0),sign=Number(n)<0?'-':'';
 const f=(v,unit)=>sign+'Rp '+v.toLocaleString('id-ID',{maximumFractionDigits:1})+' '+unit;
 if(v>=1e12)return f(v/1e12,'T');
 if(v>=1e9)return f(v/1e9,'M');
 if(v>=1e6)return f(v/1e6,'jt');
 if(v>=1e3)return f(v/1e3,'rb');
 return sign+'Rp '+Math.round(v).toLocaleString('id-ID');
}
function satriaLaporanVisualTrend(years){
 if(!years.length)return '<p class="satria-lv-empty">Belum ada data tahunan pada filter ini.</p>';
 const data=years.slice(-8),W=650,H=216,l=40,r=12,t=16,b=36;
 const max=Math.max(1,...data.flatMap(y=>[y.hps,y.penetapan]))*1.08;
 const x=i=>l+(data.length===1?.5:i/(data.length-1))*(W-l-r);
 const y=v=>H-b-Math.max(0,v)/max*(H-t-b);
 const grid=[0,.25,.5,.75,1].map(f=>`<line x1="${l}" x2="${W-r}" y1="${y(max*f).toFixed(2)}" y2="${y(max*f).toFixed(2)}" class="satria-lv-gridline"/><text x="${l-6}" y="${(y(max*f)+4).toFixed(2)}" text-anchor="end" class="satria-lv-axis">${esc(satriaLaporanVisualCompact(max*f))}</text>`).join('');
 const line=(key,cls)=>{
  const pts=data.map((v,i)=>[x(i),y(v[key])]);
  return `<polyline class="satria-lv-line ${cls}" points="${pts.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ')}"/>`+
   data.map((v,i)=>`<circle class="satria-lv-dot ${cls}" cx="${pts[i][0].toFixed(2)}" cy="${pts[i][1].toFixed(2)}" r="4.8"><title>TA ${v.tahun} • ${key==='hps'?'HPS':'Penetapan'} ${rp(v[key])}</title></circle>`).join('')};
 const ticks=data.map((v,i)=>`<text x="${x(i).toFixed(2)}" y="${H-11}" text-anchor="middle" class="satria-lv-axis">${esc(v.tahun)}</text>`).join('');
 return `<svg class="satria-lv-trend-svg" role="img" aria-label="Tren tahunan total HPS dan total penetapan e-Purchasing" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${line('hps','satria-lv-purple')}${line('penetapan','satria-lv-green')}${ticks}</svg>`;
}
function vLaporanVisual(){
 const d=satriaLaporanVisualData(),{totals,rekening,audit}=d;
 const chosen=String(S.ui.lapVizMetric||'hps');
 const metric=Object.hasOwn(SATRIA_LV_METRICS,chosen)?chosen:'hps';
 const top=[...d.accounts].sort((a,b)=>(b[metric]-a[metric])||b.paket-a.paket).slice(0,7);
 const max=Math.max(1,...top.map(a=>a[metric]));
 const wait=audit.summary.menunggu,valid=audit.summary.ditetapkan,spse=audit.summary.spse;
 const num=Math.max(0,valid+wait+spse),p1=num?valid*100/num:0,p2=num?(valid+wait)*100/num:0;
 const yearOptions=rekening.years.map(y=>`<option value="${y}" ${rekening.selectedYear===String(y)?'selected':''}>${y}</option>`).join('');
 const bars=top.map(a=>`<button type="button" class="g satria-lv-barline" data-act="lapVizAccount" data-key="${esc(a.key)}" aria-label="Filter rekening ${esc(a.kode)}">
  <span class="satria-lv-barlabel"><b>${esc(a.kode)}</b><small>${esc(a.nama)}</small></span>
  <span class="satria-lv-rail"><span class="satria-lv-fill" style="width:${Math.min(100,Math.max(0,a[metric]/max*100)).toFixed(2)}%"></span></span>
  <strong>${esc(satriaLaporanVisualCompact(a[metric]))}</strong></button>`).join('');
 const topAudit=Object.entries(audit.counts).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6);
 const maxAudit=Math.max(1,...topAudit.map(([,v])=>v));
 const auditBars=topAudit.map(([code,count])=>`<button type="button" class="g satria-lv-auditline" data-act="lapVizAudit" data-kind="${esc(code)}" aria-label="Lihat temuan ${esc(SATRIA_LAP_AUDIT_LABELS[code])}">
  <span>${esc(SATRIA_LAP_AUDIT_LABELS[code])}</span><span class="satria-lv-audittrack"><i style="width:${(count/maxAudit*100).toFixed(2)}%"></i></span><b>${count}</b></button>`).join('');
 const table=top.map((a,i)=>`<tr><td class="satria-lv-rank">${i+1}</td><td><b>${esc(a.kode)}</b><small>${esc(a.nama)}</small></td><td class="n">${a.paket}</td><td class="n">${rp(a.hps)}</td><td class="n">${rp(a.penetapan)}</td><td><button type="button" class="g" data-act="lapVizAccount" data-key="${esc(a.key)}">Fokus</button></td></tr>`).join('');
 return `<section class="satria-lv" id="satriaLaporanVisual" aria-label="Dashboard visual Laporan dan Analisis">
  <div class="satria-lv-hero"><div><span class="satria-lv-eyebrow">SATRIA INSIGHTS • LAPORAN & ANALISIS</span><h2>Pengadaan dalam satu pandangan<span class="satria-lv-dot-title">.</span></h2><p>Data nyata dari paket dan rekening yang dapat diakses. Pahami tren, bandingkan nilai, temukan tindak lanjut.</p>
  <div class="satria-lv-meta"><span>● Baca-saja</span><span>● Termasuk paket arsip</span><span>● OPD sesuai akses akun</span></div></div>
  <div class="satria-lv-hero-filter"><label for="lapVizYear">Tahun anggaran</label><select id="lapVizYear" aria-label="Filter tahun dashboard"><option value="all">Semua TA diizinkan</option>${yearOptions}</select><small>Atur rekening dan pencarian pada tab Rekening Anggaran.</small></div></div>
  <div class="satria-lv-kpis">
   <div class="satria-lv-kpi"><span>HPS e-Purchasing</span><strong>${rp(totals.hps)}</strong><small>Nilai HPS terfilter, bukan realisasi</small><i class="satria-lv-kpi-stroke is-purple"></i></div>
   <div class="satria-lv-kpi"><span>Nilai penetapan E-P</span><strong>${rp(totals.penetapan)}</strong><small>Hanya penetapan tervalidasi</small><i class="satria-lv-kpi-stroke is-green"></i></div>
   <div class="satria-lv-kpi"><span>Paket dalam cakupan</span><strong>${totals.paket.toLocaleString('id-ID')}</strong><small>${valid} E-P ditetapkan • ${wait} menunggu • ${spse} SPSE</small><i class="satria-lv-kpi-stroke is-blue"></i></div>
   <div class="satria-lv-kpi"><span>Perlu ditinjau</span><strong>${audit.summary.temuanPaket.toLocaleString('id-ID')}</strong><small>${audit.summary.temuan} catatan pemeriksaan data</small><i class="satria-lv-kpi-stroke is-amber"></i></div>
  </div>
  <div class="satria-lv-grid">
   <article class="satria-lv-panel"><div class="satria-lv-heading"><div><span class="satria-lv-chip">01 • KOMPOSISI</span><h3>Status paket pengadaan</h3></div><span class="satria-lv-caption">Berdasarkan jumlah paket</span></div>
    <div class="satria-lv-donut-layout"><div class="satria-lv-donut" data-empty="${num?'false':'true'}" role="img" aria-label="${valid} E-P ditetapkan, ${wait} E-P menunggu, ${spse} paket SPSE" style="--lv-stop1:${p1.toFixed(3)}%;--lv-stop2:${p2.toFixed(3)}%"><div><strong>${num.toLocaleString('id-ID')}</strong><small>Paket</small></div></div>
     <div class="satria-lv-legend"><div><i class="satria-lv-legend-color is-purple"></i><span>E-P ditetapkan</span><strong>${valid}</strong></div><div><i class="satria-lv-legend-color is-amber"></i><span>E-P menunggu</span><strong>${wait}</strong></div><div><i class="satria-lv-legend-color is-green"></i><span>SPSE</span><strong>${spse}</strong></div></div></div>
    <p class="satria-lv-foot">Status e-Purchasing berdasar validasi pemenang saat laporan dibuka. SPSE dipisahkan dari penetapan E-P.</p></article>
   <article class="satria-lv-panel"><div class="satria-lv-heading"><div><span class="satria-lv-chip">02 • REKENING</span><h3>Rekening dengan nilai terbesar</h3></div><label class="satria-lv-metric-control">Ukuran<select id="lapVizMetric"><option value="hps" ${metric==='hps'?'selected':''}>HPS</option><option value="penetapan" ${metric==='penetapan'?'selected':''}>Penetapan</option><option value="pagu" ${metric==='pagu'?'selected':''}>Pagu paket</option></select></label></div>
     <div class="satria-lv-bars">${bars||'<p class="satria-lv-empty">Belum ada rekening pada filter ini.</p>'}</div>
     <p class="satria-lv-foot">7 rekening teratas menurut ${esc(SATRIA_LV_METRICS[metric])}; klik batang untuk memfilter rinciannya. Nilai dijumlah dari paket per rekening, bukan saldo DPA.</p></article>
   <article class="satria-lv-panel"><div class="satria-lv-heading"><div><span class="satria-lv-chip">03 • TREN</span><h3>HPS vs penetapan per tahun</h3></div><span class="satria-lv-caption">Maks. 8 tahun terakhir</span></div>
     ${satriaLaporanVisualTrend(d.years)}<div class="satria-lv-line-legend"><span><i class="is-purple"></i>HPS E-P</span><span><i class="is-green"></i>Penetapan E-P</span></div>
     <p class="satria-lv-foot">Dua seri nilai yang berbeda, tidak dihitung sebagai pembayaran. Semua grafik mengikuti filter yang sama.</p></article>
   <article class="satria-lv-panel"><div class="satria-lv-heading"><div><span class="satria-lv-chip">04 • AUDIT DATA</span><h3>Jenis temuan paling sering</h3></div><span class="satria-lv-caption">12 kategori pemeriksaan</span></div>
     <div class="satria-lv-auditbars">${auditBars||'<p class="satria-lv-empty">Tidak ada temuan pada cakupan ini.</p>'}</div>
     <p class="satria-lv-foot">Satu paket dapat memuat beberapa temuan. Klik kategori untuk melihat daftar paket yang perlu diperiksa, bukan penilaian hukum.</p></article>
  </div>
  <article class="satria-lv-panel satria-lv-table-panel"><div class="satria-lv-heading"><div><span class="satria-lv-chip">05 • PRIORITAS</span><h3>Rekening teratas • rincian cepat</h3></div><span class="satria-lv-caption">HPS dan penetapan ditampilkan terpisah</span></div>
   <div class="satria-lv-table-wrap"><table><thead><tr><th>#</th><th>Rekening anggaran</th><th class="n">Paket</th><th class="n">HPS E-P</th><th class="n">Penetapan E-P</th><th>Aksi</th></tr></thead><tbody>${table||'<tr><td colspan="6">Belum ada data rekening pada filter ini.</td></tr>'}</tbody></table></div>
   <p class="satria-lv-foot">Tabel visual menampilkan 7 rekening teratas sesuai ukuran grafik; untuk seluruh rekening, semua paket, serta ekspor gunakan tab Rekening Anggaran.</p></article>
  <p class="satria-lv-scope">Cakupan: ${rekening.selectedYear==='all'?'semua tahun yang diizinkan':'TA '+esc(rekening.selectedYear)} • ${rekening.selectedKey==='all'?'semua rekening':'rekening terpilih'} • ${rekening.query?'pencarian aktif':'tanpa pencarian'} • mengikuti OPD header. Tab Bank RUP & SPSE memiliki cakupan seluruh tahun yang diizinkan dan dijelaskan terpisah.</p>
 </section>`;
}
function vLap(){
 const data=satriaLaporanData(), totals=data.reduce((a,g)=>{for(const k of ['rup','terpakai','sisa','ep','spse','paguPaket','hps','penetapan','hematHps','nilaiKontrak','bayar','rupPerluCek','paketTanpaRup','kontrakPerluCek'])a[k]=(a[k]||0)+g[k];return a},{});
 const cards=[['Pagu RUP unik',totals.rup||0,'Tidak dijumlahkan berulang per paket'],['Penggunaan RUP terhitung',totals.terpakai||0,'Nilai penetapan valid atau HPS/cadangan non-final'],['Sisa kapasitas RUP',totals.sisa||0,'Bukan saldo kas / realisasi'],['Kontrak SPSE tercatat',totals.nilaiKontrak||0,'Nilai kontrak dan addendum dengan nomor kontrak'],['Pembayaran SPSE terverifikasi',totals.bayar||0,'Bukan progres fisik; tidak termasuk e-Purchasing'],['HPS e-Purchasing',totals.hps||0,'HPS paket yang tercatat, bukan penetapan'],['Nilai penetapan E-Purchasing',totals.penetapan||0,'Bukan nilai kontrak atau pembayaran']];
 const rows=data.map(g=>`<tr><td>${g.tahun}</td><td>${esc(O(g.opd).singkat||g.opd)}</td><td class=n>${g.rupValid}</td><td class=n>${rp(g.rup)}</td><td class=n>${rp(g.terpakai)}</td><td class=n>${rp(g.sisa)}</td><td class=n>${g.ep}</td><td class=n>${g.spse}</td><td class=n>${rp(g.hps)}</td><td class=n>${rp(g.penetapan)}</td><td class=n>${rp(g.hematHps)}</td><td class=n>${rp(g.nilaiKontrak)}</td><td class=n>${rp(g.bayar)}</td><td class=n>${g.rupPerluCek}</td><td class=n>${g.spseTerlambat+g.spseMasalah}</td></tr>`).join('');
 const active=['overview','rekening','audit','rup'].includes(S.ui.lapView)?S.ui.lapView:'overview';
 const options=[['overview','Dashboard','Ringkasan & grafik'],['rekening','Rekening anggaran','HPS & penetapan'],['audit','Kualitas data','Temuan & tindak lanjut'],['rup','Bank RUP & SPSE','Rekap terintegrasi']];
 const nav=`<nav class="satria-lap-nav" role="tablist" aria-label="Bagian laporan dan analisis">${options.map(([id,name,desc])=>`<button type="button" role="tab" id="lapTab-${id}" aria-controls="lapPanel-${id}" aria-selected="${active===id}" tabindex="${active===id?'0':'-1'}" class="satria-lap-nav-item ${active===id?'is-active':''}" data-act="lapView" data-view="${id}"><b>${name}</b><small>${desc}</small></button>`).join('')}</nav>`;
 const panel=(id,content)=>`<div class="satria-lap-tab-panel" id="lapPanel-${id}" role="tabpanel" aria-labelledby="lapTab-${id}" ${active===id?'':'hidden'}>${content}</div>`;
 return `<div class="satria-lap-shell" id="satriaLaporanShell"><div class="satria-lap-topline"><div><span class="satria-lap-topline-icon">◈</span><span>LAPORAN &amp; ANALISIS</span></div><span class="satria-lap-topline-status">Data sesuai kewenangan akun · Baca saja</span></div>${nav}
 ${panel('overview',vLaporanVisual())}
 ${panel('rekening',vLaporanRekening())}
 ${panel('audit',vLaporanAudit())}
 <div class="satria-lap-tab-panel" id="lapPanel-rup" role="tabpanel" aria-labelledby="lapTab-rup" ${active==='rup'?'':'hidden'}><section class="card" data-satria-laporan="integrated"><div class="row" style="justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><h3>Laporan dan Analisis • E-Purchasing + Monitoring SPSE</h3><div class="row" style="gap:8px"><button class="g" data-act="csv">Ekspor Ringkasan (CSV)</button><button class="g" data-act="csvDetail">Ekspor Paket (CSV)</button></div></div>
 <p class="mut">Ringkasan terintegrasi di bagian ini selalu mencakup <b>semua tahun yang diizinkan</b> dalam OPD header. Filter tahun/rekening pada tab Rekening Anggaran berlaku juga pada tab Kualitas Data, tetapi tidak pada rekap Bank RUP & SPSE ini.</p>
 <p class="mut">Sumber: data SATRIA terakhir yang berhasil dimuat sesuai akses Anda, termasuk paket arsip. Nilai RUP adalah anggaran sumber, penggunaannya merupakan perhitungan HPS/cadangan sebelum penetapan dan nilai pemenang tervalidasi setelah penetapan paket RUP tunggal; penetapan e-Purchasing bukan pembayaran, dan pembayaran SPSE hanya yang berstatus terverifikasi. Laporan tidak mengubah data. Informasi SPSE yang dicatat manual perlu dibandingkan dengan SPSE resmi.</p>
 <div class="satria-lap-metrics">${cards.map(([l,v,d])=>`<div class="card satria-lap-metric"><span class="satria-lap-label">${esc(l)}</span><b class="satria-lap-value">${rp(v)}</b><small class="satria-lap-note">${esc(d)}</small></div>`).join('')}</div>
 <p class="mut">Total ${totals.ep||0} paket e-Purchasing, ${totals.spse||0} paket SPSE, ${totals.rupPerluCek||0} kelompok RUP perlu perhatian, ${totals.paketTanpaRup||0} paket dengan referensi RUP tidak ditemukan, ${totals.kontrakPerluCek||0} catatan kontrak/pembayaran SPSE perlu periksa. Selisih HPS–penetapan hanya dihitung untuk paket e-Purchasing dengan pemenang terpilih; selisih negatif tetap dilaporkan. Total tidak digunakan sebagai bukti realisasi anggaran.</p>
 <div class="table-wrap satria-lap-table-scroll" style="max-height:68vh;overflow:auto"><table id="lapTable"><thead><tr><th>TA</th><th>OPD</th><th>RUP valid</th><th>Pagu RUP unik</th><th>Terpakai terhitung</th><th>Sisa RUP</th><th>Paket E-P</th><th>Paket SPSE</th><th>HPS E-P</th><th>Penetapan E-P</th><th>Selisih HPS–penetapan</th><th>Kontrak SPSE</th><th>Bayar terverifikasi</th><th>RUP perlu cek</th><th>Isu/jadwal SPSE</th></tr></thead><tbody>${rows||'<tr><td colspan="15" class="mut">Belum ada paket atau Bank RUP untuk cakupan ini.</td></tr>'}</tbody></table></div><small class="mut">Geser tabel secara horizontal untuk melihat seluruh indikator kontrak dan pembayaran SPSE. Laporan dirinci menurut TA + OPD. Pagu Bank RUP unik mengikuti aturan Input RUP; duplikat dan pagu tidak valid dikecualikan serta ditandai untuk pemeriksaan.</small></section></div></div>`;
}
function csvExport(){
 const rows=satriaLaporanData();
 const fields=['tahun','opd','rupValid','rup','terpakai','sisa','ep','spse','hps','penetapan','hematHps','nilaiKontrak','bayar','rupPerluCek','spseTerlambat','spseMasalah','paketTanpaRup','kontrakPerluCek'];
 const headers=['TA','OPD','RUP valid','Pagu RUP unik','Penggunaan terhitung','Sisa kapasitas RUP','Paket e-Purchasing','Paket SPSE','HPS e-Purchasing','Nilai penetapan e-Purchasing','Selisih HPS-penetapan','Kontrak SPSE tercatat','Pembayaran SPSE terverifikasi','RUP perlu cek','Tahapan SPSE terlambat','Kendala SPSE terbuka','Paket referensi RUP tidak ditemukan','Kontrak/pembayaran SPSE perlu periksa'];
 satriaLaporanDownloadCsv('satria-laporan-ringkasan.csv',headers,rows.map(g=>fields.map(k=>k==='opd'?O(g.opd).singkat||g.opd:g[k])));
}
function satriaLaporanCsvDetail(){
 const scope=activeCloudScope();
 const list=(S.paket||[]).filter(p=>(S.ui.opd==='all'||String(p.opd)===String(S.ui.opd))&&(!scope||(scope.opdIds.includes(String(p.opd))&&scope.years.includes(Number(p.tahun)))));
 const head=['TA','OPD','ID Paket','RUP','Jalur','Nama paket','Pagu paket tercatat','HPS e-Purchasing','Nilai penetapan e-Purchasing','Nilai kontrak SPSE','Bayar SPSE terverifikasi','Status','Kode rekening','Kondisi rekening','Tanggal negosiasi','Tanggal kontrak SPSE','Arsip'];
 const rows=list.map(p=>{const sp=satriaSpseIs(p),m=p.spseMonitoring||{};const akun=(S.akun||[]).find(a=>String(a.id)===String(p.akunId||''));return [p.tahun,O(p.opd).singkat||p.opd,p.id,p.rup,sp?'SPSE':'E-Purchasing',p.nama,p.pagu,sp?'':hps(p),sp?'':(pemenang(p)?kontrak(p):''),sp?(String(m.contractNo||'').trim()?satriaSpseContractValue(m):''):'',sp?satriaSpsePayments(m,true):'',sp?(m.status||'Belum diisi'):stt(p),akun?.kode||'',akun?'Terhubung':p.akunId?'Tidak ditemukan':'Belum ditautkan',p.tglNego||'',sp?m.contractDate||'':'',p.arsip===true?'Ya':'Tidak']});
 satriaLaporanDownloadCsv('satria-laporan-paket.csv',head,rows);
}

/* ===== MASTER & PENGATURAN ===== */
const JAB={PPK:'Pejabat Pembuat Komitmen',PP:'Pejabat Pengadaan',Kabid:'Kepala Bidang'};
const PERAN={ppk:'PPK',pp:'PP',kabid:'Kabid'};
const MTAB=[['ppk','PPK / KPA'],['pp','Pejabat Pengadaan'],['kabid','Kepala Bidang'],['unit','Unit/Bagian'],['penyedia','Penyedia'],['akun','Akun Anggaran']];
const ED=id=>S.ui.me===id;
const hit=r=>{const q=(S.ui.ms||'').toLocaleLowerCase('id-ID').trim();if(!q)return true;const values=Object.entries(r).filter(([k])=>k!=='ttd'&&k!=='cap').map(([,v])=>v);if(r&&r.opd){const o=O(r.opd);values.push(o.nama,o.singkat)}return values.join(' ').toLocaleLowerCase('id-ID').includes(q)};
const masterOpdLabel=id=>{const o=O(id);return [o.singkat,o.nama].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' — ')||String(id||'-')};
const thumb=src=>src?`<img src="${src}" style="height:40px;max-width:110px;vertical-align:middle">`:'<span class=mut>-</span>';
function canDel(c,id){const activeAndTrashed=[...S.paket,...(S.sampah||[]).filter(e=>e.collection==='paket').map(e=>e.record)];if(c==='pejabat')return !activeAndTrashed.some(p=>[p.ppk,p.pp,p.kabid].includes(id));if(c==='penyedia')return !activeAndTrashed.some(p=>p.penawaran.some(w=>w.pen===id));if(c==='kode')return !activeAndTrashed.some(p=>p.sub===id);if(c==='akun')return !activeAndTrashed.some(p=>p.akunId===id);if(c==='opd')return !activeAndTrashed.some(p=>p.opd===id)&&!S.pejabat.some(x=>x.opd===id)&&!S.unit.some(x=>x.opd===id);if(c==='unit')return !activeAndTrashed.some(p=>p.unit===id);return true}
function tPejabat(peran){
 const sign=peran==='PPK';
 const L=S.pejabat.filter(x=>x.peran===peran&&hit(x));
 const b=L.map((r,i)=>{const ed=ED(r.id),off=r.aktif===false,jab=r.jabatan||JAB[r.peran];
  const up=f=>`<input type=file accept="image/*" data-up="${f}" data-id="${r.id}" style="width:150px">`;
  const opdCell=`<span title="${esc(O(r.opd).nama)}"><b>${esc(O(r.opd).singkat||'-')}</b><br><small>${esc(O(r.opd).nama||'Nama OPD belum diisi')}</small></span>`;
  return `<tr><td>${i+1}</td><td>${ed?`<input style="width:100%" value="${esc(r.nama)}" data-col="pejabat" data-id="${r.id}" data-f="nama">`:`<b>${esc(r.nama)}</b>`}</td>
  <td>${ed?`<input style="width:100%" value="${esc(r.nip||'')}" data-col="pejabat" data-id="${r.id}" data-f="nip">`:esc(r.nip||'-')}</td>
  <td>${ed?`<input style="width:100%" value="${esc(jab)}" data-col="pejabat" data-id="${r.id}" data-f="jabatan">`:esc(jab)}</td>
  <td>${ed?`<select data-col="pejabat" data-id="${r.id}" data-f="opd">${S.opd.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===String(r.opd)?'selected':''}>${esc(masterOpdLabel(o.id))}</option>`).join('')}</select>`:opdCell}</td>
  ${sign?`<td>${ed?up('ttd'):thumb(r.ttd)}</td><td>${ed?up('cap'):thumb(r.cap)}</td>`:''}
  <td><span class="pill" style="background:${off?'#fde3e0':'#dff5e8'};color:${off?'#991b1b':'#166534'}">${off?'Nonaktif':'Aktif'}</span></td>
  <td style="white-space:nowrap"><button class="g" data-act="medit" data-id="${r.id}">${ed?'Selesai':'Edit'}</button><button class="${off?'':'g'}" data-act="mtoggle" data-c="pejabat" data-id="${r.id}">${off?'Aktifkan':'Nonaktifkan'}</button><button class="d" data-act="delrow" data-c="pejabat" data-id="${r.id}">Hapus</button></td></tr>`}).join('');
 return `<div class="table-wrap"><table><thead><tr><th>No</th><th>Nama Lengkap</th><th>NIP</th><th>Jabatan</th><th>OPD penugasan</th>${sign?'<th>TTD</th><th>Cap / Stempel</th>':''}<th>Status</th><th>Aksi</th></tr></thead><tbody>${b||`<tr><td colspan="${sign?9:7}" class="mut">Belum ada data.</td></tr>`}</tbody></table></div>`
}
function tGen(c,cols){
 const L=(S[c]||[]).filter(hit);
 const b=L.map((r,i)=>`<tr><td>${i+1}</td>${cols.map(([f,l,ro])=>`<td>${ED(r.id)&&!ro?((c==='unit'&&f==='opd')?`<select data-col="${c}" data-id="${r.id}" data-f="${f}">${S.opd.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===String(r.opd)?'selected':''}>${esc(masterOpdLabel(o.id))}</option>`).join('')}</select>`:(c==='penyedia'&&['tipe','pdn','statusKatalog','status','kbliSesuai','daftarHitam'].includes(f)?`<select data-col="${c}" data-id="${r.id}" data-f="${f}">${(f==='tipe'?['Perlu verifikasi','UMKM','Non-UMKM','Koperasi','Perorangan']:f==='pdn'?['Perlu verifikasi','PDN','Impor','Tidak relevan']:f==='kbliSesuai'?['Perlu verifikasi','Ya','Tidak']:f==='daftarHitam'?['Perlu verifikasi','Tidak','Ya']:['Perlu verifikasi','Aktif','Nonaktif']).map(v=>`<option value="${v}" ${v===(r[f]||'Perlu verifikasi')?'selected':''}>${v}</option>`).join('')}</select>`:`<input style="width:100%" value="${esc(r[f]??'')}" data-col="${c}" data-id="${r.id}" data-f="${f}">`)):(c==='unit'&&f==='opd'?`<span title="${esc(O(r.opd).nama)}"><b>${esc(O(r.opd).singkat||'-')}</b><br><small>${esc(O(r.opd).nama||'Nama OPD belum diisi')}</small></span>`:(f==='link'&&r[f]?`<a href="${esc(r[f])}" target="_blank" rel="noopener noreferrer">Buka katalog</a>`:esc(r[f]??'')))}</td>`).join('')}
 <td><span class="pill" style="background:${r.aktif===false?'#fde3e0':'#dff5e8'};color:${r.aktif===false?'#991b1b':'#166534'}">${r.aktif===false?'Nonaktif':'Aktif'}</span></td>
 <td style="white-space:nowrap"><button class="g" data-act="medit" data-c="${c}" data-id="${r.id}">${ED(r.id)?'Selesai':'Edit'}</button><button class="${r.aktif===false?'':'g'}" data-act="mtoggle" data-c="${c}" data-id="${r.id}">${r.aktif===false?'Aktifkan':'Nonaktifkan'}</button><button class="d" data-act="delrow" data-c="${c}" data-id="${r.id}">Hapus</button></td></tr>`).join('');
 return `<div class="table-wrap"><table><thead><tr><th>No</th>${cols.map(([f,l])=>`<th>${l}</th>`).join('')}<th>Status</th><th>Aksi</th></tr></thead><tbody>${b||`<tr><td colspan="${cols.length+3}" class="mut">Belum ada data.</td></tr>`}</tbody></table></div>`
}
const FORMS={ppk:{t:'Tambah PPK / KPA Baru',f:[['nama','Nama Lengkap'],['nip','NIP'],['jabatan','Jabatan',JAB.PPK]],opd:1},
 pp:{t:'Tambah Pejabat Pengadaan Baru',f:[['nama','Nama Lengkap'],['nip','NIP'],['jabatan','Jabatan',JAB.PP]],opd:1},
 kabid:{t:'Tambah Kepala Bidang Baru',f:[['nama','Nama Lengkap'],['nip','NIP'],['jabatan','Jabatan',JAB.Kabid]],opd:1},
 unit:{t:'Tambah Unit/Bagian Baru',f:[['kode','Kode Unit'],['bidang','Nama Unit/Bagian']],opd:1},
 penyedia:{t:'Tambah Penyedia Baru',f:[['nama','Nama penyedia'],['alamat','Alamat lengkap'],['telepon','Telepon'],['email','Email'],['npwp','NPWP'],['nib','NIB/OSS'],['kbli','Kode KBLI'],['kbliSesuai','KBLI sesuai jenis usaha'],['daftarHitam','Status daftar hitam'],['bentuk','Bentuk Usaha','Perorangan'],['tipe','Kategori usaha (UMKM/Non-UMKM)','Perlu verifikasi'],['pdn','Status PDN (PDN/Impor/Perlu verifikasi)','Perlu verifikasi'],['statusKatalog','Status katalog','Perlu verifikasi'],['kabupaten','Kabupaten/Kota'],['link','Link katalog/toko']]},
 akun:{t:'Tambah Akun Anggaran',f:[['kode','Kode Rekening'],['nama','Nama Akun / Uraian'],['link','Link E-Katalog']]},
};
const COLS={unit:[['kode','Kode Unit'],['bidang','Nama Unit/Bagian'],['opd','OPD']],penyedia:[['nama','Nama'],['alamat','Alamat'],['telepon','Telepon'],['email','Email'],['npwp','NPWP'],['nib','NIB/OSS'],['kbli','Kode KBLI'],['kbliSesuai','KBLI sesuai jenis usaha'],['daftarHitam','Status daftar hitam'],['bentuk','Bentuk Usaha'],['tipe','Kategori usaha'],['pdn','PDN'],['statusKatalog','Status katalog'],['kabupaten','Kabupaten/Kota'],['status','Status data'],['link','Link Katalog']],akun:[['kode','Kode Rekening'],['nama','Nama Akun / Uraian'],['link','Link E-Katalog']]};
function fAdd(m){
 const F=FORMS[m];
 const preferred=String(S.ui.opd||'all')!=='all'&&S.opd.some(o=>String(o.id)===String(S.ui.opd))?String(S.ui.opd):String(S.opd[0]?.id||'');
 const inp=([f,l,dv])=>{
   if(m==='penyedia'&&['tipe','pdn','statusKatalog','status','kbliSesuai','daftarHitam'].includes(f)){
     const opts=f==='tipe'?['Perlu verifikasi','UMKM','Non-UMKM','Koperasi','Perorangan']:f==='pdn'?['Perlu verifikasi','PDN','Impor','Tidak relevan']:f==='kbliSesuai'?['Perlu verifikasi','Ya','Tidak']:f==='daftarHitam'?['Perlu verifikasi','Tidak','Ya']:['Perlu verifikasi','Aktif','Nonaktif'];
     return `<div class=fg><label>${l}</label><select data-new="${f}" class="satria-select">${opts.map(v=>`<option value="${v}" ${v===(dv||opts[0])?'selected':''}>${v}</option>`).join('')}</select></div>`
   }
   return `<div class=fg><label>${l}</label><input data-new="${f}" value="${esc(dv||'')}" class="satria-input" placeholder="${l}"></div>`
 };
 const shared=['penyedia','akun'].includes(m)?`<div class="satria-shared-note"><div class="shared-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></div><div><b>Katalog bersama:</b> data ini tersedia untuk seluruh akun Operator/Admin pada organisasi ini, bukan milik satu OPD tertentu.${m==='penyedia'?'<br>Kolom kontak/identitas yang belum diketahui boleh dikosongkan. Tanda hubung tunggal (-) akan diperlakukan sebagai belum diisi.':''}</div></div>`:'';
 const opdSelect = F.opd?`<div class=fg><label>Penempatan OPD</label><select data-new="opd" class="satria-select">${S.opd.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===preferred?'selected':''}>${esc(masterOpdLabel(o.id))}</option>`).join('')}</select></div>`:'';
 return `<div class="satria-form-card"><div class="form-card-head"><div class="title-accent"></div><h3>${F.t}</h3></div>${shared}<div class="satria-form-grid">${F.f.map(inp).join('')}${opdSelect}</div><div class="form-actions"><button class="satria-btn-primary" data-act="madd" data-m="${m}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg> Simpan</button></div></div>`
}
/* Controller dipisah: frontend/satria-controller-master-settings.js; dimuat setelah app core dan sebelum DOMContentLoaded. */
/* ===== CHATBOT (berbasis aturan, membaca data aplikasi) ===== */
function gaps(p){const H=hps(p),g=[];if(!p.rup)g.push('Kode RUP');if(!(p.pagu>0))g.push('pagu');if(!p.items.length)g.push('rincian barang');else{if(H>p.pagu)g.push('HPS melebihi pagu');if(p.items.some(i=>!(+i.vol>0)||!(+i.hs>0)))g.push('volume/harga HPS belum valid');}if(!p.penawaran.length)g.push('penawaran');else if(evalPw(p).some(e=>!e.lengkap))g.push('penawaran belum mencakup seluruh item');if(p.penawaran.some(w=>!satriaOfferPriceSource(w)||!w.tanggalHarga))g.push('sumber/tanggal bukti harga');if(p.penawaran.some(w=>Number(w.ongkir||0)<0))g.push('ongkir tidak boleh negatif');if(p.penawaran.some(w=>(+w.ongkir||0)>0)&&p.pemenangId&&!pemenang(p))g.push('ongkir/total akhir penyedia terpilih perlu rekonsiliasi dengan HPS dan pagu');if(p.penawaran.some(w=>(+w.ongkir||0)>0)&&!p.lokasiPengiriman)g.push('lokasi pengiriman untuk verifikasi ongkir');if(!pemenang(p))g.push('pemenang valid');if(!p.tglDpp)g.push('tanggal DPP');if(!p.tglBahp)g.push('tanggal BA Hasil');if(PJ(p.ppk).aktif===false)g.push('PPK nonaktif');if(!p.lokasiPengiriman)g.push('lokasi penyerahan');return [...new Set(g)]}
const DINFO=[{k:'nodis',n:'Nota Dinas',w:['nota dinas','nodis'],code:'NODIS'},{k:'idkb',n:'Identifikasi Kebutuhan',w:['identifikasi','idkb'],code:null},{k:'rfi',n:'Hasil RFI',w:['rfi','request for information'],code:null},{k:'bahepe',n:'BA Evaluasi Penyedia',w:['evaluasi penyedia','bahepe'],code:'BAHEPE'},{k:'metode',n:'Formulir Penetapan E-Purchasing',w:['penetapan metode'],code:null},{k:'sppbj',n:'SPPBJ',w:['sppbj','perintah pengadaan'],code:'PPBJ'},{k:'spek',n:'Spesifikasi Teknis',w:['spesifikasi','spek'],code:null},{k:'dpp',n:'DPP',w:['dpp','dokumen persiapan'],code:'DPP'},{k:'lamp',n:'Lampiran Referensi Harga',w:['lampiran','referensi harga'],code:'DPP'},{k:'reviu',n:'BA Reviu DPP',w:['reviu','review'],code:'BAHR'},{k:'bahp',n:'BA Hasil Pemilihan',w:['ba hasil','hasil pemilihan','bahp'],code:'BAHP'},{k:'survei',n:'Survei Harga',w:['survei','survey'],code:null},{k:'hpsnego',n:'HPS & Nego',w:['hps nego','lembar hps'],code:null},{k:'kknego',n:'KK Negosiasi',w:['kk nego','kertas kerja'],code:null}];
const STOP=['belanja','kantor','paket','untuk','tahun','total','berapa','harga','status','dokumen','pagu','hps','menang','tampilkan','lihat','yang','dengan','alat','bahan','tulis','anggaran','efisiensi','penyedia','pemenang','kontrak'];
const nrm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9./&\- ]/g,' ').replace(/\s+/g,' ').trim();
const toks=q=>q.split(' ').filter(w=>w.length>=4&&!STOP.includes(w));
const docOf=q=>DINFO.find(d=>d.w.some(w=>q.includes(w)))||null;
function scopeOf(q){const y=(q.match(/\b(20\d{2})\b/)||[])[1];const multi=/semua tahun|seluruh tahun|multi tahun|per tahun|tiap tahun/.test(q);
 let opd=S.ui.opd;const ho=S.opd.find(o=>q.includes(o.singkat.toLowerCase()));if(ho)opd=ho.id;if(/semua opd|seluruh opd/.test(q))opd='all';
 const yrs=multi?S.tahun.slice():[y?+y:S.ui.tahun];
 return{yrs,opd,multi,label:(multi?'semua tahun':'TA '+yrs[0])+(opd==='all'?' · semua OPD':' · '+O(opd).singkat)}}
const listPaket=sc=>S.paket.filter(p=>!satriaSpseIs(p)&&sc.yrs.includes(+p.tahun)&&(sc.opd==='all'||p.opd===sc.opd));
function findPaket(q){const m=q.match(/\b\d{6,}\b/);if(m)return S.paket.find(p=>!satriaSpseIs(p)&&p.rup===m[0])||{none:m[0]};
 const w=toks(q);if(!w.length)return null;let best=null,bs=0;
 S.paket.filter(p=>!satriaSpseIs(p)).forEach(p=>{const n=nrm(p.nama);const c=w.filter(x=>n.includes(x)).length;if(c>bs){bs=c;best=p}});return bs>0?best:null}
const findPenyedia=q=>S.penyedia.find(y=>nrm(y.nama).split(' ').filter(x=>x.length>=4).some(x=>q.includes(x)))||null;
function docMiss(p,k){const m=[];
 const docOpd=OP(p);
 if(!docOpd.kop&&!satriaPemdaOfficial('nama'))m.push('nama Pemerintah Daerah pada kop teks (Pengaturan Sistem)');
 if(['idkb','metode'].includes(k)&&!satriaPemdaOfficial('nama')&&!m.some(x=>x.includes('Pemerintah Daerah')))m.push('nama Pemerintah Daerah pada metadata dokumen');
 if(['dpp','spek'].includes(k)&&satriaDppOfficialPlace(p)==='[Tempat belum diatur]')m.push('tempat penandatanganan resmi');if(!p.rup)m.push('Kode RUP');if(!p.items.length)m.push('rincian barang');if(!(p.pagu>0))m.push('pagu');
 if(k==='nodis'&&!p.tglNodis)m.push('tanggal Nota Dinas');
 if(k==='sppbj'&&!p.tglSppbj)m.push('tanggal SPPBJ');
 if(k==='dpp'&&!p.tglDpp)m.push('tanggal DPP');
 if(['dpp','survei','rfi','lamp','hpsnego','kknego','bahepe','reviu'].includes(k)&&!p.penawaran.length)m.push('penawaran penyedia');
 if(['survei','rfi','lamp','hpsnego','kknego','bahepe','reviu','bahp'].includes(k)&&p.penawaran.some(w=>!satriaOfferPriceSource(w)||!w.tanggalHarga))m.push('sumber dan tanggal bukti harga');
 if(['bahp','kknego','sppbj'].includes(k)&&p.penawaran.some(w=>(+w.ongkir||0)>0))m.push('rekonsiliasi ongkir dengan HPS');
 if(['bahp','kknego','sppbj'].includes(k)&&!pemenang(p))m.push('pemenang yang telah ditetapkan secara valid');
 if(['bahp','kknego','sppbj'].includes(k)&&!p.tglNego)m.push('tanggal negosiasi');
 
 if(['rfi','survei','lamp','hpsnego'].includes(k)&&!p.lokasiPengiriman)m.push('lokasi penyerahan');
 if(k==='bahepe'&&!p.tglEvaluasi)m.push('tanggal evaluasi penyedia');
 if(k==='bahp'&&!p.tglBahp)m.push('tanggal BA Hasil');
 if(k==='dpp'){
   const signer=satriaDppSigner(p);
   if(!signer)m.push('PPK penandatangan DPP dari Data Master');
   else{
     if(signer.aktif===false)m.push('PPK DPP berstatus nonaktif');
     if(p.docPpkSettings?.dpp?.showImages!==false){
      if(!signer.ttd)m.push('gambar tanda tangan PPK DPP (jika dibutuhkan pada dokumen elektronik)');
      if(!signer.cap)m.push('gambar cap PPK DPP (jika dibutuhkan pada dokumen elektronik)');
     }
   }
   if(satriaDppOfficialPlace(p)==='[Tempat belum diatur]')m.push('tempat pelaksanaan OPD pada Pengaturan Sistem');
 }
 return m}
function docText(p,d){const m=docMiss(p,d.k);return `${d.n}\nNomor: ${d.code?nomor(d.code,p):'(dokumen ini tidak memakai nomor)'}\n${m.length?'Belum siap dicetak, perlu: '+m.join(', '):'Siap dicetak di menu Dokumen Pengadaan.'}`}
function detailText(p,q){const w=pemenang(p),g=gaps(p),ev=evalPw(p);
 const hd=`${p.nama}\nKode RUP ${p.rup||'-'} · TA ${p.tahun} · ${O(p.opd).singkat} · status: ${stt(p)}`;
 if(/penawaran|harga|survei|nego|tawaran/.test(q))return hd+'\n'+(ev.length?ev.map(e=>`• ${PY(e.w.pen).nama}: ${rp(e.t)} — ${e.st}${pemenang(p)?.w.id===e.w.id?' (kandidat pemenang saat ini)':''}`).join('\n'):'Belum ada penawaran.');
 if(/pemenang|menang|kontrak/.test(q))return hd+'\n'+(w?`Pemenang: ${PY(w.w.pen).nama} · ${rp(w.t)}${p.pemenangId?' (ditetapkan manual)':' (otomatis)'}`:'Belum ada pemenang.');
 if(/belum|kurang|lengkap|\bsiap\b/.test(q))return hd+'\n'+(g.length?'Belum lengkap: '+g.join(', '):'Semua kelengkapan terpenuhi.');
 const d=docOf(q);if(d)return hd+'\n'+docText(p,d);
 return hd+`\nPagu ${rp(p.pagu)} · HPS ${rp(hps(p))} · Kontrak ${rp(kontrak(p))}\n${w?'Pemenang: '+PY(w.w.pen).nama:'Belum ada pemenang'}\n${g.length?'Belum lengkap: '+g.join(', '):'Kelengkapan lengkap.'}`}
function totalsText(sc){const L=listPaket(sc),pg=sum(L,p=>p.pagu),k=sum(L,kontrak);return `${sc.label}\nJumlah paket: ${L.length}\nTotal pagu: ${rp(pg)}\nTotal HPS: ${rp(sum(L,hps))}\nNilai kontrak: ${rp(k)}\nEfisiensi: ${rp(pg-k)}${pg?' ('+((pg-k)/pg*100).toFixed(2)+'%)':''}`}
function yearsText(sc){return 'Ringkasan per tahun'+(sc.opd==='all'?', semua OPD':' · '+O(sc.opd).singkat)+':\n'+S.tahun.slice().sort().map(y=>{const L=listPaket({yrs:[y],opd:sc.opd});const pg=sum(L,p=>p.pagu),k=sum(L,kontrak);return `• TA ${y}: ${L.length} paket · pagu ${rp(pg)} · kontrak ${rp(k)}`}).join('\n')}
function rankText(sc){const L=listPaket(sc).filter(p=>p.pagu>0&&kontrak(p)>0).map(p=>({p,e:p.pagu-kontrak(p),pc:(p.pagu-kontrak(p))/p.pagu*100})).sort((a,b)=>b.pc-a.pc).slice(0,5);
 return L.length?'Efisiensi tertinggi · '+sc.label+':\n'+L.map(x=>`• ${x.p.rup} ${x.p.nama.slice(0,45)}: hemat ${rp(x.e)} (${x.pc.toFixed(2)}%)`).join('\n'):'Belum ada paket yang sudah punya pemenang di '+sc.label+'.'}
const HOW=[[['backup','simpan','hilang'],'Klik Backup di header untuk mengunduh data (JSON). Dengan penyimpanan IndexedDB (Dexie), data tersimpan otomatis di browser ini; tetap lakukan backup berkala. Pulihkan lewat Pengaturan Sistem → Backup & Pemulihan.'],
 [['salin','tahun baru','tahun berikutnya'],'Buka paket, lalu klik "Salin ke TA berikutnya". Rincian barang ikut disalin, sedangkan penawaran, pemenang, dan tanggal dikosongkan. Kode RUP baru perlu diisi.'],
 [['pemenang','tetapkan','menang'],'Di tab Penawaran dan Negosiasi, klik "Tetapkan pemenang" pada penyedia yang dipilih. Jika tidak dipilih, sistem memakai total terendah yang masih di bawah HPS.'],
 [['cetak','pdf','print'],'Buka menu Dokumen, pilih paket dari dropdown Kode RUP, pilih jenis dokumen, lalu klik Cetak / Simpan PDF.'],
 [['tanda tangan','ttd','cap','stempel','logo'],'TTD dan cap diunggah di Data Master → PPK / KPA (maks. 300 KB per gambar). Logo instansi diunggah di Pengaturan Sistem.'],
 [['paket baru','tambah paket','buat paket'],'Klik + Tambah Paket Pengadaan di menu Paket Pengadaan. Isi kode RUP terkait, pagu paket, dan sub kegiatan, lalu tambahkan rincian barang dan penawaran.'],
 [['nomor','penomoran','format'],'Format nomor dokumen: {kode}/{Kode RUP}/{singkatan OPD}/{kode unit}. Kode per jenis dokumen diatur di Pengaturan Sistem → Penomoran.'],
 [['user','role','hak akses','pengguna'],'Kelola user di Manajemen User (Admin). Admin penuh, Operator mengelola paket dan master, Viewer hanya melihat. Ganti user aktif lewat dropdown User di header.'],
 [['tahun anggaran','tahun baru','tambah tahun'],'Tambah tahun di Pengaturan Instansi → Tahun Anggaran. Pilih tahun aktif di header.'],
 [['nonaktif','aktifkan'],'PPK yang dinonaktifkan tidak dipilih untuk paket baru, tetapi dokumen lama tetap menampilkannya. Atur di Data Master → PPK / KPA.']];
const CAPS='Saya bisa membantu dengan:\n• Ringkasan pagu, HPS, kontrak, dan efisiensi per tahun atau per OPD\n• Detail paket berdasarkan Kode RUP atau nama\n• Penawaran, pemenang, dan kelengkapan paket\n• Kesiapan setiap dokumen (Nota Dinas, DPP, SPPBJ, BA, dan lainnya)\n• Kinerja penyedia, pejabat, akun anggaran, dan user\n• Cara memakai aplikasi (ketik "cara ...")\nSaya mengingat paket terakhir yang dibahas, jadi Anda bisa bertanya lanjutan seperti "pemenangnya siapa?".';
function botAnswer(raw){
 const q=nrm(raw),sc=scopeOf(q),ctxP=S.chatCtx?P(S.chatCtx):null;
 if(!q)return 'Silakan tulis pertanyaan Anda.';
 const opsAnswer=satriaOpsAssistant(raw);if(opsAnswer!==null)return opsAnswer;
 if(/^(halo|hai|hi|hello|selamat|pagi|siang|sore|malam|assalam)/.test(q))return `Halo${cur().nama&&cur().nama!=='-'?' '+cur().nama:''}. Anda sedang di TA ${S.ui.tahun}${S.ui.opd==='all'?', semua OPD':', '+O(S.ui.opd).singkat}. Ketik "bisa apa" untuk daftar kemampuan saya.`;
 if(/terima kasih|makasih|thanks/.test(q))return 'Sama-sama. Ada lagi yang bisa saya bantu?';
 if(/bisa apa|apa saja|bantuan|help|kemampuan|menu/.test(q))return CAPS;
 if(/\b(cara|bagaimana|gimana|langkah|caranya)\b/.test(q)){const h=HOW.find(([ws])=>ws.some(w=>q.includes(w)));if(h)return h[1]}
 let p=findPaket(q);if(!p&&/(\bitu\b|\bini\b|\btersebut\b|\btadi\b|nya\b)/.test(q)&&ctxP)p=ctxP;
 if(p&&p.none)return `Tidak ada paket dengan Kode RUP ${p.none}.`;
 if(p){S.chatCtx=p.id;return detailText(p,q)}
 const pen=findPenyedia(q);
 if(pen){const rows=listPaket(sc).flatMap(x=>x.penawaran.filter(w=>w.pen===pen.id).map(w=>({x,t:totPw(x,w,true),st:evalPw(x).find(e=>e.w.id===w.id).st})));
  return `${pen.nama} · ${sc.label}\n`+(rows.length?rows.map(r=>`• ${r.x.rup||'-'} ${r.x.nama.slice(0,40)}: ${rp(r.t)} — ${r.st}`).join('\n')+`\n${rows.filter(r=>r.st==='Menang').length} penawaran memenuhi HPS, ${rows.filter(r=>{const w=pemenang(r.x);return w&&w.w.pen===pen.id}).length} sebagai pemenang.`:'Penyedia ini belum punya penawaran di cakupan tersebut.')}
 const d=docOf(q);
 if(d){const L=listPaket(sc),ready=L.filter(x=>!docMiss(x,d.k).length).length;return `${d.n} · ${sc.label}\nSiap cetak: ${ready} dari ${L.length} paket.\n${d.code?'Format nomor: '+d.code+'/{Kode RUP}/{singkatan OPD}/{kode unit}':''}\nTanya dengan Kode RUP untuk detail satu paket.`}
 if(sc.multi||/banding|perbandingan/.test(q))return yearsText(sc);
 if(/tertinggi|terbesar|efisien|hemat|termahal|terendah/.test(q))return rankText(sc);
 if(/belum|kurang|lengkap|\bsiap\b|checklist|tertunda|kendala|hambatan/.test(q)){const inc=listPaket(sc).map(x=>[x,gaps(x)]).filter(([,g])=>g.length);return inc.length?`${inc.length} paket belum lengkap · ${sc.label}\n`+inc.slice(0,15).map(([x,g])=>`• ${x.rup||'(tanpa RUP)'} ${x.nama.slice(0,40)}: ${g.join(', ')}`).join('\n'):`Semua paket di ${sc.label} sudah lengkap.`}
 if(/menang|pemenang|gugur/.test(q)){const L=listPaket(sc);return L.length?L.map(x=>{const w=pemenang(x);return `• ${x.rup||'-'} ${x.nama.slice(0,40)}: ${w?PY(w.w.pen).nama+' '+rp(w.t):'belum ada pemenang'}`}).join('\n'):'Belum ada paket di '+sc.label+'.'}
 if(/ppk|pejabat|pengadaan|kabid|kepala bidang|bidang/.test(q))return S.pejabat.filter(x=>sc.opd==='all'||x.opd===sc.opd).map(x=>`• ${x.peran==='PPK'?'PPK':x.peran==='PP'?'Pejabat Pengadaan':'Kepala Bidang'}: ${x.nama} (${OP(x).singkat}) — ${x.aktif===false?'nonaktif':'aktif'}`).join('\n')||'Belum ada pejabat.';
 if(/akun|rekening|program|kegiatan/.test(q))return `Program: ${S.meta.program}\nKegiatan: ${S.meta.kegiatan}\nRekening: ${S.meta.rekening}\nAkun anggaran terdaftar: ${S.akun.length}`;
 if(/pengguna|user|role/.test(q))return S.users.map(u=>`• ${u.nama} (${u.role})${u.aktif===false?' — nonaktif':''}`).join('\n');
 if(/aktivitas|riwayat|log|terakhir/.test(q))return S.log.length?S.log.slice(0,5).map(l=>`• ${l.t} ${l.label}`).join('\n'):'Belum ada aktivitas di sesi ini.';
 if(/dokumen|surat|nomor|format|cetak/.test(q))return 'Dokumen yang tersedia: '+DINFO.map(x=>x.n).join(', ')+'.\nTanya "DPP" atau "siap cetak DPP" untuk ringkasan, atau sertakan Kode RUP untuk detail satu paket.';
 if(/berapa|total|pagu|hps|kontrak|efisiensi|anggaran|ringkas|rangkum|jumlah/.test(q))return totalsText(sc);
 if(/paket|daftar|list/.test(q)){const L=listPaket(sc);return L.length?`${L.length} paket · ${sc.label}\n`+L.slice(0,15).map(x=>`• ${x.rup||'-'} ${x.nama.slice(0,45)} — ${stt(x)}`).join('\n'):'Belum ada paket di '+sc.label+'.'}
 return 'Saya belum yakin maksudnya. Coba salah satu:\n• total pagu dan HPS\n• status paket dengan Kode RUP (mis. 67122699)\n• paket yang belum lengkap\n• pemenang tiap paket\n• bandingkan semua tahun\n• penyedia contoh\n• siap cetak DPP\n• cara salin paket ke tahun baru';
}
const SUG=['Ringkasan TA ini','Paket yang belum lengkap','Pemenang tiap paket','Bandingkan semua tahun','Efisiensi tertinggi','Siap cetak DPP','Cara backup','Jadwal SPSE yang terlambat','Pembayaran dan kontrak SPSE','Kualitas data dan temuan','Agenda executive briefing','Bisa apa saja?'];
function chatSend(q){if(!q||!q.trim())return;S.chat=(S.chat||[]).concat([{f:'u',t:q.trim()},{f:'b',t:botAnswer(q)}]).slice(-60);render()}
function vChat(){const L=S.chat||[];
 return `<div class=card><div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#0F766E,#0891B2);display:grid;place-items:center;color:#fff;font-weight:800">SA</div><div><h3 style="margin:0">Asisten SATRIA</h3><div style="font-size:12px;opacity:.7">Integrated Government Intelligence Platform • Framework Version 3.0</div></div></div><p class=mut>Selamat datang di Asisten SATRIA. Saya siap membantu analisis data, monitoring kinerja, pelaporan, dan navigasi sistem SATRIA Framework. Menjawab berdasarkan data tata kelola di aplikasi ini (anggaran, kinerja, kepatuhan, dan dokumen).</p>
 <div style="min-height:240px;max-height:420px;overflow:auto;border:1px solid var(--bd);border-radius:8px;padding:10px;background:#fbfcfe">${L.length?L.map(m=>`<div style="margin:8px 0;text-align:${m.f==='u'?'right':'left'}"><span style="display:inline-block;max-width:80%;padding:8px 10px;border-radius:10px;background:${m.f==='u'?'#dbe7f7':'#fff'};border:1px solid var(--bd);white-space:pre-line;text-align:left">${esc(m.t)}</span></div>`).join(''):'<span class=mut>Tanyakan sesuatu, misalnya "total pagu" atau "status RUP 67122699". Atau pilih saran di bawah.</span>'}</div>
 <div class=row style="margin-top:10px"><input id=chatIn placeholder="Tulis pertanyaan..." style="flex:1;min-width:260px"><button data-act="chatsend">Kirim</button><button class=g data-act="chatclear">Bersihkan</button></div>
 <div class=row style="margin-top:8px">${SUG.map(q=>`<button class=g data-act="chatq" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`}

/* ===== MANAJEMEN USER ===== */
function vUser(){const U=S.users,act=U.filter(u=>u.aktif!==false),ROLES=['Admin','Operator','Viewer'];
 const kp=[['Total user lokal',U.length],['Admin aktif',act.filter(u=>u.role==='Admin').length],['Operator aktif',act.filter(u=>u.role==='Operator').length],['Viewer aktif',act.filter(u=>u.role==='Viewer').length]];
 return `<div class=grid id="satriaLocalUserStats">${kp.map(([l,v])=>`<div class="card kpi"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
 <div class=card id="satriaCloudUserCreateCard" style="display:none"><div class=row style="align-items:center;justify-content:space-between"><div><h3 style="margin:0">Pengguna Supabase Auth</h3><p class=mut>Buat akun login untuk organisasi yang sedang terhubung.</p></div><button id="satriaOpenCreateUser" type="button">Tambah user operator</button></div><p class=mut>Email harus berformat valid dan unik. Lengkapi password awal di formulir pendaftaran. Akun dibuat terkonfirmasi dan tidak ada email yang dikirim; sampaikan password awal melalui saluran terpisah yang aman.</p><p class=mut>Setiap Operator wajib diberi minimal satu OPD. Daftar akun dan pengaturan OPD tersedia pada panel terpisah di bawah.</p></div>
 <section class="card" id="satriaCloudUserListCard" style="display:none" aria-labelledby="satriaCloudUserListTitle">
  <div class="row" style="align-items:center;justify-content:space-between;gap:12px">
   <div><h3 id="satriaCloudUserListTitle" style="margin:0">Daftar pengguna organisasi</h3><p class="mut" style="margin:4px 0 0">Daftar ini hanya tersedia bagi admin aktif organisasi.</p></div>
   <button id="satriaAdminUsersRefresh" type="button">Muat ulang</button>
  </div>
  <p id="satriaAdminUsersStatus" class="mut" role="status" aria-live="polite">Daftar belum dimuat.</p>
  <div style="overflow:auto">
   <table>
    <thead><tr><th>Nama</th><th>Email / username</th><th>Role</th><th>OPD yang dapat diakses</th><th>Status</th><th>Bergabung</th><th>Aksi</th></tr></thead>
    <tbody id="satriaAdminUsersRows"><tr><td colspan="7">Daftar belum dimuat.</td></tr></tbody>
   </table>
  </div>
  <div class="row" style="align-items:center;justify-content:space-between;margin-top:12px">
   <span id="satriaAdminUsersPageSummary" class="mut" aria-live="polite">—</span>
   <div class="row"><button id="satriaAdminUsersPrevious" type="button" disabled>Sebelumnya</button><button id="satriaAdminUsersNext" type="button" disabled>Berikutnya</button></div>
  </div>
 </section>
 <div class=card id="satriaLocalUserCreateCard"><h3>Tambah User Lokal (browser ini)</h3><div class=row>
 <div class=fg><label>Nama lengkap</label><input data-new="nama"></div>
 <div class=fg><label>Username</label><input data-new="username"></div>
 <div class=fg><label>Role</label><select data-new="role">${ROLES.map(r=>`<option ${r==='Operator'?'selected':''}>${r}</option>`).join('')}</select></div>
 <div class=fg><label>OPD</label><select data-new="opd"><option value="all">Semua OPD</option>${S.opd.map(o=>`<option value="${o.id}">${esc(o.singkat)}</option>`).join('')}</select></div>
 <button data-act="uadd">Simpan user lokal</button></div>
 <p class=mut>Mode lokal hanya mengatur tampilan browser ini; username di sini bukan akun login Supabase.</p><div class=card style="border-color:#e0a800"><b class=warn>Catatan keamanan</b><p class=mut>Pemilihan user di header hanya membatasi tampilan di browser ini, bukan kontrol akses yang sebenarnya. Siapa pun yang membuka file ini dapat berpindah ke user Admin. Untuk data pengadaan yang sesungguhnya, gunakan sistem dengan autentikasi di sisi server.</p></div></div>
 <div class=card id="satriaLocalUserTable"><h3>Daftar user lokal browser</h3><p class=mut>Daftar ini bukan roster akun Auth Supabase.</p><table><tr><th>No</th><th>Nama</th><th>Username</th><th>Role</th><th>OPD</th><th>Status</th><th>Aksi</th></tr>
 ${U.map((u,i)=>{const off=u.aktif===false,me=u.id===S.ui.user;return `<tr><td>${i+1}</td>
 <td><input value="${esc(u.nama)}" data-col="users" data-id="${u.id}" data-f="nama"></td>
 <td><input value="${esc(u.username)}" data-col="users" data-id="${u.id}" data-f="username"></td>
 <td><select data-col="users" data-id="${u.id}" data-f="role">${ROLES.map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></td>
 <td><select data-col="users" data-id="${u.id}" data-f="opd"><option value="all">Semua OPD</option>${S.opd.map(o=>`<option value="${o.id}" ${o.id===u.opd?'selected':''}>${esc(o.singkat)}</option>`).join('')}</select></td>
 <td><span class=pill style="background:${off?'#fde3e0':'#dff5e8'}">${off?'Nonaktif':'Aktif'}</span>${me?' <span class=mut>(sedang dipakai)</span>':''}</td>
 <td style="white-space:nowrap"><button class="${off?'':'g'}" data-act="utoggle" data-id="${u.id}">${off?'Aktifkan':'Nonaktifkan'}</button><button class=d data-act="udel" data-id="${u.id}">Hapus</button></td></tr>`}).join('')}</table></div>`}

/* Controller dipisah: frontend/satria-controller-recycle.js; dimuat setelah app core dan sebelum DOMContentLoaded. */
/* ===== RENDER & ROUTING ===== */
function render(){
 if(S.ui.rupManualSkipCapture)S.ui.rupManualSkipCapture=false;
 else rupManualCapture();
 const u=S.ui;
 $('#hPemda').innerHTML='SATRIA <span style="display:inline-flex;align-items:center;gap:6px;margin-left:10px;padding:3px 10px;border-radius:9999px;background:linear-gradient(135deg,#0F766E,#0891B2);color:#fff;font-size:10px;font-weight:800;letter-spacing:0.08em;vertical-align:middle;box-shadow:0 2px 8px rgba(15,118,110,.25)">NEXT · '+ (document.querySelector('meta[name="satria-release-version"]')?.content || "3.0.59.53") +'</span>';
 $('#hSub').innerHTML='<span style="font-weight:600;letter-spacing:-0.01em">Government work, in flow.</span> <span style="opacity:.6;margin:0 6px">•</span> <span style="font-size:11px;opacity:.8">Simple • Connected • Accountable</span> <span style="opacity:.6;margin:0 6px">•</span> <span style="font-size:11px">'+(u.opd==='all'?'Multi OPD • Multi Tahun':esc(O(u.opd).nama))+'</span>';
 $('#dirty').textContent=S.persistError?'⚠ Gagal menyimpan':(S.dirty?'● Perubahan belum di-backup':'✔ Tidak ada perubahan baru');$('#dirty').title=S.persistError||'Penyimpanan lokal dan backup file adalah dua hal berbeda';$('#dirty').style.background=S.persistError?'#FEE2E2':(S.dirty?'#F59E0B':'rgba(15,118,110,.14)'); $('#dirty').style.color=S.persistError?'#991B1B':(S.dirty?'#78350f':'#0F766E');
 $('#selTahun').innerHTML=S.tahun.map(t=>`<option value="${Number(t)}" ${Number(t)===Number(u.tahun)?'selected':''}>${Number(t)}</option>`).join('');
 const cloudScope=activeCloudScope();
 const visibleOpds=cloudScope?(S.opd||[]).filter(o=>cloudScope.opdIds.includes(String(o.id))):(S.opd||[]);
 if(cloudScope){
   if(visibleOpds.length===1) u.opd=String(visibleOpds[0].id);
   else if(u.opd!=='all'&&!visibleOpds.some(o=>String(o.id)===String(u.opd))) u.opd='all';
 }
 const showAllOpds=!cloudScope||visibleOpds.length>1;
 const opdOptions=(showAllOpds?`<option value="all" ${u.opd==='all'?'selected':''}>${cloudScope?'Semua OPD ditugaskan':'Semua OPD'}</option>`:'')
   +(visibleOpds.length?visibleOpds.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===String(u.opd)?'selected':''}>${esc(o.singkat||o.nama||o.id)}</option>`).join(''):`<option value="" selected disabled>OPD belum tersedia</option>`);
 $('#selOpd').innerHTML=opdOptions;
 $('#selOpd').disabled=!!cloudScope&&!visibleOpds.length;
 $('#selOpd').title=cloudScope?(visibleOpds.length===1?'OPD otomatis mengikuti assignment akun Anda.':`Hanya ${visibleOpds.length} OPD yang ditugaskan kepada akun ini.`):'Pilih OPD untuk memfilter data aplikasi.';
 if(!allowed(u.page))u.page='dash';$('#selUser').innerHTML=S.users.filter(x=>x.aktif!==false).map(x=>`<option value="${x.id}" ${x.id===S.ui.user?'selected':''}>${esc(x.nama)} (${x.role})</option>`).join('');
 $('#nav').innerHTML=NAV.filter(([k])=>allowed(k)).map(([k,t])=>`<a href="#${k}" class="${u.page===k?'on':''}">${t}</a>`).join('');
 if(u.page==='paket'&&u.pid&&satriaSpseIs(P(u.pid))){u.page='spse';try{history.replaceState(null,'',location.pathname+location.search+'#spse/'+encodeURIComponent(u.pid))}catch(_){}}
 const V={sampah:vSampah,dash:()=>vDash()+satriaOpsDashWidget(),monitor:satriaOpsMonitor,finance:satriaOpsFinance,quality:satriaOpsQuality,care:()=>window.SATRIA_CARE?.page?.()||'<section class="card">Perawatan SATRIA belum dimuat; periksa file aplikasi atau muat ulang halaman.</section>',paket:()=>u.pid?vDetail(P(u.pid)):vPaket(),kerja:()=>window.SATRIA_PP_ECOSYSTEM?.page?.((S.paket||[]).filter(p=>Number(p.tahun)===Number(u.tahun)&&(u.opd==='all'||String(p.opd)===String(u.opd))&&(!cloudScope||(cloudScope.opdIds.includes(String(p.opd))&&cloudScope.years.includes(Number(p.tahun))))),u.pid)||'<section class="card">Ruang Kerja PP belum dimuat. Periksa aset aplikasi.</section>',kalk:vKalk,input:vInputRup,spse:vSpse,brief:vBrief,satria360:()=>window.SATRIA_NEXT4?.vSatria360?.()||'<div class="card">SATRIA 360° sedang dimuat.</div>',analisa:()=>window.SATRIA_PRICE_ANALYSIS?.page?.()||'<div class="card">Analisis Harga belum dimuat. Muat ulang aplikasi.</div>',dok:vDok,lap:vLap,master:vMaster,set:vSet,user:vUser,panduan:vPanduan,chat:vChat};
 $('#main').innerHTML=(V[u.page]||vDash)();
 window.SATRIA_NEXT4?.enhance?.();
 window.SATRIA_OPERATOR_STUDIO?.enhance?.();
 if(u.page==='paket'&&u.ptab==='nego'&&u.knFocusWid){const focusWid=String(u.knFocusWid);u.knFocusWid=null;const target=[...document.querySelectorAll('[data-offer-wid]')].find(el=>el.dataset.offerWid===focusWid);if(target){target.classList.add('kn47-highlight');requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth',block:'start'}))}}
 schedulePersist();
}
function route(){const [raw,id]=(location.hash||'#dash').slice(1).split('/');const pg=raw==='settings'?'set':raw;S.ui.page=pg||'dash';S.ui.pid=id||null;render()}
function nextSeq(tahun,opd){return Math.max(0,...S.paket.filter(p=>p.tahun==tahun&&p.opd===opd).map(p=>p.seq))+1}
const pjId=(opd,peran)=>(S.pejabat.find(x=>x.opd===opd&&x.peran===peran&&x.aktif!==false)||{}).id;

/* Validasi struktur backup secara menyeluruh sebelum menyentuh data aktif. */
function validateBackup(o){
 const arr=Array.isArray;
 if(!o||typeof o!=='object'||!arr(o.paket)||!arr(o.opd)||!o.pemda||typeof o.pemda!=='object'||!arr(o.tahun))throw new Error('Struktur utama tidak lengkap');
 const unique=(xs,label)=>{const ids=xs.map(x=>x&&x.id).filter(Boolean);if(ids.length!==xs.length||new Set(ids).size!==ids.length)throw new Error('ID '+label+' kosong atau duplikat')};
 for(const k of ['opd','unit','pejabat','penyedia','akun','kode','users','paket']) if(o[k]!=null&&!arr(o[k]))throw new Error('Koleksi '+k+' harus berupa array');
 unique(o.opd,'OPD'); for(const k of ['unit','pejabat','penyedia','akun','users','paket'])if(arr(o[k]))unique(o[k],k);
 if(!o.opd.every(x=>x&&typeof x.id==='string'&&typeof x.nama==='string'&&typeof x.singkat==='string'))throw new Error('Struktur OPD tidak valid');
 const yearsList=(o.tahun||[]).map(Number),years=new Set(yearsList);if(years.size!==yearsList.length)throw new Error('Tahun anggaran duplikat');if([...years].some(y=>!Number.isInteger(y)||y<2000||y>2200))throw new Error('Tahun anggaran tidak valid');
 const opdIds=new Set(o.opd.map(x=>x.id));
 const unitIds=new Set((o.unit||[]).map(x=>x.id));const staffIds=new Set((o.pejabat||[]).map(x=>x.id));const supplierIds=new Set((o.penyedia||[]).map(x=>x.id));
 for(const x of (o.unit||[]))if(!opdIds.has(x.opd))throw new Error('Unit merujuk OPD yang tidak ada');
 for(const x of (o.pejabat||[]))if(x.opd&&!opdIds.has(x.opd))throw new Error('Pejabat merujuk OPD yang tidak ada');
 for(const x of o.paket){if(!x||typeof x.id!=='string'||!Number.isInteger(+x.tahun)||+x.tahun<2000||+x.tahun>2200||typeof x.opd!=='string'||!arr(x.items))throw new Error('Struktur paket tidak valid');if(!opdIds.has(x.opd))throw new Error('Paket merujuk OPD yang tidak ada');if(x.unit&&unitIds.size&&!unitIds.has(x.unit))throw new Error('Paket merujuk unit yang tidak ada');if(!Number.isFinite(+x.pagu)||+x.pagu<0)throw new Error('Nilai pagu tidak valid');if(!x.items.every(i=>i&&typeof i.id==='string'&&Number.isFinite(+i.vol)&&+i.vol>=0&&Number.isFinite(+i.hs)&&+i.hs>=0))throw new Error('Rincian item paket tidak valid');if(new Set(x.items.map(i=>i.id)).size!==x.items.length)throw new Error('ID item duplikat dalam paket');if(x.penawaran!=null&&!arr(x.penawaran))throw new Error('Penawaran paket tidak valid');if(new Set((x.penawaran||[]).map(w=>w&&w.id)).size!==(x.penawaran||[]).length)throw new Error('ID penawaran duplikat dalam paket');for(const w of (x.penawaran||[])){if(!w||typeof w.id!=='string'||typeof w.pen!=='string')throw new Error('Struktur penawaran tidak valid');if(supplierIds.size&&!supplierIds.has(w.pen))throw new Error('Penawaran merujuk penyedia yang tidak ada');}}
 for(const p of o.paket){if(p.ppDokumenPemilihan===undefined)continue;
  const d=p.ppDokumenPemilihan;
  if(!d||typeof d!=='object'||Array.isArray(d)||d.schema!==1||typeof d.sourceSnapshot!=='string'||d.sourceSnapshot.length>200000||typeof d.savedAt!=='string'||d.savedAt.length>40)throw new Error('Dokumen Pemilihan pada backup tidak valid');
  const fields={nomor:160,tanggal:10,namaPP:180,nipPP:80,alamatPemilihan:500,sumberDana:220,penyedia:180,alamatPenyedia:450,tanggalUndangan:10,batasPenawaran:16,metodePenyampaian:600,lokasi:240,jangkaWaktu:200,syaratKualifikasi:3500,instruksiPeserta:5000,metodeEvaluasi:1600,kriteriaEvaluasi:4000,dokumenPenawaran:2500,ketentuanKhusus:3500,refHpsPPK:200,refSpesifikasi:200,rancanganSpk:45000};
  for(const [key,max] of Object.entries(fields))if(typeof d[key]!=='string'||d[key].length>max)throw new Error('Isian Dokumen Pemilihan tidak valid: '+key);
 }
 for(const p of o.paket){if(p.ppEkosistem===undefined)continue;const z=p.ppEkosistem;
  if(!z||typeof z!=='object'||Array.isArray(z)||z.schema!==1||!Array.isArray(z.notes)||!Array.isArray(z.evidence)||z.notes.length>100||z.evidence.length>100)throw new Error('Kertas kerja PP tidak valid');
  const field=(r,k,n)=>typeof r[k]==='string'&&r[k].length<=n;
  for(const a of z.notes){if(!a||typeof a!=='object'||!field(a,'id',120)||!field(a,'topic',40)||!field(a,'text',1000)||!field(a,'at',40)||!field(a,'by',120))throw new Error('Catatan kerja PP tidak valid');}
  for(const a of z.evidence){if(!a||typeof a!=='object'||!field(a,'id',120)||!field(a,'title',120)||!field(a,'reference',250)||!field(a,'url',600)||!field(a,'date',16)||!field(a,'at',40)||!field(a,'by',120)||a.url&&!/^https:\/\/[^\s<>\"']+$/i.test(a.url))throw new Error('Referensi bukti PP tidak valid');}
 }
 for(const p of o.paket){if(p.jalurPengadaan==='SPSE_MONITOR'){const m=p.spseMonitoring;if(!m||typeof m!=='object'||arr(m)||!arr(m.stages)||!arr(m.payments)||!arr(m.addenda)||!arr(m.issues)||!m.stages.every(x=>x&&typeof x.key==='string')||!m.payments.every(x=>x&&typeof x.id==='string'&&Number.isSafeInteger(x.amount)&&x.amount>0)||!m.addenda.every(x=>x&&typeof x.id==='string'&&Number.isSafeInteger(x.delta))||!Number.isSafeInteger(m.contractValue)||m.contractValue<0)throw new Error('Data Monitoring SPSE pada backup tidak valid');}}
 if(o.rupBank!==undefined&&!arr(o.rupBank))throw new Error('Bank RUP harus berupa array');
 if(arr(o.rupBank)){
   unique(o.rupBank,'Bank RUP');const keys=new Set(),bankById=new Map(o.rupBank.map(r=>[String(r.id),r]));
   for(const r of o.rupBank){
     const key=rupBankKey(r);if(keys.has(key))throw new Error('Entri Bank RUP ganda pada OPD, tahun, dan kode yang sama');keys.add(key);
   }
   for(const p of o.paket){
     if(p.rupBankIds!==undefined&&!arr(p.rupBankIds))throw new Error('rupBankIds harus array');
     if(p.rupAlokasi!==undefined){
       const m=p.rupAlokasi;
       if(!m||typeof m!=='object'||arr(m)||Object.values(m).some(v=>!Number.isSafeInteger(v)||v<0))throw new Error('Pembagian alokasi RUP paket tidak valid');
     }
     const ids=satriaRupLinks(p);
     for(const id of ids){const r=bankById.get(id);if(!r||String(r.opd)!==String(p.opd)||Number(r.tahun)!==Number(p.tahun)){if(p.rupBankIds!==undefined)throw new Error('Referensi Bank RUP paket tidak ditemukan atau berbeda OPD/tahun: '+id);/* backup lama tetap diterima untuk diperiksa melalui audit data */}}
   }
 }
 if(o.sampah!==undefined){
  if(!arr(o.sampah)||o.sampah.length>50000)throw new Error('Struktur Sampah tidak valid');
  const ids=new Set();for(const e of o.sampah){if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id)||!['snapshot',...window.SATRIA_CORE_GUARDS.COLLECTIONS,...window.SATRIA_CORE_GUARDS.EXTRAS].includes(e.collection)||!e.record||typeof e.record!=='object'||typeof e.deletedAt!=='string'||typeof e.deletedBy!=='string')throw new Error('Catatan Sampah tidak valid');ids.add(e.id);if(window.SATRIA_CORE_GUARDS.COLLECTIONS.includes(e.collection)&&String(e.record.id)!==String(e.originalId))throw new Error('ID arsip Sampah tidak valid');}
 }
 if(o.users?.length&&!o.users.some(u=>u.role==='Admin'&&u.aktif!==false))throw new Error('Backup tidak memiliki Admin aktif');
 return true;
}

function resetDetailIfOutsideFilter(){
 const active=P(S.ui.pid);if(!active)return;
 if(Number(active.tahun)!==Number(S.ui.tahun)||(S.ui.opd!=='all'&&String(active.opd)!==String(S.ui.opd))){
   S.ui.pid=null;S.ui.page='paket';
   try{history.replaceState(null,'',location.pathname+location.search+'#paket')}catch(_){location.hash='#paket'}
 }
}
/* ===== EVENT ===== */
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-act]');if(!t)return;
 const a=t.dataset.act,id=t.dataset.id,pid=t.dataset.pid,d=t.dataset;
 if(a==='trashrefresh'){
   if(!window.SATRIA_CLOUD_CONFIGURED)return;
   const api=window.SATRIA_CLOUD_TRASH;
   if(!api?.ready){toast('Login dan tarik cloud lebih dahulu.');return}
   api.refresh().catch(err=>toast('Gagal memuat Sampah: '+err.message));return;
 }
 if(a==='trashmore'){
   if(!window.SATRIA_CLOUD_CONFIGURED)return;
   const api=window.SATRIA_CLOUD_TRASH;
   if(!api?.ready){toast('Masuk cloud dahulu untuk memuat arsip lama.');return}
   if(api.loading||!api.hasMore)return;
   t.disabled=true;t.textContent='Memuat arsip…';
   api.loadMore().catch(err=>toast('Gagal memuat arsip lama: '+err.message));return;
 }
 if(a==='trashrestore'){
   if(!canWrite()){toast('Viewer hanya dapat melihat Sampah');return}
   if(window.SATRIA_CLOUD_CONFIGURED){
     if(!confirm('Pulihkan data ini dari Sampah cloud? Perubahan akan terlihat lintas perangkat.'))return;
     const api=window.SATRIA_CLOUD_TRASH;
     if(!api?.ready){toast('Cloud belum siap. Data tidak diubah.');return}
     api.restore(id).catch(err=>toast('Pemulihan cloud dibatalkan: '+err.message));return;
   }
   if(satriaRecycleBlocked())return;
   const entry=(S.sampah||[]).find(x=>String(x.id)===String(id));if(!entry){toast('Data di Sampah tidak ditemukan.');return}
   if(entry.collection!=='snapshot'&&satriaRecycleDependencies(entry)){toast(satriaRecycleDependencies(entry));return}
   if(!confirm('Pulihkan data ini dari Sampah ke daftar aktif?'))return;
   try{
     if(entry.collection==='snapshot'){
       validateBackup(entry.record);
       const ui=S.ui,old=JSON.parse(JSON.stringify(persistable()));delete old.sampah;
       S.sampah=S.sampah.filter(x=>x.id!==entry.id);
       const history=S.sampah;
       Object.assign(S,JSON.parse(JSON.stringify(entry.record)),{ui,sampah:history,dirty:true});
       normalizeData();
       S.sampah.unshift({id:uid('trash'),collection:'snapshot',originalId:'snapshot',record:old,deletedAt:new Date().toISOString(),deletedBy:cur().nama});
       S.ui.tahun=S.tahun.includes(Number(ui.tahun))?Number(ui.tahun):S.tahun[0];S.ui.opd='all';S.ui.pid=null;
     }else window.SATRIA_CORE_GUARDS.restore(S,id);
     sync('paket','Data dipulihkan dari Sampah: '+entry.collection);render();
   }catch(err){toast('Pemulihan dibatalkan: '+err.message)}return;
 }
 if(WRITE.concat(['rupcreate','rupremove']).includes(a)&&!canWrite()){toast('Akun Viewer hanya dapat melihat data');return}
 if(window.SATRIA_CLOUD_CONFIGURED&&window.SATRIA_CLOUD_ROLE&&window.SATRIA_CLOUD_ROLE!=='admin'){
   if(['addopd','addyear','delyear','rmlogo','reset','clearsample','uadd','utoggle','udel'].includes(a)){
     toast('Pengaturan organisasi, daftar OPD/tahun, dan reset penuh hanya dapat dilakukan admin.');return;
   }
   if(a==='madd'&&['opd','kode'].includes(d.m)){
     toast('Master OPD dan referensi akun/kode bersifat organisasi; hanya admin yang dapat mengubahnya.');return;
   }
   if(a==='addrow'&&['opd','kode','users'].includes(d.c)){
     toast('Master organisasi ini hanya dapat diubah oleh admin.');return;
   }
   if(a==='delrow'&&['opd','kode','users'].includes(d.c)){
     toast('Master organisasi ini hanya dapat diubah oleh admin.');return;
   }
   if(a==='medit'&&['opd','kode'].includes(S.ui.mtab)){
     toast('Master organisasi ini hanya dapat diubah oleh admin.');return;
   }
 }
 if(window.SATRIA_CLOUD_CONFIGURED&&['udel','clearsample','reset','delyear'].includes(a)){
   satriaRecycleBlocked();return; // These actions lack a safe server recycle contract.
 }
 if(window.SATRIA_CLOUD_CONFIGURED&&a==='delrow'&&!['opd','unit','pejabat','penyedia','akun','kode'].includes(d.c)){
   satriaRecycleBlocked();return;
 }
 if(a==='settingsReport'){const g=(function(){const report={dibuat:new Date().toISOString(),versi:'3.0.38',jumlahRUP:(S.rupBank||[]).length,jumlahPaket:S.paket.length,jumlahOPD:S.opd.length,tahun:[...S.tahun],peringatan:[]};(S.rupBank||[]).forEach(r=>{if(!S.opd.some(o=>o.id===r.opd)||!S.tahun.includes(+r.tahun))report.peringatan.push('Bank RUP '+r.rup+' memiliki OPD/tahun tidak terdaftar')});(S.paket||[]).forEach(p=>{if(hps(p)>+p.pagu)report.peringatan.push('HPS lebih tinggi dari pagu: '+p.rup)});return report})();const url=URL.createObjectURL(new Blob([JSON.stringify(g,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='SATRIA-Laporan-Pengaturan-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),5000);return}
 if(a==='settingsBackup'){document.querySelector('[data-act=export]')?.click();return}
 if(a==='chatsend'){return chatSend($('#chatIn').value)}
 if(a==='chatq'){return chatSend(d.q)}
 if(a==='chatclear'){S.chat=[];return render()}
 if(a==='rupmode'){const ta=$('#rupJsonIn');if(ta)S.ui.rupJson=ta.value;S.ui.rupMode=d.mode==='json'?'json':'manual';S.ui.rupPrev=null;S.ui.rupFormErr=null;return render()}
 if(a==='rupbankreset'){
   S.ui.rupSearch='';S.ui.rupBankOpd='all';S.ui.rupBankYear='all';
   toast('Semua RUP sesuai hak akses akun ditampilkan.');return render();
 }
 if(a==='rupmanualclear'){
   if(!confirm('Bersihkan seluruh isian RUP manual yang belum disimpan?'))return;
   rupManualClearDraft();toast('Draf Input RUP Manual dibersihkan.');return render();
 }
 if(a==='rupmanualsave'){
   const g=k=>String(document.getElementById(k)?.value??'').trim();
   const rup=g('rupMCode'),nama=g('rupMName'),opd=g('rupMOpd'),tahun=Number(g('rupMYear'));
   const pagu=Number(g('rupMBudget')),asal=g('rupMProvenance');
   if(!rup||!nama||!opd||!Number.isInteger(tahun)||!(pagu>0)||!Number.isSafeInteger(pagu)||!asal){toast('Lengkapi kode/identitas RUP, nama, OPD, tahun, pagu positif, dan sumber referensi.');return}
   if(rup.length>100||nama.length>1000||asal.length>500){toast('Kode, nama paket, atau referensi terlalu panjang.');return}
   const scope=activeCloudScope();
   if(!S.tahun.includes(tahun)||!S.opd.some(o=>String(o.id)===opd)||(scope&&(!scope.opdIds.includes(opd)||!scope.years.includes(tahun)))){toast('OPD atau tahun di luar kewenangan/konfigurasi.');return}
   const collision=(S.rupBank||[]).some(r=>String(r.rup).trim().toLowerCase()===rup.toLowerCase()&&Number(r.tahun)===tahun&&String(r.opd)===opd);
   if(collision){toast('Kode/identitas RUP sudah ada di Bank RUP pada OPD dan tahun tersebut.');return}
   const entry={id:uid('rup'),rup,nama,opd,tahun,pagu,sumber:g('rupMSource'),metodePemilihan:g('rupMMethod'),jenisPengadaan:g('rupMType'),klasifikasiSumber:g('rupMMethod')&&g('rupMType')?'Input manual':'Perlu verifikasi',sub:'',bulanPelaksanaan:'',asal:'Input manual — '+asal,catatan:g('rupMNotes'),statusVerifikasi:'Perlu verifikasi terhadap sumber resmi',importedAt:new Date().toISOString()};
   const ok=SATRIA.tx('paket','Input RUP manual: '+rup,()=>{S.rupBank=S.rupBank||[];S.rupBank.push(entry)});
   if(ok===null)return;
   // Jangan mengganti pencarian Bank RUP menjadi kode manual: tindakan ini
   // dahulu menyembunyikan seluruh data impor JSON yang telah tersimpan.
   S.ui.tahun=tahun;S.ui.opd=opd;rupManualClearDraft();
   S.ui.rupSearch='';S.ui.rupBankOpd='all';S.ui.rupBankYear='all';
   toast('RUP manual masuk ke Bank RUP. Daftar manual dan impor JSON tetap ditampilkan.');return render();
 }
 if(a==='rupclasssave'){
   const r=(S.rupBank||[]).find(x=>String(x.id)===String(id));
   if(!r){toast('RUP tidak ditemukan di Bank RUP.');return}
   const scope=activeCloudScope();
   if(scope&&(!scope.opdIds.includes(String(r.opd))||!scope.years.includes(Number(r.tahun)))){toast('RUP berada di luar kewenangan akun.');return}
   const jenis=String([...document.querySelectorAll('[data-rup-class-kind]')].find(x=>x.dataset.rupClassKind===String(id))?.value||'').trim();
   const metode=String([...document.querySelectorAll('[data-rup-class-method]')].find(x=>x.dataset.rupClassMethod===String(id))?.value||'').trim();
   if(!SATRIA_RUP_JENIS.includes(jenis)||!SATRIA_RUP_METODE.includes(metode)){toast('Pilih jenis dan metode dari sumber resmi terlebih dahulu.');return}
   if(jenis===r.jenisPengadaan&&metode===r.metodePemilihan&&r.klasifikasiDiperiksaPada){toast('Klasifikasi Bank RUP sudah dicatat.');return}
   const ok=SATRIA.tx('paket','Klasifikasi Bank RUP diperiksa: '+r.rup,()=>{
     r.jenisPengadaan=jenis;r.metodePemilihan=metode;
     r.klasifikasiDiperiksaPada=new Date().toISOString();r.klasifikasiSumber='Diperiksa operator';
   });
   if(ok!==null){toast('Klasifikasi Bank RUP disimpan. Paket terkait tidak diubah otomatis.');return render()}
   return;
 }
 if(a==='rupclipboard'){
   if(!navigator.clipboard||typeof navigator.clipboard.readText!=='function'){
     toast('Akses clipboard tidak tersedia pada browser ini. Tempel manual (Ctrl+V) ke kolom JSON.');$('#rupJsonIn')?.focus();return;
   }
   navigator.clipboard.readText().then(raw=>{
     const txt=String(raw||'').replace(/^\uFEFF/,'').trim();
     if(!txt){toast('Clipboard kosong. Salin JSON SiRUP terlebih dahulu.');return;}
     if(txt.length>5*1024*1024){toast('Isi clipboard lebih dari 5 MB. Gunakan berkas yang lebih kecil.');return;}
     try{JSON.parse(txt);}catch(_){toast('Clipboard bukan JSON valid. Salin isi JSON terlebih dahulu.');return;}
     S.ui.rupJson=txt;S.ui.rupPrev=null;render();toast('JSON dimuat. Klik Periksa data untuk validasi dan pratinjau.');
   }).catch(()=>{toast('Izin membaca clipboard ditolak. Tempel manual (Ctrl+V) ke kolom JSON.');$('#rupJsonIn')?.focus();});
   return;
 }
 if(a==='rupexample'){S.ui.rupJson=d.kind==='sirup'?RUP_SIRUP:RUP_TPL;S.ui.rupPrev=null;return render()}
 if(a==='rupvalidate'||a==='rupimport'){
   const txt=$('#rupJsonIn')?.value??S.ui.rupJson??'';S.ui.rupJson=txt;
   const dop=$('#rupDefOpd')?.value??S.ui.rupDefOpd??'';S.ui.rupDefOpd=dop;
   const mode=$('#rupDupMode')?.value==='update'?'update':'skip';S.ui.rupDupMode=mode;
   const r=rupReadJson(txt,dop,S.ui.rupDefSub||'',mode);
   S.ui.rupPrev=rupPreview(r);
   if(a==='rupvalidate'||r.errs.length){toast(r.errs.length?'Ada '+r.errs.length+' kesalahan. Tidak ada data yang disimpan.':r.rows.length+' baru, '+r.updates.length+' diperbarui, '+r.skips+' dilewati.');return render()}
   if(!r.rows.length&&!r.updates.length){toast('Seluruh RUP sudah ada di Bank RUP; tidak ada yang perlu disimpan.');return render()}
   const msg='Impor '+r.rows.length+' RUP baru dan perbarui '+r.updates.length+' RUP di Bank? '+r.skips+' baris akan dilewati. Isian manual dan seluruh Paket Pengadaan TIDAK diubah. Periksa perubahan pagu/metode sebelum konfirmasi.';
   if(!confirm(msg))return render();
   const ok=SATRIA.tx('paket','Impor '+r.rows.length+' baru, perbarui '+r.updates.length+' Bank RUP',()=>{
     S.rupBank=S.rupBank||[];
     const timestamp=new Date().toISOString();
     for(const p of r.rows)S.rupBank.push(satriaBankRow(p));
     for(const u of r.updates){
       const old=S.rupBank.find(x=>x.id===u.id);
       if(!old)throw new Error('RUP tujuan perbarui sudah tidak tersedia.');
       // Tidak boleh mereset data operator atau ID sumber saat impor ulang.
       const changed=satriaRupDiff(old,u.patch);
       if(Object.keys(changed).length)Object.assign(old,changed,{updatedAt:timestamp});
     }
   });
   if(ok===null){S.ui.rupPrev=rupPreview({...r,errs:['Transaksi dibatalkan. Periksa notifikasi validasi.']});return render()}
   S.ui.rupJson='';S.ui.rupPrev=null;
   // Pulihkan tampilan penuh; filter lama tidak boleh menyamarkan hasil impor baru.
   S.ui.rupSearch='';S.ui.rupBankOpd='all';S.ui.rupBankYear='all';
   const changed=[...r.rows,...r.updates.map(u=>u.p)];
   S.ui.tahun=changed[0].tahun;
   const ops=[...new Set(changed.map(p=>String(p.opd)))];S.ui.opd=ops.length===1?ops[0]:'all';
   location.hash='#input';toast('Berhasil: '+r.rows.length+' RUP baru, '+r.updates.length+' diperbarui, '+r.skips+' dilewati.');return render();
 }
 if(a==='rupsave'){
   const g=k=>String($('#'+k)?.value??'').trim();
   const x=rupParseRow({rup:g('rupKode'),nama:g('rupNama'),opd:g('rupOpd'),tahun:g('rupTahun'),sub:g('rupSub'),pagu:g('rupPagu'),sumber:g('rupSumber'),masaHk:g('rupMasa'),jenisPengadaan:g('rupJenis'),metodePemilihan:g('rupMetode'),lokasiPengiriman:g('rupLokasi')},0,S.ui.tahun);
   if(!x.ok){S.ui.rupFormErr=x.err.replace(/^Data #1: /,'');toast(S.ui.rupFormErr);return render()}
   const p=x.p;p.seq=nextSeq(p.tahun,p.opd);
   const ok=SATRIA.tx('paket','Input RUP manual: '+p.rup,()=>{S.paket.push(p)});
   if(ok===null){S.ui.rupFormErr='Paket belum disimpan karena gagal validasi. Periksa pesan di atas.';return render()}
   S.ui.rupFormErr=null;S.ui.tahun=p.tahun;S.ui.opd=String(p.opd);S.ui.ptab='data';location.hash='#paket/'+p.id;return render()
 }
 if(a==='rupopen'){location.hash='#'+(satriaSpseIs(P(id))?'spse':'paket')+'/'+id;return render()}
 if(a==='rupallocsave'){
   const p=P(id);if(!p){toast('Paket tidak ditemukan.');return}
   const links=satriaRupLinks(p);if(links.length<2){toast('Pembagian alokasi hanya untuk paket yang menautkan lebih dari satu RUP.');return}
   const map={};for(const rid of links){const inp=[...document.querySelectorAll('[data-rup-split]')].find(el=>String(el.dataset.rupSplit)===rid);const raw=inp?.value?.trim()||'';const amount=Number(raw);if(raw===''||!Number.isSafeInteger(amount)||amount<0){toast('Alokasi setiap RUP harus angka rupiah bulat nonnegatif.');return}map[rid]=amount}
   const check=satriaRupPeriksaAlokasiPaket(p,p.pagu,map);
   if(!check.ok){toast(check.msg);return}
   const ok=SATRIA.tx('pagu','Pembagian alokasi RUP konsolidasi paket '+p.id,()=>{p.rupAlokasi=check.map});
   if(ok!==null){toast('Pembagian alokasi RUP disimpan. Pagu Bank RUP tidak berubah.');render()}
   return;
 }
 if(a==='ruplink'||a==='rupunlink'){
   const p=P(id);if(!p){toast('Paket tidak ditemukan.');return}
   const rid=a==='ruplink'?String($('#rupLinkAdd')?.value||''):String(d.rup||'');
   const r=(S.rupBank||[]).find(x=>String(x.id)===rid);
   if(!r){toast('Pilih RUP yang tercatat pada Bank RUP.');return}
   if(String(r.opd)!==String(p.opd)||Number(r.tahun)!==Number(p.tahun)){toast('RUP konsolidasi harus dalam OPD dan tahun anggaran yang sama.');return}
   if(a==='rupunlink'&&!confirm('Lepas tautan RUP '+r.rup+' dari paket ini? Jika RUP utama diganti dengan RUP konsolidasi lain, kode RUP paket/nomor dokumen turut berubah. Rincian dan HPS tetap.'))return;
   const ok=SATRIA.tx('paket',(a==='ruplink'?'Tautkan':'Lepas')+' RUP '+r.rup+' ke paket '+p.id,()=>{
     let ids=satriaRupLinks(p),map=satriaRupPetaAlokasiAwal(p);
     if(a==='ruplink'){
       if(ids.includes(rid))return;
       ids.push(rid);
       if(!p.rupBankId){p.rupBankId=rid;p.rup=r.rup;}
       // RUP tambahan tertaut dengan alokasi awal nol; operator dapat membaginya kemudian.
       map[rid]=ids.length===1?Number(p.pagu||0):0;
     }else{
       const freed=Number(map[rid]||0);
       ids=ids.filter(x=>x!==rid);delete map[rid];
       if(ids.length)map[ids[0]]=Number(map[ids[0]]||0)+freed;
     }
     if(a==='rupunlink'&&String(p.rupBankId)===rid){p.rupBankId=ids[0]||'';const next=(S.rupBank||[]).find(x=>String(x.id)===String(p.rupBankId));if(next)p.rup=next.rup;}
     p.rupBankIds=ids;
     if(ids.length>1)p.rupAlokasi=map;else delete p.rupAlokasi;
   });
   if(ok===null)return;
   toast('Relasi RUP diperbarui. Periksa kode RUP utama dan pagu paket.');return render();
 }

 if(a==='rupremove'){const r=(S.rupBank||[]).find(x=>x.id===id);if(!r)return;if([...(S.paket||[]),...(S.sampah||[]).filter(e=>e.collection==='paket').map(e=>e.record)].some(p=>satriaRupLinked(p,r))){toast('RUP masih terhubung dengan paket. Jangan hapus referensi yang telah dipakai; buka paket terkait terlebih dahulu.');return}if(!confirm('Pindahkan RUP '+r.rup+' ke Sampah? Bisa dipulihkan.'))return;if(satriaRecycleMove('rupBank',id))render();return}
 if(a==='satriaFixDemoSub'){
   const count=satriaSubDemoJumlah();
   if(!count){toast('Tidak ada subkegiatan demo pada paket/Bank RUP.');return render()}
   if(!confirm('Bersihkan '+count+' nilai KODE-DEMO-001 yang teridentifikasi sebagai data contoh? Hanya field subkegiatan yang ditandai demo yang dikosongkan; data lainnya tetap. Lakukan backup sebelum melanjutkan.'))return;
   const ok=SATRIA.tx('paket','Pembersihan kode subkegiatan demo pada paket dan Bank RUP',()=>{
     for(const p of S.paket||[])if(satriaPaketAdaSubDemo(p))p.sub='';
     for(const r of S.rupBank||[])if(satriaIsDemoSubCode(r.sub)&&String(r.rup||'')!=='DEMO-RUP-0001')r.sub='';
   });
   if(ok===null)return;
   toast('Kode demo telah dibersihkan. Isi subkegiatan resmi di Data Paket sebelum menerbitkan dokumen.');return render();
 }
 if(a==='rupalign'){
   const p=P(id);if(satriaSpseIs(p)){toast('Alokasi paket SPSE diperbarui melalui menu Monitoring SPSE.');return}if(!p){toast('Paket tidak ditemukan.');return}
   if(satriaRupLinks(p).length>1){toast('Paket konsolidasi perlu pembagian per RUP secara manual.');return}
   const rin=satriaRupRincianPenggunaan(p);
   if(!rin.complete||rin.nilai<=0){toast('Lengkapi rincian paket dahulu.');return}
   if(rin.nilai===Number(p.pagu)){toast('Pagu paket sudah sesuai dengan rincian.');return}
   if(!confirm('Samakan pagu PAKET '+(p.nama||p.id)+' dari '+rp(p.pagu)+' menjadi '+rp(rin.nilai)+'? Ini dapat mengubah nilai pagu yang muncul pada dokumen yang dicetak ulang. Pagu Bank RUP tetap.'))return;
   if(satriaRupSetPaguPaket(p,rin.nilai)){toast('Pagu paket disesuaikan dengan total rincian/HPS.');return render()}
   return;
 }
 if(a==='rupcreate'){
   const r=(S.rupBank||[]).find(x=>x.id===id);if(!r){toast('RUP tidak ditemukan.');return}
   const input=[...document.querySelectorAll('[data-rup-budget-input]')].find(el=>String(el.dataset.rupBudgetInput)===String(id));
   const raw=String(input?.value||'').trim();
   const status=satriaRupStatusAnggaran(r),paguPaket=raw===''?status.sisa:Number(raw);
   if(!Number.isSafeInteger(paguPaket)||paguPaket<=0){toast('Cadangan pagu harus angka rupiah positif, atau kosongkan untuk memakai sisa RUP.');input?.focus();return}
   if(!status.valid||status.sisa<=0){toast('Sisa alokasi RUP tidak tersedia. Sesuaikan pagu paket lama atau perbarui data RUP resmi terlebih dahulu.');return}
   if(paguPaket>status.sisa){toast('Alokasi paket baru '+rp(paguPaket)+' melebihi sisa pagu RUP '+rp(status.sisa)+'. Paket tidak dibuat.');input?.focus();return}
   const scope=activeCloudScope();if(scope&&(!scope.opdIds.includes(String(r.opd))||!scope.years.includes(Number(r.tahun)))){toast('RUP di luar kewenangan akun.');return}
   const p={id:uid('k'),tahun:+r.tahun,opd:r.opd,unit:(S.unit.find(u=>String(u.opd)===String(r.opd))||{}).id||'',seq:nextSeq(r.tahun,r.opd),nama:r.nama,rup:r.rup,pagu:paguPaket,sumber:r.sumber,sub:satriaValidSubCode(r.sub)||'',bulanPelaksanaan:r.bulanPelaksanaan||'',metodePemilihan:r.metodePemilihan||'',jenisPengadaan:r.jenisPengadaan||'',ppk:pjId(r.opd,'PPK')||'',pp:pjId(r.opd,'PP')||'',kabid:pjId(r.opd,'Kabid')||'',masaHk:Number(r.masaHk)||7,lokasiPengiriman:r.lokasiPengiriman||O(r.opd).tempat||'',items:status.linked.length?[]:(Array.isArray(r.items)?r.items:[]).map(it=>({...it,id:uid('i')})),penawaran:[],pemenangId:null,rupBankId:r.id,rupBankIds:[String(r.id)]};
   const ok=SATRIA.tx('paket','Buat paket dari Bank RUP '+r.rup,()=>S.paket.push(p));if(ok===null)return;
   S.ui.tahun=p.tahun;S.ui.opd=p.opd;S.ui.ptab='data';location.hash='#paket/'+p.id;return render();
 }
 if(a==='newpaket'){S.ui.rupSearch='';location.hash='#input';toast('Pilih RUP dari Bank RUP untuk membuat paket pengadaan.');return render()}
 if(a==='copy'){const s=P(id);if(satriaSpseIs(s)){toast('Paket SPSE dicatat melalui Monitoring SPSE, bukan fitur salin e-Purchasing.');return;}if(window.SATRIA_CLOUD_CONFIGURED&&window.SATRIA_CLOUD_ROLE&&window.SATRIA_CLOUD_ROLE!=='admin'&&!S.tahun.includes(s.tahun+1)){toast('Tidak dapat menyalin ke tahun yang belum ditetapkan. Minta admin menambahkan assignment tahun lebih dahulu.');return}if(!S.tahun.includes(s.tahun+1)){S.tahun.push(s.tahun+1);S.tahun.sort()}const n=JSON.parse(JSON.stringify(s));Object.assign(n,{id:uid('k'),tahun:s.tahun+1,seq:nextSeq(s.tahun+1,s.opd),rup:'',rupBankId:'',rupBankIds:[],pemenangId:null,penawaran:[],tglNodis:'',tglSurvei:'',tglEvaluasi:'',tglNego:'',tglPenetapan:'',tglDpp:'',tglSppbj:'',tglBahp:''});delete n.ppDokumenPemilihan;S.paket.push(n);S.ui.tahun=n.tahun;location.hash='#paket/'+n.id;sync('paket','Paket disalin ke TA '+n.tahun);return render()}
 if(a==='delpaket'){const p=P(id);if(!p)return;if(!confirm('Pindahkan paket '+String(p.nama||p.id)+' ke Sampah? Dapat dipulihkan.'))return;if(satriaRecycleMove('paket',id)){location.hash='#paket';render()}return}
 if(a==='openOfferCalc'){const p=P(pid),w=p?.penawaran?.find(x=>String(x.id)===String(id));if(!p||!w){toast('Paket atau penyedia tidak ditemukan.');return}KN.pid=p.id;KN.wid=w.id;KN.scope='';KN.lastSaved=null;S.ui.tahun=Number(p.tahun);S.ui.opd=String(p.opd);S.ui.page='kalk';S.ui.pid=null;location.hash='#kalk';return render()}
 if(a==='ptab'){S.ui.ptab=d.tab;return render()}
 if(a==='satMasterAudit'){toast(satMasterIssues().length+' temuan pemeriksaan Data Master.');return render()}
 if(a==='satMasterExport'){satMasterExport();return}
 if(a==='mtab'){S.ui.mtab=d.tab;S.ui.me=null;S.ui.ms='';return render()}
 if(a==='medit'){S.ui.me=S.ui.me===id?null:id;return render()}
 if(a==='mtoggle'){const c=d.c||'pejabat',list=c==='pejabat'?S.pejabat:S[c];const r=Array.isArray(list)?list.find(x=>String(x.id)===String(id)):null;if(!r){toast('Data master tidak ditemukan. Muat ulang data bila diperlukan.');return render()}r.aktif=r.aktif===false;sync('master',(r.aktif?'Diaktifkan: ':'Dinonaktifkan: ')+(r.nama||r.bidang||r.kode||r.id));return render()}
 if(a==='madd'){const row={id:uid('x'),aktif:true};document.querySelectorAll('[data-new]').forEach(i=>{row[i.dataset.new]=i.value.trim()});
  if(d.m==='penyedia'){
    // Optional contact/identification fields: '-' means no information entered.
    // Preserve actual names, addresses, status and catalog selections unchanged.
    ['telepon','email','npwp','nib','kbli','link'].forEach(f=>{
      if(/^[-–—]+$/.test(String(row[f]??'').trim()))row[f]='';
    });
  }
  const invalidMaster=satMasterCheckNew(d.m,row);if(invalidMaster){toast(invalidMaster);return}
  const need=d.m==='kode'||d.m==='unit'||d.m==='akun'?'kode':'nama';if(!String(row[need]||'').trim()){toast('Kolom utama wajib diisi');return}
  if(['ppk','pp','kabid'].includes(d.m)&&!String(row.opd||'').trim()){toast('Penempatan OPD wajib dipilih');return}
  if(d.m==='unit'&&!String(row.bidang||'').trim()){toast('Nama Unit/Bagian wajib diisi');return}
  if(d.m==='akun'&&!String(row.nama||'').trim()){toast('Nama Akun / Uraian wajib diisi');return}
  if(d.m==='kode'){if(S.kode.some(k=>String(k.kode||'').trim().toLowerCase()===String(row.kode||'').trim().toLowerCase())){toast('Kode sudah ada');return}row.id=row.kode}
  if(d.m==='unit'){if(!row.kode||!row.opd){toast('Kode unit dan OPD wajib diisi');return}if(S.unit.some(u=>u.opd===row.opd&&String(u.kode||'').toLowerCase()===String(row.kode).toLowerCase())){toast('Kode unit sudah dipakai pada OPD tersebut');return}row.id=uid('u')}
  if(d.m==='akun'&&S.akun.some(a=>String(a.kode||'').trim().toLowerCase()===String(row.kode||'').trim().toLowerCase())){toast('Kode rekening sudah ada (pemeriksaan tidak membedakan huruf besar/kecil)');return}
  if(d.m==='penyedia'){row.status='Aktif';row.statusKatalog=row.statusKatalog||'Perlu verifikasi';row.pdn=row.pdn||'Perlu verifikasi';row.tipe=row.tipe||'Perlu verifikasi';row.bentuk=row.bentuk||'Perorangan'}
  if(PERAN[d.m]){const pr=PERAN[d.m];row.peran=pr;row.aktif=true;row.jabatan=row.jabatan||JAB[pr];row.opd=row.opd||S.opd[0].id;S.pejabat.push(row);sync('master','Pejabat ditambahkan: '+row.nama);return render()}
  S[d.m].push(row);sync('master','Data master ditambahkan');return render()}
 if(a==='dtype'){const jump=!!t.closest('.spha-quick')&&d.tab==='analisa';S.ui.dok=d.tab;render();if(jump)requestAnimationFrame(()=>document.querySelector('#dokLazyContainer')?.scrollIntoView({block:'start',behavior:'smooth'}));return}
 if(a==='hpsdraftadd'||a==='additem'){
  const p=P(pid);if(!satriaHpsCanEdit(p))return;
  const draft=satriaHpsDraft(p),iid=uid('i');
  draft.items.push({id:iid,nama:'',spesifikasi:'',merek:'',pdn:'Perlu verifikasi',linkProduk:'',vol:'',satuan:'Buah',hs:''});
  draft.dirty=true;render();requestAnimationFrame(()=>{const el=[...document.querySelectorAll('[data-hps-edit][data-f="nama"]')].find(x=>x.dataset.id===iid);el?.scrollIntoView({block:'nearest'});el?.focus()});return;
 }
 if(a==='hpsdraftdel'||a==='delitem'){
  const p=P(pid);if(!satriaHpsCanEdit(p))return;
  const draft=satriaHpsDraft(p),it=draft.items.find(x=>String(x.id)===String(id));if(!it)return;
  if(window.SATRIA_CLOUD_CONFIGURED&&(p.items||[]).some(x=>String(x.id)===String(id))){
    if(draft.dirty){toast('Simpan atau batalkan perubahan draf dahulu sebelum mengarsipkan barang cloud.');return}
    if(!confirm('Pindahkan rincian barang ini ke Sampah cloud? Bila sudah memiliki harga penawaran, server akan menolak sampai buktinya aman.'))return;
    if(!window.SATRIA_CLOUD_TRASH?.ready){toast('Cloud belum siap, tidak ada data dihapus.');return}
    satriaHpsEditDrafts.delete(satriaHpsDraftKey(p.id));
    window.SATRIA_CLOUD_TRASH.archiveNested('item',p.id,id)
      .catch(err=>toast('Penghapusan rincian dibatalkan: '+err.message));return;
  }
  if(!confirm('Hapus barang "'+String(it.nama||'baru')+'" dari draf? Data asli baru berubah setelah Simpan Semua Rincian.'))return;
  draft.items=draft.items.filter(x=>String(x.id)!==String(id));draft.dirty=true;return render();
 }
 if(a==='hpsdraftdiscard'){
  const draft=satriaHpsEditDrafts.get(satriaHpsDraftKey(pid));if(!draft)return;
  if(draft.dirty&&!confirm('Batalkan seluruh isian rincian yang belum disimpan?'))return;
  satriaHpsEditDrafts.delete(satriaHpsDraftKey(pid));return render();
 }
 if(a==='hpsdraftsave'){
  const p=P(pid);if(!satriaHpsCanEdit(p)){toast('Akun ini tidak dapat mengubah rincian paket.');return;}
  satriaHpsDraftSave(p);return;
 }

 if(a==='correctOfferProvider'){
   if(!canWrite()){toast('Akun Viewer tidak dapat mengubah penyedia penawaran.');return}
   const p=P(pid),w=p?.penawaran?.find(x=>String(x.id)===String(id));
   if(!p||!w){toast('Penawaran atau paket tidak ditemukan.');return}
   const cloudScope=activeCloudScope();
   if(cloudScope&&(!cloudScope.opdIds.includes(String(p.opd))||!cloudScope.years.includes(Number(p.tahun)))){toast('Paket di luar penugasan akun.');return}
   const form=[...document.querySelectorAll('.satria-offer-provider-correction')].find(el=>el.dataset.providerCorrectionPid===String(pid)&&el.dataset.providerCorrectionWid===String(id));
   if(!form){toast('Form koreksi tidak ditemukan. Buka Penawaran & Negosiasi kembali.');return}
   const targetId=String(form.querySelector('[data-provider-correction-target]')?.value||'');
   const reason=String(form.querySelector('[data-provider-correction-reason]')?.value||'').trim();
   const evidence=String(form.querySelector('[data-provider-correction-evidence]')?.value||'').trim();
   const confirmed=!!form.querySelector('[data-provider-correction-confirm]')?.checked;
   const target=(S.penyedia||[]).find(y=>String(y.id)===targetId&&y.aktif!==false);
   if(!target||String(target.id)===String(w.pen)){toast('Pilih penyedia pengganti yang berbeda dan masih aktif.');return}
   if((p.penawaran||[]).some(x=>x!==w&&String(x.pen)===targetId)){toast('Penyedia ini sudah memiliki penawaran pada paket.');return}
   if(reason.length<15){toast('Isi alasan/kronologi koreksi minimal 15 karakter.');return}
   if(evidence.length<5){toast('Isi nomor/referensi bukti asli minimal 5 karakter.');return}
   if(!confirmed){toast('Centang pernyataan setelah memverifikasi bukti asli.');return}
   const old=PY(w.pen),oldName=String(old.nama||'-'),newName=String(target.nama||'-');
   if(!confirm('KOREKSI IDENTITAS PENAWARAN\n\nRUP '+String(p.rup||p.id)+'\nDari: '+oldName+'\nMenjadi: '+newName+'\n\nPerubahan hanya benar apabila seluruh data harga/negosiasi yang sudah diinput adalah milik '+newName+'.\nPenetapan lama akan dicabut untuk dikonfirmasi ulang. Riwayat perubahan disimpan. Lanjutkan?'))return;
   const hadWinner=String(p.pemenangId||'')===String(w.id),wasReview=w.hpsTotalReview?JSON.parse(JSON.stringify(w.hpsTotalReview)):null;
   const record={dari:String(w.pen),dariNama:oldName,ke:targetId,keNama:newName,pada:new Date().toISOString(),oleh:String(cur().nama||'-'),alasan:reason,bukti:evidence,pemenangSebelumnya:hadWinner,reviewHistorisSebelumnya:wasReview};
   const ok=SATRIA.tx('nego','Koreksi penyedia penawaran RUP '+String(p.rup||p.id)+': '+oldName+' → '+newName,()=>{
     if(!Array.isArray(w.koreksiIdentitasPenyedia))w.koreksiIdentitasPenyedia=[];
     w.koreksiIdentitasPenyedia.push(record);
     w.pen=targetId;
     // A review atas nama penyedia lain tidak boleh otomatis pindah; nilai HPS dan item tetap.
     delete w.hpsTotalReview;
     satriaHpsReviewDrafts.delete(satriaHpsReviewKey(p.id,w.id));
     // Penetapan wajib dievaluasi dan dikonfirmasi ulang secara eksplisit.
     if(hadWinner){p.pemenangId=null;p.koreksiPenyediaPerluVerifikasi={pada:record.pada,dari:oldName,ke:newName,bukti:evidence};}
   });
   if(ok===null)return;
   toast('Nama penyedia terkoreksi menjadi '+newName+'. Periksa nilai dan dokumen, lalu tetapkan ulang jika memenuhi syarat.');
   return render();
 }
 if(a==='delpw'){
   const p=P(pid),w=p?.penawaran?.find(x=>String(x.id)===String(id));if(!p||!w)return;
   if(!confirm('Pindahkan penawaran penyedia ini ke Sampah?'))return;
   if(window.SATRIA_CLOUD_CONFIGURED){
     const api=window.SATRIA_CLOUD_TRASH;
     if(!api?.ready){toast('Cloud belum siap; penawaran tidak dihapus.');return}
     api.archiveNested('penawaran',p.id,id).catch(err=>toast('Arsip penawaran dibatalkan: '+err.message));return;
   }
   if(satriaRecycleBlocked())return;
   window.SATRIA_CORE_GUARDS.archiveSpecial(S,'penawaran',id,{paketId:p.id,offer:w},cur().nama);
   p.penawaran=p.penawaran.filter(x=>x.id!==id);if(p.pemenangId===id)p.pemenangId=null;
   sync('nego','Penawaran dipindah ke Sampah');return render();
 }
 if(a==='saveHpsTotalReview'){
   const p=P(pid),w=p?.penawaran?.find(w=>String(w.id)===String(id));if(!p||!w)return;
   const panel=[...document.querySelectorAll('.satria-hps-total-review')].find(el=>
     el.getAttribute('data-hps-review-pid')===String(pid)&&el.getAttribute('data-hps-review-wid')===String(id));
   if(!panel){toast('Form review tidak ditemukan. Buka kembali Penawaran & Negosiasi.');return}
   satriaHpsReviewCapture(panel);
   const draft=satriaHpsReviewDrafts.get(satriaHpsReviewKey(pid,id))||{reason:'',evidence:'',accepted:false};
   const reason=String(draft.reason).trim(),evidence=String(draft.evidence).trim(),accepted=!!draft.accepted;
   const e=evalPw(p).find(x=>x.w===w),above=satriaNegoAboveUnit(p,w);
   if(!above.length){toast('Tidak ada harga nego satuan di atas HPS; gunakan evaluasi standar.');return}
   if(!(e?.negoLengkap&&e.lengkap)||!(e.t>0)||!(Number(p.pagu)>0)||(p.items||[]).some(i=>!(Number(i.vol)>0)||!(Number(i.hs)>0))||e.t>hps(p)||e.t>Number(p.pagu)||
     (p.items||[]).some(i=>Number(w.nego?.[i.id]||0)>Number(w.harga?.[i.id]||0))){
     alert('Review tidak dapat digunakan: seluruh item harus lengkap; total negosiasi termasuk ongkir wajib <= total HPS dan pagu, serta setiap nego <= harga tayang.');return;
   }
   if(reason.length<15||reason.length>1200||evidence.length<5||evidence.length>300||!accepted){
     alert('Isi kronologi/alasan minimal 15 karakter, referensi bukti minimal 5 karakter, dan centang pernyataan pemeriksaan.');return;
   }
   if(!confirm('Simpan CATATAN REVIEW KASUS HISTORIS untuk '+above.length+' item di atas HPS satuan?\nTotal: '+rp(e.t)+' / HPS '+rp(hps(p))+' / pagu '+rp(p.pagu)+'\n\nIni hanya menyimpan catatan historis opsional; penetapan tetap dinilai dari batas total, pagu, dan kelengkapan. Catatan ini bukan pengesahan transaksi atau persetujuan tambahan.'))return;
   const prev=w.hpsTotalReview,record={mode:'historical-total',reason,evidence,
     recordedAt:new Date().toISOString(),actor:String(cur().nama||'-'),actorId:String(cur().id||''),
     fingerprint:satriaNegoReviewFingerprint(p,w),overItems:above.map(i=>({id:i.id,nama:i.nama,hps:Number(i.hs),nego:Number(w.nego?.[i.id]||0)})),
     totalNego:e.t,totalHps:hps(p),pagu:Number(p.pagu||0)};
   const ok=SATRIA.tx('nego','Review evaluasi total HPS historis untuk '+p.rup,()=>{
     w.hpsTotalReviewHistory=Array.isArray(w.hpsTotalReviewHistory)?w.hpsTotalReviewHistory:[];
     if(prev)w.hpsTotalReviewHistory.push({...prev,replacedAt:record.recordedAt});
     w.hpsTotalReview=record;
   });if(ok===null)return;satriaHpsReviewDrafts.delete(satriaHpsReviewKey(pid,id));toast('Catatan historis tersimpan. Periksa kembali syarat penetapan dan dokumen resmi.');return render();
 }
 if(a==='removeHpsTotalReview'){
   const p=P(pid),w=p?.penawaran?.find(w=>String(w.id)===String(id));if(!p||!w?.hpsTotalReview)return;
   if(!confirm('Arsipkan catatan historis ini? Jejaknya tetap disimpan; keputusan penetapan mengikuti pemeriksaan total HPS/pagu dan kelengkapan.'))return;
   const ok=SATRIA.tx('nego','Cabut review total HPS historis untuk '+p.rup,()=>{
     w.hpsTotalReviewHistory=Array.isArray(w.hpsTotalReviewHistory)?w.hpsTotalReviewHistory:[];
     w.hpsTotalReviewHistory.push({...w.hpsTotalReview,replacedAt:new Date().toISOString(),revoked:true});
     delete w.hpsTotalReview;
   });if(ok===null)return;satriaHpsReviewDrafts.delete(satriaHpsReviewKey(pid,id));return render();
 }
 if(a==='winner'){const p=P(pid);if(!p){toast('Paket tidak ditemukan.');return}const e=evalPw(p).find(x=>String(x.w.id)===String(id)),check=satriaOfferGate(p,e);if(!check.ready){alert('Penyedia belum dapat ditetapkan:\n• '+check.errors.join('\n• '));return}if(p.pemenangId===id){toast('Penyedia ini sudah ditetapkan.');return}const seller=PY(e.w.pen).nama;const prior=p.pemenangId?(p.penawaran||[]).find(w=>w.id===p.pemenangId):null;const text=(prior?'Ganti penyedia yang sebelumnya ditetapkan ('+PY(prior.pen).nama+')?\n\n':'')+'Tetapkan '+seller+' sebagai penyedia terpilih untuk paket '+String(p.nama||p.rup)+'?\nNilai hasil negosiasi: '+rp(e.t)+' (termasuk pajak).\n'+(satriaNegoAboveUnit(p,e.w).length?'\nPERHATIAN: Ada item di atas HPS satuan. Periksa kewajaran, spesifikasi, dan bukti, meskipun total paket memenuhi batas.\n':'')+'\nSistem mencatat pilihan manual. Periksa kelengkapan bukti serta kewenangan pejabat sebelum menerbitkan dokumen.';if(!confirm(text))return;p.pemenangId=id;if(p.koreksiPenyediaPerluVerifikasi){p.koreksiPenyediaPerluVerifikasi.ditetapkanUlangPada=new Date().toISOString();p.koreksiPenyediaPerluVerifikasi.ditetapkanUlangOleh=String(cur().nama||'-');}sync('pemenang','Penetapan manual penyedia: '+seller);toast('Penyedia '+seller+' berhasil ditetapkan.');return render()}
 if(a==='autowin'){P(pid).pemenangId=null;sync('pemenang','Penetapan pemenang dibatalkan; kandidat tetap dihitung otomatis');return render()}
 if(a==='addrow'){if(typeof MBLANK==='undefined'||!MBLANK[d.c]){toast('Gunakan formulir tambah pada tab ini.');return}S[d.c].push(MBLANK[d.c]());sync('master','Baris master ditambahkan: '+d.c);return render()}
 if(a==='delrow'){if(!confirm('Pindahkan data ini ke Sampah?'))return;if(!canDel(d.c,id)){toast('Data masih dipakai paket. Nonaktifkan atau ganti dulu.');return}if(d.c==='opd'&&[...(S.rupBank||[]),...(S.sampah||[]).filter(e=>e.collection==='rupBank').map(e=>e.record)].some(r=>r.opd===id)){toast('OPD masih digunakan Bank RUP. Hapus/relokasi RUP terlebih dahulu.');return}if(satriaRecycleMove(d.c,id))render();return}
 if(a==='addopd'){S.opd.push({id:uid('o'),nama:'',singkat:'',unit:'',bidang:'',alamat:''});sync('settings','OPD ditambahkan');return render()}
 if(a==='addyear'){const raw=$('#newYear').value,v=Number(raw);if(!raw||!Number.isInteger(v)||v<2000||v>2200){toast('Masukkan tahun anggaran berupa bilangan bulat 2000–2200.');return}if(S.tahun.includes(v)){toast('Tahun anggaran sudah terdaftar.');return}S.tahun.push(v);S.tahun.sort((a,b)=>a-b);sync('settings','Tahun '+v+' ditambahkan');return render()}
  if(a==='uadd'){const row={id:uid('u'),aktif:true};document.querySelectorAll('[data-new]').forEach(i=>{row[i.dataset.new]=i.value.trim()});
 if(!row.nama||!row.username){toast('Nama dan username wajib diisi');return}
 if(S.users.some(x=>x.username.toLowerCase()===row.username.toLowerCase())){toast('Username sudah dipakai');return}
 S.users.push(row);sync('master','User ditambahkan: '+row.nama);return render()}
 if(a==='utoggle'){const u=S.users.find(x=>x.id===id);if(!u)return;if(u.aktif!==false){if(u.id===S.ui.user){toast('Tidak bisa menonaktifkan user yang sedang dipakai');return}if(isLastAdmin(id)){toast('Harus ada minimal satu Admin aktif');return}u.aktif=false}else u.aktif=true;sync('master',(u.aktif?'Diaktifkan: ':'Dinonaktifkan: ')+u.nama);return render()}
 if(a==='udel'){const u=S.users.find(x=>x.id===id);if(!u)return;if(u.id===S.ui.user){toast('Tidak bisa menghapus user yang sedang dipakai');return}if(isLastAdmin(id)){toast('Harus ada minimal satu Admin aktif');return}if(!confirm('Pindahkan user '+u.nama+' ke Sampah?'))return;if(satriaRecycleMove('users',id))render();return}
 if(a==='clearsample'){if(satriaRecycleBlocked())return;if(!confirm('Pindahkan semua paket, pejabat, dan penyedia aktif ke Sampah? Data bisa dipulihkan.'))return;for(const c of ['paket','pejabat','penyedia'])for(const row of [...S[c]])window.SATRIA_CORE_GUARDS.archive(S,c,row.id,cur().nama);sync('master','Paket, pejabat, dan penyedia dipindah ke Sampah');toast('Data contoh dipindahkan ke Sampah dan dapat dipulihkan.');return render()}
 if(a==='rmkop'){
   const o=S.opd.find(x=>x.id===id);if(!o?.kop)return;
   if(window.SATRIA_CLOUD_CONFIGURED){
     if(!window.SATRIA_CLOUD_TRASH?.ready){toast('Cloud belum siap; kop tetap tersimpan.');return}
     window.SATRIA_CLOUD_TRASH.archiveNested('media',id,id).catch(err=>toast('Arsip kop ditolak: '+err.message));return;
   }
   if(satriaRecycleBlocked())return;
   window.SATRIA_CORE_GUARDS.archiveSpecial(S,'media',id,{owner:'opd',opdId:id,value:o.kop},cur().nama);
   delete o.kop;sync('settings','Kop '+o.singkat+' dipindahkan ke Sampah');return render();
 }
 if(a==='rmlogo'){
   if(!S.pemda.logo)return;
   if(window.SATRIA_CLOUD_CONFIGURED){
     if(!window.SATRIA_CLOUD_TRASH?.ready){toast('Cloud belum siap; logo tetap tersimpan.');return}
     window.SATRIA_CLOUD_TRASH.archiveNested('media','pemda','pemda-logo').catch(err=>toast('Arsip logo ditolak: '+err.message));return;
   }
   if(satriaRecycleBlocked())return;
   window.SATRIA_CORE_GUARDS.archiveSpecial(S,'media','pemda-logo',{owner:'pemda',value:S.pemda.logo},cur().nama);
   delete S.pemda.logo;sync('settings','Logo dipindahkan ke Sampah');return render();
 }
 if(a==='delyear'){const y=+d.y;if([...S.paket,...(S.sampah||[]).filter(e=>e.collection==='paket').map(e=>e.record)].some(p=>+p.tahun===y)||[...(S.rupBank||[]),...(S.sampah||[]).filter(e=>e.collection==='rupBank').map(e=>e.record)].some(r=>+r.tahun===y)){toast('Tahun masih digunakan Paket Pengadaan atau Bank RUP.');return render()}if(S.tahun.length<=1){toast('Tahun anggaran terakhir tidak dapat dihapus. Tambahkan tahun pengganti terlebih dahulu.');return render()}if(satriaRecycleBlocked())return;if(!confirm('Pindahkan TA '+y+' ke Sampah? Bisa dipulihkan.'))return;window.SATRIA_CORE_GUARDS.archiveSpecial(S,'tahun',String(y),{year:y},cur().nama);S.tahun=S.tahun.filter(x=>+x!==y);if(+S.ui.tahun===y)S.ui.tahun=S.tahun[0];sync('settings','Tahun '+y+' dipindah ke Sampah');return render()}
 if(a==='reset'){if(satriaRecycleBlocked())return;if(!confirm('Reset ke data awal? Snapshot seluruh data aktif akan dicadangkan ke Sampah lokal. Unduh backup JSON terpisah terlebih dahulu untuk keamanan tambahan.'))return;const before=persistable(),actor=cur().nama,previousTrash=JSON.parse(JSON.stringify(S.sampah||[]));init();S.sampah=previousTrash;delete before.sampah;S.sampah.unshift({id:uid('trash'),collection:'snapshot',originalId:'snapshot',record:before,deletedAt:new Date().toISOString(),deletedBy:actor});sync('settings','Data direset ke data awal; snapshot tersedia di Sampah');route();toast('Data awal dimuat; snapshot sebelum reset tersedia di Sampah.');return}
 if(a==='print')return window.print();
 if(a==='lapView'){
  const target=String(d.view||'overview');if(!['overview','rekening','audit','rup'].includes(target))return;
  S.ui.lapView=target;render();document.getElementById('satriaLaporanShell')?.scrollIntoView({block:'start'});
  return;
 }
 if(a==='lapVizAccount'){const key=String(d.key||'');if(!satriaLaporanRekeningRows().options.has(key))return;S.ui.lapView='rekening';S.ui.lapRekeningAkun=key;render();document.getElementById('satriaLaporanRekening')?.scrollIntoView({block:'start',behavior:'smooth'});return}
 if(a==='lapVizAudit'){const kind=String(d.kind||'');if(!Object.hasOwn(SATRIA_LAP_AUDIT_LABELS,kind))return;S.ui.lapView='audit';S.ui.lapAuditJenis=kind;render();document.getElementById('satriaLaporanAudit')?.scrollIntoView({block:'start',behavior:'smooth'});return}
 if(a==='lapAuditCsv')return satriaLaporanAuditCsv();
 if(a==='lapRekeningCsv')return satriaLaporanRekeningCsv(false);
 if(a==='lapRekeningDetailCsv')return satriaLaporanRekeningCsv(true);
 if(a==='lapRekeningReset'){S.ui.lapRekeningTahun='all';S.ui.lapRekeningAkun='all';S.ui.lapRekeningCari='';return render()}
 if(a==='lapRekeningCari'){S.ui.lapRekeningCari=String($('#lapRekeningCari')?.value||'');return render()}
 if(a==='lapRekeningOpen'){const pack=P(id),scope=activeCloudScope();if(!pack||(scope&&(!scope.opdIds.includes(String(pack.opd))||!scope.years.includes(Number(pack.tahun))))||(S.ui.opd!=='all'&&String(pack.opd)!==String(S.ui.opd))){toast('Paket tidak tersedia pada kewenangan akun.');return}S.ui.tahun=Number(pack.tahun);S.ui.pid=pack.id;location.hash='#'+(satriaSpseIs(pack)?'spse':'paket')+'/'+encodeURIComponent(pack.id);return}
 if(a==='csv')return csvExport();
 if(a==='csvDetail')return satriaLaporanCsvDetail();
 if(a==='export'){const o={...S};delete o.ui;delete o.log;delete o.dirty;delete o.chat;const u=URL.createObjectURL(new Blob([JSON.stringify(o,null,2)],{type:'application/json'}));const l=document.createElement('a');l.href=u;l.download='SATRIA-backup-'+new Date().toISOString().slice(0,10)+'.json';l.click();setTimeout(()=>URL.revokeObjectURL(u),1500);return render()}
});
/* Form rincian: capture langsung saat mengetik, tanpa merender ulang atau auto-sync. */
document.addEventListener('input',e=>{
 const t=e.target;if(!t?.matches?.('[data-hps-edit]'))return;
 const p=P(t.dataset.pid);if(!satriaHpsCanEdit(p))return;
 const d=satriaHpsDraftsGet(p);if(!d)return;
 const it=d.items.find(x=>String(x.id)===String(t.dataset.id));
 if(!it||!['nama','vol','satuan','hs'].includes(t.dataset.f))return;
 it[t.dataset.f]=t.value;d.dirty=true;
 const wrap=t.closest('[data-hps-draft]');
 const status=wrap?.querySelector('[data-hps-status]');if(status)status.textContent='● Ada isian belum disimpan';
 const preview=wrap?.querySelector('[data-hps-preview]');const total=satriaHpsDraftTotals(d);
 if(preview)preview.textContent=total===null?'Lengkapi volume & HPS':rp(total);
 const row=wrap?.querySelector('[data-hps-row="'+CSS.escape(String(it.id))+'"]');
 const rowSubtotal=row?.querySelector('[data-hps-subtotal]');
 const qty=satriaHpsDraftVolume(it.vol),price=satriaHpsDraftHarga(it.hs);
 if(rowSubtotal)rowSubtotal.textContent=Number.isFinite(qty)&&Number.isFinite(price)?rp(qty*price):'—';
},true);
function satriaHpsDraftsGet(p){return satriaHpsEditDrafts.get(satriaHpsDraftKey(p.id));}
let paketSearchTimer=null;
/* Draf review ditangkap sebelum event generik atau refresh tampilan. */
document.addEventListener('input',e=>{
 if(e.target?.matches?.('[data-hps-review-reason],[data-hps-review-evidence]'))
   satriaHpsReviewCapture(e.target.closest('.satria-hps-total-review'));
},true);
document.addEventListener('change',e=>{
 if(e.target?.matches?.('[data-hps-review-reason],[data-hps-review-evidence],[data-hps-review-check]'))
   satriaHpsReviewCapture(e.target.closest('.satria-hps-total-review'));
},true);
document.addEventListener('input',e=>{if(RUP_MANUAL_FIELD_IDS.includes(e.target?.id))rupManualCapture();});
document.addEventListener('input',e=>{if(e.target?.id==='lapRekeningCari')S.ui.lapRekeningCari=String(e.target.value||'')});
document.addEventListener('keydown',e=>{if(e.target?.id==='lapRekeningCari'&&e.key==='Enter'){e.preventDefault();S.ui.lapRekeningCari=String(e.target.value||'');render()}});
document.addEventListener('input',e=>{if(e.target?.id==='rupJsonIn'){S.ui.rupJson=e.target.value;S.ui.rupPrev=null;}});
document.addEventListener('input',e=>{if(e.target?.id==='rupBankSearch'){const inp=e.target;S.ui.rupSearch=inp.value;const pos=inp.selectionStart;render();const next=$('#rupBankSearch');if(next){next.focus();try{next.setSelectionRange(pos,pos)}catch(_){}}}});
document.addEventListener('input',event=>{
 const input=event.target;
 if(!input||input.id!=='qPaket')return;
 S.ui.q=input.value;
 clearTimeout(paketSearchTimer);
 paketSearchTimer=setTimeout(()=>{
   const rows=paketListForView();
   const host=document.getElementById('paketTableResult');
   if(host)host.innerHTML=rows.length?tabelPaket(rows):paketEmptyState();
   const count=document.querySelector('.satria-result-count');
   if(count)count.textContent=`${rows.length} paket`;
 },90);
});
document.addEventListener('change',e=>{
 const t=e.target,d=t.dataset;
 if(t.id==='lapVizYear'){S.ui.lapRekeningTahun=String(t.value||'all');return render()}
 if(t.id==='lapVizMetric'){const key=String(t.value||'hps');S.ui.lapVizMetric=Object.hasOwn(SATRIA_LV_METRICS,key)?key:'hps';return render()}
 if(t.id==='lapAuditJenis'){S.ui.lapAuditJenis=String(t.value||'all');return render()}
 if(t.id==='lapRekeningTahun'){S.ui.lapRekeningTahun=String(t.value||'all');return render()}
 if(t.id==='lapRekeningAkun'){S.ui.lapRekeningAkun=String(t.value||'all');return render()}
 if(t.id==='lapRekeningCari'){S.ui.lapRekeningCari=String(t.value||'');return}
 if(t.matches?.('[data-pbj-start],[data-pbj-basis],[data-hps-doc-field]'))return; // Formulir dokumen mempunyai tombol Simpan sendiri; jangan menggambar ulang dropdown.
 if(t.matches?.('[data-rup-class-kind],[data-rup-class-method]'))return; // Koreksi klasifikasi disimpan hanya melalui tombolnya; jangan hilangkan pilihan yang belum disimpan.
 if(t.matches?.('[data-hps-edit]'))return; // Hanya tombol Simpan Semua Rincian yang menulis data.
 // Review historis ditangani oleh kontrol sendiri, tanpa menggambar ulang semua input.
 if(t.matches?.('[data-hps-review-reason],[data-hps-review-evidence],[data-hps-review-check]'))return;
 if(t.matches?.('[data-provider-correction-target],[data-provider-correction-reason],[data-provider-correction-evidence],[data-provider-correction-confirm]'))return;
 if(t.matches?.('[data-rup-budget-input],[data-rup-split]'))return; // Nilai formulir alokasi baru ditindaklanjuti saat tombol Simpan/Buat ditekan.
 // SMART SURVEY PRO owns these form controls. Do not rerender the entire page on selection change.
 if(t.matches?.('[data-s59-field]')&&t.closest?.('[data-smart-panel]'))return;
 if(t.id==='rupBankOpdFilter'){
   const selected=String(t.value||'all');
   const allowed=new Set(satriaBankAccessibleRows().map(r=>String(r.opd)));
   S.ui.rupBankOpd=selected==='all'||allowed.has(selected)?selected:'all';
   return render();
 }
 if(t.id==='rupBankYearFilter'){
   const selected=String(t.value||'all');
   const allowed=new Set(satriaBankAccessibleRows().map(r=>String(r.tahun)));
   S.ui.rupBankYear=selected==='all'||allowed.has(selected)?selected:'all';
   return render();
 }
 if(t.id==='rupDefOpd'){S.ui.rupDefOpd=t.value;S.ui.rupPrev=null;return}
 if(t.id==='rupDupMode'){S.ui.rupDupMode=t.value==='update'?'update':'skip';S.ui.rupPrev=null;return}
 if(RUP_MANUAL_FIELD_IDS.includes(t.id)){rupManualCapture();return}
 if(t.id==='rupFile'){const f=t.files[0];if(!f)return;if(f.size>5*1024*1024){toast('File maksimal 5 MB.');t.value='';return}const r=new FileReader();r.onload=()=>{try{const str=String(r.result||'').replace(/^\uFEFF/,'');S.ui.rupJson=/\.csv$/i.test(f.name)?JSON.stringify(satriaCSVtoRows(str),null,2):str;S.ui.rupPrev=null;toast('File dimuat. Klik Periksa data untuk memvalidasi sebelum impor.');render()}catch(err){toast('File tidak dapat dibaca: '+err.message)}};r.readAsText(f);return}
 if(t.id==='selEngine'){ENGINE=t.value==='dexie'&&DB?'dexie':'memory';clearTimeout(pTimer);if(ENGINE==='dexie')persistNow();toast(ENGINE==='dexie'?'Penyimpanan: IndexedDB (Dexie)':'Penyimpanan: memori sesi (hilang saat halaman ditutup)');return}
 if(t.id==='selTahun'){
   const scope=activeCloudScope(),year=Number(t.value);
   if(scope&&!scope.years.includes(year)){toast('Tahun tidak termasuk assignment akun Anda.');return render()}
   S.ui.tahun=year;S.ui.rupManualOpd='';resetDetailIfOutsideFilter();return render();
 }
 if(t.id==='selOpd'){
   const scope=activeCloudScope(),value=String(t.value||'');
   if(scope&&value!=='all'&&!scope.opdIds.includes(value)){toast('OPD tidak termasuk assignment akun Anda.');return render()}
   if(scope&&scope.opdIds.length===1)S.ui.opd=scope.opdIds[0];
   else S.ui.opd=value||'all';
   S.ui.rupManualOpd='';
   resetDetailIfOutsideFilter();return render();
 }
 if(t.id==='satriaDppSignerSelect'){
   if(!canWrite()){toast('Akun ini hanya dapat melihat dokumen.');return render()}
   const pack=P(t.dataset.pid),chosen=String(t.value||'');
   if(!pack){toast('Paket tidak ditemukan.');return render()}
   const valid=(S.pejabat||[]).some(x=>String(x.id)===chosen&&String(x.opd)===String(pack.opd)&&x.peran==='PPK'&&x.aktif!==false);
   if(chosen&&!valid){toast('PPK tidak valid atau bukan dari OPD paket.');return render()}
   pack.dppPpkId=chosen;
   sync('paket','PPK penandatangan DPP paket '+(pack.rup||pack.id)+' diperbarui');
   return render();
 }
 if(t.id==='selPaket'){S.ui.dpid=t.value;return render()}
 if(t.id==='selUser'){S.ui.user=t.value;if(!allowed(S.ui.page))S.ui.page='dash';return render()}
 if(!canWrite()&&(d.col||d.up||d.kopup||d.new!==undefined||d.addpw||t.id==='imp'||t.id==='logoFile')){toast('Akun Viewer hanya dapat melihat data');return render()}
 if(window.SATRIA_CLOUD_CONFIGURED&&window.SATRIA_CLOUD_ROLE&&window.SATRIA_CLOUD_ROLE!=='admin'){
   if(['pemda','penomoran'].includes(d.col)||d.col==='opd'||d.col==='kode'||t.id==='logoFile'){
     toast('Pengaturan dan master organisasi hanya dapat diubah admin.');return render();
   }
 }
 if(['pejabat','unit','penyedia','akun'].includes(d.col)&&d.id){
   const current=(S[d.col]||[]).find(x=>String(x.id)===String(d.id));
   if(current){const proposed={...current,[d.f]:t.value};const kind=d.col==='pejabat'?({PPK:'ppk',PP:'pp',Kabid:'kabid'}[current.peran]||'ppk'):d.col;
    const validation=satMasterCheckNew(kind,proposed,d.id);
    if(validation){toast('Perubahan ditolak: '+validation);return render()}
    if(['kode','opd'].includes(d.f)&&d.col==='unit'&&!canDel('unit',d.id)){toast('Unit yang sedang digunakan paket tidak boleh dipindah OPD atau diubah kodenya.');return render()}
    if(d.f==='opd'&&d.col==='pejabat'&&!canDel('pejabat',d.id)){toast('Penugasan OPD pejabat yang digunakan paket tidak boleh diubah.');return render()}
   }
 }
 if(d.col==='users'&&d.f==='role'&&t.value!=='Admin'&&isLastAdmin(d.id)){toast('Harus ada minimal satu Admin aktif');return render()}
 if(t.id==='mSearch'){S.ui.ms=t.value;return render()}
 if(d.new!==undefined)return;
 if(d.kopup){const f=t.files[0];if(!f)return;if(f.size>1024*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)){toast('Kop harus PNG/JPG/WebP/GIF maks. 1 MB.');return render()}const rd=new FileReader();rd.onload=()=>{const o=S.opd.find(x=>x.id===d.kopup);if(o){o.kop=rd.result;sync('settings','Kop '+o.singkat+' diperbarui')}render()};rd.readAsDataURL(f);return}
 if(d.up){const f=t.files[0];if(!f)return;if(f.size>300*1024){toast('Gambar maksimal 300 KB');return render()}const rd=new FileReader();rd.onload=()=>{S.pejabat.find(x=>x.id===d.id)[d.up]=rd.result;sync('master','Gambar '+d.up+' diperbarui');render()};rd.readAsDataURL(f);return}
 if(t.id==='logoFile'){const f=t.files[0];if(!f)return;if(f.size>300*1024||!['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)){toast('Logo harus PNG/JPG/WebP/GIF maks. 300 KB');return render()}const r=new FileReader();r.onload=()=>{S.pemda.logo=r.result;sync('settings','Logo instansi diperbarui');render()};r.readAsDataURL(f);return}
 if(t.id==='imp'){if(window.SATRIA_CLOUD_CONFIGURED&&window.SATRIA_CLOUD_ROLE!=='admin'){t.value='';toast('Impor backup penuh hanya tersedia bagi admin; Operator/Viewer hanya memakai data hasil scope server.');return}const f=t.files[0];if(!f)return;if(f.size>25*1024*1024){toast('File backup terlalu besar (maks. 25 MB).');t.value='';return}const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);validateBackup(o);const arr=v=>Array.isArray(v);if(!confirm('Impor akan MENGGANTI data aktif dengan isi backup ini. Unduh backup kondisi sekarang terlebih dahulu bila belum dilakukan. Lanjutkan impor?')){t.value='';return}const base=JSON.parse(JSON.stringify(SEED));Object.assign(S,base,o,{ui:S.ui,log:[],dirty:true,chat:[],chatCtx:null,sampah:arr(o.sampah)?o.sampah:[]});if(!arr(S.users)||!S.users.length)S.users=[{id:'u1',nama:'Administrator',username:'admin',role:'Admin',opd:'all',aktif:true}];if(!arr(S.unit))S.unit=(S.opd||[]).map(x=>({id:'u'+x.id,opd:x.id,kode:x.unit||'',bidang:x.bidang||''}));if(!arr(S.akun))S.akun=[];if(!S.penomoran||typeof S.penomoran!=='object')S.penomoran=base.penomoran;normalizeData();S.tahun=[...new Set([...S.tahun.map(Number),...S.paket.map(p=>+p.tahun).filter(Number.isFinite)])].filter(Number.isInteger).sort((a,b)=>a-b);if(!S.tahun.length)S.tahun=[new Date().getFullYear()];S.ui.tahun=S.tahun.includes(+S.ui.tahun)?+S.ui.tahun:S.tahun[0];S.ui.opd='all';S.ui.pid=null;S.ui.user=(S.users.find(u=>u.aktif!==false)||S.users[0]).id;sync('settings','Backup JSON dipulihkan');if(window.SATRIA_CLOUD_ROLE==='admin')window.SATRIA_CLOUD_ADMIN_IMPORT_READY=true;toast('Backup berhasil dimuat dan divalidasi. Periksa indikator kelengkapan sebelum mencetak dokumen.');render()}catch(err){console.warn('Backup import ditolak',err);toast('Backup tidak valid atau strukturnya tidak didukung. Data aktif tidak diubah.')}finally{t.value=''}};r.readAsText(f);return}
 if(d.addpw){if(t.value){P(d.addpw).penawaran.push({id:uid('w'),pen:t.value,sumberHarga:satriaOfferSupplierCatalogLink({pen:t.value}),tanggalHarga:'',ongkir:0,catatan:'',harga:{},nego:{}});sync('nego','Penyedia ditambahkan ke survei')}return render()}
 if(d.rp){const n=+String(t.value).replace(/[^0-9]/g,'')||0;
  if(d.col==='item'){const p=P(d.pid),it=p?.items?.find(x=>x.id===d.id);if(!it)return;const items=p.items.map(x=>x.id===it.id?{...x,[d.f]:n}:x);const guard=satriaRupUjiPerubahanRincian(p,items);if(!guard.ok){toast(guard.msg);return render()}it[d.f]=n;sync('items','Harga satuan HPS diperbarui')}
  else if(d.col==='harga'){P(d.pid).penawaran.find(x=>x.id===d.pw).harga[d.id]=n;sync('nego','Harga tayang diperbarui')}
  else if(d.col==='nego'){const w=P(d.pid).penawaran.find(x=>x.id===d.pw);satriaClearStaleNegoDetails(w,d.id,n);if(n)w.nego[d.id]=n;else delete w.nego[d.id];sync('nego','Harga nego diperbarui')}
  return render()}
 if(d.cur){const pg=P(d.id);if(!pg)return;const input=String(t.value||'').replace(/[^0-9]/g,'');const nominal=Number(input);if(!input||!Number.isSafeInteger(nominal)||nominal<=0){toast('Pagu paket harus angka rupiah positif.');return render()}if(!satriaRupSetPaguPaket(pg,nominal))return;return render()}
 if(d.col==='offerMeta'){const p=P(d.pid),w=p&&p.penawaran.find(x=>x.id===d.pw);if(!w)return;if(d.f==='sumberHarga'&&satriaOfferSupplierCatalogLink(w))return render();w[d.f]=d.f==='ongkir'?(+String(t.value).replace(/[^0-9]/g,'')||0):t.value;sync('nego','Metadata sumber penawaran diperbarui');return render()}
 const v=NUMF.includes(d.f)?(+t.value||0):t.value;
 if(d.col==='item'){const p=P(d.pid),it=p?.items?.find(x=>x.id===d.id);if(!it)return;const items=p.items.map(x=>x.id===it.id?{...x,[d.f]:v}:x);const guard=satriaRupUjiPerubahanRincian(p,items);if(!guard.ok){toast(guard.msg);return render()}it[d.f]=v;sync('items','Rincian: '+it.nama)}
 else if(d.col==='harga'||d.col==='nego'){const w=P(d.pid).penawaran.find(x=>x.id===d.pw);if(d.col==='harga')w.harga[d.id]=+t.value||0;else if(t.value===''){satriaClearStaleNegoDetails(w,d.id,0);delete w.nego[d.id]}else {satriaClearStaleNegoDetails(w,d.id,+t.value||0);w.nego[d.id]=+t.value||0;}sync('nego','Harga penawaran')}
 else if(d.col==='paket'){const pg=P(d.id);if(!pg)return;if(d.f==='pagu'){if(!satriaRupSetPaguPaket(pg,Number(v)))return;return render()}if(d.f==='rup'){const val=String(v||'').trim();const primary=(S.rupBank||[]).find(r=>String(r.id)===String(pg.rupBankId||''));if(primary&&val&&val.toLowerCase()!==String(primary.rup).trim().toLowerCase()){toast('Kode RUP utama terhubung ke Bank RUP. Lepas tautan utama dahulu sebelum mengganti kode.');return render()}pg.rup=val}else if(/^(program|kegiatan|subKeg)(Kode|Nama)$/.test(d.f)){pg[d.f]=v;klfCompose(pg)}else{if(d.f==='opd'&&satriaRupLinks(pg).length&&String(v)!==String(pg.opd)){toast('Lepas semua referensi Bank RUP sebelum memindahkan paket ke OPD lain.');return render()}pg[d.f]=v;if(d.f==='sub'){delete pg.subKeg;delete pg.subKegKode;delete pg.subKegNama}}if(d.f==='opd'){S.ui.opd=String(pg.opd);const unit=S.unit.find(u=>String(u.opd)===String(pg.opd));pg.unit=unit?unit.id:'';pg.ppk=pjId(pg.opd,'PPK')||'';pg.pp=pjId(pg.opd,'PP')||'';pg.kabid=pjId(pg.opd,'Kabid')||'';if(!pg.lokasiPengiriman)pg.lokasiPengiriman=O(pg.opd).tempat||O(pg.opd).alamat||''}if(['tglNodis','tglSurvei','tglEvaluasi','tglDpp','tglNego','tglPenetapan','tglBahp','tglSppbj','batas'].includes(d.f)){const dates=['tglNodis','tglSurvei','tglEvaluasi','tglDpp','tglNego','tglPenetapan','tglBahp','tglSppbj'].map(k=>pg[k]).filter(Boolean);if(dates.some((x,i)=>dates.some((y,j)=>i<j&&x>y))){toast('Peringatan: urutan tanggal proses tidak kronologis. Periksa kembali tanggal dokumen.')}}sync(d.f==='pagu'?'pagu':'paket','Data paket: '+d.f)}
 else if(d.col==='pemda'){S.pemda[d.f]=t.value;sync('settings','Identitas pemda')}
 else if(d.col==='penomoran'){S.penomoran[d.f]=t.value;sync('settings','Penomoran '+d.f)}
 else if(d.col){const r=S[d.col].find(x=>x.id===d.id);if(r){r[d.f]=t.value;sync(d.col==='opd'?'settings':'master','Master: '+d.col)}}
 render();
});
window.addEventListener('hashchange',route);window.addEventListener('beforeunload',e=>{if(S.dirty||satriaHpsDraftPending()){e.preventDefault();e.returnValue=''}});
/* ===== PENYIMPANAN: Dexie.js (IndexedDB) atau memori sesi ===== */
let DB=null,ENGINE='memory',pTimer=null,persistRevision=0,lastPersistedRevision=0;
let satriaLocalBaseStamp=null,satriaLocalConflict=false;
function dbInit(){if(typeof Dexie==='undefined')return false;try{DB=new Dexie('satria-framework-db');DB.version(1).stores({kv:'k'});ENGINE='dexie';return true}catch(e){console.warn('Dexie gagal dibuka',e);return false}}
function normalizeData(){S.sampah=Array.isArray(S.sampah)?S.sampah:[];S.rupBank=Array.isArray(S.rupBank)?S.rupBank:[];S.pemda={nama:'',kota:'',provinsi:'',sumber:'',...(S.pemda||{})};S.penomoran={...SEED.penomoran,...(S.penomoran||{})};S.opd=S.opd||[];S.paket=(S.paket||[]).map(p=>({...p,seq:(Number.isInteger(+p.seq)&&+p.seq>0)?+p.seq:0,items:(p.items||[]).map(i=>({spesifikasi:'',merek:'',pdn:'Perlu verifikasi',linkProduk:'',...i})),penawaran:(p.penawaran||[]).map(w=>({sumberHarga:'',tanggalHarga:'',ongkir:0,catatan:'',...w,harga:w.harga||{},nego:w.nego||{}})),jenisPengadaan:p.jenisPengadaan||'',metodePemilihan:p.metodePemilihan||'',lokasiPengiriman:p.lokasiPengiriman||O(p.opd).tempat||O(p.opd).alamat||'',tglSurvei:p.tglSurvei||'',tglEvaluasi:p.tglEvaluasi||'',tglNego:p.tglNego||'',tglPenetapan:p.tglPenetapan||''}));
 const maxSeqByScope=new Map();for(const p of S.paket){const key=String(p.tahun)+'|'+String(p.opd);if(Number.isInteger(+p.seq)&&+p.seq>0)maxSeqByScope.set(key,Math.max(maxSeqByScope.get(key)||0,+p.seq));}
 for(const p of S.paket){if(!p.seq){const key=String(p.tahun)+'|'+String(p.opd);const next=(maxSeqByScope.get(key)||0)+1;p.seq=next;maxSeqByScope.set(key,next)}}
 S.penyedia=(S.penyedia||[]).map(y=>({statusKatalog:'Perlu verifikasi',pdn:'Perlu verifikasi',tipe:'Perlu verifikasi',kbliSesuai:'Perlu verifikasi',daftarHitam:'Perlu verifikasi',...y,aktif:y.aktif!==false}));S.akun=(S.akun||[]).map(x=>({...x,aktif:x.aktif!==false}));S.unit=(S.unit||[]).map(x=>({...x,aktif:x.aktif!==false}));S.pejabat=(S.pejabat||[]).map(x=>({...x,aktif:x.aktif!==false}));S.kode=S.kode||[];S.tahun=[...new Set([...(S.tahun||[]).map(Number),...S.paket.map(p=>+p.tahun).filter(Number.isFinite)])].filter(Number.isInteger).sort((a,b)=>a-b);if(!S.tahun.length)S.tahun=[new Date().getFullYear()];}
const persistable=()=>{const o={...S};['ui','log','dirty','chat','chatCtx'].forEach(k=>delete o[k]);return o};
async function persistNowRaw(){
 if(ENGINE!=='dexie'||!DB||satriaLocalConflict)return false;
 const writingRevision=persistRevision,copy=persistable(),stamp=uid('local');
 try{
  // Dexie rw transaction = compare and swap across every tab sharing this DB.
  // Do not silently replace another tab's committed snapshot.
  await DB.transaction('rw',DB.kv,async()=>{
   const old=await DB.kv.get('main');
   const actual=old?(old.localStamp||'legacy:'+old.at):null;
   if(actual!==satriaLocalBaseStamp)throw new Error('SATRIA_LOCAL_CONFLICT');
   await DB.kv.put({k:'main',v:copy,at:Date.now(),localStamp:stamp});
  });
  satriaLocalBaseStamp=stamp;
  lastPersistedRevision=Math.max(lastPersistedRevision,writingRevision);
  S.persistError='';
  window.SATRIA_NOTIFY_LOCAL_PERSISTED?.(stamp);
  return true;
 }catch(e){
  satriaLocalConflict=String(e?.message||'').includes('SATRIA_LOCAL_CONFLICT');
  S.persistError=satriaLocalConflict?'Tab lain telah menyimpan versi berbeda di browser ini. PENYIMPANAN LOKAL DIHENTIKAN agar perubahan tidak tertimpa. Ekspor backup perubahan Anda sebelum reload; bandingkan dengan data tab lain.':'Data gagal disimpan ke IndexedDB. Jangan tutup halaman; unduh backup JSON dan periksa penyimpanan browser.';
  console.error('Gagal menyimpan ke IndexedDB',e);
  const el=$('#dirty');if(el){el.textContent='⚠ Gagal menyimpan';el.title=S.persistError;el.style.background='#FEE2E2';el.style.color='#991B1B'}
  toast(satriaLocalConflict?'KONFLIK ANTARTAB — backup dahulu!':'GAGAL MENYIMPAN — backup dahulu!');
  return false;
 }
}
function schedulePersist(){if(ENGINE!=='dexie'||!DB||!S?.dirty||persistRevision<=lastPersistedRevision)return;clearTimeout(pTimer);pTimer=setTimeout(()=>{void persistNow()},350)}
async function loadSaved(){try{const r=await DB.kv.get('main');satriaLocalBaseStamp=r?(r.localStamp||'legacy:'+r.at):null;satriaLocalConflict=false;if(r&&r.v&&r.v.paket&&r.v.opd){const ui=S.ui;Object.assign(S,r.v,{ui,log:[],dirty:false,chat:[],chatCtx:null});normalizeData();if(!S.users.some(u=>u.id===ui.user))ui.user=S.users[0].id;if(!S.tahun.includes(ui.tahun))ui.tahun=S.tahun[0]}}catch(e){console.warn('Gagal memuat dari IndexedDB',e)}}
function setEngineSelect(){const s=$('#selEngine');s.innerHTML=(DB?'<option value="dexie">IndexedDB (Dexie)</option>':'')+'<option value="memory">Memori sesi</option>';s.value=ENGINE;if(!DB){s.disabled=true;s.title='Dexie.js tidak termuat, memakai memori sesi'}}
async function boot(){
  init();
  const hasCloudConfig=(()=>{try{const local=JSON.parse(localStorage.getItem('satria-supabase-bridge-config-v1')||'{}');const embedded=window.SATRIA_EMBEDDED_SUPABASE_CONFIG||{};return !!((local.url||embedded.url)&&(local.key||embedded.key)&&(local.org||embedded.org))}catch(_){return !!window.SATRIA_EMBEDDED_SUPABASE_CONFIG?.url}})();
  const dbReady=dbInit();
  if(dbReady&&!hasCloudConfig)await loadSaved();
  if(dbReady&&hasCloudConfig){
    // Only read the local commit marker; do NOT render any cached data before cloud auth/scope.
    try{const r=await DB.kv.get('main');satriaLocalBaseStamp=r?(r.localStamp||'legacy:'+r.at):null}catch(e){console.warn('Marker cache lokal tidak terbaca',e)}
  }
  if(hasCloudConfig){
    // Do not render a cached admin snapshot before the authenticated principal/scope is known.
    const seedOpd = (SEED.opd||[]).map(o=>({...o}));
    const seedTahun = (SEED.tahun||[new Date().getFullYear()]).slice();
    const seedPemda = {...SEED.pemda};
    const seedPenomoran = {...SEED.penomoran};
    S.rupBank=[];S.paket=[];S.opd=seedOpd;S.unit=(SEED.unit||[]).slice();S.pejabat=(SEED.pejabat||[]).slice();S.penyedia=(SEED.penyedia||[]).slice();S.akun=(SEED.akun||[]).slice();S.kode=(SEED.kode||[]).slice();S.tahun=seedTahun;
    S.pemda=seedPemda;S.meta={...SEED.meta};S.penomoran=seedPenomoran;
    S.pemda={nama:'',kota:'',provinsi:'',sumber:''};S.meta={};S.penomoran={};
    S.users=[{id:'cloud-login-required',nama:'Login Supabase diperlukan',username:'',role:'Viewer',opd:'all',aktif:false}];
    S.ui.user=S.users[0].id;S.ui.tahun=S.tahun[0];S.dirty=false;
  }
  setEngineSelect();
  // Rules live inside the lifecycle/automation IIFE and are not visible in this boot scope.
  // The automation module initializes its rules after boot; do not reference `rules` here.
  route();
}
window.addEventListener('DOMContentLoaded',()=>{void boot()},{once:true});

