# 开发流程规范

## 一句话原则

**`main` 分支永远是能玩、已确认的版本**（也就是在线试玩网址上跑的版本）。所有改动都在单独的分支里做，本地测过、你试玩确认后，才合并进 `main`。

---

## 分支怎么开

| 分支 | 用途 | 例子 |
|---|---|---|
| `main` | 已确认的稳定版本，在线试玩页面自动使用它 | — |
| `feat/…` | 新功能 | `feat/reticle-like-original`、`feat/super-jump` |
| `fix/…` | 修 bug | `fix/loading-overlay` |
| `tune/…` | 只调数值和手感 | `tune/rifle-range` |
| `exp/…` | 试验性的尝试，不一定会保留 | `exp/camera-centered` |

规则：**一个分支只做一件事**（或者一轮迭代），分支名用英文小写和短横线。

---

## 每次改动的完整流程

```bash
# 1. 从最新的 main 开一个新分支
git switch main
git pull
git switch -c feat/reticle-like-original

# 2. 修改 src/ 里的文件，然后重新打包
./tools/build.sh

# 3. 本地验证（两项都要过）
node tools/smoke-test.js      # 自动跑完整对局，必须显示 SMOKE TEST PASSED
node tools/feature-test.js    # 逐项验证核心机制，必须全部 PASS
node tools/map-test.js        # 改了滑板场（或地形代码）时跑，必须 ALL MAP TESTS PASSED
node tools/canton-test.js     # 改了西關大屋（或悬空方块、涂地分层）时跑，必须 ALL CANTON TESTS PASSED
open index.html               # 自己打开试玩

# 4. 提交：改一小块就提交一次，每次提交都应该是能打包、能运行的状态
git add -A
git commit -m "feat: 小准星改为沿瞄准线放置"

# 5. 推到 GitHub 上的同名分支（相当于云端备份，随时可以推）
git push -u origin feat/reticle-like-original

# 6. 试玩确认没问题后，合并进 main（二选一）
#    方式 A：在 GitHub 网页上点 "Compare & pull request" → "Merge pull request"
#    方式 B：在本地合并
git switch main
git merge --no-ff feat/reticle-like-original
git push

# 7. 发布版本：更新 CHANGELOG.md、README 版本号、src/js/04_data.js 的 RELEASES（游戏内版本日志，date + time 填发布时的日期和时间），然后打标签
git tag -a v0.4.0 -m "v0.4.0 准星与操作手感原版化"
./tools/publish.sh      # 推送 main + 标签，并强制触发 GitHub Pages 部署、等它部署完成
```

> ⚠️ `src/` 改了以后一定要重新运行 `./tools/build.sh`，并把 `index.html` 一起提交。在线试玩读的是 `index.html`。

---

## 什么时候推？

| 情况 | 推到哪里 |
|---|---|
| 做到一半、下线前 | 推到**自己的分支**（备份，不影响 main），可以随时推 |
| 本地测试通过、你试玩确认 | 合并进 **main** 并推送，网页版会自动更新 |
| 一轮迭代完成 | 在 main 上**打版本标签**（v0.4.0…） |
| 测试没过、还在调 | **不要**合并进 main |

---

## 试验和回退

```bash
# 试验失败，整个分支不要了
git switch main
git branch -D exp/camera-centered
git push origin --delete exp/camera-centered   # 如果推过远端

# main 上某个提交有问题：生成一个"撤销提交"，历史会保留
git revert <提交编号>

# 临时回到某个旧版本看看
git switch --detach v0.3.0      # 看完用 git switch main 回来
```

---

## 提交信息怎么写

格式：`类型: 一句话说明改了什么`

| 类型 | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `tune` | 调数值、调手感 |
| `ui` | 界面调整 |
| `refactor` | 重构代码，玩法不变 |
| `docs` | 文档 |
| `chore` | 构建脚本、杂项 |

例子：`tune: 步枪直飞距离 5m → 7.5m`、`fix: 加载遮罩不消失`

---

## 版本号

用 `v0.主版本.修订号`，正式上线前一直是 `0.x`：

- 完成一轮功能迭代：`v0.3.0 → v0.4.0`
- 只修 bug、小调数值：`v0.4.0 → v0.4.1`

---

## 和 Claude 协作时

1. 每一轮迭代，Claude 会开一个对应的分支，在分支里提交。
2. 每轮交付时同时附上重新打包好的 `index.html`，并确认 `smoke-test` 通过。
3. 你试玩确认后，再合并进 `main`、打版本标签。
4. 试玩不满意，就继续在同一个分支上改，main 不受影响。
