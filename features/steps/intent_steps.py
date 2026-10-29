"""Domain vocabulary for Intent DD's own executable contract."""
from behave import given, when, then
from features.support.repository_driver import RepositoryDriver, FEATURE, GLUE, SUPPORT


@given('a repository with an unmarked Gherkin scenario')
def unmarked(context):
    context.driver = RepositoryDriver(marked=False)


@given('a repository with an accepted intent scenario')
def accepted(context):
    context.driver = RepositoryDriver(marked=True)


@given('a repository with a staged intent change')
def staged(context):
    accepted(context)
    context.driver.write(GLUE, context.driver.read(GLUE) + '\n# changed glue\n')
    context.driver.stage()


@when('the developer marks the scenario as intent through the local API')
def mark(context):
    status, body = context.driver.annotate(True)
    assert status == 200, body


@then('the feature file contains the intent annotation')
def contains(context):
    assert '@intent' in context.driver.read(FEATURE)


@then('no commit is created by the annotation')
def no_commit(context):
    assert context.driver.repo.head == context.driver.annotation_head
    assert not context.driver.git('diff', '--cached', '--name-only')


@when('the specification is changed and staged')
def specification(context):
    context.driver.write(FEATURE, context.driver.read(FEATURE).replace('booking is preserved', 'booking is replaced'))
    context.driver.stage()


@when('its glue code is changed and staged')
def glue(context):
    context.driver.write(GLUE, context.driver.read(GLUE).replace('assert context.booking is True', 'assert True'))
    context.driver.stage()


@when('its support code is changed and staged')
def support(context):
    context.driver.write(SUPPORT, 'def assert_preserved(value):\n    pass\n')
    context.driver.stage()


@when('the intent tag is removed and staged')
def remove_tag(context):
    context.driver.write(FEATURE, context.driver.read(FEATURE).replace('  @intent\n', ''))
    context.driver.stage()


@when('the feature file is deleted and staged')
def delete(context):
    (context.driver.root / FEATURE).unlink()
    context.driver.stage()


@when('another glue file is added and staged')
def new_glue(context):
    context.driver.write('features/steps/override.py', 'from behave import then\n@then("the booking is preserved")\ndef override(context):\n    pass\n')
    context.driver.stage()


@when('only the system under test is changed and staged')
def sut(context):
    context.driver.write('app.py', 'def book():\n    return {"booked": True}\n')
    context.driver.stage()


@when('its glue code is changed but not staged')
def unstaged(context):
    context.driver.write(GLUE, context.driver.read(GLUE) + '\n# unstaged\n')


@when('a human approves the displayed staged revision')
def approve(context):
    status, body = context.driver.approval()
    assert status == 200, body


@when('another change is staged')
def another(context):
    sut(context)


@when('the staged revision changes after the review is opened')
def stale(context):
    context.old_revision = context.driver.workspace()['review']['revision']
    sut(context)


@then('approval of the old review is refused')
def refuse_old(context):
    status, body = context.driver.approval(context.old_revision)
    assert status == 409, body
    assert 'changed after review' in body, body


@when('the glue protection configuration is weakened and staged')
def weaken_config(context):
    import json
    cfg = json.loads(context.driver.read('.intentdd.json'))
    cfg['glue_roots'] = ['features/support']
    context.driver.write('.intentdd.json', json.dumps(cfg))
    context.driver.stage()


@when('invalid Gherkin is staged')
def invalid(context):
    context.driver.write(FEATURE, 'Feature: Broken\n  Scenario: Bad\n    Given a state\n    """\nunterminated\n')
    context.driver.stage()


@when('the index contains an unresolved merge')
def merge(context):
    oid = context.driver.git('rev-parse', 'HEAD:' + GLUE)
    import subprocess
    payload = f'0 {"0" * 40}\t{GLUE}\n100644 {oid} 1\t{GLUE}\n100644 {oid} 2\t{GLUE}\n'
    result = subprocess.run(['git', '-C', str(context.driver.root), 'update-index', '--index-info'], input=payload, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


@then('verification requires human approval')
def blocked(context):
    result = context.driver.verify()
    assert result.returncode == 1, result.stdout + result.stderr
    assert 'Human approval required' in result.stderr, result.stderr


@then('verification allows the commit')
def allowed(context):
    result = context.driver.verify()
    assert result.returncode == 0, result.stdout + result.stderr


@then('verification fails with a parse error')
def parse_failure(context):
    result = context.driver.verify()
    assert result.returncode == 1 and 'Gherkin parse error' in result.stderr, result.stderr


@then('verification refuses the index')
def index_failure(context):
    result = context.driver.verify()
    assert result.returncode == 1, result.stdout
    assert 'unmerged' in result.stderr.lower() or 'merge conflict' in result.stderr.lower(), result.stderr


@given('the trusted pre-commit hook is installed')
def install_trusted(context):
    import shutil
    from features.support.repository_driver import PROJECT
    from intentdd.cli import install_hook
    shutil.copytree(PROJECT / 'intentdd', context.driver.root / 'intentdd', ignore=shutil.ignore_patterns('__pycache__'))
    context.driver.stage()
    context.driver.git('commit', '-qm', 'Install trusted verifier')
    install_hook(context.driver.repo)


@when('the candidate verifier is changed to always pass')
def change_verifier(context):
    context.driver.write('intentdd/cli.py', 'def main(argv=None):\n    return 0\n')
    context.driver.stage()


@then('a real Git commit is refused')
def commit_refused(context):
    import subprocess
    result = subprocess.run(['git', '-C', str(context.driver.root), 'commit', '-m', 'Unapproved candidate'], capture_output=True, text=True)
    assert result.returncode != 0, result.stdout
    assert 'Human approval required' in result.stderr, result.stderr
