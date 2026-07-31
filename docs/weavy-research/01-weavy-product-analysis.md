# Weavy 产品深度调研报告

> 调研时间：2026-07-30 ｜ 调研方式：真实登录会话（app.weavy.ai 实测 DOM/样式/交互）+ 官方帮助中心（help.weavy.ai）+ 公开资料
> 目标：为 node-banana 复刻 Weavy 产品形态提供 100% 准确的交互与 UI 规格

---

## 1. 产品定位

- **Weavy**（2025 年 10 月被 Figma 收购，现品牌为 **Figma Weave**）是面向创意专业人士的**节点式 AI 工作流平台**。
- 核心理念：**"craft over chat"** —— 不是聊天式生成，而是把每一个生成模型、编辑工具、LLM 都变成画布上的节点，创作者对每个节点有完全控制权。
- 模型无关（model-agnostic）：一个画布上混用数百个模型（图像/视频/3D/音频），按节点独立运行、按用量计费（credits）。
- 平台化能力：Saved（节点/模型/组合预设库）、Groups（节点组保存复用）、Tools（把工作流发布成可复用工具）、分享/协作（付费）。

## 2. 技术栈（实测确认）

| 层 | 技术 | 证据 |
|---|---|---|
| 画布 | **React Flow**（与 node-banana 相同！） | `.react-flow__node` / `.react-flow__edge` / `.react-flow__handle` |
| UI 组件库 | **MUI (Material UI)** | `MuiBox-root` / `MuiMenu-root` / `MuiToggleButton-root` |
| 字体 | **DM Sans** | `fontFamily: "DM Sans", system-ui, ...` |
| 特性 | React Flow 多连接模式 | `.react-flow.multi-connect-enabled` |

对 node-banana 的意义：底层画布库相同，复刻工作集中在**自定义节点渲染、边渲染、面板布局、交互模式**四层，不需要换框架。

## 3. 设计令牌（实测提取，可直接落代码）

### 3.1 颜色

| 用途 | 值 | 实测来源 |
|---|---|---|
| 页面底色 | `#121212` | body computed bg |
| 画布底色 | `#0E0E13` | `.react-flow` computed bg |
| 节点底色 | `#2B2B2F` | `.node-header` computed bg |
| 控件底色（下拉/按钮） | `#212126` | 参数下拉按钮 computed bg |
| 微弱填充（次按钮） | `rgba(255,255,255,0.04)` | Share / Run selected 按钮 |
| 点阵背景 | 圆点 `#65616b`，r=0.25，间距 10px | `.react-flow__background` pattern |
| 选中态 | 内框 `2px solid rgba(255,255,255,0.64)` | selected 节点 computed border |
| 文字主色 | `#FFFFFF` | — |
| 文字次级 | `rgba(255,255,255,0.8)` / `0.4`（禁用） | 节点按钮 |

### 3.2 端口/连线颜色（数据类型编码，Weavy 的签名特征）

| 类型 | 颜色 | 实测 |
|---|---|---|
| Prompt/文本 | `#F1A0FA`（粉紫） | prompt 端口 computed bg |
| Image | `#6EDDB3`（薄荷绿） | image 端口 computed bg |
| File（通用文件） | `#FEFFF1`（米白） | import/preview 端口 computed bg |

**连线 = 从源端口颜色到目标端口颜色的线性渐变**（SVG linearGradient，userSpaceOnUse），可见线宽 2px，另有 40px 透明命中层方便点选。贝塞尔曲线（React Flow 默认 bezier）。边两端有 `edgeupdater` 圆点可拖拽重连。

### 3.3 形状与排版

- 节点圆角 **16px**；控件/磁贴圆角 4px；运行按钮圆角 8px
- 节点标题 16px DM Sans regular；正文 12px；徽章（如 "New"）10px、bg `rgba(255,255,255,0.16)`、圆角 2px
- 端口：16px 圆点 + 8px 同色描边环（视觉上是带环的实心点），圆点内有类型小图标，端口旁有白色文字标签（如 `Prompt*`——`*` 表示必填）

## 4. 界面布局（1600×1000 视口实测坐标）

```
+------------------------------------------------------------------+
| rail | [流程名v](71,15,220x48)      [3.6 credits Share Tasks](右) |
| 56px |                                                           |
| logo |   +-库面板(56,0,240x1000,滑入滑出)-+                       |
| 9icons|  | Search...                     |      画布(点阵)        |
|      |   | Quick access / Saved /       |                        |
|      |   | Toolbox / Image Models /     |                        |
|      |   | Video / 3D / Audio /         |                        |
|      |   | Community (单滚动列表)         |                        |
|      |   | 磁贴 100x100 可拖拽            |                        |
|      |   +------------------------------+                        |
|      |                         +-设置面板(1360,0,240x1000)-----+  |
|      |                         | 节点参数 / 运行 / 成本         |  |
|      |                         +------------------------------+  |
|      |      [底栏: Navigate|Pan|Sticky|Undo|Redo|50%v](居中)      |
+------------------------------------------------------------------+
```

五个关键区域：

1. **左侧图标轨（56px）**：logo（=工作区文件菜单）+ 9 个工具图标（search / recent / assets / toolbox / image / video / threedee / audio / models），底部 help + Discord。图标即库面板的分区跳转。
2. **库面板（240px，滑入滑出）**：顶部搜索框 + "Quick access"（最近/常用磁贴）+ **一条约 17922px 高的单滚动列表**，分区依次为 Saved（工作区共享预设）、Toolbox（编辑工具）、Image Models、Video Models、3D Models、Audio Models、Community Models。磁贴 100×100、可拖拽、带彩色类型图标，新模型带 "New" 徽章。
3. **顶部**：左 = 流程名按钮（下拉：重命名等）；右 = credits 余量、"Share"（付费可用）、"Tasks"（后台任务队列）。
4. **右侧设置面板（240px，选中节点时滑入）**：节点名、单次运行成本、参数下拉（Model/Quality/Resolution…，207×26、#212126）、"Run selected nodes" 区（Runs 步进器 N 次、Total cost 汇总、Run selected 按钮）。
5. **底部居中工具栏（266×44）**：Navigate（选择，快捷键 V）/ Pan（抓手，H）/ Sticky note │ Undo / Redo │ 缩放菜单（50%，含 ⌘+ ⌘- ⌘0 ⇧1）。当前工具按钮白底反色。

## 5. 节点解剖（实测 4 种）

统一规格：宽 **460px**、圆角 16px、#2B2B2F；顶部标题行（左标题 + 右侧类型图标/设置图标）；输入端口在左边缘（x=-14，半嵌）、输出端口在右边缘；底部可拖拽 resize。

### 5.1 Prompt 节点（`promptV3`）

- 标题 "Prompt" + 粉色类型图标；contenteditable 正文区（灰占位示例文本）
- 输出：`output-prompt`（粉色 #F1A0FA，标签 "Prompt"）
- 新建时自动选中，初始 230×204，可拉宽到标准 460

### 5.2 模型节点（`custommodelV2`，例：ChatGPT Images 2.0 Edit）

- 标题 "ChatGPT Images 2.0 Edit" + 右上"滑杆"图标（打开右侧参数面板）
- 输入端口按行排列：`Prompt*`（粉，必填）、`Image*`（绿，必填）…
- **"Add another image input" 虚线按钮**：动态增加输入端口（多图输入）
- 节点内嵌 **"Run Model" 按钮**（120×36，圆角 8；无积分时置灰 rgba 0.4）
- 节点内嵌**成本/状态文案**："Not enough credits to run the model. Upgrade to get more credits."
- **节点本体只放端口+运行+状态；所有参数在右侧设置面板**（Model: GPT Image 2 / Quality: medium / Resolution: Auto）

### 5.3 Import 节点（`import`）

- 标题 "File"；大号虚线拖放区 "Drag & drop or click to upload"；输出 `File`（米白）

### 5.4 Preview 节点（`preview`）

- 标题 "Preview"；输入 `File`（米白）；内容区显示结果预览

### 5.5 节点右键菜单（实测）

`Save node`（存入工作区预设库）/ `Duplicate ⌘D` / `Rename` / `Lock` / `Delete`

## 6. 交互清单（实测 + 官方文档）

### 6.1 画布交互

- **右键空白画布 -> 快速添加菜单**：顶部 8 个 Quick access 项 + Saved + 六个分类子菜单（Tools/Image/Video/3D/Audio/Custom models）
- **Tab = 打开节点菜单**（官方快捷键）
- **⌘P = 新建 Prompt 节点**；**⌘I = 导入文件**
- **从端口拖线到空白 + 按住 Option/Alt -> 松手弹出节点建议菜单，选中即自动连接**（ConnectionDropMenu 的 Weavy 版）
- 拖线连接：React Flow pointer 拖拽，松手即连
- 边可选中删除；边两端圆点可拖拽改接
- 框选多节点 -> 右键 -> **Save group**（存为带缩略图的组合预设）
- Navigate/Pan 两种模式（V/H 切换）；Sticky note 模式（工具栏）
- 缩放：⌘+ / ⌘- / ⌘0（100%）/ ⇧1（fit）；底栏显示百分比

### 6.2 快捷键（官方文档全量）

| 快捷键 | 功能 |
|---|---|
| Tab | 打开节点菜单 |
| ⌘C / ⌘V | 复制 / 粘贴 |
| ⌘D | 复制选中节点 |
| ⌘Z / ⌘⇧Z | 撤销 / 重做 |
| ⌘P | 新建 Prompt 节点 |
| 拖线 + Option/Alt | 松手出节点建议并自动连接 |
| V / H | 选择 / 抓手工具 |
| ⌘I | 导入文件 |
| ⌃⇧? | 快捷键面板 |

### 6.3 执行模型

- **节点级独立运行**：每个模型节点自带 "Run Model"，可只跑单个节点
- **批量运行**：右侧面板 "Run selected nodes"——Runs（N 次）× Total cost（积分汇总）-> "Run selected"
- **积分制**：每次运行扣 credits（如 GPT Image 2 = 9 credits/次）；顶部实时显示余量；不足时节点内警告 + 按钮置灰
- **Tasks 面板**：后台任务队列（生成是异步的）
- 运行结果写入下游 Preview/Export 节点；同一条流可反复调参重跑

### 6.4 资产与预设

- **Saved 区**：保存模型预设（含参数）/ 单个工具节点 / 节点组（可选缩略图），工作区成员共享，可从库面板或右键菜单直接拖到画布
- **Assets**：工作区级素材库（左边缘竖排标签入口）
- **Tools**：把整个工作流发布成"工具"（自定义节点），参数即输入端口——工作流套工作流

## 7. 完整模型目录（实测库面板，分区结构）

- **Toolbox（编辑工具）**：Editing（Rotate/Color palette/Color correction/Levels/Compositor/Painter/Crop/Resize/Blur/Invert/Channels/Extract Video Frame/Video to GIF）｜Matte（Mask Extractor/Mask by Text/Matte Grow·Shrink/Merge Alpha/Video Matte/Video Mask by Text）｜Text tools（Prompt/Prompt Concatenator/Prompt Enhancer/Any LLM/Image·Video·Audio Describer）｜Iterators（Text/Image/Video Iterator）｜Helpers（Import/Export/Preview/Import LoRA(s)/Video Concatenator/Router/Output/Depth Anything V2/Compare/Kling Element/Runway Aleph 2 Keyframe/Blend/Gen Effect）｜Datatypes（Number/Text/Toggle/List Selector/Seed/Array）
- **Image Models**：文生图 25+（ChatGPT Images 2.0、Flux 2 全系、Imagen 3/4、Recraft V3/V4、Ideogram V3/V4、SD3.5、Reve 2.1、Krea 2…）｜矢量（Recraft SVG/Vectorizer）｜编辑（Nano Banana 2/Pro/Lite、Seedream V4.5/V5.0、Kontext、Inpaint/Outpaint/去背景/Relight/Try-On…）｜图生图（Redux/ControlNet/Canny/Depth…）｜增强（Topaz/Magnific/Enhancor/Recraft Crisp）
- **Video Models**：文/图生视频 35+（Gemini Omni Flash、Seedance 2.0、Kling 3、Veo 3.1、Sora 2、Runway Gen-4.5、Luma Ray 3.2、Wan 2.7、Pixverse 6、Higgsfield、HeyGen Avatar 5、LTX 2.3…）｜视频编辑（Aleph 2、Kling o3/o1、Veed…）｜Lip sync（Omnihuman、Sync 2 Pro…）｜增强（Topaz、Real-ESRGAN…）
- **3D Models**：Meshy V6、Tripo H3.1、SAM 3D、Rodin V2、Hunyuan 3D V3、Trellis V2 ｜ 纹理：Patina 系列
- **Audio Models**：音乐（MiniMax Music v2.6、CassetteAI、Lyria 3）｜配音（MiniMax Speech v2.8、Seed Audio、Qwen-3 TTS、Chirp 3 HD）｜音效｜声音克隆｜Whisper 转写
- **Community Models**：36+ 社区/Comfy 系模型（ControlNet、IPAdapter、Real-ESRGAN、Face Swap、Tooncrafter…）

## 8. 平台层功能（非画布）

- 工作区文件菜单（logo）：Back to files / New file / Open recent / Duplicate / Rename / Share / **Version history** / Keyboard shortcuts / Preferences
- 积分账户体系（免费额度有限，Share 仅付费）
- 帮助中心 + Discord 社区入口常驻

---

## 附：调研证据文件

- `screenshots/01-canvas-empty.png` 空画布（左轨 + 点阵 + 底栏）
- `screenshots/02-toolbox-panel.png` 库面板打开态
- `screenshots/03-context-menu.png` 右键快速添加菜单
- `screenshots/04-prompt-node.png` Prompt 节点
- `screenshots/05-connected-nodes.png` 连线（渐变）
- `screenshots/07-right-settings-panel.png` 右侧设置面板
- `screenshots/08-assets-panel.png` / `09-tasks.png` 多节点全景
- `screenshots/10-nodebanana-current.png` node-banana 现状（对照）

> 注：部分截图受内置浏览器截图管线限制为 DOM 状态重建 + 成功帧组合；所有颜色/尺寸/坐标均来自 computed style 实测，非截图估读。
