#!/usr/bin/env python3
"""SATRIA release evidence summary: fail closed, never contacts a live database.

A successful local QA is a *staging candidate*, not proof that RLS, atomic
transactions or backups work in a real Supabase deployment. Evidence can be
attached as SHA256 only; this command will never auto-certify production.
"""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

EVIDENCE = {
    'scoped_api': 'API dan RLS Admin/Operator/Viewer dengan fixture lintas OPD/tahun',
    'rls_sql': 'RLS/grant katalog pada database Supabase staging sebenarnya',
    'archive_restore': 'Hapus–pulihkan positif melalui transaksi DB pada dua perangkat',
    'version_conflict': 'Konflik versi, rollback, dan penolakan perubahan tidak sah',
    'backup_restore': 'Pemulihan backup pada proyek staging terpisah, termasuk data terkait',
}


def report(quality, evidence):
    qa = quality or {}
    checks = qa.get('checks', [])
    valid_checks = isinstance(checks, list) and bool(checks) and all(
        isinstance(item, dict) and item.get('passed') is True for item in checks)
    local_pass = (valid_checks and qa.get('failed') == 0
                  and qa.get('total') == len(checks)
                  and qa.get('passed') == len(checks))
    details = {}
    for key, description in EVIDENCE.items():
        filename = evidence.get(key)
        attached = bool(filename and filename.is_file() and filename.stat().st_size > 0)
        details[key] = {
            'description': description,
            'status': 'bukti_terlampir_perlu_diperiksa' if attached else 'belum_diuji_di_staging',
            'sha256': hashlib.sha256(filename.read_bytes()).hexdigest() if attached else None,
        }
    return {
        'name': 'SATRIA readiness – stability & staging',
        'time_utc': datetime.now(timezone.utc).isoformat(),
        'local_qa': {'passed': bool(local_pass), 'checks_passed': qa.get('passed', 0),
                     'checks_total': qa.get('total', 0)},
        'staging': details,
        'candidate_for_staging': bool(local_pass),
        'production_ready': False,
        'release_decision': 'STAGING_REQUIRED' if local_pass else 'LOCAL_QA_FAILED',
        'note': ('Lampiran bukti belum diverifikasi keasliannya secara otomatis. '
                 'Jangan menjadikan JSON ini bukti bahwa migrasi, RLS atau restore sudah lulus.'),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--quality-report', required=True, type=Path)
    parser.add_argument('--out', type=Path)
    for key in EVIDENCE:
        parser.add_argument('--' + key.replace('_', '-'), type=Path)
    args = parser.parse_args()
    try:
        quality = json.loads(args.quality_report.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        quality = {}
        print('Laporan QA belum tersedia atau tidak valid:', type(exc).__name__, file=sys.stderr)
    evidence = {key: getattr(args, key) for key in EVIDENCE}
    result = report(quality, evidence)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"{result['release_decision']}: local QA {result['local_qa']['checks_passed']}/{result['local_qa']['checks_total']}; "
          'produksi BELUM diverifikasi')
    return 0 if result['candidate_for_staging'] else 1


if __name__ == '__main__':
    sys.exit(main())
