'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../frontend/refactor/maintenance/care-center.js'),'utf8');
const listeners={};
const state={persistError:'',records:[{name:'KODE-PAKET-PRIVAT'}]};
const changes=JSON.stringify(state);
const context={
 window:{
   SATRIA_CLOUD_CONFIGURED:true,
   SATRIA_CLOUD_ROLE:'admin',
   SATRIA_MAINTENANCE:{inspect:()=>({errorCount:0,stylesExpected:22,stylesLoaded:22,scriptsExpected:34,coreReady:true,priceAnalysisReady:true})},
   SATRIA_OPS_V2:{health:()=>({issues:[{level:'Tinggi',message:'NAMA-PAKET-PRIVAT'}],records:[{}]})}
 },
 cur:()=>({role:'Admin'}),
 S:state,
 satriaSettingsCheck:()=>({referensi:[],data:[],identitas:[],dokumen:[]}),
 satriaSettingsWarnings:()=>['OPD perlu dilengkapi'],
 document:{addEventListener:(name,handler)=>listeners[name]=handler,getElementById:()=>null},
 location:{hash:'#care'},
 Date,JSON,Math,Object,Number,String,Array,Boolean,Blob,URL,setTimeout
};
vm.runInNewContext(source,context,{timeout:1200});
const api=context.window.SATRIA_CARE;
assert.equal(Object.isFrozen(api),true);
let a=api.scan();
assert.equal(a.admin,true);
assert.equal(a.config.incomplete,1);
assert.equal(a.config.count,0);
assert.equal(a.data.count,1);
assert.equal(a.data.high,1);
assert.equal(a.runtime.errorCount,0);
assert.equal(a.attention,true);
assert.equal(JSON.stringify(state),changes,'Scan tidak boleh mengubah data bisnis');
assert(!JSON.stringify(a).includes('PRIVAT'),'Laporan tidak boleh menyertakan data paket');
assert(api.page().includes('Perawatan SATRIA'));
assert(api.page().includes('1 kelengkapan'));
context.window.SATRIA_CLOUD_ROLE='operator';
a=api.scan();
assert.equal(a.admin,false,'operator tidak boleh memeriksa global config');
assert.equal(a.config,null);
assert(!api.page().includes('Backup Data JSON'),'Backup lengkap hanya tampil untuk Admin');
context.window.SATRIA_CLOUD_ROLE='admin';
context.window.SATRIA_MAINTENANCE.inspect=()=>({errorCount:2,stylesExpected:22,stylesLoaded:21,scriptsExpected:34,coreReady:false,priceAnalysisReady:false});
a=api.scan();
assert.equal(a.attention,true);
assert.equal(a.runtime.stylesLoaded,21);
assert.equal(JSON.stringify(state),changes);
console.log('PASS Perawatan SATRIA: baca-saja, Admin/Operator, status kelengkapan, data privat tak tercetak');
