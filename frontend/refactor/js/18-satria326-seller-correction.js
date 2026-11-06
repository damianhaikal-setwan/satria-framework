
/* 3.0.59.39: Identitas penyedia penawaran dan nama penjual pada referensi katalog adalah data berbeda.
   Rekonsiliasi hanya dilakukan atas konfirmasi bukti per barang; tidak mengubah harga/nego/pemenang. */
(function(){'use strict';
function normalized(s){return String(s||'').toLowerCase().replace(/^(?:cv|pt|ud|toko|firma|koperasi)\.?\s+/i,'').replace(/[^a-z0-9]/g,'');}
function offer(pid,wid){const p=P(pid);return {p,w:p?.penawaran?.find(x=>String(x.id)===String(wid))};}
function correctSeller(pid,wid,iid,proof){
 const {p,w}=offer(pid,wid);
 if(!p||!w)return {ok:false,message:'Paket atau penawaran tidak ditemukan.'};
 if(typeof canWrite==='function'&&!canWrite())return {ok:false,message:'Akun ini tidak memiliki izin mengubah referensi katalog.'};
 const scope=typeof activeCloudScope==='function'?activeCloudScope():null;
 if(scope&&(!scope.opdIds.includes(String(p.opd))||!scope.years.includes(Number(p.tahun))))return {ok:false,message:'Paket berada di luar penugasan akun.'};
 const item=p.items?.find(x=>String(x.id)===String(iid));
 const ref=w.catalogRefs?.[iid];
 if(!item||!ref||!String(ref.seller||'').trim())return {ok:false,message:'Belum ada nama penyedia tayang yang tersimpan pada rincian ini.'};
 const name=String(PY(w.pen)?.nama||'').trim(),old=String(ref.seller||'').trim();
 if(!name||name==='-')return {ok:false,message:'Identitas penyedia penawaran belum valid.'};
 if(old===name)return {ok:false,message:'Nama penyedia tayang sudah sama.'};
 const note=String(proof||'').trim();
 if(note.length<8)return {ok:false,message:'Referensi bukti asli harus diisi minimal 8 karakter.'};
 // If the existing INAPROC catalog path explicitly names the OLD seller, do not relabel it as a new seller.
 const parsed=ref.link&&window.SATRIA_SMART_SURVEY?.parseProductUrl?.(String(ref.link));
 if(parsed&&normalized(parsed.seller)===normalized(old)&&normalized(parsed.seller)!==normalized(name))return {ok:false,message:'Tautan katalog yang tersimpan masih merujuk pada '+old+'. Perbarui referensi produk/link sesuai bukti asli sebelum mengubah nama tayang.'};
 const at=new Date().toISOString(),by=String(cur()?.nama||'-');
 const ok=SATRIA.tx('nego','Koreksi nama penyedia tayang RUP '+String(p.rup||p.id)+': '+old+' → '+name,()=>{
   // Keep catalog product identity, price, tax, photo, negotiation and winning award unchanged.
   ref.seller=name;
   ref.verification='Perlu verifikasi terhadap katalog';
   if(!w.surveyHistory)w.surveyHistory={};
   const history=w.surveyHistory[iid]||(w.surveyHistory[iid]=[]);
   history.push({at,kind:'koreksi-penyedia-tayang',from:old,to:name,source:'Koreksi manual dengan bukti',evidence:note,by,link:String(ref.link||'')});
 });
 if(ok===null)return {ok:false,message:'Perubahan tidak berhasil disimpan.'};
 return {ok:true,message:'Nama penyedia tayang untuk '+String(item.nama||'barang')+' dikoreksi '+old+' → '+name+'. Nilai harga, negosiasi, dan penetapan tidak diubah.'};
}
document.addEventListener('click',ev=>{
 const button=ev.target.closest?.('[data-satria-seller-sync]');if(!button)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const panel=button.closest('[data-smart-panel]');if(!panel)return;
 const {p,w}=offer(panel.dataset.pid,panel.dataset.wid);
 const ref=w?.catalogRefs?.[panel.dataset.iid];
 if(!p||!w||!ref){toast('Referensi katalog belum tersimpan.');return}
 const old=String(ref.seller||''),name=String(PY(w.pen)?.nama||'');
 if(typeof canWrite==='function'&&!canWrite()){toast('Akun Viewer tidak bisa mengoreksi data.');return}
 const source=String(ref.link||'Tidak ada tautan — wajib ada bukti alternatif');
 if(!confirm('KOREKSI NAMA PENYEDIA TAYANG — RUP '+String(p.rup||p.id)+'\n\nDari: '+old+'\nMenjadi: '+name+'\nReferensi katalog: '+source+'\n\nNama tayang merupakan data VERIFIKASI MANUAL. Lanjutkan HANYA jika bukti katalog/transaksi asli memang menunjukkan '+name+'.\n\nHarga, pajak, HPS, hasil negosiasi, dan pemenang tidak akan berubah.'))return;
 const proof=prompt('Masukkan nomor/referensi bukti asli yang menunjukkan nama penyedia tayang benar (minimal 8 karakter). Jangan membuat bukti baru atau mengubah fakta referensi katalog.',String(ref.link||''));
 if(proof===null)return;
 const result=correctSeller(panel.dataset.pid,panel.dataset.wid,panel.dataset.iid,proof);
 toast(result.message);if(result.ok)render();
},true);
window.SATRIA_SELLER_CORRECTION={correctSeller};
})();
