#!/usr/bin/env python3
"""Deterministic static frontend build, preserving individual module source bytes.

No minification, bundling, API credentials, network access, or deletion of source files.
Run: python tools/build_frontend.py --output /tmp/satria-dist
"""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRA = ('sw.js', '_headers', '_redirects')


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.files = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'script':
            value = attrs.get('src', '')
        elif tag == 'link':
            value = attrs.get('href', '')
        else:
            return
        if value.startswith('./'):
            self.files.append(value.removeprefix('./').split('?', 1)[0].split('#', 1)[0])


def runtime_files():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    service_worker = (ROOT / 'sw.js').read_text(encoding='utf-8')
    match = re.search(r'const APP_ASSETS\s*=\s*\[([\s\S]*?)\];', service_worker)
    if not match:
        raise ValueError('PWA asset manifest missing')
    assets = re.findall(r'"([^"\\]+)"', match.group(1))
    if len(assets) != len(set(assets)):
        raise ValueError('Duplicate PWA entries')
    references = References()
    references.feed(html)
    precached = {value.removeprefix('./').rstrip('/') or 'index.html' for value in assets}
    required = set(references.files) | {'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'}
    if missing := required - precached:
        raise ValueError('Runtime references missing from PWA cache: ' + ', '.join(sorted(missing)))
    paths = precached | set(EXTRA)
    for name in paths:
        if not name or name.startswith('/') or '..' in Path(name).parts or '\\' in name:
            raise ValueError('Unsafe path: ' + name)
        if not (ROOT / name).is_file():
            raise FileNotFoundError(name)
    return sorted(paths)


def build(target):
    target = target.resolve()
    if target == ROOT or ROOT in target.parents:
        raise ValueError('Output folder must be outside the source repository')
    target.mkdir(parents=True, exist_ok=True)
    files = runtime_files()
    manifest = {}
    for filename in files:
        data = (ROOT / filename).read_bytes()
        destination = target / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        manifest[filename] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    (target / 'satria-build-manifest.json').write_text(
        json.dumps({'file_count': len(manifest), 'files': manifest}, ensure_ascii=False, sort_keys=True, indent=2) + '\n',
        encoding='utf-8')
    print(f'PASS: {len(manifest)} frontend files copied byte-for-byte to {target}')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    build(parser.parse_args().output)
