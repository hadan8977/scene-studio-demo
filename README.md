# Scene Studio 场景

[在线体验 Demo](https://scene-studio-demo.vercel.app)

小塔场景 · LUMA 座舱应用：1920×1080驾驶员视角屏幕、深炭黑与黄绿主题、导航与音乐情境、单张悬浮生成卡，以及独立的场景管理、创建、编辑和个人档案。

一句话生成车内场景的交互 demo。输入需求后，查看理解句、触发条件和动作；继续说一句只改对应设置，确认后保存到“我的场景”。

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

重启开发服务器，在屏内右下角设置面板刷新连接，切换到“真实 AI”。`OPENROUTER_MODEL` 可留空，默认选择候选清单中当前可用的首个主候选。模型下拉框来自候选清单与 OpenRouter 实时目录的交集。

密钥仅由服务端读取，不进入浏览器、前端构建或 Git。目录可见不代表账户有可用额度。

## 可以体验什么

- 中文和英文输入；先呈现理解句，再展开经过校验的方案。
- 场景动作按光、声、气、温、话、供组织；空类别隐藏。
- “就这样保存 / 改一下 / 不用”，以及缺信息时的一句追问。
- 局部修改时保留其他动作，例如“灯再暗一点”。
- 停车完整提案与行驶三行摘要；车窗、灯光和禁止动作独立裁决。
- “它学会了什么”：两份演示档案、逐条偏好停用与恢复，按档案独立持久保存。
- 浏览器本地保存、刷新恢复、重新打开修改。
- 模型选择、真实时延、裁决记录和结构化输出。

默认显示明确标注的示例提案。示例模式仅支持预设案例及少量局部续改，不会将预设数据冒充为模型输出。

## Figma Make 提示词

[直接查看可复制的完整提示词](public/Figma-Make-prompt.md)。它规定产品目标、交互和能力边界，不限定配色、布局、材质或组件形式。

## 项目结构

| 位置 | 内容 |
| --- | --- |
| `app/scene-studio.tsx` | 场景卡片、输入、编辑、保存与评审面板 |
| `app/globals.css` / `app/cockpit-theme.css` | 结构布局 / Card Stack 融合主题 |
| `components/profile-library.tsx` | 档案与偏好管理 |
| `lib/profile-settings.ts` | 档案隔离与偏好持久化 |
| `app/api/` | 模型目录与流式生成接口 |
| `lib/scene.ts` | 结构、能力和取值校验，局部修改保护 |
| `lib/generation.ts` | 服务端提示词、OpenRouter 调用与流式解析 |
| `lib/examples.ts` | 明确标注的交互示例 |
| `lib/data/` | 运行所需的能力定义与候选模型 |
| `tests/` | 能力裁决、存储、流式生成等34项测试 |

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

返回 SSE 事件：`understanding`、`retry`、`result`、`error`。最终结果包括场景、逐项裁决、是否可保存、概念能力标注、使用的偏好和真实时延。`currentScene` 用于续改或补充澄清；档案可选 `none`、`quiet`、`fresh`。

超过2.5秒显示等待反馈，服务端30秒终止；格式错误仅自动重试一次。失败不会自动切换成示例。保存只保存在当前浏览器，不执行车辆动作。

## 验证和构建

```bash
npm test
npm run test:ui
npm run typecheck
npm run build
```

34项测试覆盖能力名、枚举、范围、步长、行驶限制、禁止值、无法表达的触发条件、负面偏好、局部修改、澄清、存储恢复、SSE分块、重试、错误与取消。

生成服务测试使用受控响应夹具，不代表真实模型的质量和时延。真实模型联调需自行配置密钥。10条 React DOM 交互旅程覆盖保存跳转、续改、追问、删除、行驶限制、档案持久化和动效退出竞争等路径；真实浏览器视觉验收和 WebMCP 环境验证尚未完成。

## 运行边界

车况、记忆档案和车辆动作均为演示数据。规划中与提议中的能力只做标注后的概念展示。没有真实车辆执行、自动触发调度、电话、消息发送或账号同步。

基于 Next.js 16、React 19、TypeScript 与组件原语构建，支持本地 Node.js 和 Vercel 部署。

接口依据：[OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)、[Models API](https://openrouter.ai/docs/api/api-reference/models/get-models)。

## 部署到 Vercel

导入此 GitHub 仓库，框架选择 Next.js，保留默认构建设置。无需密钥即可部署并体验示例模式。

如需真实 AI，在 Vercel 项目的 Environment Variables 中设置服务端变量 OPENROUTER_API_KEY，可选设置 OPENROUTER_MODEL，然后重新部署。不要加 NEXT_PUBLIC_ 前缀。生成接口仍会在30秒主动终止，平台运行时上限为60秒。

## 本轮产品与设计

[车机交互说明与2026年设计参考](docs/cockpit-design.md)。应用中的导航、音乐、气候和车况均为演示；保存只更新浏览器中的场景，不改变底层车况。
