#!/usr/bin/env bash
# Update openbnk: pull the latest source into this checkout, then rebuild and reinstall.
# The installer only asks for the model server URL when no config file exists, so an update never asks again.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
git pull --ff-only
exec ./install
