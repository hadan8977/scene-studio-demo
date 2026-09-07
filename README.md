# Scene Studio 场景

[在线体验 Demo](https://scene-studio-demo.vercel.app)

v17 版本以用户上传的 Figma Make「Card Stack」为视觉基础，保留炭黑、青柠与倾斜显示器；扩充文字比例、主动服务分流、场景组合和本地管理。接入 114 条原子能力校验与 OpenRouter 场景生成接口。

1920×1080 显示器可切换驾驶员视角与正视阅读。主要正文 22–24px、标题 30–36px；完整提案 700px、命令栏 780px、侧栏 320px、应用编辑窗 760px。动作仍是同一张卡片里的行，空分组隐藏。

[旧版 v16 备份](https://scene-studio-demo-v16.vercel.app) · [备份标签](https://github.com/hadan8977/scene-studio-demo/tree/backup/v16-7e13263) · [本轮执行计划](docs/v17-implementation-plan.md) · [实现与验证记录](docs/v17-validation.md)

明确要求创建场景时，查看理解句、条件和组合动作。只描述处境时，先回应，再轻问是否安排；明确调灯调温则交给车控，不生成场景。卡片的「改一下」进入局部续改，保存与应用一次分别操作。

包含独立的能力验证器、可展开的评审面板，以及可切换的示例模式和 OpenRouter 实时生成接口。没有模型密钥也可以使用示例模式；真实 AI 状态会明确标注。

## 快速运行

需要 Node.js 24 和 npm。

```bash
npm ci
npm run dev
```

Windows PowerShell 如受执行策略限制，使用 `npm.cmd ci` 和 `npm.cmd run dev`。打开终端输出的本地地址，默认 `http://localhost:3000`。

## 连接真实 AI

将 `.env.example` 复制为 `.env`，填写自己的 OpenRouter 密钥：

```dotenv
OPENROUTER_API_KEY=填写你自己的密钥
OPENROUTER_MODEL=
```

重启开发服务器，在屏内“评审 / 设置”面板刷新连接，切换到“真实 AI”。`OPENROUTER_MODEL` 可留空，默认选择候选清单中当前可用的首个主候选。模型候选来自候选清单与 OpenRouter 实时目录的交集。

密钥仅由服务端读取，不进入浏览器、前端构建或 Git。目录可见不代表账户有可用额度。

此前 v16 改动见 [历史评审记录](docs/demo-review-v16.md)。地图数据与许可见 [地图说明](public/map/README.md)。

## 可以体验什么

- 中文和英文输入；先呈现理解句，再展开经过校验的方案。
- 场景动作按灯光、声音、空气与香氛、温度与座椅、车窗与门、播报与出口组织；官方预设与时序单列。
- “就这样保存 / 改一下 / 不用”，以及缺信息时的一句追问。
- 局部修改时保留其他动作，例如“灯再暗一点”；进入编辑后，快捷修改和刚改反馈在同卡内完成；普通语音里的直接控制交给车控。
- 上海徐汇滨江真实街区地图，按当前主题绘制；本地加载，保留 OSM 署名。
- 25 个显式场景组合、8 个弱意图情境、9 个反例；覆盖座椅、方向盘、空气、遮阳、屏幕、媒体、定时与延时。
- 主动询问先匹配已有场景，检查打扰状态、冷却、变化价值与负面偏好；三秒光声预览、应用一次、还原。
- 「它的想法」收纳未保存建议；相似场景显示差异，可更新原有、另存或取消。
- 档案影响对照预览，保存卡片显示实际值与概念能力。
- 停车完整提案与行驶三行摘要；车窗、灯光和禁止动作独立裁决。
- “它学会了什么”：两份演示档案、逐条偏好停用与恢复，按档案独立持久保存。
- 浏览器本地保存、刷新恢复、重新打开修改。
- 模型选择、真实时延、裁决记录和结构化输出。

默认在真实徐汇滨江地图与原稿命令栏等待输入，示例结果均明确标注。示例模式仅支持预设案例及少量局部续改，不会将预设数据冒充为模型输出。

## Figma Make 提示词

[直接查看可复制的完整提示词](public/Figma-Make-prompt.md)。它规定产品目标、交互和能力边界，不限定配色、布局、材质或组件形式。

## 项目结构

| 位置                                                   | 内容                                          |
| ------------------------------------------------------ | --------------------------------------------- |
| `app/scene-studio.tsx`                                 | Figma Make 前端入口                           |
| `app/figma-theme.css`                                  | 原稿主题与字体配置                            |
| `components/figma-make/components/`                    | 原稿的显示器、弹窗、场景应用、卡片与评审界面  |
| `components/figma-make/useGeneration.ts` / `bridge.ts` | 真实服务与 Figma 组件之间的接口适配           |
| `lib/profile-settings.ts`                              | 档案隔离与偏好持久化                          |
| `app/api/`                                             | 模型目录与流式生成接口                        |
| `lib/scene.ts`                                         | 结构、能力和取值校验，局部修改保护            |
| `lib/generation.ts`                                    | 服务端提示词、OpenRouter 调用与流式解析       |
| `lib/demo-cases.ts` / `intent-routing.ts`              | 案例、分流、主动建议规则                      |
| `components/figma-make/useExperience.ts`               | 询问、模拟应用、还原与收件箱                  |
| `lib/scene-similarity.ts`                              | 相似场景与差异合并                            |
| `lib/examples.ts`                                      | 示例回放与局部续改                            |
| `lib/data/`                                            | 运行所需的能力定义与候选模型                  |
| `tests/`                                               | 能力裁决、存储、流式生成等49 项服务与规则测试 |

公开版本只包含 demo 代码及其运行数据，未包含原始 PRD、原始评测题集、内部来源和执行映射、历史结果或私有部署标识。

## 接口

`GET /api/models` 返回密钥是否配置、可用候选和默认模型，不返回密钥。

`POST /api/generate` 接收：

```json
{
  "input": "做一个雨夜回家的场景",
  "context": { "driving": false, "profile": "none" },
  "model": "从模型目录选择",
  "currentScene": null
}
```

纯车控、点名预设、已识别的闲聊和车控追问返回 422 与分流类型，`executed:false`，不会调用模型或执行车辆动作。场景请求返回 SSE 事件：`understanding`、`retry`、`result`、`error`。最终结果包括场景、逐项裁决、是否可保存、概念能力标注、使用的偏好和真实时延。`currentScene` 用于续改或补充澄清；档案可选 `none`、`quiet`、`fresh`。

超过2.5秒显示等待反馈，服务端30秒终止；格式错误仅自动重试一次。失败不会自动切换成示例。保存只保存在当前浏览器，不执行车辆动作。

## 验证和构建

```bash
npm test
npm run test:ui
npm run typecheck
npm run build
```

49 项服务与规则测试覆盖能力名、枚举、范围、步长、行驶限制、禁止值、无法表达的触发条件、负面偏好、局部修改、澄清、存储恢复、SSE分块、重试、错误与取消。

生成服务测试使用受控响应夹具，不代表真实模型的质量和时延。真实模型联调需自行配置密钥。21 条 React DOM 交互旅程覆盖保存、续改、车控、主动询问、三秒预览、后续指令优先、拒绝冷却、收件箱、查重、档案和连续提交等。DOM 测试不是视觉验收；本轮浏览器环境不可用，实屏阅读与 WebMCP 环境验证尚未完成。

## 运行边界

车况、记忆档案和车辆动作均为演示数据。规划中与提议中的能力只做标注后的概念展示。没有真实车辆执行、自动触发调度、电话、消息发送或账号同步。主动分流与门控是明确标注的本地规则演示，不是通用 NLU。询问额度与拒绝冷却以当前会话模拟，案例按钮重置独立情境；未实现跨日额度、完整观测学习或 L3/L4。

基于 Next.js 16、React 19、TypeScript 与组件原语构建，支持本地 Node.js 和 Vercel 部署。

接口依据：[OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)、[Models API](https://openrouter.ai/docs/api/api-reference/models/get-models)。

## 部署到 Vercel

导入此 GitHub 仓库，框架选择 Next.js，保留默认构建设置。无需密钥即可部署并体验示例模式。

如需真实 AI，在 Vercel 项目的 Environment Variables 中设置服务端变量 OPENROUTER_API_KEY，可选设置 OPENROUTER_MODEL，然后重新部署。不要加 NEXT_PUBLIC_ 前缀。生成接口仍会在30秒主动终止，平台运行时上限为60秒。

## 本轮产品与设计

[车机交互说明与2026年设计参考](docs/cockpit-design.md)。应用中的导航、音乐、气候和车况均为演示；保存只更新浏览器中的场景，不改变底层车况。
