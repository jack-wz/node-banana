# Weavy vs node-banana 深度差距对比

> 基于 `01-weavy-product-analysis.md` 的实测规格 vs node-banana v1.6.0 代码与运行实例（localhost:3000）
> 结论先行：**底层同构（React Flow），差距集中在视觉令牌、布局骨架、交互细节、平台层四档；node-banana 在生成能力广度（BYOK 多 provider、3D/音频、批处理、Prompt-to-Workflow）上反而有差异化优势。**

---

## 0. 总览评分

| 维度 | 相似度 | 说明 |
|---|---|---|
| 画布内核 | 95% | 同为 @xyflow/react，多连接、bezier 概念一致 |
| 视觉令牌 | 40% | 同为暗色系，但色值/圆角/点阵密度/选中态全部不同 |
| 布局骨架 | 45% | 都有左轨+画布+底栏；Weavy 无顶栏、有右侧设置面板，NB 有大 Header、无右面板 |
| 节点系统 | 55% | 都有自定义节点+类型化端口；Weavy 参数外置右侧、NB 参数内嵌节点 |
| 连线系统 | 70% | NB 已有 SharedEdgeGradients 渐变边与 EdgeToolbar；色板与命中层不同 |
| 交互清单 | 60% | NB 已有 V/H、⌘C/V/Z、ConnectionDropMenu、框选、分组；缺 Tab 菜单/右键快添/⌘P/⌘I/预设库 |
| 执行模型 | 50% | 都有节点级运行+成本估算；Weavy 有 Runs×N 批量、积分、云端任务队列 |
| 平台层 | 15% | Weavy：工作区/版本历史/分享/Assets/Tools；NB：localStorage+JSON 导入导出 |

## 1. 视觉令牌对比（逐项可改）

| 令牌 | Weavy | node-banana | 改造点 |
|---|---|---|---|
| 画布底色 | `#0E0E13` | `#0a0a0a`（globals.css `--background`） | 改 1 个变量 |
| 点阵 | 10px 间距 / r0.25 / `#65616b` | 20px 间距 / size 1 / `#404040` | WorkflowCanvas `<Background gap={10} size={0.25} color="#65616b">` |
| 节点底色 | `#2B2B2F` | `bg-neutral-800`（#262626） | BaseNode 容器类 |
| 节点圆角 | **16px** | 8px（rounded-lg） | BaseNode + 全部节点壳 |
| 节点宽度 | 460px 标准 | 各节点不一（320 起） | 统一 defaultWidth |
| 选中态 | `2px solid rgba(255,255,255,0.64)` 内边框 | `ring-2 ring-blue-500/40` 蓝色外环 | BaseNode selected 样式 |
| 字体 | DM Sans | 系统默认（Tailwind sans） | 引入 DM Sans（next/font） |
| 控件底色 | `#212126` | neutral-700/750 系 | 面板控件统一 |
| 端口样式 | 16px 圆点+8px 同色环+类型图标+白色文字标签 | 小圆点+HandleLabel（已有标签机制） | BaseNode/Handle 组件 |
| 端口色板 | Prompt 粉 #F1A0FA / Image 绿 #6EDDB3 / File 米白 #FEFFF1 | image #10b981 / text #3b82f6 / video #ec4899 / audio #a855f7 / 3d #f97316 | 决策点①（见 §6） |
| 边 | 2px 类型渐变 + 40px 透明命中层 + 端点重连圆点 | EditableEdge + SharedEdgeGradients（已有渐变基础） | 对齐渐变成"源色→目标色"，加命中层 |

## 2. 布局骨架对比

| 区域 | Weavy | node-banana | 差距与决策 |
|---|---|---|---|
| 顶栏 | **无传统 Header**，只有漂浮的流程名（左上）+ credits/Share/Tasks（右上） | 完整 Header：logo+标题+保存状态、居中 "Ask AI" 输入、Workflows/设置/Save 按钮 | **最大结构差异**。复刻需把 Header 拆成漂浮面板；Ask AI 是 NB 差异化功能，建议保留为可开关的漂浮入口 |
| 左轨 | 56px，9 图标+logo+help/Discord | 已有左轨（黄色系图标，badge 计数） | 结构同构，改色板与图标集 |
| 库面板 | 240px 滑入滑出，单滚动长列表+顶部搜索；磁贴 100×100 | FloatingActionBar "+" 弹出式节点菜单（分类列表） | NB 缺**常驻库面板**与磁贴网格；需新增 LibraryPanel 组件 |
| 右侧面板 | **选中节点即滑出 240px 设置面板**（参数+运行+成本） | 无；参数在节点内 InlineParameterPanel/ControlPanel/ModelParameters | **交互哲学差异最大处**：Weavy 节点画布极简、参数外置；NB 参数内嵌。见 §6 决策点② |
| 底栏 | 266×44：Navigate/Pan/Sticky│Undo/Redo│Zoom% | FloatingActionBar 676 行：工具更多（含切片/组/运行等） | NB 功能更多；复刻需精简主栏+收纳 |
| 画布 chrome | 全部面板**漂浮在画布上**（react-flow__panel），画布全出血 | Header 占独立一行，画布在下方区域 | 复刻需改为全出血画布+漂浮层 |

## 3. 节点系统对比

| 能力 | Weavy | node-banana | 评估 |
|---|---|---|---|
| 节点种类 | 300+（每个模型一个节点类型，`custommodelV2` 统一壳） | 23 种功能型节点（GenerateImage/Video/Audio/3D 内选模型） | 哲学不同：Weavy 模型即节点；NB 节点选模型。**NB 方式对 BYOK 更合理**，建议保持，仅复刻外观 |
| 端口 | 类型色圆点+环+图标+标签，必填带 *，"Add another image input" 动态加口 | 类型色小圆点+HandleLabel，多输入已有（image-0/1… indexed） | NB 已有动态口；样式需复刻 |
| 节点内容 | 仅端口区+Run 按钮+状态文案 | 预览图/参数/进度全内嵌 | NB 信息密度高（优点）；复刻版可提供"紧凑模式" |
| 节点右键 | Save node / Duplicate ⌘D / Rename / Lock / Delete | 有节点操作（MultiSelectToolbar 等），无 Save to library | 缺预设保存 |
| Resize | 节点底部拖拽柄 | NodeResizer（@xyflow 已有） | 对齐交互位置 |

## 4. 交互清单对比

| 交互 | Weavy | node-banana | 动作 |
|---|---|---|---|
| Tab 开节点菜单 | 有（官方快捷键） | 无 | 新增（全局 keydown） |
| 右键画布快速添加 | 有（带分类子菜单） | 无 | 新增 CanvasContextMenu |
| 右键节点菜单 | Save/Duplicate/Rename/Lock/Delete | 部分（工具栏按钮） | 新增 NodeContextMenu |
| ⌘P 新建 Prompt | 有 | 无 | 新增 |
| ⌘I 导入文件 | 有 | 拖放已有，快捷键无 | 新增（触发 file picker） |
| ⌘D 复制节点 | 有 | copy/paste 已有 | 对齐 ⌘D |
| 拖线到空白出建议 | 有（需按住 Option/Alt） | 有（ConnectionDropMenu，onConnectEnd 直接出） | **NB 更顺手**，保持 |
| V/H 工具切换 | 有 | 有（v/h 已实现） | 一致 |
| 缩放快捷键 | ⌘+ / ⌘- / ⌘0 / ⇧1 | 部分 | 补齐 ⌘0 与 ⇧1 |
| Sticky note | 独立工具+节点 | 无（Annotation 标注节点概念不同） | 新增轻量便签节点 |
| 框选→Save group | 有（带缩略图预设） | GroupNode/GroupsOverlay 已有，无存预设 | 增预设保存 |
| Runs×N 批量 | 有（右面板步进器+成本汇总） | Array 节点批处理（不同范式） | 新增 Runs 批量运行 |
| 快捷键面板 | ⌃⇧? | KeyboardShortcutsDialog（? 键）已有 | 一致 |

## 5. 执行与平台层对比

| 能力 | Weavy | node-banana | 差距 |
|---|---|---|---|
| 单节点运行 | Run Model（节点内） | 各生成节点自带运行 | 一致 |
| 全图运行 | 批量 selected | ⌘Enter / Run 按钮 | 一致 |
| 成本 | 积分制（云端扣费） | CostIndicator/CostDialog（BYOK 估算） | 概念对应，NB 无需改 |
| 任务队列 | Tasks 面板（云端异步） | 本地直接 await，Toast 提示 | 本地工具无需复刻；长任务（视频）可考虑本地任务面板 |
| 持久化 | 云端工作区+自动保存+**Version history** | localStorage + JSON 导入导出 + WorkflowBrowserModal | 缺版本历史（本地可做快照栈） |
| 分享 | 分享链接（付费） | 导出 JSON 文件 | 本地形态够用 |
| 素材库 | Assets 工作区级 | GlobalImageHistory（全局图片历史，已有） | 已对应 70% |
| 工作流即工具 | Tools（发布为自定义节点） | 无（有社区工作流 API） | 远期 |
| 模型供给 | 云端 300+ 聚合计费 | BYOK 6 provider（Gemini/Replicate/fal/Kie/WaveSpeed/OpenAI） | **NB 差异化优势**：自有 key、无抽成；模型目录可按 provider 动态枚举（已有 /api/models） |

## 6. 关键决策点（复刻前需拍板）

① **端口色板**：完全采用 Weavy 色板（粉/绿/米白），还是保留 NB 更丰富的 5 类型色板（绿/蓝/粉/紫/橙）只改视觉样式？
   建议：保留 NB 类型语义（image/text/video/audio/3d），把色值调向 Weavy 观感（提高明度、柔和饱和度），因为 NB 类型比 Weavy 的 File 统一口更精细。

② **参数外置 vs 内嵌**：Weavy 把参数全部搬到右侧设置面板；NB 参数内嵌节点。
   建议：做**右侧设置面板**承载完整参数（复刻），节点本体保留预览+端口+Run（紧凑模式），两者联动。这是观感上最"像 Weavy"的一步。

③ **Header 去留**：Weavy 无 Header。
   建议：拆成漂浮 chrome（左上流程名+保存态、右上运行/保存/设置），Ask AI 保留为左轨或顶部漂浮按钮——既像 Weavy 又不丢 NB 的 AI 建流特色。

## 7. 改造优先级矩阵（影响 × 成本）

| 优先级 | 项 | 影响 | 成本 |
|---|---|---|---|
| P0 | 视觉令牌（底色/点阵/圆角/选中态/DM Sans） | 一眼像 Weavy | 低（变量级） |
| P0 | 端口样式（圆点+环+图标+标签）+ 边渐变对齐 | 节点图 signature | 中 |
| P0 | 右键画布快速添加菜单 + Tab 节点菜单 | 核心交互 | 中 |
| P1 | 右侧节点设置面板（参数外置+Run selected） | 布局哲学 | 高 |
| P1 | Header 拆解为漂浮 chrome + 全出血画布 | 布局骨架 | 中高 |
| P1 | 底栏精简为 Weavy 形态 | 布局骨架 | 低 |
| P2 | ⌘P/⌘I/⌘0/⇧1 快捷键补齐 | 交互细节 | 低 |
| P2 | Sticky note 节点 | 功能补全 | 低 |
| P2 | Save node/group 预设库（localStorage） | 功能补全 | 中 |
| P3 | Runs×N 批量运行 + 成本汇总 | 执行增强 | 中 |
| P3 | 本地版本历史快照 | 平台补齐 | 中 |
| P3 | 任务队列面板（本地异步任务） | 平台补齐 | 中高 |
