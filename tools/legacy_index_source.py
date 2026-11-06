"""Compatibility source reader for tests written before index modularization.

Use this only for offline tests, not production rendering.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
def read_index():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    def js(match):
        attrs,src=match.groups()
        return '<script'+attrs+'>'+(ROOT/src[2:]).read_text(encoding='utf-8')+'</script>'
    def css(match):
        src=match.group(1)
        return '<style>'+(ROOT/src[2:]).read_text(encoding='utf-8')+'</style>'
    html=re.sub(r'<script([^>]*?)\s+src="(\./frontend/refactor/js/[^"<>]+\.js)"\s+data-satria-refactor="script"></script>',js,html)
    html=re.sub(r'<link rel="stylesheet" href="(\./frontend/refactor/css/[^"<>]+\.css)" data-satria-refactor="style">',css,html)
    return html
