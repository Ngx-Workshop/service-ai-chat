import importlib.util
from pathlib import Path
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('runtime', Path(__file__).with_name('prepare-ai-runtime.py'))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

class RuntimePreparationTests(unittest.TestCase):
    def test_bootstraps_key_without_changing_donor_or_logging_values(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'next.env'
            donor = Path(directory) / 'publisher.env'
            target.write_text('PORT=3012\nCHAT_MODEL=gpt-6.1-sol\n')
            target.chmod(0o600)
            donor.write_text('OPENAI_API_KEY=private-test-key\nDOCUMENT_BASE_URL=http://documents/document\nCODING_LABS_BASE_URL=http://labs/coding-labs\nOTHER_SECRET=excluded\n')
            donor.chmod(0o600)
            original = donor.read_bytes()
            with patch.object(Path, 'lstat', return_value=SimpleNamespace(st_uid=0, st_mode=stat.S_IFREG | 0o600)):
                runtime.prepare(target, [donor])
            self.assertIn('OPENAI_API_KEY=private-test-key', target.read_text())
            self.assertIn('DOCUMENT_BASE_URL=http://documents/document', target.read_text())
            self.assertIn('CODING_LABS_BASE_URL=http://labs/coding-labs', target.read_text())
            self.assertNotIn('OTHER_SECRET', target.read_text())
            self.assertEqual(donor.read_bytes(), original)
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)

    def test_missing_key_leaves_staging_configuration_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'next.env'
            target.write_text('PORT=3012\n')
            with patch.object(Path, 'lstat', return_value=SimpleNamespace(st_uid=0, st_mode=stat.S_IFREG | 0o600)):
                with self.assertRaisesRegex(RuntimeError, 'Missing OPENAI_API_KEY'):
                    runtime.prepare(target, [])
            self.assertEqual(target.read_text(), 'PORT=3012\n')

    def test_rejects_shared_or_non_root_configuration(self):
        for uid, mode in [(1, stat.S_IFREG | 0o600), (0, stat.S_IFREG | 0o644), (0, stat.S_IFLNK | 0o600)]:
            with patch.object(Path, 'lstat', return_value=SimpleNamespace(st_uid=uid, st_mode=mode)):
                with self.assertRaisesRegex(RuntimeError, 'root-owned and private'):
                    runtime.read_private(Path('not-read'))

if __name__ == '__main__':
    unittest.main()
