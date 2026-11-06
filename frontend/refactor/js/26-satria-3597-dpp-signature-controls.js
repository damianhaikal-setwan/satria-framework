
/* SATRIA NEXT 3.0.59.7 — DPP-only layout presets + manual overrides, stored per package.
   Writes only paket.dppSignatureLayout; never mutates signed image bytes, other documents,
   negotiation, Smart Survey, or pemenang. */
(function(){'use strict';
 const keys=['capX','capY','capW','capH','ttdX','ttdY','ttdW','ttdH'];
 const limits={
  capX:[-5,25],capY:[-3,5],capW:[13,27],capH:[13,20],
  ttdX:[-5,35],ttdY:[-3,7],ttdW:[27,65],ttdH:[11,20]
 };
 const presets={
  rapat:{capX:2.8,capY:.3,capW:19.5,capH:19,ttdX:11.7,ttdY:1,ttdW:47,ttdH:17.5},
  sedang:{capX:2.8,capY:.3,capW:19.5,capH:19,ttdX:15.2,ttdY:1,ttdW:45.5,ttdH:17.5},
  formal:{capX:2.8,capY:.3,capW:19.5,capH:19,ttdX:18.4,ttdY:1.1,ttdW:43,ttdH:17.3}
 };
 const props={capX:'--satria-dpp-cap-x',capY:'--satria-dpp-cap-y',capW:'--satria-dpp-cap-w',capH:'--satria-dpp-cap-h',ttdX:'--satria-dpp-ttd-x',ttdY:'--satria-dpp-ttd-y',ttdW:'--satria-dpp-ttd-w',ttdH:'--satria-dpp-ttd-h'};
 const labels={capX:'Geser kiri / kanan',capY:'Geser atas / bawah',capW:'Lebar stempel',capH:'Tinggi stempel',ttdX:'Geser kiri / kanan',ttdY:'Geser atas / bawah',ttdW:'Lebar tanda tangan',ttdH:'Tinggi tanda tangan'};
 const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clamp=(v,k,fallback)=>{const n=Number(v),[a,b]=limits[k];return Math.round(Math.min(b,Math.max(a,Number.isFinite(n)?n:fallback))*10)/10;};
 function clean(raw){const valid=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};const mode=['rapat','sedang','formal','manual'].includes(valid.mode)?valid.mode:'sedang';const defaults=presets[mode==='manual'?'sedang':mode];const result={mode};for(const k of keys)result[k]=mode==='manual'?clamp(valid[k],k,presets.sedang[k]):defaults[k];return result;}
 function styleValue(v){return keys.map(k=>props[k]+':'+clamp(v[k],k,presets.sedang[k])+'mm').join(';')+';';}
 function inlineStyle(p){return styleValue(clean(p?.dppSignatureLayout));}
 function readValues(panel){const result={mode:panel.querySelector('[data-satria597-preset]')?.value||'sedang'};for(const k of keys)result[k]=clamp(panel.querySelector('[data-satria597-field="'+k+'"]')?.value,k,presets.sedang[k]);return result;}
 function apply(panel,value){const v=clean(value);const select=panel.querySelector('[data-satria597-preset]');if(select)select.value=v.mode;
  for(const k of keys){const input=panel.querySelector('[data-satria597-field="'+k+'"]');if(input)input.value=String(v[k]);const output=panel.querySelector('[data-satria597-value="'+k+'"]');if(output)output.textContent=v[k].toFixed(1)+' mm';}
  const doc=panel.closest('.dok-preview-section')||panel.parentElement;
  const imageRegion=doc?.querySelector('.doc[data-document-type="dpp"] .satria-dpp-ppk-images')||document.querySelector('.doc[data-document-type="dpp"] .satria-dpp-ppk-images');
  if(imageRegion)for(const k of keys)imageRegion.style.setProperty(props[k],v[k]+'mm');
  panel.dataset.satria597Pending=JSON.stringify(v);
  const status=panel.querySelector('[data-satria597-status]');if(status)status.textContent='Pratinjau diperbarui. Klik Simpan Tata Letak untuk menyimpan ke paket DPP.';
 }
 function panel(p){const v=clean(p.dppSignatureLayout);const disabled=typeof canWrite==='function'&&!canWrite();const slider=(k)=>`<div class="satria597-row"><label for="satria597-${esc(p.id)}-${k}">${labels[k]}</label><output data-satria597-value="${k}">${v[k].toFixed(1)} mm</output><input id="satria597-${esc(p.id)}-${k}" data-satria597-field="${k}" type="range" min="${limits[k][0]}" max="${limits[k][1]}" step="0.1" value="${v[k]}" ${disabled?'disabled':''}></div>`;
 return `<section class="satria597-panel no-print" data-satria597-panel data-pid="${esc(p.id)}" aria-label="Pengaturan manual tanda tangan dan stempel DPP">
  <div class="satria597-panel-head"><div><b>✍ Atur Posisi TTD & Stempel DPP</b><p>Standar: Mode Sedang. Sesuaikan sendiri tanpa mengubah gambar asli di Data Master.</p></div></div>
  <div class="satria597-preset-row"><label for="satria597Mode">Tata letak</label><select id="satria597Mode" data-satria597-preset ${disabled?'disabled':''}><option value="rapat" ${v.mode==='rapat'?'selected':''}>Rapat</option><option value="sedang" ${v.mode==='sedang'?'selected':''}>Sedang (standar)</option><option value="formal" ${v.mode==='formal'?'selected':''}>Formal</option><option value="manual" ${v.mode==='manual'?'selected':''}>Manual (sesuaikan sendiri)</option></select></div>
  <details class="satria597-details" ${v.mode==='manual'?'open':''}><summary>Pengaturan manual: posisi dan ukuran gambar</summary><div class="satria597-slidergrid"><div class="satria597-group"><b>Stempel / cap PPK</b>${keys.filter(k=>k.startsWith('cap')).map(slider).join('')}</div><div class="satria597-group"><b>Tanda tangan PPK</b>${keys.filter(k=>k.startsWith('ttd')).map(slider).join('')}</div></div><p class="satria597-help">Geser sambil melihat pratinjau DPP. Nilai dalam mm untuk A4 skala 100%. PNG dengan ruang transparan lebar mungkin memerlukan pergeseran tambahan.</p></details>
  <div class="satria597-actions"><button type="button" class="satria597-primary" data-satria597-action="save" ${disabled?'disabled':''}>Simpan Tata Letak</button><button type="button" data-satria597-action="reset" ${disabled?'disabled':''}>Kembalikan Mode Sedang</button></div>
  <div class="satria597-status" data-satria597-status role="status" aria-live="polite">${p.dppSignatureLayout?'Menggunakan tata letak yang tersimpan di paket ini.':'Mode Sedang aktif sebagai standar. Klik Simpan agar preferensi tercatat di paket.'}</div>
 </section>`;
 }
 function findPack(panel){const id=panel.dataset.pid;return typeof P==='function'?P(id):null;}
 document.addEventListener('input',ev=>{const t=ev.target;if(!t?.matches?.('[data-satria597-field]'))return;const panel=t.closest('[data-satria597-panel]');if(!panel)return;ev.stopImmediatePropagation();ev.stopPropagation();const preset=panel.querySelector('[data-satria597-preset]');if(preset)preset.value='manual';apply(panel,readValues(panel));},true);
 document.addEventListener('change',ev=>{const t=ev.target;if(!t?.matches?.('[data-satria597-preset],[data-satria597-field]'))return;const panel=t.closest('[data-satria597-panel]');if(!panel)return;ev.stopImmediatePropagation();ev.stopPropagation();if(t.matches('[data-satria597-preset]')){const mode=t.value;if(mode==='manual'){const current=readValues(panel);apply(panel,{...current,mode:'manual'});panel.querySelector('.satria597-details')?.setAttribute('open','');}else apply(panel,{...presets[mode],mode});}else apply(panel,{...readValues(panel),mode:'manual'});},true);
 document.addEventListener('click',ev=>{const btn=ev.target.closest?.('[data-satria597-action]');if(!btn)return;const panel=btn.closest('[data-satria597-panel]');if(!panel)return;ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();if(typeof canWrite==='function'&&!canWrite()){const status=panel.querySelector('[data-satria597-status]');if(status)status.textContent='Akun ini tidak memiliki izin mengubah paket.';return;}
  const p=findPack(panel);if(!p){const status=panel.querySelector('[data-satria597-status]');if(status)status.textContent='Paket tidak ditemukan. Muat ulang dokumen.';return;}
  const value=btn.dataset.satria597Action==='reset'?{mode:'sedang',...presets.sedang}:readValues(panel);
  p.dppSignatureLayout=clean(value);
  apply(panel,p.dppSignatureLayout);
  sync('paket','Tata letak TTD dan stempel DPP disimpan untuk paket '+(p.rup||p.id));
  render();
 },true);
 window.SATRIA_DPP_SIGN_LAYOUT={panel,inlineStyle,clean,presets,limits};
})();
