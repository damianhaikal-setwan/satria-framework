'use strict';
const assert=require('node:assert/strict');
const core=require('../frontend/satria-procurement-core.js');
const bank=Array.from({length:1200},(_,i)=>({id:'r'+i,rup:'K-'+i,opd:'OPD-'+(i%4),tahun:2026}));
const records=Array.from({length:2000},(_,i)=>({id:'p'+i,rupBankId:'r'+(i%1200),
 rup:'K-'+(i%1200),opd:'OPD-'+(i%1200%4),tahun:2026,items:[{vol:2,hs:5000}],penawaran:[]}));
const before=JSON.stringify({bank,records});
const normal=records.slice(0,10).map(p=>core.packageSnapshot(p,bank));
const batch=core.packageSnapshots(records,bank);
assert.equal(batch.length,2000);
assert.deepEqual(batch.slice(0,10),normal);
assert(batch.every(item=>item.hps===10000&&item.rup.issues.length===0));
assert.equal(JSON.stringify({bank,records}),before,'Read-only calculations must not mutate packages');
assert.equal(core.rupLinkStatus({...records[0],rupBankId:'missing'},bank).missing[0],'missing');
const duplicate=[{id:'r0',rup:'ORIGINAL',opd:'OPD-0',tahun:2026},...bank];
assert.equal(core.createBankIndex(duplicate).byId.get('r0').rup,'ORIGINAL');
console.log('PASS shared RUP index: 2000 packages, 1200 Bank RUP, no mutation');
