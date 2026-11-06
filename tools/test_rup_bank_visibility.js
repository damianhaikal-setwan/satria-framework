/* Pure Node regression for Bank RUP query / scope. No external services or dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html=require('./legacy_index_source.cjs').readIndex();
const start=html.indexOf('/* Bank RUP adalah daftar sumber lintas OPD/tahun');
const end=html.indexOf('function satriaBankRow(p)',start);
assert(start>=0&&end>start,'Bank RUP function not found');
const methods=html.slice(start,end);
const S={
  rupBank:[
    {id:'json1',rup:'JSON-A',nama:'Dari JSON',opd:'a',tahun:2026,pagu:1000,asal:'Impor JSON/CSV SiRUP'},
    {id:'manual1',rup:'MAN-B',nama:'Dari manual',opd:'b',tahun:2026,pagu:2000,asal:'Input manual — Dokumen'},
    {id:'json2',rup:'JSON-B-2027',nama:'Tahun berbeda',opd:'b',tahun:2027,pagu:3000,asal:'Impor JSON/CSV SiRUP'},
  ],
  ui:{opd:'b',tahun:2026,rupSearch:'',rupBankOpd:'all',rupBankYear:'all'}
};
let scope=null;
const {satriaBankRows,satriaBankAccessibleRows}=new Function('S','activeCloudScope',methods+'\nreturn {satriaBankRows,satriaBankAccessibleRows};')(S,()=>scope);
assert.deepEqual(satriaBankRows().map(x=>x.id),['json1','manual1','json2'],'Main header must not hide bank data');
S.ui.rupSearch='json';
assert.deepEqual(satriaBankRows().map(x=>x.id),['json1','json2'],'Bank search must use independent query');
S.ui.rupSearch='';
S.ui.rupBankOpd='b';
assert.deepEqual(satriaBankRows().map(x=>x.id),['manual1','json2'],'Bank OPD filter');
S.ui.rupBankYear='2027';
assert.deepEqual(satriaBankRows().map(x=>x.id),['json2'],'Bank year filter');
S.ui.rupBankYear='all';S.ui.rupBankOpd='all';
scope={opdIds:['a'],years:[2026]};
assert.deepEqual(satriaBankAccessibleRows().map(x=>x.id),['json1'],'Server-assignment projection must be enforced');
assert.deepEqual(satriaBankRows().map(x=>x.id),['json1'],'Bank display must not bypass user assignment');
assert(html.includes("const WRITE=['newpaket','rupsave','rupimport','rupmanualsave'"),'Viewer action guard must include manual save');
assert(!html.includes('rupManualClearDraft();S.ui.rupSearch=rup'),'Manual save must not narrow global bank search');
assert(html.includes("S.ui.rupSearch='';S.ui.rupBankOpd='all';S.ui.rupBankYear='all';"),'Save/import must clear bank filters');
assert(html.includes('data-act="rupbankreset"'),'Reset filter button required');
console.log('PASS — Bank RUP visibility, independent filters, cloud scope, manual save guard');
