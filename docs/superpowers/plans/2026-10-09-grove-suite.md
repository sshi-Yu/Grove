# Grove 扩展套件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 Grove 面板宿主 App 的首版：模块注册表、启停生命周期引擎、`ModuleApi`、状态存储、纵向两列卡片的模块目录页（只含“规划中”占位）、关于入口、主题与五语言接入。

**Architecture:** 一个 Hana v2 宿主 App（目录与 id 均为 `grove`）。业务无关的核心（契约、注册表、`ModuleApi`、存储、生命周期、i18n）写成不依赖 Hana SDK 的纯 ESM，用 `node:test` 测试；`host/` 里的薄适配层把 `defineApp` 的 `sdk` 接成核心要求的 `HostPort`，并挂 Hono 路由；`ui/` 的整页卡通过 `hana.api.fetch` 读写这些路由。首版没有真实模块，启停与故障流程用只存在于测试中的假模块验证。

**Tech Stack:** Node ESM（无构建、无 npm 依赖）、`node:test`（本 Windows sandbox 的验证命令用 `--test-isolation=none`，规避 Node 子进程 `spawn EPERM`）、Hana v2 App SDK（随脚手架复制到 `apps/grove/sdk/`，勿手改）、Hono（由宿主提供的路由对象）、原生 HTML/CSS/JS。

**Spec:** `docs/superpowers/specs/2026-10-09-grove-suite-design.md`（执行者须同时阅读规格与 `docs/APPS.md`）

## Global Constraints

- 清单：`manifestVersion` 恰为 `2`；`id` 必须等于目录名 `grove`；`entry` 为 `index.js`；`icon` 必须是真实 PNG/JPEG/WebP/静态 SVG；每张卡必须有 `face.image`（位于 `ui/` 内的 PNG/WebP/SVG）。
- `capabilities` 只声明真实用到的受保护能力；首版宿主自身不用任何受保护能力，故为 `[]`。面板版声明所含全部模块所需能力的**并集**，模块开关不授予也不撤销权限。
- 工具名须匹配 `^[a-z][a-z0-9_-]*$`；Hana 不给工具名加前缀，重名会使整个 App `failed`。
- 模块 ID 稳定、唯一，匹配 `^[a-z][a-z0-9-]*$`；工具名 `grove_<模块ID>_<本地名>`，命令名 `grove-<模块ID>-<本地名>`。
- 初次安装与更新新增的模块一律**默认关闭**；启停按套件**全局**生效，不按 Agent。
- 整页 App 页面使用相对静态资源路径时 manifest 至少声明 `minAppVersion: "0.928.0"`。Creator 脚手架基于随包 SDK 的实际兼容版本自动写入最低版本；不要为了视觉能力随意降低它。
- 运行状态集合：`planned`、`off`、`starting`、`on`、`blocked`（权限不足）、`failed`、`stopping`。
- 停用、重载、更新都不删除模块设置与数据；数据格式变化走模块迁移，迁移失败保留旧数据并显示错误。
- `storage` 单作用域 16 MiB 硬上限，首版只存选择、语言与模块数据，不存大对象。
- 不在运行时下载或执行外部代码；注册表只含显式 `import` 的模块。
- 界面：单页纵向，**无左侧分类栏、无“模块／关于”页签**；状态分组顺序“已启用、可启用、需处理、规划中”；组内每行两张卡片，窄宽度变单列；“关于 Grove”与语言偏好在标题栏“⋯”菜单；规划中的卡片只读，无开关。
- 样式用 `hana.theme` 宿主签发的 `cssUrl` 与宿主 CSS 变量起步，明暗随宿主；图标用线性图形，不用 Emoji。
- 语言：`zh`、`zh-TW`、`en`、`ja`、`ko`；Hana v2 无公开宿主语言接口，按浏览器语言选择并允许手动覆盖，回退 `zh`；品牌名 `Grove`，中文名「林间」。
- 首批示例对应：`session-stats`＝向日葵（会话统计）、`token-stats`＝小苔藓（Token 统计）、`task-manager`＝松鼠（事务管理）。
- 仓库已初始化，`origin` 指向 `https://github.com/sshi-Yu/Grove.git`；所有功能实现都在 linked worktree 与 feature branch 中进行，按任务提交；用户已要求交付后 push feature branch。当前主工作区中用于初始化的基线仅包含 `.gitignore` 与确认过的规格/计划文档，不纳入其他工作区项目。

## Review Focus

1. 同一模块被并发启用/停用（快速连点）：只激活一次、无重复注册，最终状态等于最后一次请求。
2. 模块 `activate` 在注册了部分工具后抛错：已注册的全部回滚，状态为 `failed`，用户的启用意图保留，其他模块不受影响。
3. 模块清理函数在停用时抛错：状态仍变为 `off`，错误被记录，其余注册照常撤销，其他模块不受影响。
4. 存储里的选择数据损坏、或含已不在注册表中的模块 ID：忽略坏数据与未知 ID、不崩溃、不删除对应数据。
5. 异常语言输入（`undefined`、空串、`zh-Hant-HK`、`EN-us`、不支持的 `fr`）：解析为受支持语言；模块名等文本进入 DOM 只用 `textContent`，不能注入标记。
6. 对规划中或不存在的模块调用启用：拒绝并返回明确错误码，状态不变。

---

### Task 1: 脚手架、清单与测试基座

**Files:**
- Create: `brand/grove-icon.svg`, `brand/grove-cover.svg`
- Create (scaffold): `apps/grove/**`（`manifest.json`、`index.js`、`sdk/`、`ui/`）
- Create: `apps/grove/package.json`, `apps/grove/tests/manifest.test.js`
- Modify: `apps/grove/manifest.json`, `apps/grove/README.md`（移除脚手架不再对应的 starter-tool 指引）

**Interfaces:**
- Produces: `apps/grove/` 目录及可运行的 `npm test`（即 `node --test tests/`，在 `apps/grove` 下执行）；已核对的 SDK 签名记录（见 Step 4）。

- [ ] **Step 1: 创建两个品牌 SVG。** `brand/grove-icon.svg`（viewBox `0 0 512 512`）与 `brand/grove-cover.svg`（viewBox `0 0 1200 800`）：几何化的叶丛/树冠轮廓，暖灰底（`#f4f2ed`）配低饱和绿（`#5f8a6e`），仅静态图形；禁用 `<script>`、`<foreignObject>`、外链 `href`、动画与 `@import`。

- [ ] **Step 2: 运行官方脚手架。** 命令：`py -3 hana-app-creator/scripts/create_hana_app.py "Grove" --app-id grove --path apps --icon brand/grove-icon.svg --cover brand/grove-cover.svg --kind ui`。预期：生成 `apps/grove/manifest.json`，脚手架末尾的内置校验通过。若 `check_env.mjs` 因沙箱报 `python_not_found`，直接用上面的命令即可（Python 3.9+ 已可用）。

- [ ] **Step 3: 写失败测试 `tests/manifest.test.js`。** 用 `node:test` 读取 `manifest.json`，断言：`manifestVersion === 2`、`id === "grove"`、`name === "Grove"`、`capabilities` 深等于 `[]`、`contributes.cards` 恰一张且 `id === "panel"`、`route === "/panel.html"`、`realization === "page"`、`siteNavEntry === true`、`face.image` 是以 `assets/` 开头的字符串、`contributes.ui` 不存在（无消息按钮）。为了验证 RED，临时仅将清单的 capability 改回脚手架默认值并运行 `node --test --test-isolation=none tests/manifest.test.js`，应只因 `capabilities` 断言失败；恢复后跑绿。默认隔离在本 sandbox 会 spawn 子进程并报 `EPERM`，不得把该环境失败算作测试 RED。

- [ ] **Step 4: 修改清单并清理 starter demo。** 设 `description` 为“Fern 的 HanaAgent 扩展套件：统一管理面板与可逐项启用的小功能模块。”；`capabilities` 置 `[]`；卡片 `panel` 加 `realization: "page"`、`siteNavEntry: true`、`title: "Grove"`；删除任何 `contributes.ui`。保留脚手架依随包 SDK 写入的 `minAppVersion`（当前基线 `1.0.6-beta`），因为 Hana 文档要求使用相对静态资源的 App 至少 `0.928.0`，不能把 SDK 版本当成可任意删除的多余字段。`index.js` 移除脚手架 hello 工具，只保留合法空 `defineApp`。`ui/panel.html`/`panel.js` 也清理 greeting、输入框与 starter 状态文字，保持面板占位但不假装已有功能。README 删除“starter tool requires `app/tools.expose-to-model`”章节，避免与 manifest 能力清单矛盾。

- [ ] **Step 5: 核对 SDK 签名。** 把 `hana-app-creator/assets/sdk/hana-app-sdk.tgz` 解到临时目录，读 `package/dist` 里的类型声明，确认并记在 `docs/superpowers/plans/sdk-notes.md`：`sdk.tools.register`、`sdk.commands.register`、`sdk.bus.subscribe`、`sdk.routes.register`、`sdk.storage.global.get/set/delete` 各自的参数与返回值（回执是 `{ ready, disposeAsync }` 还是函数）。后续 Task 3/8 以这份记录为准。

- [ ] **Step 6: 添加 `package.json`**（`{"type":"module","private":true,"scripts":{"test":"node --test --test-isolation=none tests/*.test.js"}}`）。默认隔离的 node:test 会 spawn worker 而在此 Windows sandbox 报 `spawn EPERM`；单进程隔离 + 显式 `*.test.js` glob 可运行，`npm test` 已验证 PASS。官方静态校验从 worktree 根目录运行：`node hana-app-creator/scripts/validate_app.mjs --dir apps/grove --json`（不要在 `apps/grove` 子目录用同一相对路径），预期无 error。

- [ ] **Step 7: Commit** — `git add brand apps docs/superpowers/plans && git commit -m "feat: scaffold grove host app"`

---

### Task 2: 模块契约与注册表

**Files:**
- Create: `apps/grove/core/module-contract.js`, `apps/grove/core/registry.js`, `apps/grove/modules/index.js`
- Test: `apps/grove/tests/registry.test.js`

**Interfaces:**
- Produces:
  - `validateModuleDef(def: unknown): ModuleDef`（非法则抛 `Error`，消息含字段名）
  - `createRegistry({ modules: ModuleDef[], planned: PlannedEntry[] }): Registry`，`Registry = { modules: ModuleDef[], planned: PlannedEntry[], get(id): ModuleDef | undefined, isPlanned(id): boolean, capabilityUnion(): string[] }`
  - `ModuleDef = { id: string, version: string, schemaVersion: number, capabilities: string[], tools: string[], commands: string[], activate(api: ModuleApi): Promise<void | (() => void | Promise<void>)>, migrate?(fromVersion: number, api: ModuleApi): Promise<void> }`
  - `PlannedEntry = { id: string }`
  - `modules/index.js` 导出 `modules: ModuleDef[]`（首版为空数组）与 `planned: PlannedEntry[]`（`session-stats`、`token-stats`、`task-manager`）。

- [ ] **Step 1: 写失败测试。** 用例名与断言：`rejects id not matching /^[a-z][a-z0-9-]*$/`（如 `"Bad_Id"`）；`rejects non-integer or <1 schemaVersion`；`rejects tools entries not matching /^[a-z][a-z0-9_-]*$/`；`createRegistry throws on duplicate module id`；`createRegistry throws when a planned id equals a module id`；`capabilityUnion returns sorted unique union`；`isPlanned true only for planned ids`。
- [ ] **Step 2: 运行 `node --test tests/registry.test.js`，预期 FAIL（模块不存在）。**
- [ ] **Step 3: 实现上述两个文件与 `modules/index.js`。** 校验放 `module-contract.js`，注册表放 `registry.js`。
- [ ] **Step 4: 运行测试，预期 PASS。**
- [ ] **Step 5: Commit** — `git commit -m "feat: module contract and registry"`

---

### Task 3: ModuleApi 与注册回滚

**Files:**
- Create: `apps/grove/core/module-api.js`
- Test: `apps/grove/tests/module-api.test.js`（含 `tests/fixtures/fake-port.js`）

**Interfaces:**
- Consumes: `ModuleDef`（Task 2）。
- Produces:
  - `HostPort = { registerTool(reg): Promise<Disposable>, registerCommand(reg): Promise<Disposable>, subscribe(cb, filter?): Promise<Disposable>, storage: { get(key, fallback?): Promise<any>, set(key, value): Promise<void>, delete(key): Promise<void> }, logger: { info(m), warn(m), error(m) } }`，其中 `Disposable = () => Promise<void> | void`（Task 8 负责把 SDK 回执归一成它）。
  - `createModuleApi(port: HostPort, def: ModuleDef, moduleStorage: ModuleStorage): { api: ModuleApi, disposeAll(): Promise<Error[]> }`
  - `ModuleApi = { id, log(level: "info"|"warn"|"error", message: string): void, registerTool(spec): Promise<void>, registerCommand(spec): Promise<void>, subscribe(cb, filter?): Promise<void>, storage: ModuleStorage }`
  - `ModuleStorage = { get(key, fallback?), set(key, value), delete(key) }`

- [ ] **Step 1: 写 `fake-port.js`**（记录所有注册、可指定第 N 次注册失败、记录每个 disposer 是否被调用）与失败测试：
  - `registerTool prefixes name as grove_<id>_<name>`（如 `session-stats` + `summary` → `grove_session-stats_summary`）；
  - `registerCommand prefixes name as grove-<id>-<name>`；
  - `registerTool rejects a name not declared in def.tools`；
  - `disposeAll calls every disposer in reverse order and returns collected errors without throwing`（Review Focus 3）；
  - `a failing registration leaves earlier ones tracked so disposeAll can roll them back`（Review Focus 2）；
  - `log forwards to port.logger with [grove:<id>] prefix`。
- [ ] **Step 2: 运行，预期 FAIL。**
- [ ] **Step 3: 实现 `createModuleApi`。** 注册成功才入栈；`disposeAll` 逆序执行，吞掉并收集每个 disposer 的异常。
- [ ] **Step 4: 运行，预期 PASS。**
- [ ] **Step 5: Commit** — `git commit -m "feat: module api with tracked registrations"`

---

### Task 4: 状态存储

**Files:**
- Create: `apps/grove/core/state-store.js`
- Test: `apps/grove/tests/state-store.test.js`

**Interfaces:**
- Produces: `createStateStore(storage: HostPort["storage"]): StateStore`，
  `StateStore = { getEnabledIds(): Promise<string[]>, setEnabled(id: string, on: boolean): Promise<void>, getModuleSchema(id): Promise<number | null>, setModuleSchema(id, n: number): Promise<void>, getLocaleOverride(): Promise<string | null>, setLocaleOverride(locale: string | null): Promise<void>, moduleStorage(id: string): ModuleStorage }`
- 存储键：`grove:selection`（值 `{ version: 1, enabled: { [id]: true } }`）、`grove:locale`、`grove:schema:<id>`、`grove:data:<id>:<key>`。

- [ ] **Step 1: 写失败测试（内存 `storage` 假实现）：** `setEnabled persists and getEnabledIds returns it`；`setEnabled false removes the id`；`parallel setEnabled for two ids keeps both`（写入串行化）；`getEnabledIds ignores garbage (null, array, string, wrong version)`（Review Focus 4）；`moduleStorage keys are namespaced per module and do not collide`；`setLocaleOverride(null) clears`。
- [ ] **Step 2: 运行，预期 FAIL。**
- [ ] **Step 3: 实现。** 选择的读改写走内部 Promise 队列。
- [ ] **Step 4: 运行，预期 PASS。**
- [ ] **Step 5: Commit** — `git commit -m "feat: grove state store"`

---

### Task 5: 生命周期引擎

**Files:**
- Create: `apps/grove/core/lifecycle.js`
- Test: `apps/grove/tests/lifecycle.test.js`（假模块放 `tests/fixtures/fake-modules.js`）

**Interfaces:**
- Consumes: `Registry`（Task 2）、`createModuleApi`（Task 3）、`StateStore`（Task 4）。
- Produces:
  - `createLifecycle({ registry, store, port, logger }): Lifecycle`
  - `Lifecycle = { views(): Promise<ModuleView[]>, enable(id): Promise<ModuleView>, disable(id): Promise<ModuleView>, restore(): Promise<void> }`
  - `ModuleView = { id: string, status: "planned"|"off"|"starting"|"on"|"blocked"|"failed"|"stopping", error?: { code: string, message: string } }`
  - `class LifecycleError extends Error { code: "UNKNOWN_MODULE" | "NOT_AVAILABLE" }`
- 规则：同一模块的操作串行；`on`/`starting` 再启用幂等；`failed`/`blocked` 再启用即重试；失败时 `disposeAll` 回滚并保留启用意图；错误带 `capability` 字段则状态为 `blocked`，否则 `failed`；数据迁移规则见 Step 3。

- [ ] **Step 1: 写失败测试（假模块：成功型、`activate` 部分注册后抛错型、清理抛错型、需迁移型、抛 `{capability}` 错误型）：**
  - `new modules start off and views lists planned entries as planned`；
  - `enable runs activate once, status on, selection persisted`；
  - `enable twice concurrently activates once`、`enable then disable concurrently ends off with no residual registrations`（Review Focus 1）；
  - `activate failing after one registration rolls back and ends failed, intent kept`（Review Focus 2）；
  - `error with capability ends blocked`；
  - `retry after failure succeeds and ends on`；
  - `cleanup throwing still ends off and other modules unaffected`（Review Focus 3）；
  - `enable on planned or unknown id rejects with NOT_AVAILABLE / UNKNOWN_MODULE and changes nothing`（Review Focus 6）；
  - `restore enables stored ids concurrently, ignores unknown ids, one failure does not stop others`（Review Focus 4）；
  - `migration: stored schema lower than def calls migrate(from, api) then records new schema; migrate failure ends failed with code MIGRATION_FAILED and keeps the old schema`；`stored schema higher ends failed with code SCHEMA_NEWER`；`first run records current schema`。
- [ ] **Step 2: 运行，预期 FAIL。**
- [ ] **Step 3: 实现 `createLifecycle`。** 每模块一条 Promise 链；`activate` 之前先查 schema（无记录→写当前版本；低于→`migrate`；高于→失败）；`activate` 返回的函数作清理句柄，停用时先调它再 `disposeAll`。
- [ ] **Step 4: 运行，预期 PASS。**
- [ ] **Step 5: Commit** — `git commit -m "feat: module lifecycle engine"`

---

### Task 6: 构建检查

**Files:**
- Create: `apps/grove/scripts/check-modules.mjs`
- Modify: `apps/grove/package.json`
- Test: `apps/grove/tests/check-modules.test.js`

**Interfaces:**
- Produces: `checkModules({ registry: Registry, manifest: object }): { ok: boolean, errors: string[] }`；脚本入口导入 `modules/index.js` 与 `manifest.json`，有错则打印并以退出码 1 结束。检查项：模块间工具名（`grove_<id>_<name>`）与命令名冲突；`manifest.capabilities` 不覆盖 `capabilityUnion()`（逐条指出缺失项）；模块 ID 与已有卡片 id 无关，不检查。

- [ ] **Step 1: 写失败测试：** `passes for empty registry with empty capabilities`；`fails and names the missing capability when manifest lacks one a module needs`；`fails when two modules derive the same tool name`（测试里手工构造一个含两个模块、推导名相同的类 `Registry` 对象，直接传入 `checkModules`，因为 `createRegistry` 已拦同 ID）；`fails when two modules derive the same command name`；`fails on duplicate local tool names within one module`。
- [ ] **Step 2: 运行，预期 FAIL。**
- [ ] **Step 3: 实现。** 并在 `package.json` 加脚本 `"check:modules": "node scripts/check-modules.mjs"`。
- [ ] **Step 4: 运行 `node --test tests/check-modules.test.js` 与 `npm run check:modules`，预期 PASS / 退出码 0。**
- [ ] **Step 5: Commit** — `git commit -m "feat: module build checks"`

---

### Task 7: 多语言

**Files:**
- Create: `apps/grove/core/i18n.js`
- Test: `apps/grove/tests/i18n.test.js`

**Interfaces:**
- Produces:
  - `SUPPORTED_LOCALES: ["zh","zh-TW","en","ja","ko"]`
  - `resolveLocale({ override?: string | null, candidates?: string[] }): "zh"|"zh-TW"|"en"|"ja"|"ko"`：先看 `override`（受支持才用），再按 `candidates` 顺序匹配（`zh-TW/zh-HK/zh-MO/zh-Hant*`→`zh-TW`，其他 `zh*`→`zh`，`en*`→`en`，`ja*`→`ja`，`ko*`→`ko`，大小写不敏感），都不中则 `zh`。
  - `createTranslator(locale): (key: string) => string`：缺词回退 `zh`，再缺则返回 key 本身。
  - 词条键（五种语言都要有）：`app.name`、`app.chineseName`、`app.publisher`、`menu.about`、`menu.language`、`menu.languageAuto`、`about.title`、`about.body`、`about.version`、`about.author`、`back`、`details`、`group.on`、`group.off`、`group.attention`、`group.planned`、`status.planned`、`status.off`、`status.starting`、`status.on`、`status.blocked`、`status.failed`、`status.stopping`、`action.enable`、`action.disable`、`action.retry`、`hint.blocked`、`empty.catalog`、`error.generic`，以及三个示例模块的 `module.<id>.name` / `module.<id>.desc`。

- [ ] **Step 1: 写失败测试：** `resolveLocale handles undefined, empty string, "zh-Hant-HK" → zh-TW, "EN-us" → en, "fr" → zh, ["fr","ja-JP"] → ja`；`override wins when supported and is ignored when not`；`every supported locale defines every key` （遍历键表，缺任何一项即失败）；`createTranslator falls back to zh then key`（Review Focus 5）。
- [ ] **Step 2: 运行，预期 FAIL。**
- [ ] **Step 3: 实现并填满五种语言词典。** 示例模块名：zh 向日葵／小苔藓／松鼠；其余语言由实现者给出自然译名并在交付说明里列出，供 Fern 审定。词典同时被后端与 `ui/` 引用，故不得依赖 Node 专有 API。
- [ ] **Step 4: 运行，预期 PASS。**
- [ ] **Step 5: Commit** — `git commit -m "feat: i18n dictionaries and locale resolution"`

---

### Task 8: 宿主适配、路由与入口

**Files:**
- Create: `apps/grove/host/ports.js`, `apps/grove/host/routes.js`, `apps/grove/host/standalone.js`
- Modify: `apps/grove/index.js`
- Test: `apps/grove/tests/routes.test.js`, `apps/grove/tests/ports.test.js`, `apps/grove/tests/standalone.test.js`

**Interfaces:**
- Consumes: `createLifecycle`、`createStateStore`、`createRegistry`、`resolveLocale`（前述任务）；Task 1 Step 5 的 SDK 签名记录。
- Produces:
  - 路由对象只假定最小接口：`app.get/post/put(path, handler)`，`handler(c)` 里用 `c.json(body, status?)`、`c.req.param(name)`、`c.req.json()`；测试用一个实现这三项的小型假路由，不依赖 Hono 包。
  - `createHostPort(sdk): HostPort`：把 `sdk.tools.register`、`sdk.commands.register`、`sdk.bus.subscribe` 的回执归一成 `Disposable`；`storage` 映射到 `sdk.storage.global`；`logger` 映射到 `sdk.logger`。
  - `registerRoutes(app, { lifecycle, store }): void`，路由（相对 `/api/apps/grove/routes/`）：`GET /state` → `{ locale: string|null, modules: ModuleView[] }`；`POST /modules/:id/enable`、`POST /modules/:id/disable` → `ModuleView`（`UNKNOWN_MODULE`→404，`NOT_AVAILABLE`→409，其余→500 带 `{ error, code }`）；`PUT /locale` 体 `{ locale: string|null }`，不受支持的值→400。
  - `createStandaloneApp(def: ModuleDef): (sdk) => Promise<void>`：给单模块 v2 App 的入口用——建 `HostPort`、存储与 `ModuleApi`，处理迁移后直接 `activate`，不含面板；失败抛出让 Hana 标记 `failed`。
  - `index.js`：`defineApp` 内依次建端口、存储、注册表（来自 `modules/index.js`）、生命周期，`await sdk.routes.register(app => registerRoutes(...))`，最后 `lifecycle.restore()`。

- [ ] **Step 1: 写失败测试：** 路由用上面的假路由＋假生命周期，断言上列状态码与响应体；`ports.test.js` 断言回执为函数、为 `{ disposeAsync }`、为 `{ ready, disposeAsync }` 三种形状都能归一并可被调用；`standalone.test.js` 用假 `sdk` 与测试模块断言：已迁移、`activate` 被调用一次、注册的工具名带 `grove_<id>_` 前缀、`activate` 抛错时 `createStandaloneApp` 的 promise 拒绝。
- [ ] **Step 2: 运行，预期 FAIL。**
- [ ] **Step 3: 实现三份适配与 `index.js`。** 路由的错误码映射集中在一个函数里。
- [ ] **Step 4: 运行 `npm test`，预期全部 PASS。**
- [ ] **Step 5: 运行 `node hana-app-creator/scripts/validate_app.mjs --dir apps/grove --json`，预期无 error；若校验器要求 `minAppVersion`，按其提示填入并记录原因。**
- [ ] **Step 6: Commit** — `git commit -m "feat: host adapters, routes and entry"`

---

### Task 9: 面板界面

**Files:**
- Create: `apps/grove/ui/assets/view-model.js`, `apps/grove/ui/assets/shell.js`
- Modify: `apps/grove/ui/panel.html`, `apps/grove/ui/assets/panel.js`, `apps/grove/ui/assets/panel.css`
- Test: `apps/grove/tests/view-model.test.js`

**Interfaces:**
- Consumes: `ModuleView`（Task 5）、`createTranslator`/`resolveLocale`（Task 7）；脚手架生成的 `ui/assets/sdk.js` 中 `hana.ready/theme/api` 的实际调用形态（先读该文件再写）。
- Produces:
  - `groupViews(views: ModuleView[]): { key: "on"|"off"|"attention"|"planned", views: ModuleView[] }[]`：顺序固定；`on`/`starting`/`stopping` 归“已启用”，`off` 归“可启用”，`failed`/`blocked` 归“需处理”，`planned` 归“规划中”；空组不出现。
  - `shell.js`：在 `hana.ready()` 后取 `hana.theme.getSnapshot()`，把 `cssUrl` 作为 `<link id="hana-theme">` 加载并订阅后续变化；`appearance` 存在时同步 `color-scheme`。

- [ ] **Step 1: 写失败测试（仅 `view-model`）：** `groups follow the fixed order and omit empty groups`；`starting and stopping stay in the enabled group`；`failed and blocked go to attention`；`planned only → single planned group`。
- [ ] **Step 2: 运行，预期 FAIL。**
- [ ] **Step 3: 实现 `view-model.js`，运行预期 PASS。**
- [ ] **Step 4: 重写页面。** 结构：标题栏（`Grove` + `Fern`，右侧“⋯”按钮打开菜单：“关于 Grove”、语言选择含“跟随系统”）→ 分组标题 → 两列卡片栅格（`grid-template-columns: repeat(2, minmax(0, 1fr))`，容器宽小于 560px 时单列）。轻叙述卡：意象名、一句功能说明、状态胶囊、详情入口；规划中卡片无开关且不可打开详情；已实现模块的卡片主体打开同页详情（顶部“返回”），启停开关独立于卡片主体；`failed`/`blocked` 显示错误文案与“重试”，`blocked` 另显 `hint.blocked`。所有来自数据的文本一律 `textContent`。颜色只用宿主 CSS 变量（`var(--bg)`、`var(--text)` 起步，边框与次级文字用 `color-mix` 派生）。数据经 `hana.api.fetch` 调 Task 8 的路由，操作后刷新状态。
- [ ] **Step 5: 视觉自检。** 用 Hana 里的本地安装或浏览器直接打开 `ui/panel.html`（路由不可用时页面应显示 `error.generic` 而非空白），检查明/暗主题、五种语言切换、窄宽度单列、键盘可聚焦且有可见焦点、`prefers-reduced-motion` 下无多余动画。记录检查结果；无法在 Hana 内验证的项明确写“未测”。
- [ ] **Step 6: 运行 `npm test` 与校验器，预期通过。**
- [ ] **Step 7: Commit** — `git commit -m "feat: grove panel ui"`

---

### Task 10: 隔离启动检查与交付核对

**Files:**
- Create: `apps/grove/README.md`
- Modify: 无

**Interfaces:**
- Consumes: 全部前述任务。

- [ ] **Step 1: 运行完整验证。** 依次：`npm test`（在 `apps/grove`）、`npm run check:modules`、`node hana-app-creator/scripts/validate_app.mjs --dir apps/grove --json`，预期全部通过。
- [ ] **Step 2: 隔离启动检查。** `node hana-app-creator/scripts/validate_app.mjs --dir apps/grove --smoke --json`。预期通过；若缺平台缓存的 Node/Electron 运行环境而无法执行，须如实记录“未运行”及原因，不得宣称通过。
- [ ] **Step 3: 打包。** `node hana-app-creator/scripts/pack_app.mjs --dir apps/grove --publisher "Fern" --out dist-extensions`，预期生成 ZIP 与 `.entry.json`；再对产物 ZIP 过一遍校验器。**不安装**到真实 Hana，除非 Fern 明确要求。
- [ ] **Step 4: 写 `README.md`：** 用途、目录结构、如何新增一个模块（`modules/<id>/` + 在 `modules/index.js` 登记 + 在 `manifest.json` 补能力 + 在 `i18n.js` 补词条 + 跑 `check:modules`）、权限清单（首版为空）、已知限制（语言无法跟随宿主；单模块包与导出/导入迁移尚未交付）。
- [ ] **Step 5: 对照规格第 11 节七条验收逐条核对，列出“已验证 / 未测”。**
- [ ] **Step 6: Commit** — `git commit -m "docs: grove readme and delivery check"`

---

## 规格覆盖与已知偏差

- 规格第 4–7、9、10 节：Task 2–5、7–9。第 8 节视觉：Task 9。第 11 节验收 1–4、6：Task 5、8、9；验收 5：宿主包由 Task 8–10 覆盖。
- **偏差一（需 Fern 知晓）**：验收 5 要求“独立模块包”也过校验。首版无真实模块，本计划只交付 `createStandaloneApp` 适配函数并用测试模块验证；**独立 App 包的 manifest、图标与打包脚本推迟到第一个真实模块加入时**制作。
- **偏差二**：规格 6.2 的“显式导出/导入迁移”属于未来拆分，不在首版范围，与规格第 10 节一致，本计划不含。
- 规格第 12 节待定项：App ID 定为 `grove`、工具前缀 `grove_`、命令前缀 `grove-`（Task 1–3 落地）；各语言模块名与图标图形由 Task 7、Task 1 给出初版，仍由 Fern 审定；发布前检索 ID 占用不在本计划内。
