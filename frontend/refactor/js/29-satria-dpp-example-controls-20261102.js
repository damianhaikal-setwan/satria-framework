
(function(){
 const escD=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function panel(p){
  const f=satriaDppOptions(p),w=typeof canWrite==='function'&&canWrite(),off=w?'':'disabled';
  const options=[['unreviewed','Belum ditetapkan PPK'],['no_specific','Tidak mensyaratkan merek tertentu'],['reference','Merek sebagai referensi'],['specific','Merek/tipe tertentu (wajib justifikasi)']];
  return `<section class="satria-dpp-format-panel no-print" data-dpp-format data-pid="${escD(p.id)}" aria-label="Pengaturan format dan justifikasi DPP">
   <h3>✦ Format DPP sesuai contoh & justifikasi PPK</h3>
   <p class="mut" style="font-size:11px;margin:0">Perubahan hanya berlaku untuk DPP paket ini. Data HPS, nomor dokumen lama, dan foto di Data Master tidak diubah.</p>
   <div class="satria-dpp-format-grid">
    <div><label>Mode tabel spesifikasi</label><select data-dpp-field="tableMode" ${off}><option value="contoh" ${f.tableMode==='contoh'?'selected':''}>Sesuai Contoh (5 kolom)</option><option value="lengkap" ${f.tableMode==='lengkap'?'selected':''}>Rincian Lengkap (6 kolom + total)</option></select></div>
    <div><label>Status penggunaan merek (keputusan PPK)</label><select data-dpp-field="brandPolicy" ${off}>${options.map(([v,l])=>`<option value="${v}" ${f.brandPolicy===v?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="satria-dpp-wide"><label>Alasan/pertimbangan teknis (ditulis PPK)</label><textarea data-dpp-field="brandReason" maxlength="2000" ${off} placeholder="Isikan pertimbangan yang benar-benar didukung kondisi kebutuhan">${escD(f.brandReason)}</textarea></div>
    <div class="satria-dpp-wide"><label>Referensi dokumen/bukti pendukung (bukan mengunggah gambar)</label><input data-dpp-field="brandEvidence" maxlength="500" value="${escD(f.brandEvidence)}" ${off} placeholder="Nomor hasil pemeriksaan, berkas evaluasi, dsb."></div>
    <div class="satria-dpp-wide"><label>Nomor DPP khusus paket (opsional; isi bila nomor otomatis sama pada paket berbagi RUP)</label><input data-dpp-field="docNumber" maxlength="120" value="${escD(f.docNumber)}" ${off} placeholder="Kosong: memakai nomor DPP lama dari penomoran sistem"></div>
    <div class="satria-dpp-wide"><label class="satria-dpp-photo-option"><input type="checkbox" data-dpp-field="includePhotos" ${f.includePhotos?'checked':''} ${off}> Sertakan lampiran foto referensi produk dari Smart Survey</label></div>
   </div>
   <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:11px"><button type="button" data-dpp-save ${off}>Simpan Pengaturan DPP</button><small data-dpp-status class="mut" role="status">Tersimpan per paket melalui mekanisme penyimpanan SATRIA.</small></div>
  </section>`;
 }
 function read(box){const val=k=>box.querySelector(`[data-dpp-field="${k}"]`)?.value||'';
  return {tableMode:val('tableMode'),brandPolicy:val('brandPolicy'),brandReason:val('brandReason').trim(),brandEvidence:val('brandEvidence').trim(),docNumber:val('docNumber').trim(),includePhotos:!!box.querySelector('[data-dpp-field="includePhotos"]')?.checked};}
 document.addEventListener('click',ev=>{
  const btn=ev.target.closest?.('[data-dpp-save]');if(!btn)return;
  const box=btn.closest('[data-dpp-format]');if(!box)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const msg=box.querySelector('[data-dpp-status]'),p=P(box.dataset.pid);
  if(!p||!canWrite()){if(msg)msg.textContent='Tidak memiliki izin perubahan paket.';return;}
  const scope=typeof activeCloudScope==='function'?activeCloudScope():null;
  if(scope&&(!scope.opdIds?.includes(String(p.opd))||!scope.years?.includes(Number(p.tahun)))){if(msg)msg.textContent='Paket di luar OPD/tahun penugasan akun Anda.';return;}
  const f=read(box);
  if(f.brandPolicy==='specific'&&(!f.brandReason||!f.brandEvidence)){if(msg)msg.textContent='Merek tertentu wajib memiliki alasan teknis dan referensi bukti.';return;}
  if(f.docNumber&&(f.docNumber.length>120||/[\r\n<>]/.test(f.docNumber))){if(msg)msg.textContent='Nomor DPP mengandung karakter tidak valid.';return;}
  const dup=(S.paket||[]).some(x=>x!==p&&String(x.opd)===String(p.opd)&&Number(x.tahun)===Number(p.tahun)&&satriaDppNumber(x)===(f.docNumber||nomor('DPP',p)));
  if(dup&&f.docNumber){if(msg)msg.textContent='Nomor DPP khusus paket ini sudah dipakai paket lain dalam OPD/tahun yang sama.';return;}
  p.dppFormat=f;
  sync('paket','Pengaturan format DPP paket '+(p.rup||p.id)+' disimpan');render();
 },true);
 // Jangan biarkan handler change global menggambar ulang sebelum tombol Simpan ditekan.
 document.addEventListener('change',ev=>{if(ev.target.closest?.('[data-dpp-format]'))ev.stopImmediatePropagation();},true);
 window.SATRIA_DPP_FORMAT=Object.freeze({panel,read});
})();
