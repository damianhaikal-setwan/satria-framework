/* SATRIA HPS document export — one package as the source of truth.
 * Draft only. Never mutates HPS items or re-computes/changes award values.
 * No network, third-party libraries or second database.
 */
(function(root){'use strict';if(!root)return;
 const drafts=new Map();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const num=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
 const rup=v=>'Rp '+Math.round(num(v)).toLocaleString('id-ID');
 const safeDate=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return false;const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;};
 const fields=['tanggal','tempat','mode','tarif','pptkNama','pptkJabatan','pptkNip','ppkNama','ppkJabatan','ppkNip'];
 function mayEditHps(p){if(typeof canWrite!=='function'||!canWrite())return false;
  const scope=typeof activeCloudScope==='function'?activeCloudScope():null;
  return !scope||(Array.isArray(scope.opdIds)&&scope.opdIds.includes(String(p.opd))&&Array.isArray(scope.years)&&scope.years.includes(Number(p.tahun)));
 }
 function defaults(p){const opd=typeof O==='function'?O(p.opd):null;
  return {tanggal:String(p.tglDpp||''),tempat:String(opd?.tempat||''),mode:'included',tarif:'',pptkNama:'',pptkJabatan:'Pejabat Pelaksana Teknis Kegiatan',pptkNip:'',ppkNama:'',ppkJabatan:'Pejabat Pembuat Komitmen',ppkNip:'',...(p.hpsDokumen||{})};
 }
 function settings(p){return drafts.get(String(p.id))||defaults(p)}
 function evaluate(p,setting=settings(p)){
  const s={...defaults(p),...setting},errors=[],warnings=[];let taxRate=0;
  if(s.tarif!==''&&s.tarif!==null&&s.tarif!==undefined){taxRate=Number(s.tarif);if(!Number.isFinite(taxRate)||taxRate<0||taxRate>100)errors.push('Tarif pajak harus 0–100% atau dikosongkan.');}
  if(!['included','excluded'].includes(s.mode))errors.push('Pilih dasar penghitungan pajak yang benar.');
  if(s.tanggal&&!safeDate(s.tanggal))errors.push('Tanggal penyusunan tidak valid.');
  const computed=root.SATRIA_PROCUREMENT_CORE.documentHps(p,{mode:s.mode,rate:taxRate});
  const {rows,before,tax,total}=computed;
  rows.forEach((item,j)=>{
   if(!(item.qty>0)||!(item.price>=0)||!Number.isSafeInteger(item.base)||item.price===0)
    errors.push('Rincian '+(j+1)+' belum memiliki volume/harga HPS yang valid.');
  });
  if(!rows.length)errors.push('Rincian HPS paket belum tersedia.');
  if(total>Number(p.pagu||0)&&Number(p.pagu)>0)warnings.push('Total perhitungan melebihi pagu paket: periksa rincian sebelum diterbitkan.');
  if(s.mode==='excluded')warnings.push('Mode harga sebelum pajak menghasilkan total berbeda dari penjumlahan harga HPS tersimpan. Konfirmasi bahwa harga sumber memang belum termasuk pajak; SATRIA tidak mengubah HPS paket.');
  if(s.tarif==='')warnings.push('Tarif pajak belum diisi; SATRIA tidak menebak tarif atau nilai pajak.');
  if(!s.tanggal||!s.tempat||!s.pptkNama||!s.ppkNama)warnings.push('Tempat, tanggal, dan identitas penyusun/penetap perlu dilengkapi sebelum dokumen digunakan.');
  // Tautan Bank RUP bermasalah hanya memunculkan peringatan; tidak menambah gate/persetujuan.
  if(typeof S!=='undefined'&&Array.isArray(S.rupBank))
   warnings.push(...root.SATRIA_PROCUREMENT_CORE.rupLinkStatus(p,S.rupBank).issues);
  return {s,rows,before,tax,total,errors,warnings,rate:taxRate};
 }
 function panel(p){if(!p)return '';const s=settings(p),m=evaluate(p,s),w=mayEditHps(p);
  const field=(name,label,type='text',placeholder='')=>`<label>${label}<input data-hps-doc-field="${name}" type="${type}" ${name==='tarif'?'min="0" max="100" step="0.01"':'maxlength="250"'} value="${esc(s[name]??'')}" placeholder="${esc(placeholder)}" ${w?'':'disabled'}></label>`;
  return `<section class="card no-print satria-hps-generator" data-hps-doc-panel="${esc(p.id)}" aria-label="Generator HPS berbasis paket">
   <h3>📋 Generator Rincian HPS — Excel / PDF</h3><p>Meniru struktur contoh e-Purchasing yang Anda lampirkan: kop instansi, rincian, volume, harga, pajak, total, keterangan, tanggal dan penandatangan. Seluruh barang dan HPS/unit diambil dari paket aktif, tanpa input ulang.</p>
   <details data-hps-doc-details><summary>Pengaturan dokumen HPS (buka bila ingin mencetak)</summary>
     <div class="hps-gen-grid">
       ${field('tempat','Tempat penyusunan','text','Nama kota/kabupaten')}${field('tanggal','Tanggal HPS','date')}
       <label>Perlakuan harga HPS<select data-hps-doc-field="mode" ${w?'':'disabled'}><option value="included" ${s.mode==='included'?'selected':''}>Harga satuan sudah termasuk pajak (default aman)</option><option value="excluded" ${s.mode==='excluded'?'selected':''}>Harga satuan sebelum pajak (tambahkan pajak)</option></select></label>
       ${field('tarif','Tarif pajak (%) — diisi jika diketahui','number','Kosong = tidak dihitung')}
       ${field('pptkNama','Nama penyusun / PPTK','text','Sesuai dokumen asli')}${field('ppkNama','Nama penetap / PPK','text','Sesuai dokumen asli')}
       ${field('pptkJabatan','Jabatan penyusun')}${field('ppkJabatan','Jabatan penetap')}
       ${field('pptkNip','NIP penyusun (opsional)')}${field('ppkNip','NIP penetap (opsional)')}
     </div>
     ${w?`<button type="button" class="g" data-hps-doc-save="${esc(p.id)}">Simpan pengaturan dokumen</button>`:'<p class="pbj-note">Akun ini memiliki akses baca saja; ekspor draf masih tersedia.</p>'}
   </details>
   <div class="hps-gen-summary" aria-live="polite"><span>Jumlah rincian: <b>${m.rows.length}</b></span><span>Subtotal harga: <b>${rup(m.before)}</b></span><span>Pajak tercantum: <b>${rup(m.tax)}</b></span><span>Total dokumen: <b>${rup(m.total)}</b></span></div>
   <p class="pbj-note hps-gen-mode">${s.mode==='included'?'Harga dari SATRIA dianggap sudah mencakup pajak; pajak hanya ditampilkan sebagai komponen di dalam total bila tarif diketahui.':'Pajak ditambahkan pada harga SATRIA; periksa kesesuaian angka total dengan HPS paket sebelum digunakan.'}</p>
   <div class="hps-gen-alert" role="status">${m.errors.map(x=>'<p class="hps-gen-error">⚠ '+esc(x)+'</p>').join('')}${m.warnings.map(x=>'<p>ℹ '+esc(x)+'</p>').join('')}</div>
   <div class="pbj-actions"><button type="button" class="g" data-hps-doc-print="${esc(p.id)}" ${m.errors.length?'disabled':''}>Cetak / Simpan PDF A4 Landscape</button><button type="button" class="g" data-hps-doc-xlsx="${esc(p.id)}" ${m.errors.length?'disabled':''}>Unduh Excel (.xlsx)</button></div>
   <p class="pbj-note">Keluaran berstatus DRAF; pastikan tarif pajak, data penandatangan, bukti harga, dan aturan HPS sesuai metode pengadaan. Ekspor tidak mengubah rincian HPS dan tidak menambah persetujuan berjenjang.</p>
   </section>`;
 }
 function documentHtml(p,m){const s=m.s,opd=typeof O==='function'?O(p.opd):null;
  const kop=String(opd?.kop||'').match(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i)?`<img alt="Kop OPD" src="${opd.kop}" style="width:100%;max-height:110px;object-fit:contain;object-position:left">`:`<div class="kop"><b>${esc((typeof S!=='undefined'?S.pemda?.nama:null)||'PEMERINTAH DAERAH — LENGKAPI IDENTITAS')}</b><br><b>${esc(opd?.nama||'OPD — BELUM DITENTUKAN')}</b></div>`;
  const rows=m.rows.map(i=>`<tr><td>${i.no}</td><td>${esc(i.name)}${i.spec?`<div class="spec">Spesifikasi: ${esc(i.spec)}</div>`:''}</td><td>${esc(i.unit)}</td><td class="n">${esc(i.qty)}</td><td class="n">${rup(i.price)}</td><td class="n">${rup(i.tax)}</td><td class="n">${rup(i.total)}</td><td>${esc(i.notes)}</td></tr>`).join('');
  const note=m.warnings.map(x=>'<p class="caution">'+esc(x)+'</p>').join('');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>DRAF HPS ${esc(p.rup||p.id)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:10pt/1.4 Arial,sans-serif;color:#16191f}.draft{border:1px solid #888;padding:7px;font-weight:bold;margin:12px 0}.kop{text-align:center;border-bottom:2px solid #111;padding:15px}h1{text-align:center;font-size:15pt;margin:20px 0 5px}.meta{text-align:center;margin:0 0 15px}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #777;padding:6px;vertical-align:top;overflow-wrap:anywhere}th{background:#f0f0f0}.n{text-align:right}.spec{margin-top:4px;font-size:9pt}td:first-child,th:first-child{width:4%}th:nth-child(2){width:29%}th:nth-child(3){width:8%}th:nth-child(4){width:6%}th:nth-child(5),th:nth-child(6),th:nth-child(7){width:12%}th:nth-child(8){width:17%}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:14px;text-align:center}.signatures div{min-height:120px}.name{margin-top:52px;text-decoration:underline;font-weight:bold}.caution{font-size:9pt;color:#604000}@media print{.caution{color:black}}</style></head><body>${kop}<h1>RINCIAN HARGA PERKIRAAN SENDIRI (HPS)</h1><p class="meta">Paket ${esc(p.nama||'')} — RUP ${esc(p.rup||'belum diisi')} — TA ${esc(p.tahun||'')}</p><div class="draft">DRAF SATRIA — PERIKSA ANGKA, PAJAK, BUKTI DAN PENANDATANGAN SEBELUM DIGUNAKAN</div><table><thead><tr><th>No</th><th>Jenis Barang/Jasa & Spesifikasi</th><th>Satuan</th><th>Vol</th><th>Harga satuan</th><th>Pajak (Rp)</th><th>Total (Rp)</th><th>Keterangan</th></tr></thead><tbody>${rows}<tr><th colspan="6">TOTAL HPS DOKUMEN</th><th class="n">${rup(m.total)}</th><th></th></tr></tbody></table><p><b>Dasar penghitungan:</b> ${s.mode==='included'?'Harga satuan sudah termasuk pajak.':'Harga satuan sebelum pajak.'} Tarif tercatat ${s.tarif===''?'belum diketahui':esc(s.tarif)+'%'}.</p>${note}<p style="text-align:right">${esc(s.tempat||'[Tempat belum diisi]')}, ${esc(s.tanggal||'[Tanggal belum diisi]')}</p><div class="signatures"><div><b>Disusun oleh:</b><br>${esc(s.pptkJabatan)}<p class="name">${esc(s.pptkNama||'[Nama belum diisi]')}</p><span>${esc(s.pptkNip||'')}</span></div><div><b>Ditetapkan oleh:</b><br>${esc(s.ppkJabatan)}<p class="name">${esc(s.ppkNama||'[Nama belum diisi]')}</p><span>${esc(s.ppkNip||'')}</span></div></div></body></html>`;
 }
 function print(p){const m=evaluate(p);if(m.errors.length)throw Error(m.errors.join(' '));const win=root.open('','_blank');if(!win)throw Error('Izinkan pop-up untuk mencetak.');win.document.open();win.document.write(documentHtml(p,m));win.document.close();win.focus();win.print();return m;}
 function excelRows(p,m){const s=m.s,lines=[];const row=(...cells)=>lines.push(cells);
  row('RINCIAN HARGA PERKIRAAN SENDIRI (HPS)');row('DRAF SATRIA — PERIKSA SEBELUM DIGUNAKAN');row('Paket',p.nama||'');row('RUP',String(p.rup||''),'TA',Number(p.tahun)||'');row('OPD',typeof O==='function'?O(p.opd)?.nama||'':'');row('Mode harga',s.mode==='included'?'Sudah termasuk pajak':'Sebelum pajak','Tarif pajak (%)',m.rate);
  row('Penyusunan',`${s.tempat||'[TEMPAT]'}, ${s.tanggal||'[TANGGAL]'}`);row('Penyusun',s.pptkNama||'','Penetap',s.ppkNama||'');row();
  row('No','Jenis Barang/Jasa & Spesifikasi','Satuan','Vol','Harga satuan','Pajak (Rp)','Total (Rp)','Keterangan');
  m.rows.forEach(i=>row(i.no,`${i.name}${i.spec?'\nSpesifikasi: '+i.spec:''}`,i.unit,i.qty,i.price,i.tax,i.total,i.notes));
  row('','','','','','TOTAL HPS',m.total);row('Catatan','Total HPS dokumen dihitung dari rincian paket; pastikan pagu, perlakuan pajak, dan dokumen sumber benar.');
  return lines;
 }
 // Small OOXML XLSX serializer (STORE ZIP). No CDN; escaped inline strings; live formulas with cached results.
 const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&apos;'}[c]));
 function column(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
 function xlsxParts(p,m){const lines=excelRows(p,m),end=10+m.rows.length,formulaMode=m.s.mode==='excluded';
  let sheetRows='';for(let ri=0;ri<lines.length;ri++){const n=ri+1,cells=lines[ri],values=[];
   for(let ci=0;ci<cells.length;ci++){let v=cells[ci];if(v===undefined||v===null||v==='')continue;const ref=column(ci)+n,style=ri===0?3:ri===9?2:ri===end?2:ri>=10&&ci>=3&&ci<=6?1:0;
    if(typeof v==='number'){
      let f='';if(ri>=10&&ri<end&&ci===5){f=formulaMode?`ROUND(D${n}*E${n}*$D$6/100,0)`:`IF($D$6>0,ROUND(D${n}*E${n}*$D$6/(100+$D$6),0),0)`;}
      if(ri>=10&&ri<end&&ci===6){f=formulaMode?`D${n}*E${n}+F${n}`:`D${n}*E${n}`;}
      if(ri===end&&ci===6){f=`SUM(G11:G${end})`;}
      values.push(`<c r="${ref}" s="${style}">${f?`<f>${f}</f>`:''}<v>${v}</v></c>`);
    }else values.push(`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`);
   }
   sheetRows+=`<row r="${n}"${ri===0?' ht="34" customHeight="1"':''}>${values.join('')}</row>`;
  }
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="52" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="9" customWidth="1"/><col min="5" max="7" width="19" customWidth="1"/><col min="8" max="8" width="36" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><mergeCells count="2"><mergeCell ref="A1:H1"/><mergeCell ref="A2:H2"/></mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1"/></worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9EEF8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="HPS" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>`;
  return {'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
   '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
   'xl/workbook.xml':workbook,'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'xl/styles.xml':styles,'xl/worksheets/sheet1.xml':sheet};
 }
 const encoder=new TextEncoder();const te=s=>encoder.encode(s);
 function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;}
 function zipStore(parts){const locals=[],central=[];let pos=0;let i=0;const write16=(d,o,v)=>d.setUint16(o,v,true),write32=(d,o,v)=>d.setUint32(o,v>>>0,true);
  for(const [name,content] of Object.entries(parts)){const nameBytes=te(name),bytes=te(content),crc=crc32(bytes),local=new Uint8Array(30+nameBytes.length+bytes.length),ld=new DataView(local.buffer);
   write32(ld,0,0x04034b50);write16(ld,4,20);write16(ld,8,0);write32(ld,14,crc);write32(ld,18,bytes.length);write32(ld,22,bytes.length);write16(ld,26,nameBytes.length);local.set(nameBytes,30);local.set(bytes,30+nameBytes.length);locals.push(local);
   const c=new Uint8Array(46+nameBytes.length),cd=new DataView(c.buffer);write32(cd,0,0x02014b50);write16(cd,4,20);write16(cd,6,20);write16(cd,10,0);write32(cd,16,crc);write32(cd,20,bytes.length);write32(cd,24,bytes.length);write16(cd,28,nameBytes.length);write32(cd,42,pos);c.set(nameBytes,46);central.push(c);pos+=local.length;i++;
  }const centralSize=central.reduce((n,x)=>n+x.length,0),result=new Uint8Array(pos+centralSize+22);let at=0;for(const b of [...locals,...central]){result.set(b,at);at+=b.length;}const end=new DataView(result.buffer,at,22);write32(end,0,0x06054b50);write16(end,8,i);write16(end,10,i);write32(end,12,centralSize);write32(end,16,pos);return result;
 }
 function xlsxBytes(p){const m=evaluate(p);if(m.errors.length)throw Error(m.errors.join(' '));return zipStore(xlsxParts(p,m));}
 function download(p){const bytes=xlsxBytes(p),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='SATRIA-DRAF-HPS-'+String(p.rup||p.id).replace(/[^a-z0-9_-]/gi,'-')+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return bytes;}
 function feedback(msg){if(typeof root.toast==='function')root.toast(msg);else root.alert(msg);}
 // Keep unsaved form changes alive across ordinary document re-renders.
 function capture(target){const host=target.closest('[data-hps-doc-panel]');if(!host)return;const pid=host.getAttribute('data-hps-doc-panel'),p=typeof P==='function'?P(pid):null;if(!p||!fields.includes(target.dataset.hpsDocField))return;
  const s={...settings(p),[target.dataset.hpsDocField]:String(target.value).slice(0,250)};drafts.set(pid,s);
  const el=host.querySelector('.hps-gen-summary');if(el){const m=evaluate(p,s);el.innerHTML=`<span>Jumlah rincian: <b>${m.rows.length}</b></span><span>Subtotal harga: <b>${rup(m.before)}</b></span><span>Pajak tercantum: <b>${rup(m.tax)}</b></span><span>Total dokumen: <b>${rup(m.total)}</b></span>`;}
  const status=host.querySelector('.hps-gen-alert');if(status){const m=evaluate(p,s);status.innerHTML=m.errors.map(x=>'<p class="hps-gen-error">⚠ '+esc(x)+'</p>').concat(m.warnings.map(x=>'<p>ℹ '+esc(x)+'</p>')).join('');}
  host.querySelectorAll('[data-hps-doc-print],[data-hps-doc-xlsx]').forEach(b=>{b.disabled=evaluate(p,s).errors.length>0});
 }
 document.addEventListener('input',e=>{if(e.target?.matches?.('[data-hps-doc-field]'))capture(e.target)},true);
 document.addEventListener('change',e=>{if(e.target?.matches?.('[data-hps-doc-field]'))capture(e.target)},true);
 document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-hps-doc-save],[data-hps-doc-print],[data-hps-doc-xlsx]');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();const pid=b.dataset.hpsDocSave||b.dataset.hpsDocPrint||b.dataset.hpsDocXlsx,p=typeof P==='function'?P(pid):null;if(!p)return;
  if(b.hasAttribute('data-hps-doc-save')){if(!mayEditHps(p)){feedback('Akun ini tidak dapat mengubah paket.');return;}const m=evaluate(p);if(m.errors.length){feedback(m.errors.join(' '));return;}const result=typeof SATRIA!=='undefined'&&typeof SATRIA.tx==='function'?SATRIA.tx('paket','Pengaturan dokumen HPS '+String(p.rup||pid),()=>{p.hpsDokumen={...m.s}}):null;
   if(result!==null){drafts.delete(pid);feedback('Pengaturan HPS disimpan bersama paket.');if(typeof render==='function')render();}return;
  }
  try{if(b.hasAttribute('data-hps-doc-print'))print(p);else download(p);}catch(err){feedback('Dokumen tidak dapat dibuat: '+err.message);}
 },true);
 root.SATRIA_HPS_GENERATOR=Object.freeze({panel,evaluate,documentHtml,excelRows,xlsxBytes});
})(typeof window!=='undefined'?window:null);
