#!/bin/bash

# Artillery wrapper script – ensure preload-fetch.js is always required
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PRELOAD="${SCRIPT_DIR}/preload-fetch.js"

# Ensure undici is installed (quiet check)
if [ ! -d "${SCRIPT_DIR}/node_modules/undici" ]; then
  echo "[wrapper] installing missing undici..." >&2
  npm -s install undici@6 >/dev/null 2>&1 || npm -s install undici >/dev/null 2>&1
fi

BASE_FLAGS=(--no-warnings --dns-result-order=ipv4first)

# Start with existing NODE_OPTIONS tokens into array
read -r -a CURRENT <<<"${NODE_OPTIONS}"

add_flag() { # add if not present
  local flag="$1"; shift
  for t in "${CURRENT[@]}"; do [ "$t" = "$flag" ] && return 0; done
  CURRENT+=("$flag")
}

# Preload
PRELOAD_FLAG="--require"; PRELOAD_PATH="${PRELOAD}"
NEED_PRELOAD=1
for ((i=0;i<${#CURRENT[@]};i++)); do
  if [ "${CURRENT[$i]}" = "--require" ]; then
    next_index=$((i+1))
    if [ "${CURRENT[$next_index]}" = "${PRELOAD_PATH}" ]; then NEED_PRELOAD=0; break; fi
  elif [[ "${CURRENT[$i]}" == *preload-fetch.js* ]]; then
    NEED_PRELOAD=0; break
  fi
done
if [ $NEED_PRELOAD -eq 1 ]; then
  CURRENT+=("--require" "${PRELOAD_PATH}")
fi

for f in "${BASE_FLAGS[@]}"; do add_flag "$f"; done

export NODE_OPTIONS="${CURRENT[*]}"
export NODE_NO_WARNINGS=1
export UV_USE_IO_URING=0

exec node ./node_modules/.bin/artillery "$@"
