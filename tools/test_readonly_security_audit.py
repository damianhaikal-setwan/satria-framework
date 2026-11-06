#!/usr/bin/env python3
"""Static safety check of supplied SQL, not a remote Supabase test."""
from pathlib import Path
import re
p=Path(__file__).resolve().parents[1]/'supabase/SATRIA-READONLY-SECURITY-CHECK-20261106.sql'
s=p.read_text()
assert all(name in s for name in ['satria_memberships','satria_state','satria_membership_opds','satria_membership_years','satria_apply_state_delta'])
without_comments='\n'.join(line.split('--')[0] for line in s.splitlines())
without_comments=re.sub(r"'([^']|'')*'", "''", without_comments)
assert not re.search(r'\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|call|do)\b',without_comments,re.I), 'Audit SQL must be read-only'
assert without_comments.lower().count('select ')>=3
print('PASS P2: skrip audit katalog SQL read-only, tanpa DDL/DML')
