# Grove（林间）

Fern 的 HanaAgent 扩展套件：一个面板宿主 App，统一管理可逐项启用的小功能模块。

- 品牌：Grove / 林间（zh-TW・ja・ko 沿用「林间」原形，品牌名不做汉字本地化）
- 形态：Hana v2 App（`manifestVersion: 2`），单张整页导航卡，无受保护能力
- 语言：zh / zh-TW / en / ja / ko，按浏览器语言选择，可在面板「⋯」菜单手动覆盖，回退 zh

## 目录结构

```
apps/grove/
├── manifest.json          # v2 清单：id grove、capabilities []、panel 页面卡
├── index.js               # defineApp 入口：端口→存储→注册表→生命周期→路由→restore
├── core/                  # 业务无关核心（纯 ESM，不依赖 Hana SDK，node:test 覆盖）
│   ├── module-contract.js # ModuleDef 校验（validateModuleDef）
│   ├── registry.js        # 注册表：查重、planned 条目、能力并集
│   ├── module-api.js      # ModuleApi：注册跟踪与逆序回滚（disposeAll）
│   ├── state-store.js     # 状态存储：启停选择、locale 覆盖、模块 schema 与数据
│   ├── lifecycle.js       # 生命周期引擎：串行化、迁移门、失败回滚、错误隔离
│   └── i18n.js            # 五语言词典、resolveLocale、createTranslator
├── host/                  # 薄适配层：把 SDK 接成核心要求的 HostPort
│   ├── ports.js           # createHostPort：SDK 回执归一成 Disposable
│   ├── routes.js          # 面板 HTTP 路由（/state、enable、disable、/locale）
│   └── standalone.js      # createStandaloneApp：单模块独立 App 入口
├── modules/index.js       # 模块登记处（首版为空数组 + 三个规划条目）
├── ui/                    # 面板页面（panel.html + shell.js 主题接入 + view-model.js 分组）
├── scripts/check-modules.mjs  # 构建检查：命名冲突与能力覆盖
└── tests/                 # node:test 套件（87 项）
```

## 常用命令

在 `apps/grove` 下执行：

```sh
npm test               # 全部测试（单进程隔离，规避 Windows sandbox 的 spawn EPERM）
npm run check:modules  # 构建检查：工具/命令名冲突、manifest 能力覆盖
```

官方静态校验（任意目录，`--dir` 指向本目录或解包后的 App 目录）：

```sh
node <hana-app-creator>/scripts/validate_app.mjs --dir apps/grove --json
node <hana-app-creator>/scripts/validate_app.mjs --dir apps/grove --smoke --json  # 需 Node 26+ 运行时
```

## 如何新增一个模块

1. 在 `modules/<id>/` 写模块：导出符合 `ModuleDef` 的对象（id 匹配 `^[a-z][a-z0-9-]*$`，工具名匹配 `^[a-z][a-z0-9_-]*$`），在 `activate(api)` 里通过 `api.registerTool` / `api.registerCommand` / `api.subscribe` 注册，返回清理函数（可选）。
2. 在 `modules/index.js` 登记该模块。
3. 若模块需要受保护能力，在 `manifest.json` 的 `capabilities` 补上（套件声明全部模块能力的并集）。
4. 在 `core/i18n.js` 补五种语言的 `module.<id>.name` 与 `module.<id>.desc` 词条。
5. 跑 `npm run check:modules` 与 `npm test`，全绿后提交。

新加入的模块默认关闭；已保存的启停选择不受模块更新影响。

## 权限清单

首版宿主自身不使用任何受保护能力，`manifest.json` 的 `capabilities` 为 `[]`。面板版将来会声明所含全部模块所需能力的并集；模块开关不授予也不撤销权限。

## 已知限制

- Hana v2 无公开宿主语言接口，语言按浏览器语言选择（`navigator.languages`），无法跟随宿主设置；可手动覆盖。
- 独立模块包（每个模块打成单独 App）的 manifest 与打包流程尚未交付；`host/standalone.js` 已提供入口函数并用测试模块验证。
- 模块数据的显式导出/导入迁移属于未来拆分，首版未含。
- 隔离启动检查（`--smoke`）需要平台缓存的 Node 26+ AppHost 运行时，缺运行时的环境会报 `SMOKE_NODE_RUNTIME_UNAVAILABLE`。
