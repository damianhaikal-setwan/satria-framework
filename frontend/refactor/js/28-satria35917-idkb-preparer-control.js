
(function(){'use strict';
 const old=window.SATRIA_DOC_PPK?.panel;
 if(typeof old!=='function')return;
 const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 window.SATRIA_DOC_PPK.panel=function(p,doc){const core=old(p,doc);if(doc!=='idkb')return core;
   const people=(S.pejabat||[]).filter(x=>String(x.opd)===String(p.opd));
   const pick=String(p.idkbPenyusunId||p.pp||'');const chosen=people.find(x=>String(x.id)===pick);
   const title=String(p.idkbJabatanPenyusun||'');const ro=typeof canWrite==='function'&&!canWrite();
   return core+`<section class="satria914-panel no-print" data-satria917-preparer data-pid="${safe(p.id)}" aria-label="Penyusun dokumen Identifikasi Kebutuhan">
     <h3>✍ Penyusun Formulir Identifikasi Kebutuhan</h3>
     <p>Pedoman memakai <b>dua kolom pengesahan</b>: PPK yang menetapkan dan pejabat yang menyusun. Pilih penyusun dari Data Master. Perubahan ini berlaku <b>hanya untuk Identifikasi Kebutuhan</b>.</p>
     <div class="satria914-main"><div class="satria914-field"><label>Penyusun dari Data Master</label><select data-satria917-person ${ro?'disabled':''}><option value="">— Belum dipilih —</option>${people.map(x=>`<option value="${safe(x.id)}" ${String(x.id)===pick?'selected':''}>${safe(x.nama)} · ${safe(x.peran||'Pejabat')} · NIP ${safe(x.nip||'-')}</option>`).join('')}</select></div><div class="satria914-field"><label>Jabatan penyusun (sesuai surat tugas / Data Master)</label><input data-satria917-role value="${safe(title)}" placeholder="Contoh: Kasubbag Umum dan Aparatur" ${ro?'disabled':''}></div></div>
     <div class="satria914-actions"><button type="button" data-satria917-save class="satria914-save" ${ro?'disabled':''}>Simpan Penyusun Dokumen</button></div>
     <div role="status" data-satria917-status class="satria914-live">${p.idkbPenyusunId?'Penyusun tersimpan khusus dokumen ini.':'Awal menggunakan Pejabat Pengadaan paket; pastikan orang yang benar sebelum pengesahan.'}</div>
   </section>`;};
 document.addEventListener('click',event=>{const b=event.target.closest?.('[data-satria917-save]');if(!b)return;
  const panel=b.closest('[data-satria917-preparer]');if(!panel)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const p=typeof P==='function'?P(panel.dataset.pid):null;const status=panel.querySelector('[data-satria917-status]');
  if(!p||typeof canWrite!=='function'||!canWrite()){if(status)status.textContent='Akun tidak dapat menyimpan perubahan.';return;}
  const id=panel.querySelector('[data-satria917-person]')?.value||'';
  const person=(S.pejabat||[]).find(x=>String(x.id)===id&&String(x.opd)===String(p.opd));
  if(!person){if(status)status.textContent='Pilih pejabat penyusun yang terdaftar pada OPD paket.';return;}
  p.idkbPenyusunId=id;p.idkbJabatanPenyusun=String(panel.querySelector('[data-satria917-role]')?.value||'').trim().slice(0,180);
  sync('paket','Penyusun Identifikasi Kebutuhan disimpan untuk RUP '+(p.rup||p.id));render();
 },true);
})();
