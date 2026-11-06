
(function(){
  'use strict';
  let printRoot = null;
  const ALL_DOCS = new Set(['nodis','idkb','rfi','survei','bahepe','metode','sppbj','spek','dpp','lamp','reviu','hpsnego','kknego','bahp','analisa']);
  function buildPrintDocument(){
    const current = document.querySelector('#dokLazyContainer .doc[data-document-type]');
    if(!current || !ALL_DOCS.has(current.dataset.documentType)) return false;
    if(printRoot) printRoot.remove();
    printRoot = document.createElement('div');
    printRoot.id = 'satria-print-root';
    printRoot.setAttribute('role','document');
    const clone = current.cloneNode(true);
    clone.removeAttribute('data-lazy');
    clone.removeAttribute('style');
    clone.style.display = 'block';
    clone.style.opacity = '1';
    clone.querySelectorAll('.doc-virtual-table').forEach(el=>el.remove());
    clone.querySelectorAll('table').forEach(table=>{
      // The screen virtualization engine hides the original table but leaves all source rows in it.
      table.style.removeProperty('display');
      table.setAttribute('data-satria-print-original','true');
      table.style.display='table';
      table.querySelectorAll('thead').forEach(head=>head.style.display='table-header-group');
    });
    clone.querySelectorAll('img').forEach(img=>{
      img.loading = 'eager';
      img.style.removeProperty('opacity');
      img.style.removeProperty('transition');
      img.style.opacity='1';
    });
    clone.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
    printRoot.appendChild(clone);
    document.body.appendChild(printRoot);
    // Avoid rendering a silent partial print if the document has no content.
    return !!clone.textContent.trim();
  }
  window.addEventListener('beforeprint', buildPrintDocument);
  window.addEventListener('afterprint', ()=>{
    if(printRoot){ printRoot.remove();printRoot=null; }
  });
  document.addEventListener('click',function(event){
    const btn=event.target.closest && event.target.closest('[data-act="print"]');
    if(!btn || !btn.closest('.dok-studio')) return;
    // Capture-phase: the existing delegated handler will call window.print afterward.
    buildPrintDocument();
  },true);
  // Separate callable function for manual QA and automated acceptance tests.
  window.SATRIA_DOK_PRINT = Object.freeze({
    prepare:buildPrintDocument,
    inspect:()=>{
      const el=document.querySelector('#satria-print-root .doc');
      return el?{type:el.dataset.documentType, tables:el.querySelectorAll('table').length,
        rows:el.querySelectorAll('table tr').length,
        virtualTables:el.querySelectorAll('.doc-virtual-table').length,
        pageFormat:el.classList.contains('doc-landscape')?'A4 landscape':'A4 portrait',font:'Arial'}:null;
    },
    clear:()=>{if(printRoot){printRoot.remove();printRoot=null;}}
  });
})();
