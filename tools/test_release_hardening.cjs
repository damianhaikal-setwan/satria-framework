'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const code = fs.readFileSync(path.join(root,'sw.js'),'utf8');
const hooks = {}, store = new Map();
let cachedNames=[], requests=0, browserFallbackCount=0;
const cache = { addAll: async names => {cachedNames=names;}, put: async () => {}, match: async () => undefined };
const caches = { open: async key => (store.set(key,cache),cache), keys: async () => [...store.keys()],
 delete: async key => store.delete(key), match: async () => undefined };
const self = {location:{origin:'https://example.test',href:'https://example.test/satria/sw.js'},
 addEventListener:(name,fn)=>{hooks[name]=fn},skipWaiting:async()=>{},clients:{claim:async()=>{}}};
vm.runInNewContext(code,{self,caches,URL,console,Promise,Response,fetch:async()=>{requests++;throw Error('offline')}});
assert(code.includes('APP_PATHS')&&code.includes('url.search'),'PWA must allowlist cached assets');
assert(code.includes('combined-p0p3-opt5'));
async function event(name,request) {
 let answered;hooks[name]({request,waitUntil:p=>answered=p,respondWith:p=>answered=p});
 return answered;
}
(async()=>{
 await event('install');
 assert(cachedNames.length>60);
 for(const url of [
   'https://example.test/satria/private/export.csv',
   'https://example.test/satria/frontend/refactor/js/01-app-core.js?token=secret',
   'https://example.test/satria/?code=oauth-secret',
   'https://example.test/satria/rest/v1/satria_state',
   'https://example.test/satria/subpage',
   'https://external.test/satria/index.html'
 ]){
   const result=await event('fetch',{method:'GET',url,mode:'navigate'});
   assert.equal(result,undefined,'Unknown/sensitive URL must bypass PWA: '+url);
 }
 assert.equal(requests,0);
 const asset=await event('fetch',{method:'GET',url:'https://example.test/satria/frontend/refactor/js/01-app-core.js',mode:'cors'});
 assert.equal((await asset).type,'error','Offline JS cannot masquerade as HTML');
 const entry=await event('fetch',{method:'GET',url:'https://example.test/satria/index.html',mode:'navigate'});
 assert.equal((await entry).type,'error','Missing entry must fail safely');
 assert.equal(requests,2);
 const cloud=fs.readFileSync(path.join(root,'frontend/refactor/js/05-cloud-sync.js'),'utf8');
 const styles=fs.readFileSync(path.join(root,'frontend/satria-combined-ux.css'),'utf8');
 assert(!cloud.includes("document.createElement('style')"),'Sync indicator must use stylesheet');
 assert(styles.includes('.satria-sync-indicator'));
 console.log('PASS secure PWA cache allowlist, sensitive URL bypass, offline safety, shared CSS');
})().catch(e=>{console.error(e);process.exitCode=1});
