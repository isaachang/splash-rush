#!/usr/bin/env bash
# Build the single-file game: src/ + vendor/three.min.js  ->  index.html
set -euo pipefail
cd "$(dirname "$0")/.."
JS_FILES=(src/js/01_core.js src/js/02_world.js src/js/03_env.js src/js/04_data.js src/js/05_character.js src/js/06_fx.js src/js/07_ai_input.js src/js/08_game.js)
{
  echo '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SPLASH RUSH · 墨浪突击</title><style>'
  cat src/style.css
  echo '</style></head><body>'
  cat src/body.html
  echo '<script>'
  cat vendor/three.min.js
  echo '</script><script>'
  cat "${JS_FILES[@]}"
  echo '</script></body></html>'
} > index.html
echo "built index.html ($(wc -c < index.html | tr -d ' ') bytes)"
