'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
const hooks={};let cached=[];let skipped=false;let claimed=false;
const cache={addAll:async paths=>{cached=paths.slice()},put:async()=>{}};
const store=new Map([['satria-v-old',{old:1}],['another-app-v1',{other:1}]]);
const caches={
 open:async name=>{store.set(name,cache);return cache;},
 keys:async()=>Array.from(store.keys()),
 delete:async name=>store.delete(name),
 match:async ()=>undefined,
};
const self={location:{origin:'https://satria.local'},addEventListener:(event,cb)=>hooks[event]=cb,skipWaiting:async()=>{skipped=true},clients:{claim:async()=>{claimed=true}}};
const context={self,caches,console,URL,Promise,Response,fetch:async()=>{throw Error('offline')}};
vm.runInNewContext(code,context);
function wait(name,event){let promise;hooks[name]({...event,waitUntil:p=>{promise=p}});return promise;}
(async()=>{
 await wait('install',{});
 assert(skipped && cached.length>60,'precache must cover all modular files');
 assert(cached.includes('./frontend/refactor/maintenance/diagnostics.js'));
 assert(cached.includes('./frontend/refactor/maintenance/care-center.js'));
 assert(cached.includes('./frontend/refactor/maintenance/care-center.css'));
 await wait('activate',{});
 assert(claimed && !store.has('satria-v-old'));
 assert(store.has('another-app-v1'),'activation must not delete other app caches');
 let response;
 let req={method:'GET',url:'https://satria.local/frontend/refactor/js/01-app-core.js',mode:'cors'};
 hooks.fetch({request:req,respondWith:p=>{response=p}});
 let asset=await response;
 assert.equal(asset.type,'error','offline missing JS must not receive HTML fallback');
 response=null;req={method:'GET',url:'https://satria.local/other-page',mode:'navigate'};
 hooks.fetch({request:req,respondWith:p=>{response=p}});
 assert.equal((await response).type,'error','navigation without cached index correctly fails');
 response=null;req={method:'GET',url:'https://test.supabase.co/rest/v1/secret',mode:'cors'};
 hooks.fetch({request:req,respondWith:p=>{response=p}});
 assert.equal(response,null,'Supabase endpoints must bypass cache');
 console.log('PASS SW: full precache, scoped cleanup, offline asset 404 not HTML, cloud bypass');
})().catch(e=>{console.error(e);process.exitCode=1});
