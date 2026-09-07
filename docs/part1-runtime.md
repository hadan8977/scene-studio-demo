# Part 1 技术结构接入

产品界面继续展示场景生成、应用、保存、撤销。启用技术服务后，真实生成与确认链路进入独立的 [Part 1 Runtime](https://github.com/hadan8977/cockpit-scene-orchestration/tree/main/part1-generation-framework/runtime)，使用同一份 114 条注册能力生成 Prompt、严格解码 Schema 和外部验证器。

在同机启动 Python 服务，服务端配置两个私有环境变量：

```text
PART1_RUNTIME_URL=http://127.0.0.1:8787
PART1_RUNTIME_TOKEN=<与Python服务一致>
```

`/api/models` 返回 `provider: Part 1 Runtime` 后才算接入。浏览器不接触 token，只调用 Next.js 的同源代理。未配置时保持已发布 p13 路径；技术服务出错不会自动回退到 p13 或示例。

技术服务的 Prompt 版本独立于 UI，随结果返回真实哈希、注册表 revision、解码模式、校验裁决和执行 trace。开发中的 Prompt 不等于已经通过全维度验收。

交互约定：生成不等于执行；保存与应用都先经过后端校验；一项续改不能改其他设备；旧提案在能力热更新后拒绝确认；延时动作再次校验；后台阻断时显示停止；撤销交给后端快照。浏览器已保存场景使用服务返回 ID，防止重复。含未上线能力的卡片可作概念保存，目前整体不执行。

验证命令：`npm test`、`npm run typecheck`、`npm run test:ui`、`node --import tsx --test tests/runtime-ui.test.tsx`。框架仓库另提供跨 TypeScript/Python 的 HTTP/SSE 集成测试。当前开发机复用另一个 checkout 的 node_modules，Turbopack 拒绝跨仓库 junction；使用 `npm run build -- --webpack` 完成生产构建验证，正常独立安装不需要这一环境规避。

这一服务仅支持同机单人演示。公共 Vercel 不能连本机 localhost；上线完整结构需要可达的独立服务和用户隔离。目前不能把公共站点的 p13 演示说成已上线新技术结构。生成时延与最终 Prompt 质量的验收以框架仓库的新报告为准。
