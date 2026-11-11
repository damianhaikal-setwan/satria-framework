#!/usr/bin/env python3
"""Browser mock contract for nested cloud recycle. Mock is NOT a substitute for PostgreSQL/RLS."""
from pathlib import Path
from urllib.parse import urlparse
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
base=(ROOT/'tools/test_cloud_trash_stage2_browser.py').read_text()
INJECT=base.split('INJECT=r"""',1)[1].split('"""',1)[0]
INJECT=INJECT.replace('trash:[],denied:', 'trash:[],nested:[],denied:')
needle="      if(table==='satria_trash_entries')return {data:server.trash.filter(t=>!t.restored_at).map(t=>({"
assert needle in INJECT
addon="""      if(table==='satria_nested_trash_entries')return {data:server.nested.filter(t=>!t.restored_at).map(t=>({
        id:t.id,collection:t.collection,record_id:t.record_id,record_summary:t.summary,
        deleted_at:t.deleted_at,deleted_by:'mock',opd_id:t.opd||null,fiscal_year:t.year||null,retain_until:'2027-11-11'
      })),error:null};
"""
INJECT=INJECT.replace(needle,addon+needle)
needle="   if(name==='satria_archive_record'){"
assert needle in INJECT
rpc="""   if(name==='satria_archive_nested'){
     if(server.denied)return {data:null,error:{message:'Permission denied'} };
     if(args.p_expected_version!==server.version)return {data:null,error:{message:'Version conflict'}};
     if(args.p_collection!=='penawaran')return {data:null,error:{message:'Unsupported mock collection'}};
     const p=server.payload.paket.find(x=>x.id===args.p_parent_id);
     if(!p)return {data:null,error:{message:'Parent missing'}};
     const idx=(p.penawaran||[]).findIndex(w=>w.id===args.p_record_id);
     if(idx<0)return {data:null,error:{message:'Offer missing'}};
     const wasWinner=p.pemenangId===args.p_record_id;const offer=p.penawaran.splice(idx,1)[0];if(wasWinner)p.pemenangId=null;
     const id='11111111-0000-4000-8000-'+String(server.nested.length+1).padStart(12,'0');
     server.nested.push({id,collection:'penawaran',record_id:offer.id,summary:'Penawaran '+offer.id,
       parent_id:p.id,record:{paketId:p.id,offer,wasWinner},opd:p.opd,year:p.tahun,deleted_at:new Date().toISOString()});
     return {data:{trash_id:id,status:'archived',version:++server.version},error:null};
   }
   if(name==='satria_restore_nested'){
     if(server.denied)return {data:null,error:{message:'Permission denied'}};
     if(args.p_expected_version!==server.version)return {data:null,error:{message:'Version conflict'}};
     const t=server.nested.find(x=>x.id===args.p_trash_id&&!x.restored_at);
     if(!t)return {data:null,error:{message:'Nested trash missing'}};
     const p=server.payload.paket.find(x=>x.id===t.parent_id);
     if(!p)return {data:null,error:{message:'Parent missing'}};
     if(p.penawaran.some(w=>w.id===t.record_id))return {data:null,error:{message:'Duplicate offer'}};
     if(t.record.wasWinner&&p.pemenangId)return {data:null,error:{message:'Existing winner conflict'}};
     p.penawaran.push(JSON.parse(JSON.stringify(t.record.offer)));
     if(t.record.wasWinner)p.pemenangId=t.record.offer.id;
     t.restored_at=new Date().toISOString();
     return {data:{trash_id:t.id,status:'restored',version:++server.version},error:null};
   }
"""
INJECT=INJECT.replace(needle,rpc+needle)
errors=[]
with sync_playwright() as w:
 browser=w.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844})
 page.on('dialog',lambda d:d.accept())
 page.on('pageerror',lambda e:errors.append(str(e)))
 def serve(route):
  url=urlparse(route.request.url)
  if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net'):
   route.fulfill(status=200,body='',content_type='text/javascript');return
  if url.hostname in ('fonts.googleapis.com','fonts.gstatic.com'):
   route.fulfill(status=200,body='',content_type='text/css');return
  f=(ROOT/url.path.lstrip('/')).resolve()
  if f.is_file() and ROOT in f.parents:
   route.fulfill(status=200,body=f.read_bytes(),content_type='text/javascript' if f.suffix=='.js' else 'text/css' if f.suffix=='.css' else 'text/html' if f.suffix=='.html' else 'text/plain')
  else:route.fulfill(status=404,body='not found')
 page.route('**/*',serve)
 html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://satria.local/"><script>'+INJECT+'</script>',1)
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_timeout(450)
 page.evaluate("""() => {
  __mockSatriaServer.payload=JSON.parse(JSON.stringify(SEED));
  __mockSatriaServer.payload.rupBank=[];
  __mockSatriaServer.payload.paket[0].penawaran=[{id:'offer-nested-1',pen:'y1',harga:{},nego:{}}];
  __mockSatriaServer.payload.paket[0].pemenangId='offer-nested-1';
  __mockSatriaServer.payload.sampah=[];
 }""")
 page.locator('#scEmail').fill('mock@example.org')
 page.locator('#scPassword').fill('password123')
 page.locator('#scConnect').click()
 page.wait_for_function('window.SATRIA_CLOUD_TRASH?.ready===true',timeout=12000)
 assert page.evaluate("S.paket[0].penawaran.length") == 1
 # Failed server transaction MUST leave both active data and old trash unchanged.
 denied=page.evaluate("""async () => {
  __mockSatriaServer.denied=true;
  let rejected=false;try{await SATRIA_CLOUD_TRASH.archiveNested('penawaran','k1','offer-nested-1');}catch(_){rejected=true}
  __mockSatriaServer.denied=false;
  return {rejected,active:S.paket[0].penawaran.length,remote:__mockSatriaServer.payload.paket[0].penawaran.length,trash:__mockSatriaServer.nested.length};
 }""")
 assert denied=={'rejected':True,'active':1,'remote':1,'trash':0},denied
 result=page.evaluate("SATRIA_CLOUD_TRASH.archiveNested('penawaran','k1','offer-nested-1')")
 assert result['status']=='archived',result
 assert page.evaluate('S.paket[0].penawaran.length')==0
 assert page.evaluate('S.paket[0].pemenangId') is None
 assert page.evaluate('SATRIA_CLOUD_TRASH.items.filter(x=>x.nested).length')==1
 trash_id=page.evaluate('SATRIA_CLOUD_TRASH.items.find(x=>x.nested).id')
 restore=page.evaluate('(id)=>SATRIA_CLOUD_TRASH.restore(id)',trash_id)
 assert restore['status']=='restored',restore
 assert page.evaluate('S.paket[0].penawaran.length')==1
 assert page.evaluate('S.paket[0].pemenangId')=='offer-nested-1'
 assert page.evaluate('SATRIA_CLOUD_TRASH.items.filter(x=>x.nested).length')==0
 page.evaluate("location.hash='#sampah';route()")
 assert page.locator('.satria-trash-page').count()==1
 # P3: read-only storage-capacity diagnosis in the Care Center; no business data read.
 page.evaluate("location.hash='#care';route()")
 assert page.locator('[data-care-action="storage"]').count()==1
 page.evaluate("document.querySelector('[data-care-action=storage]').click()")
 page.wait_for_timeout(250)
 assert page.locator('#satriaCareStorageInfo').is_visible()
 assert not errors,errors
 print('PASS P1/P3 browser mock: nested penawaran and winner-status restore, denied RPC fail-closed, mobile Care diagnostics; PostgreSQL NOT tested')
 browser.close()
