
/* Lampiran foto e-Katalog: mengambil sumber data yang telah disimpan di Smart Survey.
   Tidak membuat file upload baru dan tidak memodifikasi harga, negosiasi, pemenang maupun template lain. */
(function(){
  'use strict';
  const esc51 = value => String(value??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money51 = value => 'Rp '+Math.round(Number(value)||0).toLocaleString('id-ID');
  const validImage51 = url => {
    if(typeof url!=='string')return '';
    const v=url.trim();
    if(/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(v))return v;
    if(/^satria-media:\/\/[a-f0-9-]+\/(?:opd|shared)\//i.test(v))return v;
    try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}
  };
  const safeUrl51 = url => {
    try{const u=new URL(String(url||'').trim());return u.protocol==='https:'?u.href:''}catch{return ''}
  };
  const refList51 = p => {
    const rows=[];
    for(const w of p.penawaran||[]){
      for(const it of p.items||[]){
        const ref=w.catalogRefs?.[it.id];
        if(!ref||!ref.imageUrl)continue;
        const src=validImage51(ref.imageUrl);
        if(!src)continue;
        rows.push({
          id:it.id, item:it, provider:PY(w.pen).nama||'Belum dicatat',
          product:String(ref.name||it.nama||'-'), spec:String(ref.spec||''),
          seller:String(ref.seller||PY(w.pen).nama||'-'),
          unit:String(ref.unit||it.satuan||it.sat||'-'),
          beforeTax:ref.beforeTax,tax:ref.taxAmount,
          price:ref.displayPrice||w.harga?.[it.id]||0,
          link:safeUrl51(ref.link),date:ref.date||w.tanggalHarga||'',
          src
        });
      }
    }
    return rows;
  };
  const groups51 = (entries,mode='dpp') => {
    // DPP: maksimal empat referensi per lembar A4. Pengelompokan mempertimbangkan
    // perkiraan panjang teks; entri yang panjang dipindahkan ke lembar berikutnya.
    // RFI dan Survei tetap memakai aturan asli (dua referensi per lembar).
    const pages=[];
    let current=[];
    let estimatedMm=0;
    const dppPageBudgetMm=238; // konservatif: ruang header, footer, catatan dan margin A4
    const extraLines=(text,chars)=>Math.max(0,Math.ceil(String(text||'').length/chars)-1);
    const dppCardMm=item=>{
      const extra=extraLines(item.product,57)*2.7
        +extraLines(item.item?.nama,79)*2.6
        +extraLines(item.spec,125)*2.4
        +extraLines(item.link,93)*2.5;
      return 51+extra;
    };
    for(const item of entries){
      if(mode==='dpp'){
        const cost=dppCardMm(item);
        if(current.length&&(current.length>=4||estimatedMm+cost>dppPageBudgetMm)){
          pages.push(current);current=[];estimatedMm=0;
        }
        current.push(item);estimatedMm+=cost;
        if(current.length>=4){pages.push(current);current=[];estimatedMm=0;}
        continue;
      }
      const long=String(item.spec||'').length>250||String(item.product||'').length>125;
      if(long&&current.length){pages.push(current);current=[];}
      current.push(item);
      if(current.length>=2||long){pages.push(current);current=[];}
    }
    if(current.length)pages.push(current);
    return pages;
  };
  // Perapian SPESIFIKASI khusus lampiran DPP (pemanggil ada pada mode==='dpp').
  // Ini hanya mengubah teks CETAK, tidak menyunting sumber Smart Survey atau referensi katalog.
  const summarizeSpec51=value=>{
    const original=String(value||'').replace(/\s+/g,' ').trim();
    if(!original)return '';
    const capText=(text,max=175)=>{
      const clean=String(text||'').replace(/\s+/g,' ').replace(/^[\s;:,–-]+|[\s;:,–-]+$/g,'').trim();
      if(clean.length<=max)return clean;
      const wordEnd=clean.lastIndexOf(' ',max);
      return clean.slice(0,wordEnd>max*.65?wordEnd:max).trim()+'…';
    };
    // Baca hanya label berstruktur yang BENAR-BENAR tercantum pada teks katalog.
    if(/\bSpesifikasi Produk\b/i.test(original)&&/\b(?:Struktur Harga|Berat per Produk|Dimensi per Produk|Deskripsi Produk)\b/i.test(original)){
      const between=(start,end)=>{
        const rx=new RegExp(start+'\\s*:?\\s*([\\s\\S]*?)(?='+end+'|$)','i');
        const match=original.match(rx);
        return match?match[1].replace(/\s+/g,' ').trim():'';
      };
      const stops='Struktur Harga|Satuan Barang|Berat per Produk|Dimensi per Produk|Informasi Lainnya|Label Produk Ramah Lingkungan Hidup|Lokasi Tempat Usaha|Deskripsi Produk';
      const title=between('Spesifikasi Produk',stops).replace(/^\d{8,12}\s+/,'').trim();
      const description=between('Deskripsi Produk','Informasi Lainnya|Label Produk Ramah Lingkungan Hidup|Lokasi Tempat Usaha');
      const weight=between('Berat per Produk',stops).match(/^([0-9]+(?:[.,][0-9]+)?\s*(?:kg|gr|gram|g))\b/i)?.[1]||'';
      const dimension=between('Dimensi per Produk',stops).replace(/\s*\([0-9., ]+\s*(?:cm3|cm³|m3|m³)\)\s*$/i,'').trim();
      const normalized=[capText(description||title,95)];
      if(weight)normalized.push('Berat '+weight);
      if(dimension)normalized.push('Dimensi '+capText(dimension,65));
      const result=normalized.filter(Boolean).join(' · ');
      if(result)return result;
    }
    // Teks biasa tetap dipertahankan; hanya rapikan spasi dan panjang tampilannya.
    const clean=original.replace(/^\d{8,12}\s+(?=Spesifikasi Produk\b)/i,'').replace(/\b(?:Spesifikasi Produk|Deskripsi Produk)\s*:?\s*/gi,' ').replace(/\s+/g,' ').trim();
    return capText(clean,175)+(clean.length>175?' (rinciannya tersimpan di Smart Survey)':'');
  };
  const tanggalID51=value=>{
    const v=String(value||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    const [y,m,d]=v.split('-').map(Number);
    const date=new Date(Date.UTC(y,m-1,d));
    return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(date):v;
  };
  const card51=(entry,n,mode)=>{
    const isDpp=mode==='dpp';
    const spec=isDpp?summarizeSpec51(entry.spec):entry.spec;
    const data=[
      ['Rincian kebutuhan/HPS',entry.item.nama||'-'],
      ['Nama produk tayang',entry.product],
      ['Penyedia',entry.seller],
      ['Spesifikasi ringkas',spec||''],
      ['Satuan',entry.unit],
      ['Harga tayang/unit',Number(entry.price)>0?money51(entry.price):''],
      ['Harga produk sebelum PPN',entry.beforeTax!==undefined&&entry.beforeTax!==null&&entry.beforeTax!==''?money51(entry.beforeTax):''],
      ['PPN pada tayangan',entry.tax!==undefined&&entry.tax!==null&&entry.tax!==''?money51(entry.tax):''],
      ['Tanggal referensi',tanggalID51(entry.date)],
      ['Link produk',entry.link||'']
    ];
    return `<article class="satria51-photo-card" data-product-item="${esc51(entry.id)}" data-source="smart-survey">
      <div class="satria51-photo-picture"><img class="satria51-product-image" src="${esc51(entry.src)}" alt="Foto produk ${esc51(entry.product)}" loading="eager" decoding="sync" onerror="this.style.display='none';this.parentElement.classList.add('satria353-photo-unavailable')"><span class="satria51-photo-caption">Foto referensi katalog ${n}</span></div>
      <div class="satria51-photo-fields"><div class="satria51-product-title">${n}. ${esc51(entry.product)}</div>${data.filter(([k,v])=>k!=='Nama produk tayang' && (v!=='' || !isDpp)).map(([label,value])=>`<div class="satria51-field"><span class="satria51-label">${esc51(label)}:</span> <span class="${label==='Link produk'?'satria51-source':''}">${esc51(value)}</span></div>`).join('')}</div>
    </article>`;
  };
  const appendix51=(p,mode)=>{
    const all=refList51(p), saved=(p.penawaran||[]).reduce((n,w)=>n+Object.values(w.catalogRefs||{}).filter(ref=>!!ref?.name).length,0);
    if(!all.length){
      return mode==='survei' ? '<p class="satria51-appendix-note"><b>Lampiran foto produk:</b> belum tersedia. Unggah foto pada Smart Survey Harga lalu simpan referensi untuk menampilkannya otomatis di sini.</p>':'';
    }
    const pages=groups51(all,mode);
    const title=mode==='survei'?'LAMPIRAN DOKUMENTASI PRODUK E-KATALOG':mode==='rfi'?'LAMPIRAN FOTO PRODUK PENDUKUNG RFI':'LAMPIRAN REFERENSI FOTO PRODUK';
    const note=mode==='survei'?'Dokumentasi berasal dari Smart Survey Harga dan merupakan bukti referensi; kesesuaian dengan sumber dan spesifikasi harus diverifikasi.':'Foto ditampilkan sebagai lampiran pendukung, bukan pengganti spesifikasi kebutuhan atau bukti evaluasi teknis.';
    return pages.map((page,idx)=>`<section class="satria51-sheet" data-photo-document="${mode}" data-photo-page="${idx+1}">
      <h3 class="satria51-sheet-title">${title}</h3>
      <div class="satria51-sheet-meta"><b>Paket:</b> ${esc51(p.nama||'-')} &nbsp; | &nbsp; <b>RUP:</b> ${esc51(p.rup||'-')} &nbsp; | &nbsp; Lampiran ${idx+1} dari ${pages.length}</div>
      <div class="satria51-photo-grid">${page.map((entry,i)=>card51(entry,pages.slice(0,idx).reduce((n,pg)=>n+pg.length,0)+i+1,mode)).join('')}</div>
      <p class="satria51-appendix-note">${esc51(note)}${mode==='survei'&&saved>all.length?' · Tidak semua referensi mempunyai foto yang tersimpan.':''}</p>
    </section>`).join('');
  };
  // DOCS adalah daftar generator sebenarnya yang digunakan pratinjau dan mesin cetak.
  // `survei` sudah menampung tabel Smart Survey pada tahap ini; gunakan sebagai isi dasar.
  const baseSurvei51 = typeof survei==='function' ? survei : DOCS.survei;
  const baseRfi51=DOCS.rfi;
  const baseDpp51=DOCS.dpp;
  DOCS.survei=p=>baseSurvei51(p)+appendix51(p,'survei');
  DOCS.rfi=p=>baseRfi51(p)+appendix51(p,'rfi');
  DOCS.dpp=p=>baseDpp51(p)+(satriaDppOptions(p).includePhotos?appendix51(p,'dpp'):'');
  window.SATRIA_PHOTO_DOCS=Object.freeze({
    count:p=>refList51(p).length,
    pages:p=>groups51(refList51(p),'dpp').length,
    formats:['survei','rfi','dpp'],
    ready:true
  });
})();
