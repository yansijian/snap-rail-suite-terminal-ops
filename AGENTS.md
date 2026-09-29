# snap-rail-suite-terminal-ops

生产作业套件（suite 层范本）：单包单行、双面、单活 `snapRail.exclusive: 'suite'`。
一个场景的全部界面（站点布局 + chrome + 五个流程页 + 计数设置）与场景私有
宿主逻辑（`./stats` 班产计数：settings 缝 + store 表 + `production/stats-changed`
帧）合成一个套件包——杜绝跨包场景耦合。

- 界面只用 `@snap-rail/framework-shadcn/ui` 的共享原语，经 `snapRail.framework`
  绑定；框架不匹配不挂载（fail-loud）；
- 场景私有契约住本包 `src/contract.ts`（跨端消费走类型面，不共享表）；
- 构建链：tsc（lib/types）→ tsdown（宿主面 lib/stats.js + clientBundle 工厂包）；
- 启用套件经 `plugins.set-enabled` 自动停用其他同互斥组成员；
- tag v* 触发 CI：build → test → pack（secrets.RELEASE_PRIVATE_PEM/
  RELEASE_KEY_ID）→ Release。
