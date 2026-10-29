#!/usr/bin/env python3
"""Detect changes to whole-file intent artifacts against a TRUSTED base policy.
Run this checker and policy from trusted CI, not unreviewed candidate source.
This detects changes; repository rules must authenticate and require human review.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath


def check(policy, root):
    if not isinstance(policy, dict) or policy.get('schemaVersion') != 1:
        raise ValueError('Unsupported policy schema')
    files = policy.get('protectedFiles')
    if not isinstance(files, list):
        raise ValueError('protectedFiles must be a list')
    failures, seen = [], set()
    for entry in files:
        if not isinstance(entry, dict):
            raise ValueError('Invalid policy entry')
        name, expected = entry.get('path'), entry.get('sha256')
        if (not isinstance(name, str) or not name or name.startswith('/')
                or any(x in ('', '.', '..') for x in name.split('/'))
                or re.search(r'[\\\x00-\x1f:*?"<>|]', name)
                or name.startswith('.git/')):
            raise ValueError('Unsafe protected path')
        if name in seen:
            raise ValueError('Duplicate protected path: ' + name)
        seen.add(name)
        if not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected):
            raise ValueError('Invalid SHA-256 for ' + name)
        target = root.joinpath(*PurePosixPath(name).parts)
        chain = [target, *target.parents]
        if any(p.is_symlink() for p in chain if p != root and root in p.parents):
            failures.append(name + ': symlink requires review')
        elif not target.is_file():
            failures.append(name + ': missing, deleted, or renamed')
        else:
            try:
                actual = hashlib.sha256(target.read_bytes()).hexdigest()
                if actual != expected:
                    failures.append(name + ': content changed')
            except OSError:
                failures.append(name + ': unreadable')
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--policy', required=True, type=Path, help='Trusted base-branch manifest')
    parser.add_argument('--root', default=Path('.'), type=Path, help='Candidate repository root')
    args = parser.parse_args()
    try:
        root = args.root.resolve(strict=True)
        if not root.is_dir():
            raise ValueError('Root must be a directory')
        policy = json.loads(args.policy.read_text(encoding='utf-8'))
        failures = check(policy, root)
    except (ValueError, OSError) as error:
        print('Intent check failed: ' + str(error), file=sys.stderr)
        return 2
    if failures:
        print('HUMAN REVIEW REQUIRED', file=sys.stderr)
        for failure in failures:
            print(' - ' + failure, file=sys.stderr)
        print('Do not regenerate the baseline to bypass this check. Use protected human review.', file=sys.stderr)
        return 1
    count = len(policy['protectedFiles'])
    print(f'Intent baseline unchanged: {count} protected files. Tests were not executed.')
    if count == 0:
        print('No protected files are configured.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
