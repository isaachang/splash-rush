<p align="center">
  <img src="docs/banner.png" alt="SPLASH RUSH · 墨浪突击" width="100%">
</p>

<p align="center">
  <a href="https://isaachang.github.io/splash-rush/"><img src="https://img.shields.io/badge/▶_在线试玩-Play_Now-ff7a00?style=for-the-badge" alt="Play Now"></a>
  <img src="https://img.shields.io/badge/version-v0.11.0-3346ff?style=for-the-badge" alt="version">
  <img src="https://img.shields.io/badge/Three.js-r158-111111?style=for-the-badge&logo=threedotjs" alt="three.js">
</p>

<p align="center"><b>一个打开浏览器就能玩的 4 V 4 涂地射击游戏。</b><br>
把广场涂成你的颜色，比赛结束时地面覆盖率更高的队伍获胜。</p>

---

## 🎮 快速开始

| 方式 | 步骤 |
|---|---|
| **在线玩** | 打开 [isaachang.github.io/splash-rush](https://isaachang.github.io/splash-rush/)，点「开始对战」 |
| **本地玩** | 下载 [`index.html`](index.html)，双击用 Chrome / Edge / Safari 打开，不需要安装，也不需要联网 |

> 进入对局后游戏会锁定鼠标，按 <kbd>Esc</kbd> 暂停并释放鼠标。

## ⌨️ 操作

| 按键 | 动作 |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | 移动 |
| 鼠标 | 瞄准 |
| <kbd>左键</kbd> | 射击（狙击：按住蓄力，松开发射） |
| <kbd>Shift</kbd> | 潜入墨水：在自己的颜色里高速移动、回墨、回血、隐身，还能爬上涂过的墙 |
| <kbd>空格</kbd> | 跳跃 |
| <kbd>右键</kbd> / <kbd>E</kbd> | 按住瞄准墨水炸弹（显示抛物线），松开投掷 |
| <kbd>Q</kbd> | 必杀技「墨浪冲击」 |
| <kbd>M</kbd> | 打开大地图，点击队友（或按 1/2/3）超级跳过去；阵亡时也能选 |
| <kbd>Tab</kbd> | 按住查看战况（双方击倒、助攻、阵亡、涂地） |

## ✨ 特色

- **实时涂地**：每一发墨水都会涂在地面和墙上，墨面有光泽和厚度，飞溅的墨滴落到哪就涂到哪
- **两张场地**：潮汐码头广场（集装箱、中路开阔）和墨浪滑板场（S 形下沉泳池、波浪外墙、中央高塔、铁网走道）；滑板场的泳池是真正的碗形曲面，能走下去、顺着弧形坡走上来
- **三个角色**：阿飒（跑得最快）、满满（墨水最多）、石墩（最耐打），每个角色有自己的武器（阿飒有两把可选）
- **四把手感不同的武器**
  - **墨浪步枪**：全能型，子弹几乎瞬间直飞，末端下坠，3 发击倒
  - **疾风冲锋枪**：射速极快、单发很弱（5 发击倒），很费墨但回墨快
  - **重炮狙击**：蓄力瞬间命中，蓄满一发击倒；沿途涂出墨线，有激光瞄准线
  - **重型加特林**：按住先转约 0.3 秒，转起来后一直扫射、松手就停；射速极快、射程远，但一罐墨只够约 40 发
- **潜墨与爬墙**：在自己的墨水里游动、隐身、1 秒回满血，还能沿着涂过的墙往上爬
- **超级跳**：打开地图点队友，从天而降直接跳到他身边
- **7 个 AI 队友与对手**：认得每张图的台阶、桥、暗道和能爬的墙；每队有一个看不见的指挥在分工、报点；难度三档是三种对手——轻松各玩各的，普通会撤退和分工，地狱会集火、埋伏、绕后、潜行躲枪
- **完整对局流程**：选场地 → 战前准备（选角色和武器、看阵容）→ 开局飞行镜头 → 对局 → 裁判判定 → 结算
- **原版风格结算**：俯视判定、比例条拉锯、WIN! / LOSE…，计分板、奖牌和毒舌吐槽奖
- **阵亡观战**：先看是谁打倒了你，再切到队友视角，等复活时也不无聊
- **单文件、零依赖**：整个游戏就是一个 HTML 文件，音乐和音效也是程序实时合成的

## 📸 截图

<p align="center">
  <img src="docs/screenshots/title.jpg" width="49%" alt="主页"> <img src="docs/screenshots/lobby.jpg" width="49%" alt="战前准备">
</p>
<p align="center"><sub>主页（背景是实时涂地的竞技场） · 战前准备（选武器、看阵容）</sub></p>

## 🛠 开发

```bash
./tools/build.sh             # 把 src/ 打包成 index.html
node tools/smoke-test.js     # 无浏览器自动跑完整对局，检查有没有报错
node tools/feature-test.js   # 逐项验证核心机制（蓄力、准星、炸弹、防护罩……）
node tools/map-test.js       # 滑板场专项检查（泳池地形、外墙、铁网桥和围栏、爬塔、AI 路线）
node tools/canton-test.js    # 西關大屋专项检查（悬空方块、上下两层涂地、河涌、镇海楼、窄缝、AI 路线）
node tools/ai-test.js        # 机器人专项检查（三张图的寻路图、掉进河涌能走出来、撤退、集火、爬墙、三档难度）
node tools/ai-bench.js canton 2 1 12   # 全电脑对打量强弱：地图、A 队难度、B 队难度、局数（0 轻松 1 普通 2 地狱 3 旧版机器人）
SR_MAP=skate node tools/smoke-test.js   # 在滑板场上跑完整对局
SR_MAP=canton node tools/smoke-test.js  # 在西關大屋上跑完整对局
```

```
src/
  style.css  body.html       界面样式与结构
  js/01_core.js              工具函数、音效与音乐、渲染器、程序纹理
  js/02_world.js             地图（码头 / 滑板场）、曲面地形、涂地系统、墨水着色器、竞技场建模
  js/03_env.js               天空、海面、城市等环境
  js/04_data.js              武器 / 副武器 / 必杀技数据、玩家存档
  js/05_character.js         角色模型、移动、潜墨、武器逻辑
  js/06_fx.js                粒子、子弹、炸弹、飞溅
  js/07_ai_input.js          寻路图（分层、走/潜/跳/爬）、战术点、队伍指挥、机器人、输入、镜头
  js/08_game.js              界面、对局流程、启动
vendor/three.min.js          Three.js r158（MIT）
tools/                       构建与测试脚本
```

开发流程和分支规范见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)，版本记录见 [CHANGELOG.md](CHANGELOG.md)。

---

<sub>个人学习项目，玩法受墨水涂地类射击游戏启发，角色、美术、代码均为原创。非官方作品，与任天堂无任何关联。</sub>
