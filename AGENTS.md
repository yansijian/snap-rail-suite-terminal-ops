# snap-rail-suite-terminal-ops

生产作业套件（suite 层范本）：单包单行、双面、单活 `snapRail.exclusive: 'suite'`。
一个场景的全部界面（站点布局 + chrome + 五个流程页 + 计数设置）与场景私有
宿主逻辑（`./stats` 班产计数：settings 缝 + store 表 + `production/stats-changed`
帧）合成一个套件包——杜绝跨包场景耦合。

- 界面只用 `@snap-rail/framework-shadcn/ui` 的共享原语，经 `snapRail.requires`
  里的框架条目绑定；框架不匹配不挂载（fail-loud）；
- **三个窗口、三个渲染面**（一包一开关）：`client.entry` 是主窗口，
  `client.surfaces.{ball,panel}` 是悬浮球与迷你面板（`src/ball.tsx` /
  `src/panel.tsx`，分别占 `shell.ball` / `shell.panel` 槽，模块 id
  `<包名>/ball` / `<包名>/panel`）。辅助面**只消费宿主聚合帧**
  （`production/stats-changed`、`shell/surface-changed`），不订阅 equipment 点；
  OS 资源（立起窗口、收面板、托盘、通知）一律经 `@snap-rail/shell` 的
  `ctx.shell` / `shell.*` 方法，本包永不 import `electron`；
- 场景私有契约住本包 `src/contract.ts`（跨端消费走类型面，不共享表）；
- 构建链：tsc（lib/types）→ tsdown（宿主面 lib/stats.js + clientBundle 工厂包）；
- 启用套件经 `plugins.set-enabled` 自动停用其他同互斥组成员；
- tag v* 触发 CI：build → test → pack（secrets.RELEASE_PRIVATE_PEM/
  RELEASE_KEY_ID）→ Release。
