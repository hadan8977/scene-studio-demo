# 场景编排 Demo · v20

面向车主的场景应用与主动服务弹窗。基于上传的 Figma Make 原稿，保留倾斜显示器、深色柔绿主题、真实徐汇滨江街区地图和紧凑场景卡片。

[在线体验](https://scene-studio-demo.vercel.app) · [本轮改动](docs/v20-update.md) · [p13 接入边界](docs/v19-integration.md)

## 本地运行

需要 Node.js 24 和 npm。

```bash
npm ci
npm run dev
```

Windows PowerShell 可使用 npm.cmd。默认地址 http://localhost:3000。无需密钥可体验示例；示例按钮与真实 AI 状态明确区分。

## 连接真实 AI

复制 .env.example 为 .env.local，设置服务端变量：

```dotenv
DEEPSEEK_API_KEY=填写自己的密钥
```

重启服务，在屏内「设置」刷新连接，切换「真实 AI」。本版按照最新报告固定使用 DeepSeek 官方接口的 deepseek-v4-flash 和冻结 p13，替换旧版 OpenRouter 候选模型路径。

参数固定为 temperature=0、max_tokens=1000、thinking disabled、JSON 输出与 SSE 流式返回。密钥只由服务端读取，不进入浏览器或 Git。配置存在不代表密钥或余额有效；调用失败会显示真实错误，不回退为预置答案。

## 交互

- 主动服务示例直接显示完整方案，保留「好 / 不要 / 编辑」与关闭按钮。
- 确认后立即「已应用」，提供「撤销 / 保存」。只有方案明确的延时动作才等待。
- 语音输入和回复在卡片外；卡内显示触发条件、动作、使用偏好和必要的能力调整。
- 示例只保留「场景建议 / 直接车控」。纪念日、心情不好、等候和英文情境可直接查看待确认方案。已有录音、露营模式直接进入模拟宿主功能，不新建场景。
- 应用内创建、手动编辑、局部续改、保存、查重、删除；「场景建议」保留查看、编辑、保存与模板入口。
- 「它学会了什么」支持按档案增删改、取消与恢复。数值使用大字、滑杆和加减按钮，枚举使用自绘选项。
- 场景、建议与档案保存在当前浏览器。保存不执行车辆动作；弹窗内保存、更新或另存后仍留在弹窗，用户自行打开场景应用管理。
- 行驶态使用三行摘要；禁止、调整、规划中与提议中分别标注。
- 25 个创建案例、10 个场景建议（含 2 个英文情境），以及 6 个直接车控示例。

## Prompt、能力与架构状态

[冻结 p13 原文](lib/prompts/p13-system-zh.md)的 SHA-256 为：

```text
57488940054541ba99365f4e9521391783b42902d468ef68699ae171804d8c12
```

114 条注册表与最新交付的名称、分组、状态、成熟度、值域和禁止值逐项一致。规划/提议能力可展示概念方案，不能作为已落地动作执行。

另一 session 已完成 Prompt 实验与离线校验组件；完整硬约束架构仍待接入、验收。按本轮约定不扩建它，保留 Demo 现有校验与本地交互规则。当前版本不代表报告的完整架构已经落地，也不继承报告中的模型质量得分。

## 接口

GET /api/models 返回单个冻结模型、默认模型、配置状态、Prompt 版本和哈希，不返回密钥。

POST /api/generate 请求示例：

```json
{
  "input": "做一个雨夜回家的场景",
  "locale": "zh",
  "context": {
    "driving": false,
    "profile": "none",
    "vehicle": { "主驾温度控制": "24℃" }
  },
  "model": "deepseek-v4-flash",
  "currentScene": null
}
```

locale 可省略；context.profile 可选 none、quiet、fresh。context.preferences 可传最多 24 条有效偏好（id、primary、value、negative、可选 deleted）；空数组表示不使用档案默认值。vehicle 只传已知设备状态。

服务端将输入转为报告的 {locale, context, utterance} 信封。完整输出仍为附录 C 的 13 个字段。接口支持直接控制、场景、追问和普通回应的模型测试，返回候选，不执行真实车辆。

SSE 事件为 understanding、retry、result、error。最终结果含校验后的场景、逐项裁决、是否可保存、实际使用偏好、时延及 provenance（Prompt 哈希、注册表版本、模型、请求参数、适配器版本）。超过 2.5 秒显示等待反馈，30 秒终止；格式错误自动重试一次。

currentScene 用于续改。新增的局部续改适配器保留不相关动作，并经过现有编辑检查；复杂批量修改仍需额外回归或手动编辑。

## 检查与部署

```bash
npm test
npm run test:ui
npm run typecheck
npm run build
```

受控生成测试不代表真实模型质量。独立真实 API 冒烟记录、界面测试结果和未验收项见[验证记录](docs/v19-validation.md)。浏览器控制环境当前不可用，DOM 测试不能替代实屏视觉验收。

Vercel 导入仓库、使用默认 Next.js 构建即可。真实 AI 需在项目服务端环境变量中设置 DEEPSEEK_API_KEY 后重新部署；不要添加 NEXT_PUBLIC_ 前缀。线上默认未配置密钥时明确显示未连接。

## 运行边界与资料

车况、车辆动作、录音入口和档案均为演示数据。未接入真实车辆、观测学习、跨日额度、提醒送达、电话、消息发送或账号同步。当前冷却和打扰额度为会话规则；案例按钮重置独立情境。AI 的记忆建议不会自行写入档案。

公开仓库不包含原始 PRD、私有评测题集、账户凭据或私有部署配置。

- [Figma Make 提示词](public/Figma-Make-prompt.md)
- [地图数据与许可](public/map/README.md)
- [历史设计参考](docs/cockpit-design.md)
- [v18 备份](https://github.com/hadan8977/scene-studio-demo/tree/backup/v18-8a96c0e)
- [v16 独立备份站](https://scene-studio-v16-7e13263.vercel.app)
