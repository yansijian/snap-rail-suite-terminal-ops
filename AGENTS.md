# snap-rail-suite-terminal-ops

生产作业套件（suite 层范本）：单包单行、双面、单活 `snapRail.exclusive: 'suite'`。
一个场景的全部界面（站点布局 + chrome + 五个流程页 + 计数设置 +
「窗口与退出」设置页 + 退出确认框）与场景私有宿主逻辑（`./stats` 班产计数：
settings 缝 + store 表 + `production/stats-changed` 帧；`./window` 窗口退出
策略声明）合成一个套件包——杜绝跨包场景耦合。

- 界面只用 `@snap-rail/framework-shadcn/ui` 的共享原语，经 `snapRail.requires`
  里的框架条目绑定；框架不匹配不挂载（fail-loud）；
- **两个渲染面**（一包一开关）：`client.entry` 是主窗口，`client.surfaces.ball`
  是悬浮球（`src/ball.tsx`，模块 id `<包名>/ball`）。球面几何/贴边收起照
  缝词汇 `BALL_SURFACE` 画：收起时按 `shell/ball-dock-changed` 的
  `{edge, collapsed, visiblePx}` 在可见条里画贴边小标签，并**自留拖拽区**
  （`-webkit-app-region: drag`），否则收起的球拽不回来。辅助面**只消费宿主
  聚合帧**（`production/stats-changed`、`shell/ball-changed`、
  `shell/ball-dock-changed`），不订阅 equipment 点；
- **窗口退出策略是宿主面声明**（`src/window.ts`，`./window` 子路径）：按设置
  声明 `ctx.shell.window.setExitPolicy`（关窗 → 球/托盘/询问、托盘退出确认）；
  `'hold'` 挂起后由 `src/exit-prompt.tsx` 经 `registerLayout` 注册为叠层
  layout occupant 弹**套件自己的确认框**（底座不画 UI），`shell.exit.resolve`
  应答；「窗口与退出」设置页（`src/window-settings.tsx`）经
  `settings/changed` 热切换。OS 资源（立起窗口、托盘、通知）一律经
  `@snap-rail/shell` 的 `ctx.shell` / `shell.*` 方法，本包永不 import
  `electron`；
- 场景私有契约住本包 `src/contract.ts`（跨端消费走类型面，不共享表）；
- 构建链：tsc（lib/types）→ tsdown（宿主面 lib/stats.js + clientBundle 工厂包）；
- 启用套件经 `plugins.set-enabled` 自动停用其他同互斥组成员；
- tag v* 触发 CI：build → test → pack（secrets.RELEASE_PRIVATE_PEM/
  RELEASE_KEY_ID）→ Release。
