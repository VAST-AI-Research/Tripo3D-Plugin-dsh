# AGENTS.md

给在这个仓库工作的 AI agent 的上下文。

## 这个仓库是什么

**Tripo 3D 的 DeepSeek Harness（DSH）插件**。仓库不是产品，`plugin/` 才是——
其余（`docs/`、本文件）是工作上下文，不进 npm 包（`files` 白名单控制）。

姊妹仓库 `../Tripo-Api-Plugin-Kimi`（Kimi 版，skill 内容基准）与
`../Tripo-api-codex`（Codex 版）。本仓库的两个 skill 由 Kimi 版移植而来
（Kimi 版 = Codex 版 + 双区域 + 中文触发词），命令契约的最终权威是
`../Tripo-API-CLI` 的源码。

## 当前状态：0.1.0

|          |                                                                                              |
| -------- | -------------------------------------------------------------------------------------------- |
| 形态     | Skills-only。**不注册 tool、无 MCP、无 hooks**                                              |
| 机制     | DSH bundle：`dsh.bundle.patch` → insert host 行 → `ctx.skills.registerProvider()` 注册打包 skill |
| 范例     | 官方 `@deepseek-ai/dsh-skill-badge`（packages/skill/skill-badge）是同模式的内置先例          |
| 工作方式 | skill 指导 agent 通过 shell 驱动 `tripo-cli`（npm 包，npx 免安装）                           |
| 分发     | npm / tarball / GitHub，`dsh plugin --profile <名> add <源>`；无商店审核                     |
| 地区     | **中国大陆 + 海外双区域**（DeepSeek 用户以大陆为主，双区域是硬要求）                         |

## 硬约束——不要违反

**保持零依赖、纯 ESM、无构建步骤、无 scripts。** `plugin/package.json` 不得出现
`dependencies` / `devDependencies` / `peerDependencies` / `scripts`。TypeScript 或任何
构建产物会让 git 安装触发 pnpm ≥10 的构建脚本拦截（见官方 publish.md），也引入
安装期代码执行的信任问题。rank 600 是 `BUNDLED_SKILL_RANK` 的字面量镜像，
不要为它引入 `@deepseek-ai/dsh-skill` 依赖。

**skill 名必须 kebab-case 且与目录名一致。** DSH 注册表按
`^[a-z0-9]+(?:-[a-z0-9]+)*$` 校验，malformed candidate 直接 fail fast。

**frontmatter description 归一化后 ≤ 500 字符。** DSH `tool-skill` 的
`catalogDescriptionMaxLength` 默认 500，超出部分在模型可见的 catalog 里被截断——
中文触发词在尾部就等于没写。这是与 Kimi/Codex 版正文不完全一致的唯一原因。

**保持双区域。** skill 的登录引导必须同时覆盖 cn（developers.tripo3d.com）和
ov（developers.tripo3d.ai）。选错区域无害——CLI 在 Key 验证时探测两个区域并自纠
（见 `../Tripo-API-CLI/src/commands/login.ts` 的 `validateAndSave`）。

**保持每个 skill 的 shell 前置条款。** DSH 会话可能运行在禁网或受限沙箱里；
条款要求 agent 在 shell/网络不可用时如实报告，而不是假装执行。

**skill 里不得出现本机路径或 Kimi/Codex 表面残留。** validate.mjs 会查。

**不要给 patch 行加多余配置。** 本插件无 Config schema；patch 只有 id + name。
用户想禁用可在自己 profile 的 cordis.patch.yml 里按 id 覆盖。

## 对照 CLI 源码核实 skill 内容

skill 记录的是 `tripo-cli` 的精确命令契约，写错一个 flag 就是有害的。凭源码
核实，不凭记忆：

- 本地克隆：`../Tripo-API-CLI`（npm `tripo-cli`，0.2.1 起支持无头设备登录
  `login --region ov|cn`）
- `skill/commands/*.md` — 每个命令的 flag 权威参考
- `src/config/config.ts` — 双区域端点（`REGION_DEFAULTS`）
- `src/commands/login.ts` — 设备码流程、区域探测与自纠
- `src/core/watch.ts` — 轮询与 1800s 默认超时

CLI 发布破坏性 flag 变更时：更新 skill → bump `version` → 记入 `CHANGELOG.md`，
同一次变更完成。四份 skill 文本（CLI 仓库 `skill/`、Codex 版、Kimi 版、本仓库）
目前是手工同步的；改契约措辞时检查是否需要四处同步。

## DSH 侧机制速查（凭 /tmp 或官方仓库核实，不凭记忆）

- 插件教程：`docs/user/develop/basic/{index,tool,config,publish}.md`
- skills 子系统：`docs/subsystems/skills.md`（provider 契约、rank 表、catalog 行为）
- 内置范例：`packages/skill/skill-badge/src/index.ts`
- host/preset 分层：skills 注册表在 host 层，本插件的 provider 注册进全局层，
  对所有 agent preset 可见（web-app bundle 的注释有完整论证）

## 校验与打包

```bash
node scripts/validate.mjs        # 改动 plugin/ 后必跑，62 项
cd plugin && npm pack --pack-destination ../dist
```

## 本地测试

```bash
npx @deepseek-ai/dsh plugin --profile web add <本仓库>/plugin
npx @deepseek-ai/dsh --profile web --dump-config    # 应出现 dsh-plugin-tripo-3d 层
npx @deepseek-ai/dsh web                             # web 是 --profile web 的硬编码别名
```

**flag 顺序陷阱**：`--profile` / `--patch` 是启动器 flag，必须在应用参数之前，
且 `web`/`plugin` 作为首个应用参数会被解析成子命令——`dsh --profile <自定义名> web`
会被直接拒绝；自定义 profile 不带 `web` 即可 boot（无 web 表面）。

注意 `add` 本地目录走 pnpm link：改 `plugin/` 内文件对已装 profile 即时生效
（provider 每次 list/get 现读文件），但改 `cordis.patch.yml` 或 `package.json`
后需重启 dsh 进程。完整 runbook：`docs/testing.md`。正向用例花真实积分。

运行时验证捷径（0.1.0 发布前已跑通）：写一个 `inject: ['skills']` 的一次性探针
插件调用 `ctx.skills.list({})`，用 `--patch` overlay 随 profile boot，确认目录里
出现 `tripo-3d[bundled/tripo-3d]` 与 `tripo-game-asset[bundled/tripo-3d]`。

## 相关仓库

| 路径                        | 角色                                 |
| --------------------------- | ------------------------------------ |
| `../Tripo-API-CLI`          | skill 驱动的 CLI，命令契约权威       |
| `../Tripo-Api-Plugin-Kimi`  | Kimi 版，skill 内容基准（双区域）    |
| `../Tripo-api-codex`        | Codex 版，skill 内容上游             |
