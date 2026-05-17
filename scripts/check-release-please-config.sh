#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="release-please-config.json"
MANIFEST_FILE=".release-please-manifest.json"

errors=0

# Get packages from filesystem (excluding private packages)
fs_packages=()
for pkg in packages/*/package.json; do
  dir=$(dirname "$pkg")
  name=$(basename "$dir")
  private=$(jq -r '.private // false' "$pkg")
  if [ "$private" != "true" ]; then
    fs_packages+=("$name")
  fi
done

# Check release-please-config.json packages
config_packages=$(jq -r '.packages | keys[]' "$CONFIG_FILE" | sed 's|packages/||' | sort)
for pkg in "${fs_packages[@]}"; do
  if ! echo "$config_packages" | grep -qx "$pkg"; then
    echo "ERROR: packages/$pkg missing from $CONFIG_FILE packages"
    errors=1
  fi
done

# Check linked-versions components
linked_components=$(jq -r '.plugins[] | select(.type == "linked-versions") | .components[]' "$CONFIG_FILE" | sort)
for pkg in "${fs_packages[@]}"; do
  if ! echo "$linked_components" | grep -qx "$pkg"; then
    echo "ERROR: $pkg missing from linked-versions components in $CONFIG_FILE"
    errors=1
  fi
done

# Check manifest
manifest_packages=$(jq -r 'keys[]' "$MANIFEST_FILE" | sed 's|packages/||' | sort)
for pkg in "${fs_packages[@]}"; do
  if ! echo "$manifest_packages" | grep -qx "$pkg"; then
    echo "ERROR: packages/$pkg missing from $MANIFEST_FILE"
    errors=1
  fi
done

if [ $errors -eq 0 ]; then
  echo "✓ release-please config is in sync with packages/"
fi

exit $errors
