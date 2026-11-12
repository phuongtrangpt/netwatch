#!/bin/sh
set -eu
umask 077
mkdir -p "${DATA_DIR:-/data}"
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "${DATA_DIR:-/data}"
  exec su-exec node:node "$@"
fi
exec "$@"
