"""Exercise actual Git hooks and HTTP annotation safety, beyond the acceptance cases."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import unittest
from features.support.repository_driver import RepositoryDriver, FEATURE, GLUE, PROJECT
from intentdd.cli import install_hook
from intentdd.repository import IntentError
from intentdd.verification import report


class LocalWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.driver = RepositoryDriver()
        self.addCleanup(self.driver.close)

    def committed_tool(self):
        shutil.copytree(PROJECT / 'intentdd', self.driver.root / 'intentdd', ignore=shutil.ignore_patterns('__pycache__'))
        self.driver.stage()
        self.driver.git('commit', '-qm', 'Install trusted tool')
        install_hook(self.driver.repo)

    def commit(self):
        return subprocess.run(['git', '-C', str(self.driver.root), 'commit', '-m', 'Candidate change'], capture_output=True, text=True)

    def test_real_hook_rejects_glue_change(self):
        self.committed_tool()
        self.driver.write(GLUE, self.driver.read(GLUE) + '\n# change\n')
        self.driver.stage()
        result = self.commit()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Human approval required', result.stderr)

    def test_real_hook_allows_human_approved_revision_and_expires_after_commit(self):
        self.committed_tool()
        self.driver.write(GLUE, self.driver.read(GLUE) + '\n# new rule\n')
        self.driver.stage()
        self.assertEqual(self.driver.approval()[0], 200)
        result = self.commit()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(report(self.driver.repo)['approved'])

    def test_changed_candidate_verifier_cannot_disable_installed_hook(self):
        self.committed_tool()
        self.driver.write('intentdd/cli.py', 'def main(argv=None):\n    return 0\n')
        self.driver.write(GLUE, 'pass\n')
        self.driver.stage()
        result = self.commit()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Human approval required', result.stderr)

    def test_hook_does_not_clobber_existing_hook(self):
        shutil.copytree(PROJECT / 'intentdd', self.driver.root / 'intentdd', ignore=shutil.ignore_patterns('__pycache__'))
        self.driver.stage()
        self.driver.git('commit', '-qm', 'Install')
        hook = self.driver.root / '.git/hooks/pre-commit'
        hook.write_text('#!/bin/sh\nexit 0\n')
        with self.assertRaises(IntentError):
            install_hook(self.driver.repo)
        self.assertEqual(hook.read_text(), '#!/bin/sh\nexit 0\n')

    def test_changed_file_cannot_be_annotated_from_stale_view(self):
        case = self.driver.workspace()['scenarios'][0]
        self.driver.write(FEATURE, self.driver.read(FEATURE) + '\n# concurrent change\n')
        status, body = self.driver.request('POST', '/api/annotation', {'path': FEATURE, 'line': case['line'], 'sourceHash': case['sourceHash'], 'enabled': False})
        self.assertEqual(status, 409)
        self.assertIn('File changed', body)
        self.assertIn('@intent', self.driver.read(FEATURE))

    def test_cross_origin_write_is_rejected(self):
        self.driver.start()
        status, _ = self.driver.request('POST', '/api/approval', {}, {'Origin': 'https://example.invalid'})
        self.assertEqual(status, 409)

    def test_missing_session_token_is_rejected(self):
        self.driver.start()
        status, _ = self.driver.request('POST', '/api/approval', {}, {'X-IntentDD-Token': ''})
        self.assertEqual(status, 403)

    def test_host_rebinding_is_rejected(self):
        self.driver.start()
        status, _ = self.driver.request('GET', '/api/workspace', headers={'Host': 'evil.example'})
        self.assertEqual(status, 409)

    def test_removal_preserves_other_tags_and_crlf(self):
        data = b'Feature: Booking\r\n  @fast @intent @smoke\r\n  Scenario: Keep tags\r\n    Given a booking exists\r\n'
        (self.driver.root / FEATURE).write_bytes(data)
        status, body = self.driver.annotate(False)
        self.assertEqual(status, 200, body)
        result = (self.driver.root / FEATURE).read_bytes()
        self.assertIn(b'@fast  @smoke\r\n', result)
        self.assertNotIn(b'@intent', result)
        self.assertNotIn(b'\n', result.replace(b'\r\n', b''))

    def test_outline_background_rule_and_docstring_protect_entire_feature(self):
        self.driver.write(FEATURE, 'Feature: Examples\n  Background:\n    Given a booking exists\n  Rule: Booking rule\n    @intent\n    Scenario Outline: Keep <value>\n      Then the booking is preserved\n      """\n      @not_a_tag\n      """\n      Examples:\n        | value |\n        | one   |\n')
        self.driver.stage()
        self.assertTrue(report(self.driver.repo)['requiresApproval'])
        rows = self.driver.workspace()['scenarios']
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]['intent'])

    def test_removing_all_glue_fails_closed(self):
        shutil.rmtree(self.driver.root / 'features/steps')
        shutil.rmtree(self.driver.root / 'features/support')
        self.driver.stage()
        result = self.driver.verify()
        self.assertEqual(result.returncode, 1)
        self.assertIn('no glue files', result.stderr)

    def test_glue_rename_requires_approval(self):
        (self.driver.root / GLUE).rename(self.driver.root / 'features/steps/renamed.py')
        self.driver.stage()
        result = self.driver.verify()
        self.assertEqual(result.returncode, 1)
        self.assertIn('Human approval required', result.stderr)

    def test_glue_symlink_is_rejected(self):
        (self.driver.root / GLUE).unlink()
        (self.driver.root / GLUE).symlink_to('../../app.py')
        self.driver.stage()
        result = self.driver.verify()
        self.assertEqual(result.returncode, 1)
        self.assertIn('regular files', result.stderr)

    def test_approval_record_tampering_is_rejected(self):
        self.driver.write(GLUE, self.driver.read(GLUE) + '\n# candidate\n')
        self.driver.stage()
        self.assertEqual(self.driver.approval()[0], 200)
        path = self.driver.repo.state_dir / 'approval.json'
        value = json.loads(path.read_text())
        value['payload']['reviewer'] = 'Someone else'
        path.write_text(json.dumps(value))
        self.assertFalse(report(self.driver.repo)['approved'])

    def test_adding_intent_requires_initial_acceptance(self):
        self.driver.write('features/new.feature', 'Feature: New\n  @intent\n  Scenario: New rule\n    Given a booking exists\n')
        self.driver.stage()
        self.assertEqual(self.driver.verify().returncode, 1)


if __name__ == '__main__':
    unittest.main()
