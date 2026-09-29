# LearnFlow · GitHub 开源调研

调研日期：2026-09-29。先完成调研和设计，再编写应用。Star 为当日 GitHub 网页显示的近似值，可能受页面缓存影响；不是精确 API 快照。GitHub API 在本机网络不可达，因此通过网页读取仓库、源码目录、License 和 Releases。未做全量源码审计，代码质量判断仅基于类型、测试、模块边界和维护记录。

## 检索范围

已搜索 learning dashboard、study tracker、student dashboard、knowledge tree、knowledge graph、personal knowledge management、AI learning assistant、spaced repetition、flashcard。通用学生 dashboard 搜索容易命中新建演示项目，缺少长期维护和完整数据模型；不因外观接近就采用。最终优先研究成熟知识工具与独立组件。

## 候选项目

| 项目 / 地址                                                  |  Star | 技术栈                        | License                             | 值得借鉴                                                         | 不适合 LearnFlow                                   | 组件建议                                              |
| ------------------------------------------------------------ | ----: | ----------------------------- | ----------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| [React Flow / xyflow](https://github.com/xyflow/xyflow)      | 38.5k | React / Svelte / TypeScript   | MIT                                 | 节点与边分离，节点可选中，图例清晰；源码分包并有 Playwright 测试 | 完整画布编辑器对简单课程图偏重                     | 未来需要缩放、布局、连线时使用 @xyflow/react；MVP SVG |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) |   801 | TypeScript；可选 Rust binding | MIT                                 | 调度状态与知识内容分离，保留每次评分日志，算法接口明确           | 不能把自评“看懂”等价为记忆成功，参数训练超出 MVP   | 未来正式间隔复习首选；MVP 显式规则                    |
| [Dexie.js](https://github.com/dexie/Dexie.js)                | 14.6k | TypeScript / IndexedDB        | Apache-2.0                          | 异步持久化、schema 版本、事务、测试目录完整                      | 初期少量文本无需引入完整存储库；Cloud 功能不在范围 | 数据量增大后采用核心 dexie，不采用云服务              |
| [AFFiNE](https://github.com/toeverything/AFFiNE)             | 73.1k | TypeScript / React / Rust     | 前端主体 MIT，部分目录独立许可      | 低干扰侧栏、文档与画布切换、本地优先体验                         | CRDT、块编辑器、服务端和协作体系过大               | 借鉴交互，不引入整套编辑器或复制源码                  |
| [Logseq](https://github.com/logseq/logseq)                   | 45.1k | Clojure / ClojureScript       | AGPL-3.0                            | 大纲树、双向关系、右侧参考区、知识内容留在用户侧                 | 数据库与文件版本路线复杂，非 React，非宽松许可     | 仅研究产品行为，不复用代码                            |
| [Trilium Notes](https://github.com/TriliumNext/Trilium)      | 38.1k | TypeScript / Electron / Node  | AGPL-3.0                            | 层级树与关系图分工，编辑与导航并存                               | 桌面/服务端架构、多父笔记克隆增加复杂性            | 仅参考；MVP 单父节点，关系另存                        |
| [Anki](https://github.com/ankitects/anki)                    | 31.6k | Rust / Python / TypeScript    | AGPL-3.0-or-later，部分文件另有许可 | 主动回忆、显示答案后自评、到期队列、复习日志                     | 完整卡片模板和桌面栈无法直接用于静态网页           | 只参考复习闭环，不复制实现                            |

AFFiNE 许可已单独检查：[LICENSE](https://github.com/toeverything/AFFiNE/blob/canary/LICENSE) 将 backend、common/native 等目录排除在主体 MIT 范围外，不能将整个仓库视为统一 MIT。Anki 的 [LICENSE](https://github.com/ankitects/anki/blob/main/LICENSE) 说明主体为 AGPL-3.0-or-later，部分贡献和内含组件采用其他许可证。

## 维护及质量证据

- [xyflow Releases](https://github.com/xyflow/xyflow/releases)：最近条目显示 9 月 24 日，包含 react 12.12.0 与 resize 行为修复。[源码目录](https://github.com/xyflow/xyflow/tree/main/packages/react/src) 和仓库中的 tests/playwright 说明有组件分层及端到端验证。
- [ts-fsrs Releases](https://github.com/open-spaced-repetition/ts-fsrs/releases)：5.4.2 条目显示 9 月 1 日，修复迁移参数约束。[算法源码](https://github.com/open-spaced-repetition/ts-fsrs/tree/main/packages/fsrs/src)，调度包与优化 binding 分开，根目录包含 Vitest 配置。
- [Dexie Releases](https://github.com/dexie/Dexie.js/releases)：4.4.6 条目显示 9 月 10 日，包含生产构建更新钩子修复。[源码目录](https://github.com/dexie/Dexie.js/tree/master/src) 和 test 目录可检查事务封装。
- 发布记录补查：[AFFiNE](https://github.com/toeverything/AFFiNE/releases) 可见 v2026.9.23-canary.909；[Anki](https://github.com/ankitects/anki/releases) 可见 26.09.2（9 月 15 日）；[Logseq](https://github.com/logseq/logseq/releases) 可见 0.10.14（9 月 18 日）；[Trilium](https://github.com/TriliumNext/Trilium/releases) 可见 0.102.2（4 月 5 日）等条目。网页的月日可能不带年份，这些是可见发布证据，不等同精确最后提交时间。实际引入时仍应再检查维护与兼容性。

## 落到 LearnFlow 的设计

1. UI：常驻导航 + 三栏工作台；内容用文档分节，避免每段文字都套卡片。首页只把课程做成可扫读列表。
2. 知识树：扁平节点表，稳定 ID、parentId、order、kind；章节与知识点共用树结构。删除子树清理关系和题目，历史保留名称快照。
3. 图谱：独立 Edge，prerequisite 为有向边，related 为无向关系；树结构不等于前置依赖。
4. 进度：仅“已掌握”计入掌握比例；自评“我懂了”只进入基本理解。练习自评正确后才可升级掌握，明确这仍是自评。
5. 复习：加入复习立即到期；不会/模糊次日、懂了三天、自测正确七天。不声称采用 FSRS，也不声称科学测量掌握程度。
6. 数据：localStorage 版本化快照，保存失败明确提示，JSON 备份与恢复；不复制任何第三方完整项目。
7. AI：QuestionProvider 接口独立，当前仅 Mock；未来 API 经安全后端代理，GitHub Pages 不承载密钥。

## 部署依据

[Vite 静态部署指南](https://vite.dev/guide/static-deploy.html) 支持产出 dist 并通过 Pages Actions 发布；[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) 说明其静态托管限制。采用相对资源路径和 hash 路由，兼容根域名与仓库子路径。
