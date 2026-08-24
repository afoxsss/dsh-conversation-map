# dsh-conversation-minimap

> 会话代码地图（Conversation Minimap）—— DeepSeek Harness (`dsh`) Web 客户端插件。

在对话区右侧渲染一条可拖动的**会话代码地图**，像编辑器的 minimap 一样预览整段会话并快速滚动：

- **双模式**：宽度 < 50px 为**色块模式**（按消息类型着色：🔵 用户 / ⚪ 助手 / 🟡 工具调用 / 🟢 命令 / 🔴 错误，悬停弹出内容预览）；宽度 ≥ 50px 自动切换为**缩略图模式**（整段会话按比例缩微显示，能看到消息、代码块、卡片的真实结构）。
- **拖动调宽**：按住地图左侧把手左右拖动（10–320px），右缘固定，拖动时显示实时宽度徽标。
- **快速滚动**：点击任意位置跳转，按住拖动连续滚动；半透明视口指示条实时显示当前可见区域。
- **收起/展开**：悬停地图顶部点击 `»` 收起为 4px 细条，点击细条展开。
- **实时同步**：消息流式输出、工具调用、切换会话时自动刷新；开合侧栏/详情面板、窗口缩放自动跟随。

## 安装

### 从 GitHub（推荐，社区发现方式）

```sh
# 固定到某个 commit，避免后续推送悄悄改变安装时执行的代码
dsh plugin --profile web add github:your-name/dsh-conversation-minimap#<commit-sha>
```

> Git 安装会执行本包的 `prepare` 构建脚本。pnpm ≥ 10 首次会拦截构建并要求放行：按 `dsh` 提示把打印出的包名加入 profile 目录 `pnpm-workspace.yaml` 的 `allowBuilds`，然后重跑上面的命令。
>
> 放行构建 = 允许该包在你机器上安装时执行代码。请先审阅源码，并固定 commit。

### 从 npm

```sh
dsh plugin --profile web add dsh-conversation-minimap
```

### 本地 checkout / tarball

```sh
dsh plugin --profile web add ./dsh-conversation-minimap
# 或
dsh plugin --profile web add ./dsh-conversation-minimap-0.1.0.tgz
```

验证层已挂载，然后启动：

```sh
dsh --profile web --dump-config   # 应出现 "# == dsh-conversation-minimap" 层
dsh --profile web
```

卸载：`dsh plugin --profile web remove dsh-conversation-minimap`

## 兼容性说明

- DeepSeek Harness 处于 **developer preview**，接口会破坏性变更；本插件当前基于 `dsh` 0.1.x 的 Web 会话 DOM 契约实现：
  - `[data-conversation-scroll]` 会话滚动容器
  - `[data-chat-anchor-key]` / `[data-chat-flow-kind]` 会话节点行
  - `[data-composer-seat]` 底部输入区
- 插件为**纯客户端**：Host 半身是空实现，浏览器半身通过 `shell.overlay` 槽位挂载，仅使用平台模块 `react` 与 `slots` 服务，无网络请求、无持久化、无遥测。

## 开发

```sh
pnpm install
pnpm run build    # tsdown → lib/client.js（__ModuleLoader__ 工厂包壳）
```

构建产物契约：CJS + `window.__ModuleLoader__.load({ id, factory })` 包装；`react` 等平台模块保持外部引用，其余依赖全部内联（本插件除 `react` 外无其他依赖）。

## 自定义

- 缩略图阈值：`src/client/index.ts` 中的 `THUMB_MIN_WIDTH`（默认 50）
- 宽度范围：`WIDTH_MIN` / `WIDTH_MAX`（默认 10 / 320）
- 缩略图刷新节流：`THUMB_CLONE_INTERVAL`（默认 200ms）

## License

MIT
