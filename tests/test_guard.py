import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('guard', Path(__file__).parents[1] / 'dist/check_intent.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

class GuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'test.feature').write_bytes(b'Given intent\r\n')
        self.policy = {'schemaVersion': 1, 'protectedFiles': [{'path': 'test.feature', 'sha256': hashlib.sha256(b'Given intent\r\n').hexdigest()}]}

    def test_unchanged_passes(self):
        self.assertEqual(guard.check(self.policy, self.root), [])

    def test_changed_fails(self):
        (self.root / 'test.feature').write_bytes(b'Given weakened intent\r\n')
        self.assertTrue(guard.check(self.policy, self.root))

    def test_line_endings_are_exact(self):
        (self.root / 'test.feature').write_bytes(b'Given intent\n')
        self.assertTrue(guard.check(self.policy, self.root))

    def test_rename_fails(self):
        (self.root / 'test.feature').rename(self.root / 'renamed.feature')
        self.assertTrue(guard.check(self.policy, self.root))

    def test_delete_fails(self):
        (self.root / 'test.feature').unlink()
        self.assertTrue(guard.check(self.policy, self.root))

    def test_symlink_fails_even_with_same_content(self):
        (self.root / 'test.feature').rename(self.root / 'other.feature')
        (self.root / 'test.feature').symlink_to(self.root / 'other.feature')
        self.assertTrue(guard.check(self.policy, self.root))

    def test_traversal_fails_closed(self):
        self.policy['protectedFiles'][0]['path'] = '../escape'
        with self.assertRaises(ValueError):
            guard.check(self.policy, self.root)

    def test_invalid_digest_fails_closed(self):
        self.policy['protectedFiles'][0]['sha256'] = '*'
        with self.assertRaises(ValueError):
            guard.check(self.policy, self.root)

if __name__ == '__main__':
    unittest.main()
