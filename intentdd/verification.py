"""Deterministic protection of specifications AND their configured glue boundary."""
import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path
from .repository import IntentError, under, safe_path
from .gherkin import scenarios

DEFAULT_CONFIG = {'version': 1, 'feature_roots': ['features'],
    'glue_roots': ['features/steps', 'features/support', 'features/environment.py'],
    'control_paths': ['intentdd', '.intentdd.json', '.agents', 'AGENTS.md', 'requirements.txt', 'requirements.lock',
                      'pyproject.toml', '.github', '.githooks']}
MANDATORY_CONTROLS = DEFAULT_CONFIG['control_paths']


def config(snapshot):
    blob = snapshot.get('.intentdd.json')
    if blob and blob.mode not in ('100644', '100755'):
        raise IntentError('Configuration must be a regular file')
    try:
        value = json.loads(blob.data) if blob else DEFAULT_CONFIG.copy()
        if value.get('version') != 1:
            raise IntentError('Unsupported configuration version')
        for field in ('feature_roots', 'glue_roots', 'control_paths'):
            if not isinstance(value.get(field), list) or (field != 'control_paths' and not value[field]):
                raise IntentError(field + ' must be a nonempty path list')
            for path in value[field]:
                safe_path(path)
    except (ValueError, TypeError, AttributeError) as error:
        raise IntentError('Invalid .intentdd.json: ' + str(error)) from error
    return value


def catalogue(snapshot, cfg):
    result = []
    for path, blob in sorted(snapshot.items()):
        if path.endswith('.feature') and under(path, cfg['feature_roots']):
            if blob.mode not in ('100644', '100755'):
                raise IntentError('Gherkin specifications must be regular files: ' + path)
            result.extend(scenarios(path, blob.data))
    return result


def protected(snapshot, cfg):
    cases = catalogue(snapshot, cfg)
    features = {s['path'] for s in cases if s['intent']}
    # Conservative, language-independent closure: the entire configured glue pool.
    # Includes shared steps, hooks, helper files, and new registrations.
    glue = {p for p in snapshot if under(p, cfg['glue_roots'])} if features else set()
    if features and not glue:
        raise IntentError('Intent exists but no glue files were found. Configure glue_roots; refusing an unprotected contract.')
    for p in glue:
        if snapshot[p].mode not in ('100644', '100755'):
            raise IntentError('Glue must be regular files, not symlinks/submodules: ' + p)
    return cases, features, glue


def report(repo):
    revision = repo.revision()
    base, candidate = repo.snapshot('HEAD'), repo.snapshot('INDEX')
    old_cfg, new_cfg = config(base), config(candidate)
    old_cases, old_features, old_glue = protected(base, old_cfg)
    new_cases, new_features, new_glue = protected(candidate, new_cfg)
    active = bool(old_features | new_features)
    roots = sorted(set(old_cfg['glue_roots'] + new_cfg['glue_roots']))
    # Apply the old roots to the candidate as well: removing config cannot hide additions.
    glue_scope = {p for p in set(base) | set(candidate) if active and under(p, roots)}
    controls = sorted(set(MANDATORY_CONTROLS + old_cfg['control_paths'] + new_cfg['control_paths']))
    control_scope = {p for p in set(base) | set(candidate) if under(p, controls)}
    feature_scope = old_features | new_features
    scope = feature_scope | glue_scope | control_scope
    changes = []
    for p in sorted(scope):
        before, after = base.get(p), candidate.get(p)
        if before == after:
            continue
        category = 'specification' if p in feature_scope else 'glue/support' if p in glue_scope else 'verification controls'
        changes.append({'path': p, 'category': category,
            'change': 'added' if before is None else 'deleted' if after is None else 'modified',
            'before': before.digest if before else None, 'after': after.digest if after else None})
    if repo.revision() != revision:
        raise IntentError('Index changed during verification; retry')
    return {'revision': revision, 'changes': changes, 'requiresApproval': bool(changes),
        'approved': has_approval(repo, revision), 'glueRoots': roots,
        'protectedFeatures': sorted(feature_scope), 'protectedGlue': sorted(glue_scope),
        'protectionMode': 'whole-feature-and-complete-glue-pool',
        'intentScenarios': sum(s['intent'] for s in new_cases)}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def approval_key(repo, create=False):
    directory = repo.state_dir
    key = directory / 'review.key'
    if create:
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            fd = os.open(key, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as stream:
                stream.write(secrets.token_bytes(32))
        except FileExistsError:
            pass
    return key.read_bytes()


def has_approval(repo, revision):
    try:
        record = json.loads((repo.state_dir / 'approval.json').read_text())
        payload = record['payload']
        digest = hmac.new(approval_key(repo), canonical(payload), hashlib.sha256).hexdigest()
        return (hmac.compare_digest(record['signature'], digest)
            and payload['revision'] == revision and bool(payload['reviewer'].strip())
            and bool(payload['reason'].strip()))
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return False


def approve(repo, expected_revision, reviewer, reason, acknowledgement):
    if acknowledgement != 'APPROVE INTENT CHANGE':
        raise IntentError('Type APPROVE INTENT CHANGE to explicitly approve this revision')
    if not isinstance(reviewer, str) or not reviewer.strip() or not isinstance(reason, str) or not reason.strip():
        raise IntentError('Reviewer name and rationale are required')
    current = report(repo)
    if current['revision'] != expected_revision:
        raise IntentError('Staged revision changed after review; refresh and review the new diff')
    if not current['requiresApproval']:
        raise IntentError('No protected change needs approval')
    from datetime import datetime, timezone
    payload = {'revision': expected_revision, 'reviewer': reviewer.strip(),
        'reason': reason.strip(), 'at': datetime.now(timezone.utc).isoformat(),
        'changes': current['changes']}
    signature = hmac.new(approval_key(repo, create=True), canonical(payload), hashlib.sha256).hexdigest()
    output = repo.state_dir / 'approval.json'
    # Approval is intentionally outside tracked source, bound to HEAD plus complete index.
    import tempfile
    with tempfile.NamedTemporaryFile(dir=repo.state_dir, mode='w', delete=False) as stream:
        json.dump({'payload': payload, 'signature': signature}, stream, indent=2)
        temporary = stream.name
    os.replace(temporary, output)
    if repo.revision() != expected_revision:
        output.unlink(missing_ok=True)
        raise IntentError('Index changed while approving; review again')
    return payload


def verify(repo):
    value = report(repo)
    if value['requiresApproval'] and not value['approved']:
        paths = ', '.join(change['path'] for change in value['changes'])
        raise IntentError('Human approval required for staged intent/glue/control changes: ' + paths
            + '. Open the local review UI; do not regenerate a baseline to bypass review.')
    return value
