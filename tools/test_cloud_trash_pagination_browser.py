"""Browser QA for paginated cloud trash with synthetic data, not real Supabase."""
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'tools/test_cloud_trash_stage2_browser.py').read_text(encoding='utf-8')
INJECT=source.split('INJECT=r"""',1)[1].split('"""',1)[0]
with sync_playwright() as w:
    browser=w.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':410,'height':820})
    page.set_default_timeout(5500)
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    def serve(route):
        url=urlparse(route.request.url)
        if url.hostname in ('cdnjs.cloudflare.com','cdn.jsdelivr.net','d3js.org','fonts.googleapis.com','fonts.gstatic.com'):
            route.fulfill(status=200,body='',content_type='text/javascript');return
        target=(ROOT/url.path.lstrip('/')).resolve()
        if target.is_file() and ROOT.resolve() in target.parents:
            ct='text/javascript' if target.suffix=='.js' else 'text/css' if target.suffix=='.css' else 'text/html'
            route.fulfill(status=200,body=target.read_bytes(),content_type=ct);return
        route.fulfill(status=404,body='missing')
    page.route('**/*',serve)
    html=(ROOT/'index.html').read_text(encoding='utf-8').replace('<head>','<head><base href="https://satria.local/"><script>'+INJECT+'</script>',1)
    page.set_content(html,wait_until='domcontentloaded')
    page.wait_for_timeout(500)
    page.evaluate('''() => {
      __mockSatriaServer.payload=JSON.parse(JSON.stringify(SEED));
      __mockSatriaServer.payload.rupBank=[];
      __mockSatriaServer.payload.sampah=[];
      __mockSatriaServer.trash=Array.from({length:122},(_,i)=>({
        id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
        collection:'paket', record_id:'archived-pkg-'+i,
        record:{id:'archived-pkg-'+i,nama:'Paket lama '+i,opd:'o1',tahun:2026},
        deleted_at:new Date(Date.now()-i*60_000).toISOString(),deleted_by:'fixture'
      }));
      S.ui.user=(S.users.find(x=>x.role==='Admin')||S.users[0]).id;
    }''')
    page.locator('#scEmail').fill('mock@example.org')
    page.locator('#scPassword').fill('password123')
    page.locator('#scConnect').click()
    page.wait_for_function('window.SATRIA_CLOUD_TRASH?.ready===true',timeout=12000)
    page.evaluate("location.hash='#sampah';route()")
    page.wait_for_function('SATRIA_CLOUD_TRASH.loaded===true && SATRIA_CLOUD_TRASH.items.length===50',timeout=12000)
    assert page.locator('.satria-trash-page [data-act="trashmore"]').count()>=1
    page.locator('.satria-trash-page [data-act="trashmore"]').first.click()
    page.wait_for_function('SATRIA_CLOUD_TRASH.items.length===100 && !SATRIA_CLOUD_TRASH.loading && document.querySelectorAll(".satria-trash-page [data-act=trashrestore]").length===100',timeout=12000)
    # Verify the next page through the exposed controller API. The first page is
    # exercised via an actual browser click above; this avoids scroll re-render
    # races in the large synthetic 100-row DOM fixture.
    page.evaluate('SATRIA_CLOUD_TRASH.loadMore()')
    page.wait_for_function('SATRIA_CLOUD_TRASH.items.length===122 && !SATRIA_CLOUD_TRASH.hasMore && !SATRIA_CLOUD_TRASH.loading',timeout=12000)
    assert page.locator('.satria-trash-page [data-act="trashmore"]').count()==0
    assert page.locator('.satria-trash-page [data-act="trashrestore"]').count()==122
    assert page.evaluate('new Set(SATRIA_CLOUD_TRASH.items.map(r=>r.id)).size')==122
    # Refresh returns to first page, and does not modify cloud data.
    page.locator('.satria-trash-page [data-act="trashrefresh"]').click()
    page.wait_for_function('SATRIA_CLOUD_TRASH.loaded && SATRIA_CLOUD_TRASH.items.length===50 && SATRIA_CLOUD_TRASH.hasMore',timeout=12000)
    assert page.evaluate('__mockSatriaServer.trash.length')==122
    assert not errors,errors
    print('PASS mock browser: 122 cloud trash archives across 3 pages, refresh, mobile UI, no mutation; PostgreSQL NOT tested')
    browser.close()
