"""Browser smoke with a fake Supabase transport; NO real PostgreSQL/RLS tested."""
from pathlib import Path
from urllib.parse import urlparse
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
INJECT=r"""
(() => {
 const _s={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>_s[k]??null,setItem:(k,v)=>{_s[k]=String(v)},removeItem:k=>{delete _s[k]},clear:()=>{for(const k in _s)delete _s[k]}}});
 const clone=o=>JSON.parse(JSON.stringify(o));
 const server={payload:null,version:10,trash:[],denied:false,role:'admin',signedIn:false};
 window.__mockSatriaServer=server;
 const query=table=>{
   const q={filters:[],
    select(){return this},eq(key,val){this.filters.push([key,val]);return this},is(){return this},
    order(){return this},limit(){return Promise.resolve(this.result())},
    range(start,end){const result=this.result();return Promise.resolve({
      ...result,data:Array.isArray(result.data)?result.data.slice(start,end+1):result.data
    })},
    maybeSingle(){return Promise.resolve(this.result())},
    result(){
      if(table==='satria_memberships')return {data:{role:server.role,active:true},error:null};
      if(table==='satria_state')return {data:server.payload?{payload:clone(server.payload),version:server.version,updated_at:new Date().toISOString(),updated_by:'mock'}:null,error:null};
      if(table==='satria_trash_entries')return {data:server.trash.filter(t=>!t.restored_at).map(t=>({
        id:t.id,collection:t.collection,record_id:t.record_id,record_summary:t.record.nama||t.record.rup||t.record_id,
        deleted_at:t.deleted_at,deleted_by:t.deleted_by,opd_id:t.record.opd,fiscal_year:t.record.tahun,retain_until:'2027-11-11'
      })),error:null};
      if(table==='satria_sync_events')return {data:null,error:null};
      return {data:null,error:{message:'Unsupported table '+table}};
    }
   };return q;
 };
 const client={
  supabaseUrl:'https://staging-mock.example.org',
  auth:{
   getSession:async()=>({data:{session:server.signedIn?{user:{id:'mock-user'}}:null},error:null}),
   getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001',email:'mock@example.org',app_metadata:{}}},error:null}),
   signInWithPassword:async()=>{server.signedIn=true;return {error:null}},
   signOut:async()=>{server.signedIn=false;return {error:null}},
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
  },
  from:query,
  channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}}),
  removeChannel:()=>{},
  rpc:async(name,args)=>{
   if(name==='satria_get_scoped_state'){
    return {data:{payload:clone(server.payload),version:server.version,updated_at:new Date().toISOString(),updated_by:'mock',
      scope:{role:server.role,opd_ids:(server.payload.opd||[]).map(x=>x.id),years:server.payload.tahun||[2026],can_write:server.role==='operator'}},error:null};
   }
   if(name==='satria_archive_record'){
    if(server.denied)return {data:null,error:{message:'Simulated SQL permission denied'}};
    if(args.p_expected_version!==server.version)return {data:null,error:{message:'Version conflict'}};
    const rows=server.payload[args.p_collection]||[], idx=rows.findIndex(x=>x.id===args.p_record_id);
    if(idx===-1)return {data:null,error:{message:'Missing active record'}};
    const row=rows.splice(idx,1)[0];
    const id='00000000-0000-4000-8000-'+String(server.trash.length+1).padStart(12,'0');
    server.trash.push({id,collection:args.p_collection,record_id:args.p_record_id,record:row,deleted_at:new Date().toISOString(),deleted_by:'mock'});
    return {data:{trash_id:id,status:'archived',version:++server.version},error:null};
   }
   if(name==='satria_restore_record'){
    if(server.denied)return {data:null,error:{message:'Simulated SQL permission denied'}};
    if(args.p_expected_version!==server.version)return {data:null,error:{message:'Version conflict'}};
    const t=server.trash.find(t=>t.id===args.p_trash_id&&!t.restored_at);
    if(!t)return {data:null,error:{message:'Missing trash'}};
    if(server.payload[t.collection].some(x=>x.id===t.record_id))return {data:null,error:{message:'ID occupied'}};
    server.payload[t.collection].push(clone(t.record));t.restored_at=new Date().toISOString();
    return {data:{trash_id:t.id,status:'restored',version:++server.version},error:null};
   }
   if(name==='satria_apply_state_delta')return {data:null,error:{message:'Only archive RPC can delete'}};
   return {data:null,error:{message:'Unexpected RPC '+name}};
  }
 };
 window.supabase={createClient:()=>client};
})();
"""
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':940})
 page.set_default_timeout(3500)
 page.on('dialog',lambda d:d.accept())
 errs=[]; missing=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 def serve(route):
  url=urlparse(route.request.url)
  if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
   route.fulfill(status=200,body='',content_type='text/javascript');return
  if url.hostname in ('d3js.org','fonts.googleapis.com','fonts.gstatic.com'):
   route.fulfill(status=200,body='',content_type='text/css');return
  target=(ROOT/url.path.lstrip('/')).resolve()
  if target.is_file() and ROOT.resolve() in target.parents:
   ctype='text/javascript' if target.suffix=='.js' else 'text/css' if target.suffix=='.css' else 'text/html' if target.suffix=='.html' else 'text/plain'
   route.fulfill(status=200,body=target.read_bytes(),content_type=ctype);return
  missing.append(route.request.url);route.fulfill(status=404,body='missing')
 page.route('**/*',serve)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://satria.local/"><script>'+INJECT+'</script>',1)
 page.set_content(html,wait_until='domcontentloaded')
 page.wait_for_timeout(500)
 page.evaluate("""() => {
  __mockSatriaServer.payload=JSON.parse(JSON.stringify(SEED));
  __mockSatriaServer.payload.rupBank=[];
  __mockSatriaServer.payload.sampah=[];
  S.ui.user=(S.users.find(x=>x.role==='Admin')||S.users[0]).id;
 }""")
 assert page.evaluate('__mockSatriaServer.payload.paket.some(p=>p.id==="k1")')
 page.locator('#scEmail').fill('mock@example.org')
 page.locator('#scPassword').fill('password123')
 page.locator('#scConnect').click()
 page.wait_for_function('window.SATRIA_CLOUD_TRASH?.ready===true',timeout=12000)
 page.evaluate("location.hash='#paket/k1';route()")
 assert page.locator('[data-act="delpaket"]').count()==1
 page.locator('[data-act="delpaket"]').click()
 page.wait_for_function('__mockSatriaServer.trash.length===1 && S.paket.every(p=>p.id!=="k1")',timeout=12000)
 assert page.evaluate('S.sampah.length')==0, 'Cloud archive must not modify local trash'
 page.evaluate("location.hash='#sampah';route()")
 page.wait_for_function('window.SATRIA_CLOUD_TRASH?.loaded===true && window.SATRIA_CLOUD_TRASH.items.length===1')
 assert page.locator('.satria-trash-page [data-act="trashrestore"]').count()==1
 page.screenshot(path='/mnt/data/SATRIA_NEXT_TAHAP2_SAMPAH_CLOUD_UJI.png',full_page=False)
 page.locator('.satria-trash-page [data-act="trashrestore"]').click()
 page.wait_for_function('__mockSatriaServer.trash[0].restored_at && S.paket.some(p=>p.id==="k1")',timeout=12000)
 assert page.evaluate('window.SATRIA_CLOUD_TRASH.items.length')==0
 # Server denial must not result in optimistic local removal.
 page.evaluate("__mockSatriaServer.denied=true; location.hash='#paket/k1';route()")
 page.locator('[data-act="delpaket"]').click()
 page.wait_for_timeout(600)
 assert page.evaluate('S.paket.some(p=>p.id==="k1")')
 assert len(page.evaluate('__mockSatriaServer.trash'))==1
 # Viewer can read the scoped trash but cannot invoke a destructive cloud RPC.
 page.evaluate('__mockSatriaServer.denied=false; __mockSatriaServer.role="viewer"')
 page.locator('#satriaCloudOpen').click()
 page.locator('#scSignOut').click()
 page.wait_for_function('window.SATRIA_CLOUD_TRASH?.ready===false')
 page.locator('#scEmail').fill('viewer@example.org')
 page.locator('#scPassword').fill('password123')
 page.locator('#scConnect').click()
 page.wait_for_function('window.SATRIA_CLOUD_TRASH?.ready===true && window.SATRIA_CLOUD_ROLE==="viewer"',timeout=12000)
 page.evaluate("location.hash='#paket/k1';route()")
 assert page.locator('[data-act="delpaket"]').is_disabled()
 result=page.evaluate("window.SATRIA_CLOUD_TRASH.archive('paket','k1').then(()=>false,e=>String(e.message).includes('Viewer'))")
 assert result is True
 assert page.evaluate('S.paket.some(p=>p.id==="k1")')
 assert not errs,errs
 assert not missing,missing
 print('PASS mock browser: cloud archive/list/restore, RPC denial fail-closed, Viewer read-only; real Supabase NOT tested')
 browser.close()
