
(function(){'use strict';
 const KNOWN=new Set(['nodis','idkb','rfi','bahepe','metode','sppbj','spek','dpp','lamp','reviu','bahp','survei','hpsnego','kknego','analisa']);
 const title={nodis:'Nota Dinas',idkb:'Identifikasi Kebutuhan',rfi:'RFI',bahepe:'BA Evaluasi Penyedia',metode:'Formulir Penetapan',sppbj:'SPPBJ',spek:'Spesifikasi Teknis',dpp:'Dokumen Persiapan',lamp:'Lampiran Harga',reviu:'BA Reviu DPP',bahp:'BA Hasil Pemilihan',survei:'Survei Harga',hpsnego:'HPS & Negosiasi',kknego:'Kertas Kerja Negosiasi',analisa:'Analisis Kewajaran Harga & Bukti'};
 function current(){
   // Respect the package shown in the document studio. IDs are strings in select elements.
   const select=document.querySelector('.dok-studio #selPaket');
   const id=String(select?.value||S.ui.dpid||'');
   return id?(S.paket||[]).find(x=>String(x.id)===id)||null:null;
 }
 function review(p,k){
   if(!p)return {error:'Paket dokumen tidak ditemukan. Pilih ulang paket dari daftar.',issues:[{label:'Paket tidak ditemukan'}]};
   if(!KNOWN.has(k))return {error:'Jenis dokumen tidak dikenal. Muat ulang SATRIA.',issues:[{label:'Dokumen tidak dikenal'}]};
   const checks=typeof window.docReqs==='function'?window.docReqs(p,k):[];
   const issues=checks.filter(x=>!x.ok&&!x.manual).map(x=>({field:x.id,label:x.label,tab:x.tab}));
   const manualChecks=checks.filter(x=>x.manual).map(x=>({field:x.id,label:x.label,needsVerification:!x.ok}));
   const docEl=document.querySelector('#dokLazyContainer .doc[data-document-type="'+k+'"]');
   const placeholders=[];
   if(docEl){
     const plain=docEl.textContent||'';
     for(const [pattern,label] of [[/\bNaN\b/g,'Perhitungan menghasilkan NaN'],[/\bundefined\b/g,'Data tidak terdefinisi'],[/\bnull\b/g,'Data bernilai null'],[/\[(?:Belum|KODE|Tanggal)[^\]]*\]/gi,'Placeholder belum diganti']]){
       if(pattern.test(plain))placeholders.push(label);
     }
   }
   const status=issues.length||placeholders.length?'PERLU MELENGKAPI DATA / MENINJAU DRAF':manualChecks.some(x=>x.needsVerification)?'ISIAN DASAR TERPENUHI — VERIFIKASI BUKTI MANUAL DIPERLUKAN':'ISIAN DASAR TERPENUHI (BUKAN PENGESAHAN)';
   return {version:'3.0.59.52',checkedAt:new Date().toISOString(),rup:p.rup||'',paket:p.nama||'',tahun:p.tahun,opd:p.opd,jenis:k,namaDokumen:title[k],status,issues,manualChecks,placeholders,templateTables:docEl?docEl.querySelectorAll('table').length:null,templateRows:docEl?docEl.querySelectorAll('table tr').length:null,peringatan:'Pemeriksaan otomatis hanya menilai isian dan metadata. Referensi asli, spesifikasi, tanggal, kewajaran harga, dan keputusan Pejabat Pengadaan harus diverifikasi.'};
 }
 function downloadReport(){
   const p=current(),k=S.ui.dok;
   const rows=KNOWN.has(k)?[review(p,k)]:[...KNOWN].map(key=>review(p,key));
   const data=JSON.stringify({application:'SATRIA',version:'3.0.59.52',reviews:rows},null,2);
   const url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='SATRIA-pemeriksaan-dokumen-'+String(p?.rup||'paket').replace(/[^a-z\d_-]/gi,'_')+'-'+k+'.json';
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
 }
 document.addEventListener('click',event=>{
   const target=event.target.closest?.('[data-act]');if(!target)return;
   if(target.dataset.act==='satriaDocAuditExport'){
     event.preventDefault();event.stopImmediatePropagation();downloadReport();return;
   }
   if(target.dataset.act!=='print'||!target.closest('.dok-studio'))return;
   // Intercept after the existing print-engine capture handler, before delegated bubble handler.
   event.preventDefault();event.stopImmediatePropagation();
   const p=current(),k=S.ui.dok,qa=review(p,k);
   if(qa.error){alert(qa.error);window.SATRIA_DOK_PRINT?.clear();return;}
   const bad=qa.issues.map(x=>'• '+x.label).slice(0,7);
   const additional=qa.issues.length>7?'\n• ...dan '+(qa.issues.length-7)+' pemeriksaan lain':'';
   const placeholder=qa.placeholders.map(x=>'• '+x).join('\n');
   if((bad.length||placeholder)&&k!=='analisa'){
     const message='DOKUMEN MASIH PERLU DIVERIFIKASI\n\n'+bad.join('\n')+additional+(placeholder?'\n'+placeholder:'')+'\n\nLanjutkan CETAK DRAF untuk pemeriksaan internal? Pilih Batal untuk melengkapi data.';
     if(!confirm(message)){window.SATRIA_DOK_PRINT?.clear();return;}
   }
   // Analisis harga is a read-only draft whose evidence warnings are printed in its report;
   // do not insert an unnecessary approval dialog in the single-operator workflow.
   // A print operation follows a direct click so browsers can retain user gesture.
   if(!window.SATRIA_DOK_PRINT?.prepare()){alert('Pratinjau tidak tersedia. Buka ulang dokumen.');return;}
   window.print();
 },true);
 window.SATRIA_DOK_QA=Object.freeze({review,report:downloadReport,types:[...KNOWN],version:'3.0.59.52'});
})();
