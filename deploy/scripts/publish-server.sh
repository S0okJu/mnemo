#!/bin/sh
set -eu
# Uses an existing temporary Docker auth file; never puts credentials in argv.
tag="${1:?Usage: publish-server.sh TAG}"
case "$tag" in *[!a-zA-Z0-9._-]*) exit 2 ;; esac
work_dir="${MNEMO_DEPLOY_WORK_DIR:-/tmp/mnemo-test-deploy}"
auth_dir="${MNEMO_DOCKER_AUTH_DIR:-/tmp/mnemo-harbor-auth}"
ca_dir="${MNEMO_HARBOR_CA_DIR:-/tmp/mnemo-harbor-ca}"
image="192.168.50.27:30003/mnemo/server:$tag"
archive="$work_dir/server-$tag.tar"
cd "$(dirname "$0")/../.."
docker buildx build --platform linux/amd64 --load -t "$image" -f server/Dockerfile server
docker image save -o "$archive" "$image"
docker run --rm -v "$auth_dir/config.json:/auth.json:ro" -v "$ca_dir:/registry-ca:ro" -v "$archive:/images.tar:ro" quay.io/skopeo/stable:v1.20.0 copy --dest-cert-dir /registry-ca --authfile /auth.json --digestfile /dev/stdout "docker-archive:/images.tar:$image" "docker://$image"
