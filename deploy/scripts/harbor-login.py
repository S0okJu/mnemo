#!/usr/bin/env python3
"""Authenticate a lab Harbor account and create a temporary Docker auth file.

Passwords/tokens are read with echo disabled, never through argv or environment.
The optional --insecure flag is only for a private test registry's unknown CA.
"""
import argparse
import base64
import getpass
import json
import os
from pathlib import Path
import ssl
import urllib.error
import urllib.request
import urllib.parse

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--registry',required=True)
parser.add_argument('--username',required=True)
parser.add_argument('--docker-config',required=True)
parser.add_argument('--ca-file')
parser.add_argument('--insecure',action='store_true')
args=parser.parse_args()
registry=args.registry.rstrip('/')
if not registry.startswith('https://'):
    raise SystemExit('Use HTTPS for registry credentials.')
password=getpass.getpass('Harbor password/token (hidden): ')
encoded=base64.b64encode((args.username+':'+password).encode()).decode()
context=ssl._create_unverified_context() if args.insecure else ssl.create_default_context(cafile=args.ca_file)
query=urllib.parse.urlencode({'service':'harbor-registry','scope':'repository:mnemo/server:pull,push','account':args.username})
request=urllib.request.Request(registry+'/service/token?'+query,headers={'Authorization':'Basic '+encoded})
try:
    with urllib.request.urlopen(request,context=context,timeout=15) as response:
        result=json.load(response)
    token=result.get('token') or result.get('access_token') or ''
    parts=token.split('.')
    if len(parts)!=3:
        raise SystemExit('Registry returned an invalid authentication response; details redacted.')
    claims=json.loads(base64.urlsafe_b64decode(parts[1]+'='*(-len(parts[1])%4)))
    if claims.get('sub')!=args.username:
        raise SystemExit('Registry identity mismatch. No credential file written.')
except urllib.error.HTTPError as error:
    raise SystemExit(f'Harbor authentication failed (HTTP {error.code}); credential redacted.')
except (OSError,ValueError):
    raise SystemExit('Harbor connection failed; credential redacted.')
os.umask(0o077)
root=Path(args.docker_config).resolve();root.mkdir(parents=True,exist_ok=True,mode=0o700);root.chmod(0o700)
host=registry.removeprefix('https://')
path=root/'config.json';path.write_text(json.dumps({'auths':{host:{'auth':encoded}}}));path.chmod(0o600)
print('Harbor authentication succeeded; temporary Docker config prepared (credential redacted).')
