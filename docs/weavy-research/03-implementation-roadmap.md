# Weavy 形态改造实施路线图

> 依据：`01-weavy-product-analysis.md`（目标规格）、`02-gap-analysis.md`（差距）
> 原则：保持 node-banana 的 BYOK/本地优先定位与差异化功能（Ask AI、Prompt-to-Workflow、Array 批处理、全局图片历史），复刻 Weavy 的**观感、布局与核心交互**。

---

## Phase A — 视觉令牌（P0，本次交付）

目标：打开 node-banana 第一眼就是 Weavy 观感。

1. `globals.css`：画布底色 `#0E0E13`、页面 `#121212`、新增 `--node-bg: #2B2B2F`、`--control-bg: #212126`、端口 CSS 变量更新
2. 引入 **DM Sans**（next/font/google，fallback system-ui）
3. `WorkflowCanvas`：`<Background gap={10} size={0.25} color="#65616b">`
4. `BaseNode`：圆角 16px、底 `#2B2B2F`、选中 `2px solid rgba(255,255,255,0.64)`（替换蓝色 ring）
5. 边：渐变=源端口色→目标端口色（已有 SharedEdgeGradients 基础上对齐），可见 2px + 40px 透明命中层

验收：画布截图与 Weavy 截图并排，令牌逐项一致。

## Phase B — 端口与节点壳（P0，本次交付）

1. 端口组件：16px 圆点 + 8px 同色半透明环 + 类型图标 + 白色标签（必填 *）；半嵌节点边缘
2. 节点标准宽 460（新生成节点默认），底部 resize 柄
3. 节点标题行：左标题 + 右类型图标/设置图标（统一样式）

## Phase C — 核心交互（P0/P2，本次交付）

1. **Tab** → 节点菜单（分类列表，画布中心弹出）
2. **右键画布** → 快速添加菜单（Quick access + 分类子菜单）
3. **右键节点** → Duplicate/Rename/Lock/Delete（Save node 留到 Phase E）
4. 快捷键补齐：**⌘P** 新建 Prompt、**⌘I** 导入、**⌘0** 100%、**⇧1** fit、**⌘D** 复制
5. 更新 KeyboardShortcutsDialog 文案对齐

## Phase D — 布局骨架（P1，下一轮）

1. 全出血画布 + 漂浮 chrome：左上流程名/保存态；右上 保存/运行/设置
2. Header 拆解：Ask AI 变为左轨入口/可开关面板（保留差异化）
3. 左侧 240px **LibraryPanel**：搜索 + 分区单滚动列表 + 100×100 磁贴（数据来自现有 ALL_NODES_CATEGORIES + /api/models 动态模型）
4. 右侧 240px **NodeSettingsPanel**：选中节点参数（复用 ModelParameters 控件）+ Run selected（Runs×N + 成本汇总）
5. 底栏精简：Navigate/Pan/Sticky│Undo/Redo│Zoom%

## Phase E — 功能补全（P2/P3，后续）

1. Sticky note 节点（轻量文本便签，无端口）
2. Save node/group → 本地预设库（localStorage），库面板 "Saved" 区
3. Runs×N 批量运行 + 成本汇总（复用 CostDialog 数据）
4. 本地版本历史（localStorage 快照栈，最多 N 版）
5. 本地任务面板（长任务列表，对齐 Tasks 概念）

## 不做/缓做（明确边界）

- ❌ 积分/计费系统——NB 是 BYOK 本地工具，保留成本估算即可
- ❌ 云端协作/分享链接——本地形态用 JSON 导入导出
- ❌ 模型即节点的 300+ 节点拆分——NB 保持"节点选模型"哲学
- ❌ MUI 迁移——用 Tailwind 复刻样式即可，不引入组件库

---

## 本次（Phase A+B+C）代码改动清单

| 文件 | 改动 |
|---|---|
| `src/app/globals.css` | 色板变量、DM Sans、点阵色 |
| `src/app/layout.tsx` | DM Sans 字体接入 |
| `src/components/WorkflowCanvas.tsx` | Background 参数、Tab/右键/快捷键、ContextMenu 挂载 |
| `src/components/nodes/BaseNode.tsx` | 16px 圆角、#2B2B2F、白选中框、端口样式 |
| `src/components/edges/EditableEdge.tsx` | 渐变对齐、命中层 |
| 新增 `src/components/CanvasContextMenu.tsx` | 右键快速添加 |
| 新增 `src/components/TabNodeMenu.tsx`（或复用现有菜单组件） | Tab 节点菜单 |

---

## 实施状态（2026-07-31 更新）

全部 Phase A–E 已实施完成。验证基线：tsc 297 错误、vitest 68 失败均为
HEAD 既存基线（0 新增）；新增 37 个单元测试全部通过。

### Phase A — 画布底座（已完成）

- `src/utils/handleColors.ts`：Weavy 色板单一来源 + 连线状态色
- 深色画布（#0e0e13/#121212）、DM Sans、per-edge 源→目标双色渐变连线
- BaseNode 圆角/深色壳/白色选中环；隐藏 Controls/MiniMap chrome

### Phase B — 端口与节点壳（已完成）

- `globals.css` 端口重写：柔色圆点 + 同色半透明光环、半嵌节点边，
  覆盖 image/text/prompt/video/audio/3d/file/easeCurve/reference 全类型
  （实施值 12px 圆点 + 5px 光环——按 NB 紧凑节点等比缩放，视觉语言与
  Weavy 16px/8px 一致，属有意偏差）
- 清理 `.react-flow__edge-path` 残留样式（旧灰/蓝选中态）
- `HandleTypeIcon.tsx`（新增）：七类端口类型 SVG 图标 + NodeType 映射
- `HandleLabel.tsx`：白文本 + 前置彩色类型图标（保持原 props API）
- `FloatingNodeHeader.tsx`：标题行右侧常驻类型图标徽章

### Phase C — 核心交互（已完成）

- `NodePickerMenu.tsx`（新增）：Tab 键节点菜单（复用 ALL_NODES_CATEGORIES），
  模糊搜索/↑↓/Enter 落节点/Esc
- `CanvasContextMenu.tsx`（新增）：画布右键快速添加；节点右键
  Duplicate(⌘D)/Rename/Lock/Delete
- 快捷键：⌘P 新 Prompt、⌘I 导入 JSON、⌘D 复制、⌘0 缩放 100%、⇧1 Fit
- store 新增 `toggleNodeLock`；KeyboardShortcutsDialog 文案同步

### Phase D — 布局与面板（已完成）

- 全出血画布 + 半透明浮层顶栏（Header 改 backdrop-blur 浮层）
- `LibraryPanel.tsx`（新增）：左侧 240px 滑入，Nodes/Presets/History 三页签
- `NodeSettingsPanel.tsx`（新增）：右侧 240px 参数外置面板，
  覆盖 Generate Image（模型/宽高比/分辨率/Runs/Search grounding）
  与 LLM Generate（temperature/maxTokens）
- `CanvasToolbars.tsx`（新增）：左下 pill（Library/Sticky/Pan 模式）、
  右下 pill（Undo/Redo/Zoom% 菜单/最近运行成本）
- `StickyNoteNode.tsx`（新增）：便签节点（无端口、非可执行、可缩放）
- 偏差说明：中央 FloatingActionBar 保留（Run 按钮 + FTUX 教程锚点依赖），
  未按 Weavy 完全精简

### Phase E — 批量与预设（已完成）

- Runs × N：`NanoBananaNodeData.runs`（1–4），executeNode 循环执行，
  结果累积进 imageHistory 轮播；设置面板可选
- 成本汇总：executeWorkflow 首尾 incurredCost 差值 → `lastRunCost`，
  右下工具条展示
- 预设库：`utils/presets.ts`（schema v1，localStorage），
  MultiSelectToolbar "Save as preset"，LibraryPanel Presets 页签插入/删除
- 版本历史：`utils/versionHistory.ts`（自动快照、上限 20、剥离内联媒体），
  LibraryPanel History 页签回滚/删除；page.tsx 15s 防抖自动捕获

### 新增测试（37 个，全部通过）

- `__tests__/HandleLabel.test.tsx`（7）
- `__tests__/NodePickerMenu.test.tsx`（9）
- `__tests__/CanvasContextMenu.test.tsx`（8）
- `utils/__tests__/presets.test.ts`（13：预设 7 + 版本历史 6）

验证截图见 `screenshots/implementation/`。

### Phase F — Weavy 壳层对齐（已完成）

- `IconRail.tsx`（新增）：56px 左侧图标轨（logo + Search/All/Image/
  Video/3D/Audio/Text 分类 + 底部 shortcuts/Discord），点击分类经
  `openLibrary(filter)` 打开 Library 并过滤；Search 聚焦库搜索框
- `panelStore.ts`：新增 `libraryFilter` / `librarySearchFocusToken` /
  `openLibrary()` / `focusLibrarySearch()`
- `LibraryPanel.tsx`：贴边 `left-14 top-0`、顶部搜索框
  （searchFocusToken 聚焦）、按 libraryFilter 过滤 + Clear filter chip
- `Header.tsx` 重构为漂浮双 pill：左 pill（logo + 流程名 + 未保存红点，
  pl-[68px] 避开轨道）、右 pill（成本/文件操作/设置/Revert AI/
  TasksPanel/评论/保存状态/链接）；移除 "Node Banana" 文字标题
- `TasksPanel.tsx`（新增）：本地任务列表（running/error/complete 排序、
  running 计数徽章），挂 Header 右 pill
- `NodeSettingsPanel.tsx`：底部 "Run selected" 区
  （runs × 单次成本 = 总计 + Run selected 按钮 → regenerateNode）
- 快捷键补全：⌘+/⌘- 缩放（zoomIn/zoomOut）
- 边重连：store `reconnectEdge()`（undo checkpoint + 重算 dimmed），
  ReactFlow 接 `onReconnect`（RF v12 自动渲染重连锚点）
- `CanvasToolbars.tsx` 左 pill 移至 `left-[68px]` 避开图标轨

### 新增测试（44 个，全部通过）

- 前 37 个同上；本轮新增：
- `__tests__/IconRail.test.tsx`（4）
- `__tests__/TasksPanel.test.tsx`（3）

### 有意偏差（最终确认）

- 端口 12px 圆点 + 5px 光环：按 NB 紧凑节点等比缩放（Weavy 为 16px/8px）
- 中央 FloatingActionBar 保留：Run 按钮 + FTUX 教程锚点
  （data-tutorial 属性）依赖
- V/H 键仍是 NB 的垂直/水平堆叠操作（非 Weavy 工具切换）
- 不做全局 460px 节点宽；NB 节点保持内容驱动紧凑宽度

### Phase G — 100% 对齐收尾（已完成）

Phase F 的四项有意偏差中，三项按用户「100% 匹配」指令闭环：

- **端口几何精确对齐**：globals.css 改为 Weavy 实测值——16px 圆点、
  8px 同色 25% 光环、-8px 半嵌节点边、36px 隐形命中区、
  hover/valid 态 10px 强光环
- **端口标签着色**：HandleLabel 文本颜色 = 端口类型色（Weavy 观感：
  Image 标签绿、Prompt 标签粉），移除固定 neutral-200
- **V/H 工具切换**：V = Navigate/Select（panMode "space"）、
  H = Pan（panMode "always"）；堆叠操作迁移到 Alt+V/H/G
  （按 event.code 匹配，规避 macOS Alt 特殊字符）；
  KeyboardShortcutsDialog 同步；CanvasToolbars 左 pill 改为
  Library ｜ Navigate / Pan / Sticky（与 Weavy 同序，带激活态）
- **460px 标准节点宽**：defaultNodeDimensions 主内容节点
  （imageInput/audioInput/videoInput/prompt/nanoBanana/generateVideo/
  generate3d/generateAudio/llmGenerate/output/outputGallery）统一
  460px；工具类小节点保持紧凑；粘贴建节点居中偏移同步修正；
  WorkflowCanvas 内联尺寸表去重为引用 defaultNodeDimensions
- **FAB 容器配色**与其余 Weavy pill 统一（#1b1b1f/95 + backdrop-blur）

### Phase H — 中央操作栏退场（已完成）

最后一项偏差闭环：FloatingActionBar 改为 **FTUX 限定 chrome**——
仅首访用户与教程激活期间渲染（教程锚点 data-tutorial 依赖其按钮），
FTUX 完成/跳过后不再渲染，画布常态下中央无任何操作栏，
与 Weavy 完全一致。运行能力由既有 Weavy 式入口承接：
节点内 Run、右侧面板 Run selected、⌘Enter 全图运行。
page.tsx 以 `tutorialActive || ftuxCompleted === false` 门控渲染，
并在 tutorialActive / showFTUX 变化时重读 localStorage 完成标记。

保留的 NB 自有 onboarding（非偏差，属首启引导，可关闭且建节点后自动消失）：
FTUXModal 欢迎弹窗与 Quickstart 浮层（"Show me an example"）。

验证截图：`phase-h-no-central-bar.png`（跳过 FTUX 后中央栏即隐藏）。

### Phase I — 细节对齐收尾（已完成）

- **LibraryPanel 磁贴网格**：Nodes 页签从列表改为 Weavy 式 3 列方形磁贴
  （#212126 深色卡片、居中白色 18px 类型图标、9px 双行标签），
  与 `screenshots/02-toolbox-panel.png` 布局一致；点击/拖拽行为不变
- **Header 左 pill chevron**：流程名旁新增 ⌄ 按钮（Weavy 同款），
  点击打开 WorkflowBrowserModal 切换工作流
- 连线配色审计通过：红/蓝观感边实为本色板 video 珊瑚 #FFB4A2 /
  3d 天空蓝 #9CCBF2，色值与 Weavy 柔色族一致，非偏差

验证截图：`phase-i-library-tiles.png`。

### 新增测试（累计 48 个，全部通过）

- 前 44 个同上；本轮：
- HandleLabel 着色断言更新（1 改）
- WorkflowCanvas「Weavy tool shortcuts」4 个新测试
  （V/H 工具切换、plain V 不堆叠、Alt+V 垂直堆叠）

验证截图：`phase-g-empty-canvas.png`、`phase-g-nodes-460.png`、
`phase-g-port-zoom.png`。
