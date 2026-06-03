#!/usr/bin/env python3
"""Encrypt strategy-insight HTML files for the BNK Capital site.

Usage:
  python tools/encrypt.py <path.html> [...]      # encrypt specific files
  python tools/encrypt.py --all                  # encrypt every plaintext file under data/
  python tools/encrypt.py --check                # list encrypted vs plaintext files

Environment:
  INSIGHT_PASSWORD   password to derive key (default: 0714)
"""
import argparse
import base64
import json
import os
import pathlib
import secrets
import sys

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
except ImportError:
    print('cryptography package not installed. Run: pip install cryptography', file=sys.stderr)
    sys.exit(1)

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / 'tools' / 'auth-config.json').read_text(encoding='utf-8'))
PASSWORD = os.environ.get('INSIGHT_PASSWORD', '0714')


def derive_key() -> bytes:
    salt = base64.b64decode(CONFIG['saltB64'])
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=CONFIG['keyLen'] // 8,
        salt=salt,
        iterations=CONFIG['iter'],
    )
    return kdf.derive(PASSWORD.encode('utf-8'))


def is_encrypted(text: str) -> bool:
    s = text.lstrip()
    if not s.startswith('{'):
        return False
    try:
        obj = json.loads(s)
    except Exception:
        return False
    return isinstance(obj, dict) and 'iv' in obj and 'ct' in obj and 'v' in obj


def encrypt_file(path: pathlib.Path, key: bytes) -> bool:
    text = path.read_text(encoding='utf-8')
    if is_encrypted(text):
        return False
    iv = secrets.token_bytes(12)
    aes = AESGCM(key)
    ct = aes.encrypt(iv, text.encode('utf-8'), None)
    blob = {
        'v': 1,
        'iv': base64.b64encode(iv).decode('ascii'),
        'ct': base64.b64encode(ct).decode('ascii'),
    }
    path.write_text(json.dumps(blob, separators=(',', ':')), encoding='utf-8')
    return True


def collect_all() -> list:
    return sorted((ROOT / 'data').rglob('*.html'))


def relative_or_abs(p: pathlib.Path) -> str:
    try:
        return str(p.resolve().relative_to(ROOT))
    except ValueError:
        return str(p)


def main():
    p = argparse.ArgumentParser(description='Encrypt strategy-insight HTML files.')
    p.add_argument('paths', nargs='*', help='specific files to encrypt')
    p.add_argument('--all', action='store_true', help='encrypt every plaintext file under data/')
    p.add_argument('--check', action='store_true', help='list status without modifying anything')
    args = p.parse_args()

    if args.check:
        for f in collect_all():
            tag = '[ENC]  ' if is_encrypted(f.read_text(encoding='utf-8')) else '[PLAIN]'
            print(f'{tag} {relative_or_abs(f)}')
        return

    if args.all:
        targets = collect_all()
    elif args.paths:
        targets = [pathlib.Path(x) for x in args.paths]
    else:
        p.error('no files specified (use --all or pass paths)')

    key = derive_key()
    changed = 0
    for f in targets:
        if not f.exists():
            print(f'skip (missing): {relative_or_abs(f)}')
            continue
        if encrypt_file(f, key):
            print(f'encrypted: {relative_or_abs(f)}')
            changed += 1
        else:
            print(f'skip (already encrypted): {relative_or_abs(f)}')
    print(f'\n{changed} file(s) encrypted')


if __name__ == '__main__':
    main()
