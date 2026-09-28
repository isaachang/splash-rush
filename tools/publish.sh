#!/usr/bin/env bash
# 发布到 GitHub：推送 main 和版本标签，并强制触发 GitHub Pages 重新部署，等待部署完成
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="isaachang/splash-rush"
echo "▶ 推送 main 和标签…"
git push origin main --tags
echo "▶ 请求 GitHub Pages 重新部署…"
gh api -X POST "repos/$REPO/pages/builds" >/dev/null && echo "  已请求"
echo "▶ 等待部署完成（最多约 3 分钟）…"
for i in $(seq 1 36); do
  st=$(gh api "repos/$REPO/pages/builds/latest" --jq .status 2>/dev/null || echo "unknown")
  echo "  状态：$st"
  if [ "$st" = "built" ]; then echo "✅ 在线版已更新：https://isaachang.github.io/splash-rush/ （浏览器里按 Cmd+Shift+R 强制刷新）"; exit 0; fi
  if [ "$st" = "errored" ]; then echo "❌ 部署失败，请到仓库的 Actions 页面查看"; exit 1; fi
  sleep 5
done
echo "⚠️ 还在部署中，稍后到仓库的 Actions 页面确认"
