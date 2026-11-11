'use strict';
/* Refactor contract: stable script loading, virtual print, accessibility & no duplicated CSS. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const html=read('index.html'),app=read('frontend/refactor/js/01-app-core.js');
const doc=read('frontend/satria-document-templates.js');
const cloud=read('frontend/refactor/js/05-cloud-sync.js');
const perf=read('frontend/satria-view-performance.js');
const css=read('frontend/satria-shared-modal-ui.css');
const ux=read('frontend/satria-stage4-ux.css');
const sw=read('sw.js');
const paths=['./frontend/refactor/js/01-app-core.js','./frontend/satria-document-templates.js','./frontend/refactor/js/05-cloud-sync.js','./frontend/satria-view-performance.js'];
let previous=-1;
for(const src of paths){const index=html.indexOf(`src="${src}"`);assert(index>previous,`Classic JS load order broken: ${src}`);previous=index;}
assert(!app.includes('function nodis(p){'),'Document templates should not return to app controller');
assert(doc.includes('function nodis(p){')&&doc.includes('const DOCS={'),'Document module incomplete');
assert(!cloud.includes('function vDokOptimized(){')&&perf.includes('function vDokOptimized(){'),'View engine must be outside cloud');
assert.equal(cloud.match(/SATRIA DATA MASTER PERFECTED/g)?.length||0,0,'Repeated giant CSS blocks leaked into cloud sync');
assert.equal(css.match(/SATRIA DATA MASTER PERFECTED/g)?.length,1);
assert(perf.includes('const attachedPackageViewports = new WeakSet()'),'Virtual scroll listeners must not duplicate');
assert(!perf.includes("e.preventDefault();\n    }\n    lastTouch"),'Mobile zoom/tap interception must not return');
assert(perf.includes("table.classList.add('satria-sr-only-table')"),'Original semantic table must be retained');
assert(ux.includes('table.satria-sr-only-table')&&ux.includes('@media print'),'Original table print rule missing');
assert(app.includes('satriaSafeMediaSrc(x.ttd)')&&app.includes('satriaSafeMediaSrc(x.cap)'),'Signer images must be sanitized');
for(const name of ['satria-document-templates.js','satria-view-performance.js','satria-shared-modal-ui.css','satria-stage4-ux.css']){
 assert(sw.includes('./frontend/'+name),`PWA missing ${name}`);
 assert.equal(html.split('./frontend/'+name).length-1,1,`HTML must include ${name} once`);
}
assert(/(?:modular-stage4|cloud-stage5|combined-p0p3)/.test(sw),'New SW cache must be versioned');
console.log('PASS Stage4 modular contract: order, split modules, dedup CSS, a11y/print, image safety, PWA assets');
