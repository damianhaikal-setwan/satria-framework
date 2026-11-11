/* Selected ideas from the separate ppkerja prototype, rewritten for SATRIA data.
 * Read-only, never adds reviewers, approval states, OAuth, MySQL or new tables.
 */
(function(root,factory){'use strict';const api=factory();if(root)root.SATRIA_PP_KERTAS_KERJA=Object.freeze(api);if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 function assess(p){const items=Array.isArray(p?.items)?p.items:[],offers=Array.isArray(p?.penawaran)?p.penawaran:[],issues=[];
  if(!String(p?.rup||'').trim())issues.push('Kode RUP perlu diverifikasi dengan SiRUP.');
  if(!String(p?.nama||'').trim())issues.push('Nama paket belum lengkap.');
  if(!(Number(p?.pagu)>0))issues.push('Pagu paket belum tercatat.');
  if(!items.length)issues.push('Belum ada rincian kebutuhan dan HPS.');
  for(const item of items){if(!String(item.nama||'').trim()||!(Number(item.vol)>0)||!(Number(item.hs)>0))issues.push('Rincian HPS belum lengkap: '+String(item.nama||'item tanpa nama'));}
  if(!offers.length)issues.push('Belum ada data penawaran/survei penyedia.');
  const route=typeof globalThis.SATRIA_PBJ_POLICY?.route==='function'?globalThis.SATRIA_PBJ_POLICY.route(p):'perlu-konfirmasi';
  if(route==='pengadaan-langsung')issues.push('Periksa penugasan PP, dasar metode dan persyaratan dokumen pemilihan di SPSE resmi.');
  if(route==='katalog')issues.push('Periksa kesesuaian katalog, sumber harga dan syarat pesanan di sistem e-Purchasing resmi.');
  return {route,issues,readyForDraft:items.length>0&&Number(p?.pagu)>0,notice:'Daftar ini adalah pengingat kerja, bukan keputusan kewenangan, legalitas atau persetujuan berjenjang.'};
 }
 function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
 function panel(p){const a=assess(p);return `<details class="pbj-kertas-kerja no-print"><summary>Kertas kerja PP — pemeriksaan praktis dari data paket (${a.issues.length} catatan)</summary><p>${escapeHtml(a.notice)}</p><ul>${a.issues.map(s=>`<li>${escapeHtml(s)}</li>`).join('')||'<li>Isian dasar yang diperiksa aplikasi tersedia; bukti, kewenangan, dan hasil resmi tetap perlu diteliti.</li>'}</ul><p>Adaptasi konsep dari aplikasi ppkerja. Tidak ada workflow persetujuan, database kedua, atau upload otomatis ke SPSE.</p></details>`;}
 return {assess,panel};
});
