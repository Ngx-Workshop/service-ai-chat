import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = mkdtempSync(join(tmpdir(), 'chat-maintenance-'));
const environment = { ...process.env, CI: '', HUSKY: '', NODE_ENV: '' };

function run(command, args, cwd, env = environment, succeeds = true) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 180000,
  });
  if (succeeds && result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`
    );
  if (!succeeds) assert.notEqual(result.status, 0);
  return succeeds ? result.stdout : result.stdout + result.stderr;
}

function copy(path, cwd) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  copyFileSync(join(root, path), join(cwd, path));
}

function git(args, cwd = fixture, succeeds = true) {
  return run('git', ['--no-pager', ...args], cwd, environment, succeeds);
}

const commitMessage =
  'maintenance fixture\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>';

try {
  for (const path of [
    'package.json',
    '.prettierrc',
    '.prettierignore',
    '.husky/pre-commit',
    'eslint.config.mjs',
    '.github/workflows/checks.yml',
  ])
    copy(path, fixture);
  for (const directory of ['src', 'test', 'scripts'])
    mkdirSync(join(fixture, directory));
  writeFileSync(join(fixture, 'test/fixture.ts'), 'export {};\n');
  writeFileSync(join(fixture, 'scripts/fixture.mjs'), 'export {};\n');
  symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
  git(['init', '--quiet']);
  git(['config', 'user.name', 'Maintenance Fixture']);
  git(['config', 'user.email', 'fixture@example.invalid']);
  run('npm', ['run', 'prepare'], fixture);
  assert.equal(git(['config', 'core.hooksPath']).trim(), '.husky/_');

  const source = join(fixture, 'src/partial.ts');
  writeFileSync(
    source,
    'export const staged = 1;\nexport const unstaged = 1;\n'
  );
  run('npm', ['run', 'format:check'], fixture);
  git(['add', 'src/partial.ts']);
  git(['commit', '--quiet', '-m', commitMessage]);
  writeFileSync(source, 'export const staged=2\nexport const unstaged = 1;\n');
  const beforeCheck = readFileSync(source, 'utf8');
  const rejected = run(
    'npm',
    ['run', 'format:check'],
    fixture,
    environment,
    false
  );
  assert.equal(readFileSync(source, 'utf8'), beforeCheck);
  assert.ok(rejected.includes('[warn] src/partial.ts'));
  git(['add', 'src/partial.ts']);
  writeFileSync(source, 'export const staged=2\nexport const unstaged = 3;\n');
  const unrelated = join(fixture, 'src/unrelated.ts');
  writeFileSync(unrelated, 'export const unrelated= 4\n');
  git(['commit', '--quiet', '-m', commitMessage]);
  assert.equal(
    git(['show', 'HEAD:src/partial.ts']),
    'export const staged = 2;\nexport const unstaged = 1;\n'
  );
  assert.equal(
    readFileSync(source, 'utf8'),
    'export const staged = 2;\nexport const unstaged = 3;\n'
  );
  assert.equal(readFileSync(unrelated, 'utf8'), 'export const unrelated= 4\n');

  const head = git(['rev-parse', 'HEAD']);
  writeFileSync(join(fixture, 'src/broken.ts'), 'export const broken = ;\n');
  git(['add', 'src/broken.ts']);
  const failedHook = git(
    ['commit', '--quiet', '-m', commitMessage],
    fixture,
    false
  );
  assert.match(failedHook, /broken\.ts/);
  assert.equal(git(['rev-parse', 'HEAD']), head);
  assert.equal(
    readFileSync(join(fixture, 'src/broken.ts'), 'utf8'),
    'export const broken = ;\n'
  );
  console.log(
    'PASS: staged formatting, partial/unstaged preservation, hook failure, non-mutating negative check'
  );

  if (process.argv.includes('--installs')) {
    for (const [name, args, env, hasGit] of [
      ['developer', [], environment, true],
      ['ci', [], { ...environment, CI: 'true' }, true],
      ['docker-package-only', [], environment, false],
      [
        'production',
        ['--omit=dev'],
        { ...environment, NODE_ENV: 'production' },
        true,
      ],
    ]) {
      const directory = join(fixture, name);
      mkdirSync(directory);
      copy('package.json', directory);
      copy('package-lock.json', directory);
      if (hasGit) git(['init', '--quiet'], directory);
      if (name === 'developer') copy('.husky/pre-commit', directory);
      run('npm', ['ci', '--no-audit', '--no-fund', ...args], directory, env);
      assert.ok(existsSync(join(directory, 'node_modules/@nestjs/common')));
      if (name === 'developer') {
        assert.equal(
          git(['config', 'core.hooksPath'], directory).trim(),
          '.husky/_'
        );
        assert.ok(existsSync(join(directory, '.husky/_/pre-commit')));
      } else {
        assert.ok(!existsSync(join(directory, '.husky/_')));
      }
      if (name === 'production')
        assert.ok(!existsSync(join(directory, 'node_modules/husky')));
      console.log(`PASS: clean ${name} npm ci`);
    }
  }
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
