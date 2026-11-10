'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const version='3.0.59.53';assert(html.includes(version)&&manifest.description.includes(version)&&sw.includes(version),'App/cache/manifest versions differ');
const hrefs=[...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(\.\/[^"#?]+)"/g)].map(x=>x[1]);
for(const href of hrefs)assert(fs.existsSync(path.join(root,href)),'Missing index asset '+href);
const m=sw.match(/const APP_ASSETS\s*=\s*\[([\s\S]*?)\];/);assert(m,'Precache list missing');
const precache=[...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
for(const href of precache)assert(fs.existsSync(path.join(root,href)),'Missing SW precache asset '+href);
for(const asset of ['frontend/pbj2026-policy.js','frontend/pbj2026-workspace.js','frontend/pbj2026-workspace.css']){
 assert(precache.includes('./'+asset),'PBJ cache missing '+asset);
 assert.equal(hrefs.filter(x=>x==='./'+asset).length,1,'PBJ asset duplicated or missing in HTML '+asset);
}
let n=0;function visit(d){for(const x of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,x.name);if(x.isDirectory())visit(f);else if(x.name.endsWith('.js')&&f.includes('/frontend/')){new vm.Script(fs.readFileSync(f,'utf8'),{filename:f});n++;}}}visit(path.join(root,'frontend'));
for(const icon of manifest.icons||[])assert(fs.existsSync(path.join(root,icon.src)));
console.log('PASS PBJ 2026 deployment assets: '+hrefs.length+' references, '+precache.length+' precached, '+n+' frontend JS parse, versions consistent');
