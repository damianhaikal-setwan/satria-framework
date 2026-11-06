
(function(){
'use strict';
const unique = a => [...new Set(a)];
function inspect(p){
 const issues=[],add=(kind,text,tab='data')=>issues.push({kind,text,tab});
 if(!p)return {issues:[{kind:'paket',text:'Paket tidak ditemukan',tab:'data'}],warningCount:1};
 const opds=new Set((S.opd||[]).map(o=>o.id)), units=new Map((S.unit||[]).map(x=>[x.id,x]));
 const staff=new Map((S.pejabat||[]).map(x=>[x.id,x])),vendors=new Set((S.penyedia||[]).map(x=>x.id));
 if(!opds.has(p.opd))add('Relasi','OPD paket tidak ditemukan pada Data Master');
 if(p.unit&&(!units.has(p.unit)||units.get(p.unit).opd!==p.opd))add('Relasi','Unit paket tidak sesuai atau telah dihapus');
 for(const [key,role] of [['ppk','PPK'],['pp','Pejabat Pengadaan'],['kabid','Kepala Bidang']]){
  if(!p[key])add('Pejabat',role+' belum ditetapkan');
  else if(!staff.has(p[key]))add('Relasi',role+' tidak ada di Data Master');
  else if(staff.get(p[key]).opd&&staff.get(p[key]).opd!==p.opd)add('Relasi',role+' berasal dari OPD yang berbeda');
  else if(staff.get(p[key]).aktif===false)add('Pejabat',role+' berstatus tidak aktif');
 }
 if(!String(p.nama||'').trim())add('Paket','Nama paket masih kosong');
 if(!String(p.rup||'').trim())add('Paket','Kode RUP belum diisi');
 if(!satriaSubKegiatan(p)&&!satriaIsDemoPaket(p))add('Klasifikasi','Subkegiatan belum diisi; lengkapi di Data Paket sebelum mencetak dokumen');
 if(!Number.isFinite(+p.pagu)||+p.pagu<=0)add('Anggaran','Pagu paket belum valid');
 for(const issue of satriaRupLinkValidation(p))add('Relasi',issue);const primary=(S.rupBank||[]).find(r=>String(r.id)===String(p.rupBankId||''));if(primary&&String(primary.rup).toLowerCase()!==String(p.rup||'').toLowerCase())add('Relasi','Kode RUP utama paket tidak sesuai Bank RUP');
 if(!(p.items||[]).length)add('Rincian','Belum ada rincian kebutuhan','rincian');
 const itemIds=new Set();
 for(const [i,x] of (p.items||[]).entries()){
  if(itemIds.has(x.id))add('Duplikasi','ID item rincian '+(i+1)+' sama dengan item lain','rincian');itemIds.add(x.id);
  if(!String(x.nama||'').trim())add('Rincian','Nama barang baris '+(i+1)+' belum diisi','rincian');
  if(!(Number(x.vol)>0)||!Number.isFinite(+x.hs)||+x.hs<0)add('Rincian','Volume/harga pada rincian '+(i+1)+' perlu ditinjau','rincian');
 }
 const pwIds=new Set();
 for(const [i,w] of (p.penawaran||[]).entries()){
  if(pwIds.has(w.id))add('Duplikasi','ID penawaran ke-'+(i+1)+' duplikat','nego');pwIds.add(w.id);
  if(!vendors.has(w.pen))add('Relasi','Penyedia pada penawaran '+(i+1)+' tidak tersedia di Data Master','nego');
  for(const field of ['harga','nego'])for(const [id,value] of Object.entries(w[field]||{})){
   if(!itemIds.has(id))add('Relasi','Harga '+field+' menunjuk rincian barang yang tidak ditemukan','nego');
   if(value!==''&&value!=null&&(!Number.isFinite(+value)||+value<0))add('Harga','Nilai '+field+' tidak valid','nego');
  }
  if(w.ongkir&&+w.ongkir>0)add('Harga','Ongkos kirim pada penawaran '+(i+1)+' perlu direkonsiliasi dengan perhitungan nilai total','nego');
 }
 if(p.pemenangId && !(p.penawaran||[]).some(w=>w.id===p.pemenangId))add('Penetapan','Pemenang merujuk penawaran yang telah dihapus','nego');
 if(hps(p)>+p.pagu)add('Anggaran','HPS melebihi pagu paket','rincian');
 for(const [k,label] of [['tglNego','Negosiasi'],['tglBahp','BAHP'],['tglSppbj','SPPBJ']]){
  if(p[k]&&!/^\d{4}-\d{2}-\d{2}$/.test(String(p[k])))add('Tanggal','Format tanggal '+label+' tidak valid');
 }
 return {issues,warningCount:issues.length};
}
function inspectAll(){const problems=[];for(const p of S.paket||[]){const result=inspect(p);for(const x of result.issues)problems.push({paket:p.id,nama:p.nama,...x})}return {packages:(S.paket||[]).length,issues:problems};}
function openAudit(){
 const p=(typeof filt==='function'?filt():[]).find(x=>x.id===S.ui.dpid)||(typeof filt==='function'?filt():[])[0];
 const r=inspect(p);document.querySelector('#satriaAuditModal')?.remove();
 const modal=document.createElement('div');modal.className='satria-audit-modal';modal.id='satriaAuditModal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Pemeriksaan relasi data');
 const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 modal.innerHTML='<section class="satria-audit-content"><div class="satria-audit-head"><h2>✦ Pemeriksaan relasi paket</h2><button type="button" data-satria-close aria-label="Tutup">×</button></div><p style="font-size:12px;color:#6f7490">'+e(p?.nama||'Paket belum dipilih')+' · Pemeriksaan lokal, bukan pengesahan dokumen atau kepatuhan hukum.</p>'+(r.issues.length?'<p><b>'+r.issues.length+' temuan perlu diperiksa</b></p><ul>'+r.issues.map(x=>'<li><b>'+e(x.kind)+':</b> '+e(x.text)+'</li>').join('')+'</ul>':'<p>Tidak ditemukan masalah referensi data berdasarkan aturan pemeriksaan lokal.</p>')+'<div class="satria-audit-actions"><button class="g" type="button" data-satria-close>Tutup</button><button type="button" data-satria-openpaket>Lihat data paket</button></div></section>';
 modal.addEventListener('click',event=>{if(event.target===modal||event.target.closest('[data-satria-close]'))modal.remove();if(event.target.closest('[data-satria-openpaket]')&&p){modal.remove();S.ui.ptab=r.issues[0]?.tab||'data';location.hash='#paket/'+encodeURIComponent(p.id);render()}});
 document.body.appendChild(modal);modal.querySelector('[data-satria-close]').focus();
}
window.SATRIA_DATA_HEALTH=Object.freeze({inspect,inspectAll,openAudit});
document.addEventListener('click',event=>{if(event.target.closest?.('[data-act="satriaAudit"]')){event.preventDefault();event.stopImmediatePropagation();openAudit()}},true);
// Esc closes the audit dialogue; no persistent data is modified by this audit.
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('#satriaAuditModal')?.remove()});
})();
