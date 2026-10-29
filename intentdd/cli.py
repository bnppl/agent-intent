"""Command line entry points. Human approval is only exposed in the local review view."""
import argparse
import json
import os
from pathlib import Path
import sys
from .repository import Repository, IntentError

HOOK_MARKER = '# Intent DD trusted HEAD loader v1'


def install_hook(repo):
    custom = repo.git('config', '--get', 'core.hooksPath', ok=True).decode().strip()
    if custom:
        raise IntentError('core.hooksPath is already configured. Integrate the trusted loader with that hook manager explicitly; existing configuration was preserved.')
    entries = repo.git('ls-tree', '-r', '--name-only', 'HEAD', '--', 'intentdd').decode().splitlines()
    if 'intentdd/cli.py' not in entries:
        raise IntentError('Commit the Intent DD installation first, then install the hook. The hook must load a trusted committed version.')
    raw = repo.git('rev-parse', '--git-path', 'hooks/pre-commit').decode().strip()
    hook = Path(raw) if Path(raw).is_absolute() else repo.root / raw
    if hook.exists() and HOOK_MARKER not in hook.read_text(errors='replace'):
        raise IntentError('An existing pre-commit hook was preserved. Chain the Intent DD trusted loader explicitly.')
    # This loader is installed outside tracked source and imports ONLY HEAD's verifier.
    code = r'''from pathlib import Path
import subprocess
import sys
import tempfile

def git(*args):
    result = subprocess.run(['git', *args], capture_output=True, check=True)
    return result.stdout

try:
    root = git('rev-parse', '--show-toplevel').decode().strip()
    entries = git('ls-tree', '-r', '-z', 'HEAD', '--', 'intentdd').split(b'\0')
    with tempfile.TemporaryDirectory(prefix='intent-dd-trusted-') as temp:
        for entry in entries:
            if not entry:
                continue
            meta, path = entry.split(b'\t', 1)
            mode, kind, oid = meta.decode().split()
            name = path.decode('utf-8')
            if not name.endswith('.py'):
                continue
            if mode not in ('100644', '100755') or kind != 'blob' or '..' in name.split('/'):
                raise RuntimeError('Invalid trusted verifier tree')
            destination = Path(temp) / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(git('cat-file', 'blob', oid))
        sys.path.insert(0, temp)
        from intentdd.cli import main
        raise SystemExit(main(['--repo', root, 'verify']))
except (OSError, subprocess.SubprocessError, ImportError, RuntimeError) as error:
    print('Intent DD hook failed closed: ' + str(error), file=sys.stderr)
    raise SystemExit(1)
'''
    hook.parent.mkdir(parents=True, exist_ok=True)
    # Preserve the virtualenv interpreter path; resolving its symlink loses dependencies.
    interpreter = os.path.abspath(sys.executable)
    if ' ' in interpreter:
        raise IntentError('Install from a Python environment whose interpreter path has no spaces')
    hook.write_text('#!' + interpreter + ' -I\n' + HOOK_MARKER + '\n' + code)
    hook.chmod(0o755)
    return hook


def main(argv=None):
    parser = argparse.ArgumentParser(description='Intent DD local Gherkin workbench')
    parser.add_argument('--repo', default='.', help='Path within the target Git repository')
    sub = parser.add_subparsers(dest='command', required=True)
    server = sub.add_parser('serve', help='Start the loopback annotation and human review UI')
    server.add_argument('--port', type=int, default=8765)
    sub.add_parser('verify', help='Verify the staged revision against HEAD')
    sub.add_parser('status', help='Show the deterministic staged review report')
    sub.add_parser('install-hook', help='Install a trusted-HEAD pre-commit loader')
    sub.add_parser('spec', help='Render this repository’s accepted Gherkin intent as an agent prompt')
    args = parser.parse_args(argv)
    try:
        repo = Repository(args.repo)
        if args.command == 'serve':
            from .server import serve
            serve(repo.root, args.port)
        elif args.command == 'install-hook':
            print('Installed pre-commit hook: ' + str(install_hook(repo)))
        elif args.command in ('verify', 'status'):
            from .verification import verify, report
            result = verify(repo) if args.command == 'verify' else report(repo)
            if args.command == 'status':
                print(json.dumps(result, indent=2))
            else:
                print('Intent DD: staged revision is explicitly approved.' if result['requiresApproval'] else 'Intent DD: no protected changes in the index.')
        elif args.command == 'spec':
            from .verification import config, protected
            snap = repo.snapshot('HEAD')
            cfg = config(snap)
            _, paths, _ = protected(snap, cfg)
            print('# Repository intent\n\nRead this executable contract before implementing. Change intent only through explicit human review.\n')
            print('Glue boundary: ' + ', '.join(cfg['glue_roots']) + '\n')
            for path in sorted(paths):
                print('## ' + path + '\n\n~~~~gherkin\n' + snap[path].data.decode('utf-8') + '\n~~~~\n')
            print('Run the acceptance suite. Observe failures before implementation. Never remove tags, skip steps, weaken assertions, or approve your own changes.\n')
        return 0
    except (IntentError, OSError, UnicodeError) as error:
        print('Intent DD: ' + str(error), file=sys.stderr)
        return 1
