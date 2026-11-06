
/* Human First for SPSE and Procurement Documents: derived advice only.
   Existing transactions, docs, permissions, and official decisions remain untouched. */
function satriaHumanSpseAdvice(p){
 const m=p?.spseMonitoring||{};
 const stages=Array.isArray(m.stages)?m.stages:[];
 const overdue=stages.filter(x=>satriaSpseStageAlert(x)==='Terlambat');
 const planned=stages.filter(x=>x.planStart||x.planEnd||x.actual).length;
 const open=Array.isArray(m.issues)?m.issues.filter(x=>x.status!=='Selesai'):[];
 const paid=Array.isArray(m.payments)?m.payments:[];
 const contract=!!String(m.contractNo||'').trim()&&satriaSpseContractValue(m)>0;
 const identity=!!String(m.tenderCode||'').trim()&&!!satriaSpseDate(m.sourceAsOf);
 const asOf=satriaSpseDate(m.sourceAsOf);
 const stale=!asOf||asOf<satriaSpseAgo(30);
 const activeContract=['Berkontrak','Pelaksanaan','Selesai'].includes(m.phase);
 const flags=[
  {label:'Identitas & sumber data',text:identity?'Kode tender dan tanggal verifikasi tercatat':'Lengkapi kode tender dan tanggal pemeriksaan SPSE',tab:'ringkasan'},
  {label:'Jadwal tahapan',text:overdue.length?overdue.length+' tahapan melewati tanggal rencana':planned?planned+' tahapan memiliki tanggal rencana/aktual':'Belum ada tanggal tahapan tercatat',tab:'jadwal'},
  {label:'Kontrak & addendum',text:contract?'Kontrak tercatat; periksa addendum':'Kontrak belum lengkap atau belum pada tahapnya',tab:'kontrak'},
  {label:'Pembayaran',text:paid.length?paid.length+' pembayaran tercatat (status verifikasi dapat berbeda)':'Belum ada pembayaran tercatat; ini bukan bukti keterlambatan',tab:'pembayaran'},
  {label:'Kendala',text:open.length?open.length+' tindak lanjut masih terbuka':'Tidak ada kendala terbuka dalam catatan',tab:'kendala'}
 ];
 let next;
 if(open.some(x=>x.priority==='Tinggi'))next={tab:'kendala',title:'Tindak lanjuti kendala prioritas tinggi',desc:'Periksa kendala, penanggung jawab, dan tenggat. Keputusan tetap di tangan petugas.'};
 else if(overdue.length)next={tab:'jadwal',title:'Periksa tahapan yang terlambat',desc:'Cocokkan jadwal aktual dengan SPSE sebelum memperbarui catatan.'};
 else if(!identity)next={tab:'ringkasan',title:'Lengkapi identitas dan sumber informasi',desc:'Catat nomor tender dan tanggal data terakhir diverifikasi.'};
 else if(!planned)next={tab:'jadwal',title:'Catat jadwal tahapan yang tersedia',desc:'Isi hanya tahapan yang berlaku; jangan mengarang tanggal yang belum diketahui.'};
 else if(activeContract&&!contract)next={tab:'kontrak',title:'Catat nomor dan nilai kontrak',desc:'Gunakan data kontrak resmi, bukan HPS atau pagu RUP sebagai nilai kontrak.'};
 else if(stale)next={tab:'ringkasan',title:'Periksa keterkinian informasi',desc:'Bandingkan catatan dengan SPSE, lalu perbarui tanggal sumber jika sudah diperiksa.'};
 else if(open.length)next={tab:'kendala',title:'Pantau tindak lanjut terbuka',desc:'Periksa tindakan dan tenggat yang masih berjalan.'};
 else next={tab:'ringkasan',title:'Lanjutkan pemantauan berkala',desc:'Catatan sudah tersedia. Periksa perubahan resmi SPSE, kontrak, dan pembayaran sesuai kebutuhan.'};
 return {flags,next,overdue:overdue.length,open:open.length,stale};
}
function satriaHumanSpseDetail(p){
 if(!p||!satriaSpseIs(p))return '';
 const a=satriaHumanSpseAdvice(p),n=a.next;
 return `<section class="satria-human-follow no-print" aria-label="Panduan Monitoring SPSE"><h3>✦ Lanjutkan monitoring paket ini</h3><p>Ringkasan dari data yang sudah tersimpan. Tahapan tidak wajib diisi berurutan, dan catatan ini bukan data SPSE real-time.</p><div class="satria-human-follow-cta"><div><b>${esc(n.title)}</b><p>${esc(n.desc)}</p></div><button type="button" data-human-spse-nav="${esc(n.tab)}">Buka langkah ini →</button></div><div class="satria-human-follow-grid">${a.flags.map(f=>`<div class="satria-human-follow-item"><b>${esc(f.label)}</b><small>${esc(f.text)}</small></div>`).join('')}</div><p class="satria-human-follow-note">Data jadwal, kontrak, dan pembayaran tetap harus diverifikasi dari sumber resmi. Peringatan tidak mengubah jadwal atau status SPSE.</p></section>`;
}
function satriaHumanSpseOverview(L){
 if(!Array.isArray(L)||!L.length)return '';
 const rows=L.map(p=>({p,a:satriaHumanSpseAdvice(p)}));
 const rank=x=>x.a.open?0:x.a.overdue?1:x.a.stale?2:3;
 rows.sort((a,b)=>rank(a)-rank(b));
 const top=rows.slice(0,4);
 return `<section class="satria-human-follow no-print" aria-label="Paket SPSE perlu dipantau"><h3>✦ Paket yang perlu diperhatikan</h3><p>Mulai dari paket yang memiliki kendala, tahapan terlambat, atau data yang perlu diperiksa. Anda tetap bisa membuka paket mana pun dari tabel di bawah.</p><div class="satria-human-spse-list">${top.map(({p,a})=>`<a href="#spse/${encodeURIComponent(p.id)}"><b>${esc(p.nama||p.rup||p.id)}</b><small>RUP ${esc(p.rup)} · ${esc(a.next.title)} →</small></a>`).join('')}</div></section>`;
}
function satriaHumanDocGuide(p,doc,missing){
 if(!p||satriaSpseIs(p))return '';
 const names={dpp:'DPP',spek:'Spesifikasi Teknis',lamp:'Lampiran Referensi Harga',survei:'Survei Harga',bahepe:'BA Evaluasi Penyedia',hpsnego:'HPS & Negosiasi',bahp:'BA Hasil Pemilihan',nodis:'Nota Dinas',idkb:'Identifikasi Kebutuhan',rfi:'Permintaan Informasi',metode:'Penetapan E-Purchasing',sppbj:'Surat Perintah Pengadaan',reviu:'Reviu DPP',kknego:'Kertas Kerja Negosiasi',analisa:'Analisis Kewajaran Harga & Bukti'};
 const count=Array.isArray(missing)?missing.length:0;
 const shortcuts=[['dpp','DPP'],['spek','Spesifikasi'],['lamp','Lampiran Harga'],['survei','Survei Harga'],['bahp','BA Hasil'],['analisa','Analisis Harga']];
 const active=names[doc]||'Dokumen';
 return `<section class="satria-human-follow no-print" aria-label="Panduan Dokumen Pengadaan"><h3>✦ Siapkan dokumen tanpa mencari banyak menu</h3><p>Dokumen aktif: <b>${esc(active)}</b>. Data berasal dari paket yang dipilih, bukan diinput ulang ke generator.</p><div class="satria-human-follow-cta"><div><b>${count?count+' pemeriksaan isian untuk dokumen aktif':'Isian dasar dokumen terdeteksi tersedia'}</b><p>${count?'Perbaiki data sumber di Paket Pengadaan atau Data Master. Periksa daftar kualitas di bagian pratinjau.':'Tetap periksa nomor, bukti, redaksi, dan hasil cetak sebelum pengesahan.'}</p></div>${count?`<button type="button" data-human-nav="paket" data-pid="${esc(p.id)}" data-tab="data">Buka data paket →</button>`:`<button type="button" data-human-doc-preview="1">Periksa pratinjau →</button>`}</div><div class="satria-human-follow-shortcuts">${shortcuts.map(([k,t])=>`<button type="button" class="${doc===k?'':'g'}" data-act="dtype" data-tab="${k}" aria-pressed="${doc===k}">${esc(t)}${doc===k?' ✓':''}</button>`).join('')}</div><p class="satria-human-follow-note">Template lainnya tersedia pada “Semua 15 template” di bawah. Tombol cetak dan seluruh pemeriksaan DPP tetap seperti sebelumnya; indikator ini bukan persetujuan dokumen.</p></section>`;
}

document.addEventListener('click',function(ev){
 const b=ev.target.closest?.('[data-human-doc-preview]');if(!b)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 document.querySelector('#dokLazyContainer')?.scrollIntoView({block:'start',behavior:'smooth'});
},true);
/* Prevent a guidance shortcut from discarding an edited SPSE form. */
document.addEventListener('click',function(ev){
 const b=ev.target.closest?.('[data-human-spse-nav]');if(!b)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const tab=String(b.dataset.humanSpseNav||'');
 if(!['ringkasan','jadwal','kontrak','pembayaran','kendala'].includes(tab))return;
 const p=P(S.ui.pid);
 if(!p||!satriaSpseIs(p)||!satriaSpseRows().some(x=>x.id===p.id)){toast('Paket monitoring tidak tersedia untuk akun ini.');return;}
 if(S.ui.spseTab===tab){document.querySelector('.spse-tabs')?.nextElementSibling?.scrollIntoView({block:'start',behavior:'smooth'});return;}
 const root=document.querySelector('.spse-page');
 if(root){
  const edited=[...root.querySelectorAll('input[data-spse-main],select[data-spse-main],input[data-spse-stage-field],input[data-spse-contract],input[data-spse-add],input[data-spse-payment],input[data-spse-issue],select[data-spse-issue]')].some(el=>{
    if(el.disabled)return false;
    if(el.tagName==='SELECT')return [...el.options].some(o=>o.selected!==o.defaultSelected);
    return el.value!==el.defaultValue;
  });
  if(edited&&!confirm('Ada isian Monitoring SPSE yang belum disimpan. Pindah langkah tanpa menyimpan perubahan tersebut?'))return;
 }
 S.ui.spseTab=tab;render();
 setTimeout(()=>document.querySelector('.spse-tabs')?.nextElementSibling?.scrollIntoView({block:'start',behavior:'smooth'}),60);
},true);

