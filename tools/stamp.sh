#!/usr/bin/env bash
# Stamps index.html with a version taken from the site's own CSS and JS, so
# browsers fetch fresh copies after every change instead of serving their
# cached ones (GitHub Pages lets them cache files for 10 minutes).
#
# Run it after changing anything in css/ or js/, before committing. Adding a
# new module under js/ also needs an entry in the import map in index.html.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(cat css/*.css js/*.js | sha1sum | cut -c1-8)
sed -i -E "s/\?v=[0-9a-z]+\"/?v=$version\"/g" index.html
echo "index.html stamped with v=$version"
