#!/usr/bin/env python3
"""Prepare private TLS/DB/encryption files and optionally pre-create test Secrets.

No credentials are printed, passed as CLI values, or written into chart values.
Existing private files/Secrets are preserved and must match on subsequent runs.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import secrets
import subprocess
from urllib.parse import quote


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--kubeconfig', default='./config')
    parser.add_argument('--tls-server-name', default='10.0.0.11')
    parser.add_argument('--namespace', default='mnemo-test')
    parser.add_argument('--node-address', default='192.168.50.138')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--enable-http', action='store_true')
    args = parser.parse_args()
    if not args.namespace.replace('-', '').isalnum():
        raise SystemExit('Use a DNS-label namespace.')
    os.umask(0o077)
    root = Path(args.output_dir).resolve()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    root.chmod(0o700)

    def write(name, value, replace=False):
        path = root / name
        if not path.exists() or replace:
            path.write_bytes(value if isinstance(value, bytes) else value.encode())
        path.chmod(0o600)
        return path

    def openssl(*command):
        result = subprocess.run(['openssl', *map(str, command)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode:
            raise SystemExit('OpenSSL operation failed; private inputs were not logged.')

    ca_key, ca_cert = root / 'ca.key', root / 'ca.crt'
    if ca_key.exists() != ca_cert.exists():
        raise SystemExit('Incomplete CA files. Restore the matching CA before continuing.')
    if not ca_key.exists():
        openssl('req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-noenc', '-keyout', ca_key, '-out', ca_cert, '-days', '365', '-subj', '/CN=mnemo-test-ca', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0', '-addext', 'keyUsage=critical,keyCertSign,cRLSign')
    for role in ('server', 'admin', 'reader'):
        key, cert = root / f'{role}.key', root / f'{role}.crt'
        if key.exists() != cert.exists():
            raise SystemExit(f'Incomplete {role} certificate files. Restore them before continuing.')
        if key.exists():
            openssl('x509', '-in', cert, '-checkend', '3600', '-noout')
            continue
        subject = '/CN=mnemo' if role == 'server' else f'/CN=mnemo-{role}'
        if role == 'admin':
            subject += '/OU=mnemo-admin'
        csr = root / f'{role}.csr'
        openssl('req', '-new', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-noenc', '-keyout', key, '-out', csr, '-subj', subject)
        extensions = 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=' + ('serverAuth' if role == 'server' else 'clientAuth') + '\n'
        if role == 'server':
            extensions += f'subjectAltName=DNS:mnemo,DNS:mnemo.{args.namespace},DNS:mnemo.{args.namespace}.svc,DNS:mnemo.{args.namespace}.svc.cluster.local,DNS:mnemo.test,DNS:localhost,IP:127.0.0.1,IP:{args.node_address}\n'
        ext_file = write(f'{role}.ext', extensions)
        openssl('x509', '-req', '-in', csr, '-CA', ca_cert, '-CAkey', ca_key, '-set_serial', '0x' + secrets.token_hex(16), '-out', cert, '-days', '90', '-extfile', ext_file)
    password = write('password', secrets.token_urlsafe(32)).read_text()
    encryption_key = write('encryption-key', base64.b64encode(secrets.token_bytes(32))).read_bytes()
    if len(base64.b64decode(encryption_key, validate=True)) != 32:
        raise SystemExit('Existing encryption key is invalid; it was not replaced.')
    database_url = write('database-url', f'postgres://mnemo:{quote(password, safe="")}@mnemo-postgresql.{args.namespace}.svc.cluster.local:5432/mnemo?sslmode=disable')

    def secret(name, files, secret_type='Opaque'):
        return {'apiVersion': 'v1', 'kind': 'Secret', 'metadata': {'name': name, 'namespace': args.namespace}, 'type': secret_type, 'data': {key: base64.b64encode(Path(path).read_bytes()).decode() for key, path in files.items()}}

    server_files={'database-url': database_url, 'encryption-key': root / 'encryption-key'}
    if args.enable_http:
        server_files['http-admin-password']=write('http-admin-password',secrets.token_urlsafe(24))
        server_files['http-viewer-password']=write('http-viewer-password',secrets.token_urlsafe(24))
    documents = [
        secret('mnemo-database', {'password': root / 'password'}),
        secret('mnemo-server', server_files),
        secret('mnemo-client-ca', {'ca.crt': ca_cert}),
        secret('mnemo-tls', {'tls.crt': root / 'server.crt', 'tls.key': root / 'server.key'}, 'kubernetes.io/tls'),
    ]
    # A protected review artifact; never render this file into terminal output.
    write('secrets.json', json.dumps({'apiVersion': 'v1', 'kind': 'List', 'items': documents}), replace=True)
    if not args.apply:
        print(f'Private test files prepared in {root}. No cluster resources changed.')
        return
    command = ['kubectl', '--kubeconfig', args.kubeconfig, '--tls-server-name', args.tls_server_name]

    def call(*parts, document=None):
        return subprocess.run([*command, *parts], input=None if document is None else json.dumps(document).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    namespace = call('get', 'namespace', args.namespace, '--ignore-not-found', '-o', 'name')
    if namespace.returncode:
        raise SystemExit('Cannot inspect target namespace. Details redacted.')
    if not namespace.stdout.strip():
        result = call('create', '-f', '-', document={'apiVersion': 'v1', 'kind': 'Namespace', 'metadata': {'name': args.namespace}})
        if result.returncode:
            raise SystemExit('Namespace creation failed. Details redacted.')
    for document in documents:
        name = document['metadata']['name']
        existing = call('-n', args.namespace, 'get', 'secret', name, '--ignore-not-found', '-o', 'json')
        if existing.returncode:
            raise SystemExit(f'Cannot inspect Secret {name}. Details redacted.')
        if existing.stdout.strip():
            current = json.loads(existing.stdout)
            if any(key in current.get('data',{}) and current['data'][key]!=value for key,value in document['data'].items()) or current.get('type') != document['type']:
                raise SystemExit(f'Existing Secret {name} differs. Restore matching private files or use an explicit rotation procedure; nothing was overwritten.')
            missing={key:value for key,value in document['data'].items() if key not in current.get('data',{})}
            if missing:
                result=call('-n',args.namespace,'patch','secret',name,'--type','merge','--patch-file','/dev/stdin',document={'data':missing})
                if result.returncode:
                    raise SystemExit(f'Cannot add new keys to Secret {name}. Details redacted.')
        else:
            result = call('create', '-f', '-', document=document)
            if result.returncode:
                raise SystemExit(f'Cannot create Secret {name}. Details redacted.')
        print(f'Secret {args.namespace}/{name} ready (values redacted).')


if __name__ == '__main__':
    main()
