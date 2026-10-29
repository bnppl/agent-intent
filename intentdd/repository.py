"""Read exact Git trees without executing repository code."""
import hashlib
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


class IntentError(ValueError):
    pass


def safe_path(value):
    if (not isinstance(value, str) or not value or '\\' in value or '\0' in value
            or value.startswith('/') or any(p in ('', '.', '..', '.git') for p in value.split('/'))):
        raise IntentError('Expected a safe repository-relative path')
    return value


@dataclass(frozen=True)
class Blob:
    mode: str
    data: bytes

    @property
    def digest(self):
        return hashlib.sha256(self.mode.encode() + b'\0' + self.data).hexdigest()


class Repository:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root = Path(self.git('rev-parse', '--show-toplevel').decode().strip())

    def git(self, *args, ok=False):
        result = subprocess.run(['git', '-C', str(self.root), *args], capture_output=True)
        if result.returncode and not ok:
            raise IntentError(result.stderr.decode(errors='replace').strip() or 'Git operation failed')
        return result.stdout

    @property
    def head(self):
        return self.git('rev-parse', '--verify', 'HEAD', ok=True).decode().strip() or 'UNBORN'

    @property
    def state_dir(self):
        path = self.git('rev-parse', '--git-path', 'intent-dd').decode().strip()
        return (self.root / path).resolve() if not Path(path).is_absolute() else Path(path)

    def snapshot(self, ref):
        result = {}
        if ref == 'HEAD':
            if self.head == 'UNBORN':
                return result
            entries = self.git('ls-tree', '-r', '-z', 'HEAD').split(b'\0')
            for entry in entries:
                if not entry:
                    continue
                meta, raw_path = entry.split(b'\t', 1)
                mode, kind, oid = meta.decode().split()
                path = safe_path(raw_path.decode('utf-8'))
                result[path] = Blob(mode, self.git('cat-file', 'blob', oid) if kind == 'blob' else oid.encode())
        elif ref == 'INDEX':
            entries = self.git('ls-files', '--stage', '-z').split(b'\0')
            for entry in entries:
                if not entry:
                    continue
                meta, raw_path = entry.split(b'\t', 1)
                mode, oid, stage = meta.decode().split()
                if stage != '0':
                    raise IntentError('Resolve all merge conflicts before reviewing intent')
                path = safe_path(raw_path.decode('utf-8'))
                result[path] = Blob(mode, self.git('cat-file', 'blob', oid) if mode != '160000' else oid.encode())
        elif ref == 'WORKTREE':
            paths = self.git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split(b'\0')
            for raw in set(paths):
                if not raw:
                    continue
                path = safe_path(raw.decode('utf-8'))
                full = self.root / path
                if any(p.is_symlink() for p in full.parents if p != self.root and self.root in p.parents):
                    raise IntentError('Symlinked parent directory: ' + path)
                if full.is_symlink():
                    result[path] = Blob('120000', os.readlink(full).encode())
                elif full.is_file():
                    result[path] = Blob('100755' if full.stat().st_mode & 0o111 else '100644', full.read_bytes())
        else:
            raise IntentError('Unknown snapshot')
        return result

    def revision(self):
        # write-tree refuses unmerged index entries and ignores unstaged source.
        return {'head': self.head, 'tree': self.git('write-tree').decode().strip()}

    def diff(self):
        return self.git('diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames').decode(errors='replace')


def under(path, roots):
    return any(path == root or path.startswith(root + '/') for root in roots)
