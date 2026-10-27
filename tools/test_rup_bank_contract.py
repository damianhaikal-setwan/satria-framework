"""Run without Supabase or network: python tools/test_rup_bank_contract.py."""
from pathlib import Path
import re, subprocess, tempfile

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
sql=(ROOT/'supabase/migrations/20261028010000_satria_rup_bank_cloud_compat.sql').read_text()
checks={
    'delta RPC protects user membership and expected version': 'Active organization membership required' in sql and 'Version conflict:' in sql,
    'delta RPC supports rupBank collection': "('paket','rupBank','opd'" in sql,
    'read RPC includes scoped rupBank': "'rupBank', coalesce((select jsonb_agg" in sql and "where r.value->>'opd'=any(v_opd_ids)" in sql,
    'operator must have OPD and fiscal-year assignments': 'Operator requires at least one active OPD and assigned fiscal year' in sql,
    'bank code duplicate guard': 'Bank RUP already contains this code' in sql,
    'bank->OPD and fiscal-year guards': 'Bank RUP references an unknown OPD' in sql and 'Bank RUP references an unregistered fiscal year' in sql,
    'package->bank reference guard': 'Package has a missing or mismatched Bank RUP link' in sql,
    'bank referenced by package cannot be deleted': 'Bank RUP is linked to procurement packages and cannot be deleted' in sql,
    'fiscal-year in bank cannot be deleted': 'Cannot remove a fiscal year still used by Bank RUP' in sql,
    'bank data cannot cross scope on logout': 'penyedia:[],rupBank:[],paket:[]' in html,
    'frontend uses scoped rupBank after pull': 'S.rupBank=(S.rupBank||[]).filter(r=>allowedOpdSet.has' in html,
    '14 document templates retained': all(x in html for x in ['bahepe','bahp','nodis','idkb','rfi','sppbj']),
}
for name,ok in checks.items():print(('PASS' if ok else 'FAIL')+' — '+name)
assert all(checks.values()), 'A static Bank RUP contract check failed'

# JS delta logic executed in an isolated Node VM, without DOM or Supabase.
start=html.index("const ARRAY_DELTAS=['rupBank'")
end=html.index('function cancelAutosaveTimer()',start)
js=html[start:end]
with tempfile.TemporaryDirectory(prefix='satria-test-') as td:
    p=Path(td)/'test.js'
    p.write_text('''const assert=require('node:assert/strict');
const cloneJson=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const payloadEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
'''+js+'''
const base={tahun:[2026],opd:[{id:'o1',nama:'OPD'}],paket:[],rupBank:[]};
const bank={id:'rup1',rup:'67090063',nama:'ATK',opd:'o1',tahun:2026,pagu:8000000};
const pkg={id:'paket1',rup:'67090063',tahun:2026,opd:'o1',rupBankId:'rup1',items:[],penawaran:[]};
const target={...base,rupBank:[bank],paket:[pkg]};
const changes=makeDelta(base,target);
assert.deepEqual(changes.map(x=>x.collection),['rupBank','paket']);
assert.deepEqual(applyDeltaToPayload(base,changes),target);
const drop=makeDelta(target,{...base,rupBank:[],paket:[]});
assert.deepEqual(drop.map(x=>x.collection),['paket','rupBank']);
assert.deepEqual(applyDeltaToPayload(target,drop),base);
const withYear={...target,tahun:[2026,2027],rupBank:[bank,{...bank,id:'rup2',rup:'R-2',tahun:2027}]};
const yearChanges=makeDelta(target,withYear);
assert.deepEqual(yearChanges.map(x=>x.collection),['tahun','rupBank']);
const withOpd={...base,opd:[...base.opd,{id:'o2',nama:'OPD2'}],rupBank:[{...bank,id:'rup3',opd:'o2'}]};
assert.deepEqual(makeDelta(base,withOpd).map(x=>x.collection),['opd','rupBank']);
assert.throws(()=>makeDelta(base,{...base,rupBank:[bank,bank]}),/duplikat/i);
console.log('PASS — JavaScript delta sync: create/delete/order/year/OPD/duplicate IDs');
''')
    run=subprocess.run(['node',str(p)],capture_output=True,text=True)
    print(run.stdout,end='')
    if run.returncode:print(run.stderr);raise SystemExit(run.returncode)
print('PASS — Bank RUP client/server contract static checks')
