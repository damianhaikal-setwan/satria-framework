"""Compatibility source reader for tests written before index modularization.

Use this only for offline tests, not production rendering.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
def read_index():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=html.replace('<script src="./frontend/satria-procurement-core.js"></script>', '<script>'+(ROOT/'frontend/satria-procurement-core.js').read_text(encoding='utf-8')+'</script>')
    html=html.replace('<script src="./frontend/refactor/js/00-core-guards.js"></script>', '<script>'+(ROOT/'frontend/refactor/js/00-core-guards.js').read_text(encoding='utf-8')+'</script>')
    for filename in ('satria-document-templates.js', 'satria-view-performance.js', 'satria-cloud-delta.js', 'satria-cloud-admin-create.js', 'satria-cloud-admin-roster.js'):
        html=html.replace('<script src="./frontend/'+filename+'"></script>', '<script>'+(ROOT/'frontend'/filename).read_text(encoding='utf-8')+'</script>')
    for filename in ('satria-shared-modal-ui.css','satria-stage4-ux.css'):
        html=html.replace('<link rel="stylesheet" href="./frontend/'+filename+'">', '<style>'+(ROOT/'frontend'/filename).read_text(encoding='utf-8')+'</style>')
    def js(match):
        attrs,src=match.groups()
        return '<script'+attrs+'>'+(ROOT/src[2:]).read_text(encoding='utf-8')+'</script>'
    def css(match):
        src=match.group(1)
        return '<style>'+(ROOT/src[2:]).read_text(encoding='utf-8')+'</style>'
    html=re.sub(r'<script([^>]*?)\s+src="(\./frontend/refactor/js/[^"<>]+\.js)"\s+data-satria-refactor="script"></script>',js,html)
    html=re.sub(r'<link rel="stylesheet" href="(\./frontend/refactor/css/[^"<>]+\.css)" data-satria-refactor="style">',css,html)
    return html
