/* PPKom API regression: simulate Auth/Admin clients, never use a live Supabase account. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root=path.join(__dirname,'..');
const file=path.join(root,'supabase/functions/admin-create-user/index.ts');
const input=fs.readFileSync(file,'utf8');
const compiled=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const ORG='64bec4e1-a687-4dce-8935-cc51363171db';
const ACTOR='123e4567-e89b-42d3-a456-426614174000';
const USER='123e4567-e89b-42d3-a456-426614174001';

function mockServer(){
 const calls={users:[],memberships:[],rpcs:[],audits:[],deleted:[]};let handler;
 const authClient={auth:{getUser:async()=>({data:{user:{id:ACTOR,email:'admin@example.org'}},error:null})}};
 const adminClient={
  auth:{admin:{createUser:async args=>{calls.users.push(args);return {data:{user:{id:USER,email:args.email}},error:null}},deleteUser:async id=>{calls.deleted.push(id);return {error:null}}}},
  from:table=>({
   select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{role:'admin',active:true},error:null})})})}),
   insert:async row=>{calls[table==='satria_memberships'?'memberships':'audits'].push(row);return {error:null}},
   delete:()=>({eq:()=>({eq:async()=>({error:null})})})
  }),
  rpc:async (name,args)=>{calls.rpcs.push({name,args});return {data:name==='satria_consume_user_creation_rate_limit'?true:1,error:null}}
 };
 const context={exports:{},require:()=>({createClient:(url,key)=>key==='public'?authClient:adminClient}),
   crypto:require('node:crypto').webcrypto,Headers,Request,Response,TextEncoder,console,
   Deno:{env:{get:key=>({'SUPABASE_URL':'https://demo.supabase.co','SUPABASE_PUBLISHABLE_KEY':'public','SUPABASE_SECRET_KEY':'private','ALLOWED_ORIGINS':'https://example.org'}[key]||'')},serve:fn=>{handler=fn}},
 };
 vm.runInNewContext(compiled,context,{filename:file});
 return {handler,calls};
}
async function create(handler, role, opd_ids=['bapperida'],year_ids=[2026]){
 const req=new Request('https://demo.supabase.co/functions/v1/admin-create-user',{method:'POST',headers:{Origin:'https://example.org',Authorization:'Bearer valid_admin', 'Content-Type':'application/json'},body:JSON.stringify({organization_id:ORG,email:'ppkom.bapperida@example.org',initial_password:'Satria#Auth2026Safe',display_name:'PPKom Bapperida',role,opd_ids,year_ids})});
 const res=await handler(req);return {status:res.status,body:await res.json()};
}
(async()=>{
 let s=mockServer();let res=await create(s.handler,'ppkom',['bapperida','disporapar']);
 assert.equal(res.status,400);assert.match(res.body.error,/satu OPD/);assert.equal(s.calls.users.length,0);
 s=mockServer();res=await create(s.handler,'ppkom',['bapperida'],[]);
 assert.equal(res.status,400);assert.equal(s.calls.users.length,0);
 s=mockServer();res=await create(s.handler,'ppkom',['bapperida'],[2026]);
 assert.equal(res.status,201,JSON.stringify(res));assert.equal(res.body.role,'ppkom');
 assert.equal(res.body.membership_role,'operator');assert.equal(res.body.account_type,'ppkom');
 assert.deepEqual(JSON.parse(JSON.stringify(res.body.opd_ids)),['bapperida']);
 assert.deepEqual(JSON.parse(JSON.stringify(res.body.year_ids)),[2026]);
 assert.equal(s.calls.users.length,1);assert.equal(s.calls.users[0].app_metadata.satria_account_type,'ppkom');
 assert.equal(s.calls.memberships[0].role,'operator');
 assert.deepEqual(s.calls.rpcs.map(x=>x.name),['satria_consume_user_creation_rate_limit','satria_admin_set_membership_opds','satria_admin_set_membership_years']);
 assert.equal(s.calls.audits[0].details.role,'ppkom');
 s=mockServer();res=await create(s.handler,'operator',['bapperida','disporapar'],[2025,2026]);
 assert.equal(res.status,201);assert.equal(s.calls.memberships[0].role,'operator');assert.equal(s.calls.users[0].app_metadata,undefined);
 console.log('PASS PPKom: 1 OPD + TA diperlukan, Auth app_metadata terlindungi, membership Operator scoped, audit; Operator lama tetap berfungsi');
})().catch(e=>{console.error(e);process.exitCode=1});
