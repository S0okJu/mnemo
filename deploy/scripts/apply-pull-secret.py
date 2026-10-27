#!/usr/bin/env python3
"""Apply an existing private Docker auth file as an imagePullSecret, without logging data."""
import argparse
import base64
import json
from pathlib import Path
import subprocess

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--docker-config',required=True)
p.add_argument('--kubeconfig',default='./config')
p.add_argument('--tls-server-name',default='10.0.0.11')
p.add_argument('--namespace',default='mnemo-test')
p.add_argument('--name',default='mnemo-harbor-pull')
a=p.parse_args()
config=(Path(a.docker_config)/'config.json').read_bytes()
if not json.loads(config).get('auths'):
    raise SystemExit('Docker auth file is empty; no Secret was changed.')
document={'apiVersion':'v1','kind':'Secret','metadata':{'name':a.name,'namespace':a.namespace},'type':'kubernetes.io/dockerconfigjson','data':{'.dockerconfigjson':base64.b64encode(config).decode()}}
result=subprocess.run(['kubectl','--kubeconfig',a.kubeconfig,'--tls-server-name',a.tls_server_name,'apply','--server-side','--field-manager=mnemo-deploy','-f','-'],input=json.dumps(document).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
if result.returncode:
    raise SystemExit('Image pull Secret could not be applied; private details redacted.')
print(f'Image pull Secret {a.namespace}/{a.name} ready (credential redacted).')
