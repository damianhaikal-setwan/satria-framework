'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'satria-readiness-test-'));
try{
 const read=path.join(tmp,'qa.json'),out=path.join(tmp,'readiness.json');
 function run(extra=[]){return cp.spawnSync('python',['tools/release_readiness.py','--quality-report',read,'--out',out,...extra],{cwd:root,encoding:'utf8'});}
 fs.writeFileSync(read,JSON.stringify({total:2,passed:2,failed:0,checks:[{name:'a',passed:true},{name:'b',passed:true}]}));
 let x=run();assert.equal(x.status,0,x.stderr);let result=JSON.parse(fs.readFileSync(out));
 assert.equal(result.candidate_for_staging,true);assert.equal(result.production_ready,false);
 assert.equal(result.release_decision,'STAGING_REQUIRED');
 const fixture=path.join(tmp,'staging-evidence.txt');fs.writeFileSync(fixture,'Synthetic log only');
 x=run(['--scoped-api',fixture]);assert.equal(x.status,0);
 result=JSON.parse(fs.readFileSync(out));
 assert.equal(result.production_ready,false,'An arbitrary attached file must never certify production');
 assert.equal(result.staging.scoped_api.status,'bukti_terlampir_perlu_diperiksa');
 fs.writeFileSync(read,JSON.stringify({total:2,passed:1,failed:1,checks:[{name:'a',passed:true},{name:'b',passed:false}]}));
 x=run();assert.equal(x.status,1);result=JSON.parse(fs.readFileSync(out));
 assert.equal(result.candidate_for_staging,false);assert.equal(result.release_decision,'LOCAL_QA_FAILED');
 const staging=fs.readFileSync(path.join(root,'tools/stage5_staging_http_audit.mjs'),'utf8');
 assert(staging.includes('origin.hostname===process.env.SATRIA_STAGING_HOSTNAME'));
 assert(staging.includes('Proyeksi OPD membocorkan'));
 assert(staging.includes('Sampah membocorkan'));
 console.log('PASS staging readiness: rejects bad QA, no automatic production approval, explicit host and scope checks');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
