
(function(){'use strict';
 const TARGETS={idkb:'2 · Identifikasi Kebutuhan',metode:'5 · Formulir Penetapan',sppbj:'6 · Surat Perintah Pengadaan',spek:'7 · Spesifikasi Teknis',dpp:'8 · DPP',reviu:'10 · BA Reviu DPP',bahp:'11 · BAHP'};
 const keys=['capX','capY','capW','capH','ttdX','ttdY','ttdW','ttdH'];
 const ranges={capX:[-5,25],capY:[-3,5],capW:[13,27],capH:[13,20],ttdX:[-5,35],ttdY:[-3,7],ttdW:[27,65],ttdH:[11,20]};
 const presets=window.SATRIA_DPP_SIGN_LAYOUT?.presets||{
 rapat:{capX:2.8,capY:.3,capW:19.5,capH:19,ttdX:11.7,ttdY:1,ttdW:47,ttdH:17.5},
 sedang:{capX:2.8,capY:.3,capW:19.5,capH:19,ttdX:15.2,ttdY:1,ttdW:45.5,ttdH:17.5},
 formal:{capX:2.8,capY:.3,capW:19.5,capH:19,ttdX:18.4,ttdY:1.1,ttdW:43,ttdH:17.3}};
 const labels={capX:'Kiri/kanan stempel',capY:'Atas/bawah stempel',capW:'Lebar stempel',capH:'Tinggi stempel',ttdX:'Kiri/kanan TTD',ttdY:'Atas/bawah TTD',ttdW:'Lebar TTD',ttdH:'Tinggi TTD'};
 const vars={capX:'--satria-dpp-cap-x',capY:'--satria-dpp-cap-y',capW:'--satria-dpp-cap-w',capH:'--satria-dpp-cap-h',ttdX:'--satria-dpp-ttd-x',ttdY:'--satria-dpp-ttd-y',ttdW:'--satria-dpp-ttd-w',ttdH:'--satria-dpp-ttd-h'};
 function h(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
 function bounded(val,k,base){const n=Number(val),[lo,hi]=ranges[k];return Math.round(Math.min(hi,Math.max(lo,Number.isFinite(n)?n:base))*10)/10;}
 function norm(raw,base){const src=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};const fallback=base&&typeof base==='object'?base:{};const mode=['rapat','sedang','formal','manual'].includes(src.mode)?src.mode:(['rapat','sedang','formal','manual'].includes(fallback.mode)?fallback.mode:'sedang');const defaults=presets[mode==='manual'?'sedang':mode];const res={mode};for(const k of keys)res[k]=mode==='manual'?bounded(src[k]??fallback[k],k,presets.sedang[k]):defaults[k];return res;}
 function get(p,doc){if(!TARGETS[doc])return null;const old=p.docPpkSettings?.[doc]||{};const id=String(old.ppkId||(doc==='dpp'||doc==='reviu'?p.dppPpkId||p.ppk:p.ppk)||'');const fallback=(doc==='dpp'||doc==='bahp')?p.dppSignatureLayout:null;return {ppkId:id,showImages:old.showImages!==false,...norm(old,fallback)};}
 function style(c){return keys.map(k=>vars[k]+':'+bounded(c[k],k,presets.sedang[k])+'mm').join(';')+';'}
 function officer(p,c){return (S.pejabat||[]).find(x=>String(x.id)===String(c.ppkId)&&x.peran==='PPK'&&String(x.opd)===String(p.opd))||null;}
 function picture(v,type){const raw=String(v||'').trim();if(!raw)return '';if(!/^https:\/\/[^\s"'<>]+$/i.test(raw)&&!/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw)&&!/^satria-media:\/\/[a-f0-9-]+\/(?:opd|shared)\//i.test(raw))return '';return `<img class="satria914-${type}" src="${h(raw)}" alt="${type==='cap'?'Stempel PPK':'Tanda tangan PPK'}" decoding="async">`;}
 function visual(x,c){const cap=c.showImages?picture(x?.cap,'cap'):'';const ttd=c.showImages?picture(x?.ttd,'ttd'):'';return `<div class="satria914-images${!c.showImages?' satria914-no-images':''}" style="${style(c)}" aria-label="${c.showImages?'Bidang tanda tangan dan stempel PPK':'Bidang tanda tangan kosong; gambar tidak dibubuhkan'}">${cap}${ttd}</div>`;}
 function rewrite(html,p,doc,signer,c){const t=document.createElement('template');t.innerHTML=html;const image=visual(signer,c);const name=h(signer?.nama||'Belum dipilih'),nip=h(signer?.nip||'-');
 if(doc==='dpp'){
  const place=t.content.querySelector('.satria-dpp-ppk-images');if(place)place.outerHTML=image;
 }else if(doc==='bahp'){
  const block=t.content.querySelector('.bahp-signatures > div:first-child');if(block){const old=block.querySelector('.satria-bahp-ppk-images,.satria-bahp-signature-spacer');if(old)old.outerHTML=image;else block.insertAdjacentHTML('beforeend',image);const b=block.querySelector('b u');if(b)b.textContent=signer?.nama||'Belum dipilih';const spans=block.querySelectorAll(':scope > span');if(spans.length)spans[spans.length-1].textContent='NIP. '+(signer?.nip||'-');}
 }else if(doc==='idkb'){
  const cell=t.content.querySelector('table.satria-idkb-sign-table td.satria-idkb-approval-cell[data-satria-idkb-section="approval"]');
  // Metadata PA/KPA/PPK dan Output hanya memuat identitas paket, BUKAN blok pengesahan.
  // Pemilih tanda tangan wajib mengarah ke sel pengesahan paling akhir.
  if(cell)cell.innerHTML=`Ditetapkan oleh,<br>PA/KPA/PPK<br>${h(OP(p).nama)}<div class="idkb-sig-media">${image}</div><div class="idkb-sign-identity"><b><u>${name}</u></b><div>NIP. ${nip}</div></div>`;
  const metadata=t.content.querySelector('table.satria-idkb-info-table[data-satria-idkb-section="metadata"]');
  if(metadata){
    // Pertahankan persis isi metadata asli, tanpa gambar/nama-NIP blok pengesahan.
    const source=document.createElement('template');source.innerHTML=html;
    const untouched=source.content.querySelector('table.satria-idkb-info-table[data-satria-idkb-section="metadata"]');
    if(untouched)metadata.innerHTML=untouched.innerHTML;
  }
 }else if(doc==='metode'){
  const cell=t.content.querySelector('.metode-sign-people > td:first-child');if(cell)cell.innerHTML=`${image}<b><u>${name}</u></b><br>NIP. ${nip}`;
 }else if(doc==='sppbj'){
  const cell=t.content.querySelector('.sppbj-pdf-layout .sppbj-signature-cell');if(cell)cell.innerHTML=`Pejabat Pembuat Komitmen (PPKom)<br>${h(OP(p).nama)}<br>${image}<b><u>${name}</u></b><br>NIP. ${nip}`;
 }else if(doc==='spek'){
  const cell=t.content.querySelector('.spek-sign');if(cell) {const o=OP(p);cell.innerHTML=`${h(satriaDppOfficialPlace(p))}, ${h(tg(p.tglDpp))}<br>Ditetapkan oleh :<br>Pejabat Pembuat Komitmen (PPKom)<br>${h(o.nama)}<br>${image}<b><u>${name}</u></b><br>NIP. ${nip}`;}
 }else if(doc==='reviu'){
  const cell=t.content.querySelector('.rv-signatures > .rv-sign-col:first-child');if(cell){const blank=cell.querySelector('.rv-sign-space');if(blank)blank.outerHTML=image;else cell.insertAdjacentHTML('beforeend',image);const b=cell.querySelector('b u');if(b)b.textContent=signer?.nama||'Belum dipilih';const divs=cell.querySelectorAll(':scope > div');if(divs.length)divs[divs.length-1].textContent='NIP. '+(signer?.nip||'-');}
 }
 return t.innerHTML;}
 function build(p,doc,original){const c=get(p,doc),pej=officer(p,c);if(!pej){return original(p);}const clone={...p,ppk:pej.id};if(doc==='dpp'||doc==='reviu')clone.dppPpkId=pej.id;
 return rewrite(original(clone),p,doc,pej,c);}
 for(const name of Object.keys(TARGETS)){const original=DOCS[name];if(typeof original!=='function')continue;DOCS[name]=function(p){return build(p,name,original);};}
 function panel(p,doc){if(!TARGETS[doc])return '';const c=get(p,doc);const signer=officer(p,c),mayWrite=typeof canWrite==='function'?canWrite():false;const options=(S.pejabat||[]).filter(x=>x.peran==='PPK'&&String(x.opd)===String(p.opd)&&(x.aktif!==false||String(x.id)===c.ppkId));const id=`satria914-${String(p.id).replace(/[^\w-]/g,'')}-${doc}`;
 const range=k=>`<div class="satria914-range"><label for="${id}-${k}">${labels[k]}</label><output data-satria914-val="${k}">${Number(c[k]).toFixed(1)} mm</output><input id="${id}-${k}" data-satria914-range="${k}" type="range" min="${ranges[k][0]}" max="${ranges[k][1]}" step="0.1" value="${c[k]}" ${!mayWrite?'disabled':''}></div>`;
 return `<section class="satria914-panel no-print" data-satria914-panel data-pid="${h(p.id)}" data-doc="${doc}" aria-label="Pengaturan PPK dokumen ${doc}">
 <h3>✍ Penandatangan PPK/PPKom — ${h(TARGETS[doc])}</h3><p>Setelan tersimpan <b>khusus dokumen ini</b> dalam paket aktif. Foto asli tetap dari Data Master / Supabase Storage; menghilangkan gambar tidak menghapus berkas.</p>
 <div class="satria914-main"><div class="satria914-field"><label for="${id}-ppk">Pilih PPK/PPKom dari Data Master</label><select id="${id}-ppk" data-satria914-ppk ${!mayWrite?'disabled':''}><option value="">— pilih PPK —</option>${options.map(x=>`<option value="${h(x.id)}" ${String(x.id)===c.ppkId?'selected':''}>${h(x.nama)} · NIP ${h(x.nip||'-')}${x.aktif===false?' (nonaktif)':''}</option>`).join('')}</select></div><label class="satria914-switch"><input type="checkbox" data-satria914-show ${c.showImages?'checked':''} ${!mayWrite?'disabled':''}><span>Bubuhkan gambar TTD dan stempel pada PDF</span></label></div>
 <div class="satria914-layout"><div class="satria914-field"><label for="${id}-mode">Posisi gambar</label><select id="${id}-mode" data-satria914-mode ${!mayWrite?'disabled':''}><option value="rapat" ${c.mode==='rapat'?'selected':''}>Rapat</option><option value="sedang" ${c.mode==='sedang'?'selected':''}>Sedang (standar)</option><option value="formal" ${c.mode==='formal'?'selected':''}>Formal</option><option value="manual" ${c.mode==='manual'?'selected':''}>Manual</option></select></div><p>${signer?`PPK: ${h(signer.nama)} · ${signer.ttd?'TTD ada':'TTD belum diunggah'} · ${signer.cap?'Cap ada':'Cap belum diunggah'}`:'Pilih PPK dari Data Master sesuai OPD paket.'}</p></div>
 <details data-satria914-details ${c.mode==='manual'?'open':''}><summary style="font-size:12px;cursor:pointer;font-weight:700">Pengaturan manual posisi dan ukuran (mm)</summary><div class="satria914-grid"><div class="satria914-grp"><strong>Stempel</strong>${keys.slice(0,4).map(range).join('')}</div><div class="satria914-grp"><strong>Tanda tangan</strong>${keys.slice(4).map(range).join('')}</div></div></details>
 <div class="satria914-sample"><div class="satria914-demo" style="${style(c)}">${c.showImages?picture(signer?.cap,'cap')+picture(signer?.ttd,'ttd'):''}</div><span class="satria914-sample-text">Pratinjau gambar. Jika pilihan nonaktif, area penandatangan tetap kosong untuk tanda tangan basah. Nama dan NIP tetap dicetak.</span></div>
 <div class="satria914-actions"><button type="button" class="satria914-save" data-satria914-save ${!mayWrite?'disabled':''}>Simpan untuk dokumen ini</button><button type="button" data-satria914-reset ${!mayWrite?'disabled':''}>Mode Sedang</button></div>
 <div class="satria914-live" role="status" data-satria914-status>${p.docPpkSettings?.[doc]?'Pengaturan tersimpan untuk dokumen ini.':'Mode standar aktif. Klik Simpan untuk menyimpan pengaturan.'}</div></section>`;}
 function read(box){const doc=box.dataset.doc,pack=P(box.dataset.pid),fallback=get(pack,doc),mode=box.querySelector('[data-satria914-mode]')?.value||'sedang',v={ppkId:box.querySelector('[data-satria914-ppk]')?.value||'',showImages:!!box.querySelector('[data-satria914-show]')?.checked,mode};for(const k of keys)v[k]=bounded(box.querySelector(`[data-satria914-range="${k}"]`)?.value,k,presets.sedang[k]);return {...v,...norm(v,fallback)};}
 function applyPreset(box,mode){if(!presets[mode])return;for(const k of keys){const el=box.querySelector(`[data-satria914-range="${k}"]`);if(el)el.value=String(presets[mode][k]);}}
 function update(box){const cfg=read(box),p=P(box.dataset.pid),doc=box.dataset.doc,signer=officer(p,cfg),preview=box.querySelector('.satria914-demo');if(preview){preview.innerHTML=cfg.showImages?picture(signer?.cap,'cap')+picture(signer?.ttd,'ttd'):'';preview.setAttribute('style',style(cfg));}
 for(const k of keys){const o=box.querySelector(`[data-satria914-val="${k}"]`);if(o)o.textContent=cfg[k].toFixed(1)+' mm';}
 box.dataset.satria914Pending=JSON.stringify(cfg);
 const target=document.querySelector(`.doc[data-document-type="${doc}"]`);if(target){const clone={...p,docPpkSettings:{...p.docPpkSettings,[doc]:cfg}};target.innerHTML=satriaSafeDocHtml(DOCS[doc](clone));if(typeof window.SATRIA_MEDIA?.hydrate==='function')window.SATRIA_MEDIA.hydrate(target);}
 const status=box.querySelector('[data-satria914-status]');if(status)status.textContent='Pratinjau berubah. Klik Simpan untuk menerapkan pada cetak berikutnya.';}
 document.addEventListener('input',event=>{const el=event.target;if(!el?.matches?.('[data-satria914-range]'))return;const box=el.closest('[data-satria914-panel]');if(!box)return;event.stopImmediatePropagation();const mode=box.querySelector('[data-satria914-mode]');if(mode)mode.value='manual';update(box);},true);
 document.addEventListener('change',event=>{const el=event.target;if(!el?.matches?.('[data-satria914-mode],[data-satria914-ppk],[data-satria914-show],[data-satria914-range]'))return;const box=el.closest('[data-satria914-panel]');if(!box)return;event.stopImmediatePropagation();if(el.matches('[data-satria914-range]')){const selector=box.querySelector('[data-satria914-mode]');if(selector)selector.value='manual';}if(el.matches('[data-satria914-mode]')){applyPreset(box,el.value);if(el.value==='manual')box.querySelector('[data-satria914-details]')?.setAttribute('open','');}update(box);},true);
 document.addEventListener('click',event=>{const el=event.target.closest?.('[data-satria914-save],[data-satria914-reset]');if(!el)return;const box=el.closest('[data-satria914-panel]');if(!box)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(typeof canWrite!=='function'||!canWrite()){const status=box.querySelector('[data-satria914-status]');if(status)status.textContent='Akun ini tidak dapat mengubah paket.';return;}
 const p=P(box.dataset.pid),doc=box.dataset.doc;if(!p||!TARGETS[doc])return;
 if(el.matches('[data-satria914-reset]')){box.querySelector('[data-satria914-mode]').value='sedang';applyPreset(box,'sedang');update(box);return;}
 const c=read(box),signer=officer(p,c);if(!signer){const status=box.querySelector('[data-satria914-status]');if(status)status.textContent='Pilih PPK yang terdaftar pada OPD paket sebelum menyimpan.';return;}
 if(signer.aktif===false&&String(p.docPpkSettings?.[doc]?.ppkId||'')!==String(signer.id)){const status=box.querySelector('[data-satria914-status]');if(status)status.textContent='PPK nonaktif tidak dapat dipilih untuk dokumen baru.';return;}
 p.docPpkSettings=p.docPpkSettings&&typeof p.docPpkSettings==='object'?p.docPpkSettings:{};
 p.docPpkSettings[doc]=c;
 if(doc==='dpp'){p.dppPpkId=c.ppkId;p.dppSignatureLayout={mode:c.mode,...Object.fromEntries(keys.map(k=>[k,c[k]]))};}
 sync('paket','Pengaturan penandatangan '+doc.toUpperCase()+' disimpan untuk RUP '+(p.rup||p.id));render();
 },true);
 window.SATRIA_DOC_PPK={panel,get,visual,norm,picture,targets:TARGETS};
})();
