#!/bin/bash

REPO_DIR="/app/repo"
cd "$REPO_DIR" || exit 1

touch /tmp/rebuild_trigger

export EXTENSION_LOG="/tmp/extension_build.log"
export EXTENSION_BUILD_LOCK="/tmp/extension_build.lock"
export SQLX_OFFLINE=true

if [ ! -d "/app/binaries" ]; then
  echo "Error: /app/binaries directory is missing. Please mount the binaries volume. read https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image"
  exit 1
fi

if [ ! -d "/app/translations" ]; then
  echo "Error: /app/translations directory is missing. Please mount the translations volume. read https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image"
  exit 1
fi

if [ ! -d "/app/extensions" ]; then
  echo "Error: /app/extensions directory is missing. Please mount the extensions volume. read https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image"
  exit 1
fi

if [ ! -d "/app/repo/database/extension-migrations" ]; then
  echo "Error: /app/repo/database/extension-migrations directory is missing. Please mount a volume for database extension migrations. read https://calagopus.com/docs/panel/extensions/switching-to-the-heavy-image"
  exit 1
fi

PROFILE=${CARGO_BUILD_PROFILE:-balanced}
PROFILE_PATH=${CARGO_TARGET_PROFILE:-heavy-release}

# pristine no-extension binary saved at image build time; the target/ copy
# gets overwritten by runtime extension builds
STOCK_BINARY="/app/panel-rs-aio.stock"
if [ ! -f "$STOCK_BINARY" ]; then
  STOCK_BINARY="/app/repo/target/$PROFILE_PATH/panel-rs-aio"
fi

cp -R /app/repo/frontend/public/translations/* /app/translations/ 2>/dev/null || true

# calculate the combined sha256 hash of all arguments' contents
hash_many() {
  local hash=""
  for file in "$@"; do
    if [ -f "$file" ]; then
      file_hash=$(sha256sum "$file" | awk '{print $1}')
      hash="${hash}${file_hash}"
    fi
  done
  echo -n "$hash" | sha256sum | awk '{print $1}'
}

PANEL_PID=""

start_panel() {
  local bin="$1"
  echo "Starting panel-rs-aio with binary: $bin"

  if [ -n "$PANEL_PID" ]; then
    echo "Stopping existing panel-rs-aio with PID: $PANEL_PID"
    kill "$PANEL_PID"
    wait "$PANEL_PID" 2>/dev/null
    PANEL_PID=""
  fi

  "$bin" &
  PANEL_PID=$!
  echo "panel-rs-aio started with PID: $PANEL_PID"
}

PANEL_VERSION=$(/app/repo/target/$PROFILE_PATH/panel-rs-aio version)
PANEL_VERSION=$(echo $PANEL_VERSION | awk '{print $2}')

execute_build() {
  local EXT_HASH=$(hash_many /app/extensions/*.c7s.zip)
  local BINARY_PATH="/app/binaries/$PANEL_VERSION/$EXT_HASH/panel-rs-aio"

  # Check if another process is building
  if [ -f "$EXTENSION_BUILD_LOCK" ]; then
    echo "Extension build already in progress. Waiting..."
    while [ -f "$EXTENSION_BUILD_LOCK" ]; do
      sleep 1
    done
    
    # If the lock is gone, check if the binary we need was just built
    if [ -f "$BINARY_PATH" ]; then
      echo "Extension build completed by another process."
      start_panel "$BINARY_PATH"
      return 0
    fi
  fi

  # Idempotency check: Don't rebuild if nothing changed
  if [ -f "$BINARY_PATH" ]; then
    echo "Binary for current extensions already exists. Skipping redundant build."
    # Ensure the panel is actually running on this binary
    start_panel "$BINARY_PATH"
    return 0
  fi

  touch "$EXTENSION_BUILD_LOCK"

  echo "Building new binary with current extensions..."

  # clear previous log
  > "$EXTENSION_LOG"

  # clear all existing extensions before re-adding
  /app/repo/target/$PROFILE_PATH/panel-rs-aio extensions clear >> "$EXTENSION_LOG" 2>&1

  # loop over all extension files
  for ext_file in /app/extensions/*.c7s.zip; do
    # Ignore if no files match the glob
    [ -e "$ext_file" ] || continue
    echo "Adding extension: $ext_file"
    /app/repo/target/$PROFILE_PATH/panel-rs-aio extensions add "$ext_file" --skip-version-check --accept-license >> "$EXTENSION_LOG" 2>&1
  done

  # resync internal extension list
  /app/repo/target/$PROFILE_PATH/panel-rs-aio extensions resync >> "$EXTENSION_LOG" 2>&1

  # apply changes
  export NODE_OPTIONS="--max-old-space-size=2048"
  /app/repo/target/$PROFILE_PATH/panel-rs-aio extensions apply --skip-replace-binary --profile $PROFILE --bin panel-rs-aio >> "$EXTENSION_LOG" 2>&1

  local EXIT_CODE=$?

  cp -R /app/repo/frontend/public/translations/* /app/translations/ 2>/dev/null || true

  # apply translation overrides if they exist
  mkdir -p /app/translations/overrides
  find /app/translations/overrides -type f -name "*.json" | while read -r override_file; do
    real_file="/app/translations/$(basename "$override_file")"
    node /applyJson.js "$real_file" "$override_file"
  done

  # check status of extensions apply
  if [ $EXIT_CODE -eq 0 ]; then
    echo "Extension build successful. Saving new binary."
    echo 0 > /tmp/extension_build.exitcode

    # create directory for new binary
    mkdir -p "/app/binaries/$PANEL_VERSION/$EXT_HASH"
    # copy new binary to binaries directory
    cp "/app/repo/target/$PROFILE_PATH/panel-rs-aio" "$BINARY_PATH"

    # Storage optimization: keep only the 3 most recently compiled binaries
    echo "Cleaning up outdated binaries to reclaim storage space, keeping the latest 3..."
    ls -t /app/binaries/*/*/panel-rs-aio 2>/dev/null | tail -n +4 | while read -r old_bin; do
      rm -rf "$(dirname "$old_bin")"
    done

    # restart panel with new binary
    echo "Restarting panel-rs-aio with new binary."
    start_panel "$BINARY_PATH"
  else
    echo "Extension build failed. Check the log at $EXTENSION_LOG for details."
    echo $EXIT_CODE > /tmp/extension_build.exitcode
  fi

  rm -f "$EXTENSION_BUILD_LOCK"
}

# Initial boot
EXT_HASH=$(hash_many /app/extensions/*.c7s.zip)
BINARY_PATH="/app/binaries/$PANEL_VERSION/$EXT_HASH/panel-rs-aio"

if [ -f "$BINARY_PATH" ]; then
  echo "Found existing binary for current extensions."
  start_panel "$BINARY_PATH"
elif [ -z "$(ls -A /app/extensions/*.c7s.zip 2>/dev/null)" ]; then
  # No extensions installed: the pristine stock binary from the image build is
  # exactly the empty-extension-set build, so use it directly instead of a
  # stale extension binary. Cache it so future boots hit the exact match above.
  echo "No extensions found in /app/extensions. Using stock binary."
  mkdir -p "$(dirname "$BINARY_PATH")"
  cp "$STOCK_BINARY" "$BINARY_PATH" 2>/dev/null || true
  start_panel "$STOCK_BINARY"
else
  # Check for the most recently compiled binary for this version as a fallback
  LAST_COMPILED=$(ls -t /app/binaries/"$PANEL_VERSION"/*/panel-rs-aio 2>/dev/null | head -n 1)

  # If nothing was built for this version yet (e.g. right after a version
  # upgrade) fall back to the most recently compiled binary from any previous
  # version.
  if [ -z "$LAST_COMPILED" ]; then
    LAST_COMPILED=$(ls -t /app/binaries/*/*/panel-rs-aio 2>/dev/null | head -n 1)
  fi

  if [ -n "$LAST_COMPILED" ] && [ -f "$LAST_COMPILED" ]; then
    echo "No exact match found for current extensions. Temporarily using the last compiled binary: $LAST_COMPILED"
    start_panel "$LAST_COMPILED"
  else
    echo "No existing or previous compiled binary found. Temporarily using stock binary."
    start_panel "$STOCK_BINARY"
  fi

  execute_build
fi

# watch for changes in /tmp/rebuild_trigger
inotifywait -m -e close_write,attrib /tmp/rebuild_trigger | while read -r directory events filename; do
  echo "Rebuild trigger detected: $events on $filename"
  execute_build
done
