"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),core=read('frontend/refactor/js/01-app-core.js'),shell=read('frontend/refactor/js/22-satria-genz-shell-341.js');
const v=html.match(/<meta\s+name="satria-release-version"\s+content="([^"]+)"/);
assert(v,'No release version metadata in index');
assert.equal(v[1],'3.0.59.54');
assert(html.includes('SATRIA NEXT '+v[1]));
assert(read('sw.js').includes('satria-v'+v[1]));
assert(read('manifest.json').includes(v[1]));
for(const [name,file] of [['runtime header',core],['browser tab',shell]]){
 assert(file.includes('meta[name="satria-release-version"]'), name+' must use release metadata');
 assert(!file.includes('NEXT · 3.0.59.44'), name+' must not show stale badge');
}
assert(!core.includes('Framework Version 3.0.59.39'),'dashboard must not show stale version');
assert(!shell.includes("document.title='SATRIA NEXT 3.0.59.39"),'tab must not show stale version');
console.log('PASS unified SATRIA release labels '+v[1]);
