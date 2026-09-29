# snap-rail-suite-terminal-ops

生产作业套件：单包单行、可双面（宿主面 + 渲染面）、单活。

- 渲染面（`src/index.tsx` → `lib-client/client.js`）：站点布局、chrome、
  五个流程页、计数设置——全部基于 `@snap-rail/framework-shadcn/ui`；
- 宿主面（`src/stats.ts` → `lib/stats.js`，`./stats` 子路径）：班产计数——
  settings 缝持久化 + 订阅 equipment 点事件 + `production/stats-changed` 帧；
- 场景私有契约住 `src/contract.ts`（套件包内，不进协议层）。

```sh
pnpm install   # @snap-rail/* 来自 Gitea npm registry（见 .npmrc）
pnpm build     # tsc (lib/types) + tsdown (lib/stats.js + lib-client)
pnpm test      # 计数/故障组/抽样/会话恢复/设置/seeds
pnpm pack      # snap-rail-plugin pack . --out dist（本地）
```

发版：打 `v*` tag → CI 构建、测试、签名打包并上传到本仓 Release。
