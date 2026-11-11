'use strict';
const assert=require('node:assert/strict');
const {inspect}=require('../frontend/satria-operational-integrity.js');
const deep=o=>JSON.parse(JSON.stringify(o));
const rup=[{id:'r1',rup:'100',opd:'o1',tahun:2026,pagu:10000000},{id:'r2',rup:'200',opd:'o2',tahun:2026,pagu:2000000}];
const suppliers=[{id:'s1'}];
const good={id:'p1',rup:'100',opd:'o1',tahun:2026,pagu:1000000,items:[{id:'i1',vol:2,hs:100}],penawaran:[{id:'w1',pen:'s1',harga:{i1:200},nego:{i1:180}}],pemenangId:'w1'};
let data={packages:[good],rupBank:rup,suppliers};
const prior=deep(data);
assert.equal(inspect(data).issues.length,0,'healthy procurement data should not be flagged');
assert.deepEqual(data,prior,'check must not mutate state');
let p=deep(good);p.id='p2';p.items.push({id:'i1',vol:0,hs:-5});p.pemenangId='missing';p.penawaran.push({id:'w1',pen:'none',harga:{lost:200,i1:-3}});
let problems=inspect({packages:[good,p],rupBank:rup,suppliers}).issues;
for(const code of ['DUPLICATE_ITEM_ID','INVALID_HPS_VALUE','MISSING_WINNER','DUPLICATE_OFFER_ID','MISSING_SUPPLIER','ORPHAN_OFFER_ITEM','INVALID_OFFER_PRICE']){
 assert(problems.some(i=>i.code===code),`missing ${code}`);
}
let outsider={...good,id:'p3',opd:'o2',rup:'200'};
assert.equal(inspect({packages:[good],rupBank:[rup[0]],suppliers}).issues.length,0,'scope isolation: unrelated OPD absent');
assert.equal(inspect({packages:[outsider],rupBank:[rup[0]],suppliers,links:()=>['r1']}).issues.filter(i=>i.code==='RUP_SCOPE_MISMATCH').length,1);
assert.equal(inspect({packages:[good,good],rupBank:[rup[0]],suppliers}).issues.filter(i=>i.code==='DUPLICATE_PACKAGE_ID').length,1);
let escaped=inspect({packages:[{...good,id:'\" onclick=alert(1)'}],rupBank:[rup[0]],suppliers});
assert.equal(escaped.checked,1);
assert.equal(escaped.readOnly,true);
console.log('PASS operational-integrity: 10 assertions groups, read-only, scope-in, RUP, winners, HPS, offers');
