"""Smoke UI SATRIA: role PPKom dan pemilihan satu OPD di browser, tanpa koneksi cloud."""
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1200, 'height': 800})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def intercept(route):
        url = urlparse(route.request.url)
        if url.hostname in ('cdnjs.cloudflare.com', 'cdn.jsdelivr.net'):
            route.fulfill(status=200, body='', content_type='text/javascript')
            return
        if url.hostname in ('fonts.googleapis.com', 'fonts.gstatic.com', 'd3js.org'):
            route.fulfill(status=200, body='', content_type='text/css')
            return
        path = (ROOT / url.path.lstrip('/')).resolve()
        if path.is_file() and ROOT.resolve() in path.parents:
            route.fulfill(status=200, body=path.read_bytes(), content_type='text/javascript' if path.suffix == '.js' else 'text/css' if path.suffix == '.css' else 'text/plain')
            return
        route.fulfill(status=404, body='not found')
    page.route('**/*', intercept)
    html = (ROOT / 'index.html').read_text().replace('<head>', '<head><base href="https://satria.local/">', 1)
    page.set_content(html, wait_until='domcontentloaded', timeout=45000)
    page.wait_for_timeout(200)
    assert page.locator('#satriaCreateUserModal').count() == 1, 'Form akun tidak terpasang'
    assert page.locator('#satriaNewUserRole option[value=ppkom]').count() == 1, 'Role PPKom tidak ditemukan'
    assert page.locator('#satriaNewUserRole option[value=operator]').count() == 1, 'Operator lama harus tetap ada'
    result = page.evaluate('''() => {
      const role = document.getElementById('satriaNewUserRole');
      const choice = document.getElementById('satriaCreateUserOpdChoices');
      choice.innerHTML = '<label><input type="checkbox" name="satria_create_opd_ids" value="bapperida"></label><label><input type="checkbox" name="satria_create_opd_ids" value="disporapar"></label>';
      const options = [...choice.querySelectorAll('input')];
      role.value = 'operator'; role.dispatchEvent(new Event('change',{bubbles:true}));
      options[0].checked = true; options[0].dispatchEvent(new Event('change',{bubbles:true}));
      options[1].checked = true; options[1].dispatchEvent(new Event('change',{bubbles:true}));
      const operatorCount = options.filter(x => x.checked).length;
      role.value = 'ppkom'; role.dispatchEvent(new Event('change',{bubbles:true}));
      const ppkomCount = options.filter(x => x.checked).length;
      options[0].checked = true; options[0].dispatchEvent(new Event('change',{bubbles:true}));
      return {operatorCount, ppkomCount, afterChange:options.filter(x=>x.checked).map(x=>x.value)};
    }''')
    assert result == {'operatorCount': 2, 'ppkomCount': 1, 'afterChange': ['bapperida']}, result
    visibility = page.evaluate("""() => {
      window.SATRIA_CLOUD_CONFIGURED = true;
      window.SATRIA_CLOUD_ROLE = 'operator';
      window.SATRIA_CLOUD_MEMBER = {role:'operator',account_type:'ppkom'};
      S.users = [{id:'auth-test', nama:'PPKom Bapperida',role:'Operator',opd:['bapperida'],years:[2026],aktif:true}];
      S.ui.user='auth-test'; S.ui.tahun=2026; S.ui.opd='all';
      S.paket=[{id:'pb26',opd:'bapperida',tahun:2026}, {id:'pd26',opd:'disporapar',tahun:2026}, {id:'pb25',opd:'bapperida',tahun:2025}];
      S.rupBank=[{id:'rb26',opd:'bapperida',tahun:2026}, {id:'rd26',opd:'disporapar',tahun:2026}, {id:'rb25',opd:'bapperida',tahun:2025}];
      return {paket:satriaOpsVisiblePaket().map(p=>p.id),rup:satriaOpsVisibleRup().map(p=>p.id),role:cur().role};
    }""")
    assert visibility == {'paket':['pb26'], 'rup':['rb26'], 'role':'Operator'}, visibility
    assert not errors, errors
    print('PASS Chromium: pilihan PPKom, 1 OPD, batas tampilan paket/RUP tahun/OPD, Operator lama tetap berjalan')
    browser.close()
