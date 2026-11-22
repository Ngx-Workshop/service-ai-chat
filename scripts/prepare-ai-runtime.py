#!/usr/bin/env python3
"""Prepare chat runtime credentials without printing values or changing donor files."""
import os
from pathlib import Path
import stat


def read_private(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077:
        raise RuntimeError('AI runtime configuration must be root-owned and private')
    return dict(line.split('=', 1) for line in path.read_text().splitlines()
                if line and not line.startswith('#') and '=' in line)


def prepare(target, sources):
    values = read_private(target)
    if not values.get('OPENAI_API_KEY'):
        for source in sources:
            if source.exists() or source.is_symlink():
                key = read_private(source).get('OPENAI_API_KEY')
                if key:
                    values['OPENAI_API_KEY'] = key
                    break
    if not values.get('OPENAI_API_KEY'):
        raise RuntimeError('Missing OPENAI_API_KEY: set the repository/organization secret or provision a private chat runtime file')
    if any(any(c in value for c in ('\r', '\n', '\0')) for value in values.values()):
        raise RuntimeError('Invalid runtime setting')
    descriptor = os.open(target, os.O_WRONLY | os.O_TRUNC | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'w') as output:
        output.write(''.join(f'{name}={value}\n' for name, value in values.items()))


if __name__ == '__main__':
    prepare(Path('.env.next'), [Path('.env'), Path('/etc/ngx-workshop/ai-chat/runtime.env'),
        Path('/etc/ngx-workshop/ai-publisher/runtime.env'),
        Path('/etc/ngx-workshop/oauth/gateway/runtime.env')])
