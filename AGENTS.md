# AGENTS.md — dsh-conversation-map

面向在本仓库里工作的 agent（智能体）的项目规则。本文件是约束与命令清单，不是介绍文档；面向用户的说明在 `README.md` / `README.en.md`。

## 本文件如何进入上下文

- DeepSeek Harness 默认只加载 `AGENTS.md` 与 `CLAUDE.md`（以及 `*.local.md` 覆盖层）；单数的 `AGENT.md` **不会被加载**。不要改名，也不要额外造一份内容相同的 `AGENT.md` 制造第二处真源。若某个工具只认 `CLAUDE.md`，正确做法是 `ln -s AGENTS.md CLAUDE.md`，而不是复制内容。
- 每个会话在第一次请求前注入一次本文件（项目根 scope），注入形态是 `<system-reminder>` 里的 `Instructions from: AGENTS.md`。本文件属于项目根，本仓库不设子目录级 `AGENTS.md`。
- **没有文件监听**：本文件改动后，当前会话不会自动看到，要等下一次 `read` / `write` / `edit` 触碰该路径、或新开一个会话、或会话恢复时的重新校准。
- 用户级全局文件 `$DSH_HOME/AGENTS.md` 不在本仓库范围内；如果本规则没有生效，先用 `dsh --profile web --dump-config` 看 `agent-instructions` 行是否被 profile 改写（默认预算 65536 字节，本文件远低于此）。
- 用中文与用户沟通（用户是中文使用者），提交信息与代码注释也保持中文。范围不清、或改动会破坏既有行为时先问，不要猜。
- 所有提交之前必须先经过人工同意。
- 所有的版本最后都会合并到main分支

## 项目定位

`dsh-conversation-map` 是 DeepSeek Harness（`dsh`）的**纯客户端 Web 插件**，在对话区右侧渲染一条可拖动调宽的会话 minimap（色块 / 缩略图双模式、悬停放大镜、点击跳转、拖动滚动）。它不在 DSH monorepo 内，靠 DOM 选择器与平台模块对接宿主；DSH 处于 developer preview，接口会破坏性变更。

本机可用的 DSH 源码 checkout：`/development/deepseek-harness/deepseek-harness`（`pnpm dsh <args>` 即从源码启动 CLI）。核对平台 API、slot 名、构建契约时去那里看源码，不要凭记忆。

## 硬性约束

- **Host 半身永远无行为**：`index.js` 只导出空 `apply`（它的存在只是让插件出现在 host Loader 里）。任何 UI 逻辑都属于 `src/client/index.ts`。不要往 host 侧加服务、定时器或副作用。
- **三处标识必须一致**：`src/client/index.ts` 的 `name = 'conversation-minimap'` ↔ `cordis.patch.yml` 的 `id: conversation-minimap` ↔ `tsdown.config.ts` 的 `PLUGIN_ID = 'dsh-conversation-map'`（模块 id 用包名，patch 行 id 用短 id，宿主按包名解析模块）；`package.json` 的 `dsh.bundle.patch` 与 `exports["./client"]` 必须指向真实存在的文件。改任一处都要同步检查其余几处。
- **浏览器半身必须保持 lazy-CJS factory 产物**：`pnpm run build`（tsdown）产出 `lib/client.js`，外壳是 `window.__ModuleLoader__.load({ id: 'dsh-conversation-map', factory: (require) => { ... } })`，`lib/` 不入库（`.gitignore`）。缺 `lib/client.js` 时宿主在启动阶段直接抛错并给出构建指引；`dsh web` 也不校验产物新旧，重建必须手动做。
- **只有平台种子模块能保持 external**：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`（见 `tsdown.config.ts` 的 `PLATFORM_EXTERNALS`）。其余依赖一律内联；确需新的外部 specifier 时，除构建外还要在 `package.json` 的 `dsh.client.external` 里申报，否则浏览器侧解析失败。
- **不改 `package.json` 的 `dsh.client` 与 `files` 而不理解后果**：`dsh.client.platform` 必须保持 `"web"`（宿主只扫描 web 半身），`inject` 列的是 slot/服务硬依赖；`files` 白名单决定发布包里有什么，新增发布产物要同时加进去。
- **不碰用户机器级状态**：不修改 `$DSH_HOME`（默认 `~/.dsh`）下的 `profiles/`、`cordis.patch.yml`、`settings.yaml`；也不要在本仓库任务里改动 DSH checkout 的受跟踪文件（除非用户明确要求，且改的是 DSH 自身）。
- **不加网络请求、不加遥测、不引入新持久化**：除 localStorage 的宽度/收起状态外，本插件不写任何存储，不发任何请求。新依赖需先问用户（本插件目前除 peer 的 `react` 外零运行时依赖）。

## 目录布局

```
index.js              Host 半身：空 apply，纯占位
src/client/index.ts   浏览器半身：全部实现（组件、测量、交互、槽位注册）
src/client/geometry.ts 缩略图几何：纯函数（宽度定标、内容框矩形、垂直平移），无 DOM 依赖
src/client/style.ts   MINIMAP_CSS：构建时内联为字符串，运行时经 ctx.effect 注入
cordis.patch.yml      组合包层：按包名插入一行 conversation-minimap
tsdown.config.ts      构建配置：CJS + __ModuleLoader__ 包装、平台 external 白名单
tsconfig.json         typecheck 配置：strict、noEmit、types: []
package.json          版本、dsh.bundle / dsh.client / exports 契约
README.md            中文用户文档（与 README.en.md 成对，两语言同权）
```

新增 `src/` 下的模块会被内联进 `lib/client.js`（`files` 白名单不必改）；只有新增
需要浏览器侧解析的外部 specifier 才动 `package.json` 的 `dsh.client.external`。

## DOM 契约（唯一允许的宿主耦合面）

选择器一律来自 dsh 0.1.x 的 Web 会话列，改代码前先在那个 checkout 里核对：

- `[data-conversation-scroll]` — 会话滚动容器。**切换会话时框架会整体重建会话列**，该节点每次都是新的：不要长期持有引用，每次计算重新解析；观察器挂在稳定祖先 `[data-slot="conversation"]`（缺失时退回 `document.body`），滚动监听在节点变化时重绑。
- `[data-chat-flow]` — 会话内容流容器，缩略图克隆与内容高度基准的唯一来源。
- `[data-chat-anchor-key]` / `[data-chat-flow-kind]` — 每条会话节点行及其类型（`KIND_LABELS` 已覆盖的类型必须继续可读，出现新 kind 时按 `unknown` 兜底而不是崩）。
- `[data-composer-seat]` — 底部输入区，地图要避开它；它同时是**可见内容的下界**（平台 `ui-chat` 的 `pagingAnchor` 同样取它的顶边当可见下界）：内容框高度按「滚动容器可视高 − 输入区高」算，被输入区盖住的那一段不算"屏幕上正在显示"。
- 槽位：只注册 `shell.overlay`（`kind: 'list'`, `scope: 'root'`），通过 `ctx.slots.inject` 等待槽位声明；`slots` 是硬依赖，写在客户端 `inject` 里。

## 运行时状态与样式边界

- `localStorage` 键固定在 `dsh-conversation-map:width` / `dsh-conversation-map:collapsed`；读写都要包 `try/catch`（隐私模式下存储不可用必须退回默认值，不能抛）。
- 样式必须以 `<style data-plugin="dsh-conversation-map" data-plugin-css="dsh-conversation-map/minimap.css">` 形式经 `ctx.effect` 注入并在清理函数里移除——`data-plugin-css` 是宿主热重载清理样式标签的依据，不能省。
- 只用主题语义令牌 `var(--dsw-alias-*)`，并保留不支持的浏览器上的兜底声明（`style.ts` 现有写法：先写 `rgba(...)` 再写 `color-mix(...)`）。
- 鼠标/指针交互统一走 pointer events + `setPointerCapture`；拖动、调宽、放大镜的 ref 状态与 React state 同步规则照现有实现，**渲染路径里既不读未同步的 state，也不读布局**（量测值一律由 `compute()` 存进 ref 后再在渲染/指针路径读，如 `flowWidthRef`、`visibleTopPxRef`）；指针事件给的是视口坐标、几何算的是轨道坐标，换算必须显式做（`root.getBoundingClientRect().top`）。
- 已知性能约束：流式输出期间不得无节流地克隆/测量 DOM（现状 `THUMB_CLONE_INTERVAL = 200ms` + rAF 合并 + pending 去重）；改动量测逻辑时保持这个节流契约，否则长会话会掉帧。被节流的是**克隆与量测**；缩略图的仿射变换（`applyThumbScale`，只写 `transform`）必须**每帧**跟随滚动，否则框（每帧重算）会与框下内容错位。
- 缩略图模式的内容框与平移是同一件事：几何里平移由框位反推（`ty = 框顶 − 框所框内容坐标 × s`），不变量是「框内所见 === 屏幕所见」（见 `src/client/geometry.ts` 的 `thumbTransformFor`）。不要给 `ty` 或框矩形另加钳制，也不要在渲染路径重复钳制——那正是「缩略图模式开始画内容框」那一版把框与内容错位两屏的成因。

## 构建与验证

```sh
pnpm run build       # tsdown → lib/client.js（构建产物，git 忽略）
pnpm run typecheck   # tsc -p tsconfig.json --noEmit（tsdown 不做类型检查）
```

首次工作前先 `pnpm install`（`prepare` 钩子会顺带构建一次）。

`tsconfig.json` 是 `types: []` + `strict`：`src` 里不要写 `node:*` 导入或依赖 Node 全局类型。

产物契约自检（改过构建配置或依赖时必须跑）：

```sh
node -e "const s=require('fs').readFileSync('lib/client.js','utf8');if(!s.includes('__ModuleLoader__.load'))throw new Error('missing module loader wrapper');if(!/require\(['\"]react['\"]\)/.test(s))throw new Error('react must stay external');console.log('bundle contract ok')"
```

几何不变量自检（改过 `src/client/geometry.ts` 或量测/框渲染时必须跑；Node ≥ 22.6 原生剥离类型，
直接 import 源文件、不必先构建。路径经 argv 传入，命令里不出现引号，bash / pwsh 通用）：

```sh
node --input-type=module -e "const g=await import(process.argv[1]);const S=[[200,700,900,20000,650],[320,567,900,1600,800],[320,105,900,300,800],[320,200,900,300,800],[320,560,900,2400,800],[320,120,900,6000,220],[320,400,200,3000,800],[320,600,900,400,900]];let bad=0,n=0;for(const [W,H,contentW,contentH,visiblePx] of S){const s=g.thumbScaleFor(W,contentW);const scaledH=contentH*s;const span=Math.max(1,contentH-visiblePx);const sliding=scaledH>H;let prev=-1;for(const p of [0,0.1,0.25,0.5,0.75,0.9,1]){const raw=p*span;const t=g.thumbTransformFor(W,H,contentW,contentH,raw,visiblePx,s);n=n+1;if(t===null){bad=bad+1;continue}const vt=Math.min(Math.max(0,raw),t.contentSpan);const back=g.thumbFrameToContentTop(t,t.viewportTop);if(Math.abs(t.ty+vt*t.s-t.viewportTop)>1e-9)bad=bad+1;if(t.frameRange<=0?(back!==null):(Math.abs(back-vt)>1e-9))bad=bad+1;if(t.viewportTop<-1e-9||t.viewportTop+t.viewportH>H+1e-9)bad=bad+1;if(sliding&&(t.ty>1e-9||t.ty<H-scaledH-1e-9))bad=bad+1;if(sliding&&t.viewportTop<prev-1e-9)bad=bad+1;prev=t.viewportTop}}console.log(String(n)+' cases, '+String(bad)+' violations');if(bad>0)throw new Error('geometry invariant broken')" ./src/client/geometry.ts
```

## 开发回路（把改动接进正在跑的 Web GUI）

```sh
# 1) 先在本仓库构建出 lib/client.js（缺它宿主会在启动时报错）
cd /data/code/dsh_dev/dsh-conversation-map && pnpm install

# 2) 在 DSH 源码 checkout 根目录，把 web profile 的依赖指向本仓库目录（一次即可）
cd /development/deepseek-harness/deepseek-harness
pnpm dsh plugin --profile web add /data/code/dsh_dev/dsh-conversation-map
# → dsh-conversation-map 以 link: 形式进入 profile 依赖与 dsh.profile.bundles

# 3) 之后每次改完源码
cd /data/code/dsh_dev/dsh-conversation-map && pnpm run build
```

验证链接是否生效：`~/.dsh/profiles/web/node_modules/dsh-conversation-map` 应是指向本仓库目录的软链（`ls -la` 看箭头），此时 profile 读到的 `lib/client.js` 就是本地构建产物。

- 宿主每 500ms stat-poll 每个客户端 bundle 并重新哈希，`lib/client.js` 一变就通过 SSE 通知浏览器重载对应插件，**不需要刷新页面**；插件集合本身变化（新增/移除插件）才需要重启 `dsh`。
- ⚠️ 若 `~/.dsh/profiles/web/node_modules/dsh-conversation-map` 是指向本仓库的软链，profile 读的就是本地构建产物（已实测）；若它仍是普通目录，说明 profile 装的还是 npm 上的旧版本——必须先做第 2 步，否则**改了没效果**。
- 发布用的产物由 `pnpm publish` 触发 `prepare`（即 `tsdown`）；不要手工提交 `lib/`。

## 交付纪律

- **双语文档同步**：用户可见行为变化同时更新 `README.md` 与 `README.en.md`（两语言必须说同样的话，不添加、不遗漏）。
- **版本号跟分支走（`main` 除外）**：非 `main` 分支上的版本号必须等于**当前分支名**去 `v` 后的值（分支 `v0.1.8` → `0.1.8`），**不随提交递增**——只有新建 `vX.Y.Z` 分支时才变。以下四处必须完全一致，不得只改其中一处：
  1. `package.json` 的 `version`；
  2. `README.md` 的「当前版本」与 `README.en.md` 的 `Current version`；
  3. 两份 README 安装章节里固定版本号的示例（`dsh plugin --profile web add dsh-conversation-map@X.Y.Z`）；
  4. **本分支上每次提交信息末尾的版本号**（如 `…，v0.1.8`）。
  校验方式：`git branch --show-current` 与 `package.json` 对照。若发现本分支已有提交标了别的版本号，就地改齐——提交尚未推送时用 `git rebase -i` 的 `reword` 改写（不要留下同一个分支上两个版本号）；已合并进 `main` 的历史提交与其版本号一律不回溯修改。`main` 是各版本分支的汇合分支、名字里没有版本号，故不受此约束；它上面的版本号取最后一次合并进来的版本即可，不要求等于任何分支名。
- **提交信息沿用仓库风格**：`feat:` / `fix:` / `docs:` + 中文摘要，行为变化带版本号（如 `fix: 缩略图恒等比缩放…，v0.1.6`）。一次提交只做一件事，不夹带无关格式化。
- **同一事实只有一处真源**：面向用户写 README，面向 agent 写本文件；同一规则要在两处出现时，必须同时改。
- **完成定义**：行为改动用 `pnpm run build` + 类型检查 + 上面的产物自检；涉及交互的改动用上面的 dev 回路在浏览器里实际点一遍（拖动、调宽、点击跳转、悬停放大、收起展开、切换会话）；最后 `git status --short` 确认只改了预期文件，没有把 `lib/`、`.idea/`、临时文件带进来。
