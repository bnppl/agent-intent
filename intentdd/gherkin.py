"""Use the official Cucumber parser; never execute step definitions to classify them."""
import hashlib
from gherkin.parser import Parser
from .repository import IntentError, safe_path


def scenarios(path, data):
    try:
        source = data.decode('utf-8')
        feature = Parser().parse(source).get('feature')
    except Exception as error:
        raise IntentError(f'Gherkin parse error in {path}: {error}') from error
    if not feature:
        raise IntentError('Gherkin feature is missing in ' + path)
    result = []
    source_hash = hashlib.sha256(data).hexdigest()

    def walk(node, inherited):
        own = node.get('tags', [])
        effective = inherited + own
        for child in node.get('children', []):
            if 'rule' in child:
                walk(child['rule'], effective)
            if 'scenario' in child:
                s = child['scenario']
                direct = s.get('tags', [])
                tags = effective + direct
                # An intent-tagged Examples block also protects its complete feature.
                examples = [t for e in s.get('examples', []) for t in e.get('tags', [])]
                result.append({'id': f"{path}:{s['location']['line']}", 'path': path,
                    'line': s['location']['line'], 'name': s['name'], 'keyword': s['keyword'],
                    'intent': any(t['name'] == '@intent' for t in tags + examples),
                    'directIntent': any(t['name'] == '@intent' for t in direct),
                    'inheritedIntent': any(t['name'] == '@intent' for t in effective + examples),
                    'tags': [t['name'] for t in tags], 'sourceHash': source_hash,
                    'tagLocations': [t['location'] for t in direct if t['name'] == '@intent'],
                    'source': source})
    walk(feature, [])
    return result


def annotate(repo, path, line, enabled, expected_hash, feature_roots):
    import os
    import tempfile
    from .repository import under
    path = safe_path(path)
    if not under(path, feature_roots) or not path.endswith('.feature'):
        raise IntentError('Only configured Gherkin feature files can be annotated')
    full = repo.root / path
    if full.is_symlink() or any(p.is_symlink() for p in full.parents if p != repo.root and repo.root in p.parents):
        raise IntentError('Refusing to annotate a symlink')
    data = full.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected_hash:
        raise IntentError('File changed since the view was opened; reload before annotating')
    scenario = next((s for s in scenarios(path, data) if s['line'] == line), None)
    if not scenario:
        raise IntentError('Scenario no longer exists; reload the view')
    if not enabled and scenario['inheritedIntent']:
        raise IntentError('Intent is inherited from Feature, Rule, or Examples; edit those tags explicitly for review')
    if bool(enabled) == scenario['directIntent']:
        return
    lines = data.decode('utf-8').splitlines(keepends=True)
    if enabled:
        original = lines[line - 1]
        indent = original[:len(original) - len(original.lstrip())]
        newline = '\r\n' if '\r\n' in data.decode('utf-8') else '\n'
        lines.insert(line - 1, indent + '@intent' + newline)
    else:
        # Work backwards so deleting an otherwise empty tag line preserves offsets.
        for location in sorted(scenario['tagLocations'], key=lambda l: (l['line'], l['column']), reverse=True):
            idx, col = location['line'] - 1, location['column'] - 1
            text = lines[idx]
            if text[col:col + 7] != '@intent':
                raise IntentError('Tag position changed; reload')
            changed = text[:col] + text[col + 7:]
            lines[idx] = changed if changed.strip() else ''
    output = ''.join(lines).encode('utf-8')
    scenarios(path, output)  # Never write a syntactically broken annotation.
    # Recheck immediately before atomic replacement; web mutations are serialized.
    if full.read_bytes() != data:
        raise IntentError('Concurrent modification; reload')
    with tempfile.NamedTemporaryFile(dir=full.parent, delete=False) as temp:
        temp.write(output)
        name = temp.name
    try:
        os.chmod(name, full.stat().st_mode & 0o777)
        os.replace(name, full)
    finally:
        if os.path.exists(name):
            os.unlink(name)
