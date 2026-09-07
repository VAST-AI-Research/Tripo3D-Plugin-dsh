# Tripo 3D × DeepSeek Harness

**一个 skills-only 的 DSH 插件：把 Tripo 的 3D 生成能力以「技能」形式注入
DeepSeek Harness 的 agent，agent 通过 shell 驱动 `tripo-cli`，生成的模型直接落到
用户本地项目。**

npm `@vastai/dsh-tripo-3d` · 零依赖 · 纯 ESM · 无构建步骤 · 双区域（国内站 / 海外站）

```
  用户                DeepSeek Harness (dsh)                    本插件                 Tripo
  ────                ──────────────────────                    ──────                 ─────
  "生成一个低模宝箱"
        │
        ▼
   ┌──────────┐   skill catalog 里有 tripo-3d 的      ┌────────────────────────┐
   │  agent   │ ◀── name + description ─────────────  │ index.js               │
   │ (model)  │                                        │  ctx.skills            │
   │          │ ── skill 工具加载正文 ───────────────▶ │   .registerProvider()  │
   │          │ ◀── SKILL.md body ───────────────────  │  skills/*/SKILL.md     │
   │          │                                        └────────────────────────┘
   │          │
   │          │ ── shell: npx tripo-cli make "..." --json --yes ──────────────▶ ┌─────────┐
   │          │                                         (阻塞：提交→轮询→下载)   │ Tripo   │
   │          │ ◀── stdout 最后一行 JSON + exit code ─────────────────────────  │ API     │
   └──────────┘                                                                 │ cn / ov │
        │                                                                       └─────────┘
        ▼
   ./tripo-out/<name>-<id8>/model.glb  preview.png  task.json   ← 已在用户磁盘上
```

## 目录

- [设计取舍：为什么是 skills-only](#设计取舍为什么是-skills-only)
- [架构：DSH 如何加载这个插件](#架构dsh-如何加载这个插件)
- [运行时：一次生成的完整生命周期](#运行时一次生成的完整生命周期)
- [两个 skill](#两个-skill)
- [双区域](#双区域)
- [硬约束及其原因](#硬约束及其原因)
- [仓库结构](#仓库结构)
- [安装与验证](#安装与验证)
- [发布](#发布)

---

## 设计取舍：为什么是 skills-only

DSH 插件可以注册 tool、接 MCP server、挂 hooks。本插件**只注册 skill**，
不注册任何 tool，也不引入 MCP。原因是分工：

| 层                | 负责什么                                                                  | 在哪里                          |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------- |
| `tripo-cli`       | API 契约：鉴权、区域探测、任务轮询、下载、exit code、`--json` 的 stdout   | npm `tripo-cli`，`npx` 免安装   |
| 本插件的 skill    | 操作手册：什么时候用、先跑什么、怎么分支、怎么花用户积分、怎么呈现结果    | `plugin/skills/*/SKILL.md`      |
| DSH               | 把 skill 放进模型可见的目录；提供 shell 工具与沙箱                        | 宿主                            |

这样做的直接后果：

- **插件本身没有 API 代码。** `index.js` 只是把两份 Markdown 交给 DSH 的 skills
  注册表。API 契约变了，改 skill 文本、bump 版本即可，不需要重写任何桥接代码。
- **agent 用的是它已有的 shell 工具。** 不新增工具 schema，不给每轮请求增加
  tool definition token；skill 正文只在模型决定使用时才被加载。
- **CLI 的 exit code 与 JSON stdout 就是协议。** skill 明确要求 agent「按 exit code
  分支，不解析错误文本」「只解析 stdout 最后一行 JSON，不读日志」。
- **代价：** 登录、生成都依赖 shell 与网络。skill 的第一条规则就是：shell 或网络
  不可用时如实报告，不得假装执行。

## 架构：DSH 如何加载这个插件

### bundle → 层 → 行 → provider

DSH 的可运行单元是 **profile**，profile 由若干 **bundle** 的配置层按顺序叠加而成。
本插件就是一个 bundle：

```
plugin/package.json
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }     ← 声明「我贡献一层配置」
        │
        ▼
plugin/cordis.patch.yml
  - insert:
      - id: tripo-3d                                          ← 用户可按 id 覆盖 / 禁用
        name: '@vastai/dsh-tripo-3d'                          ← 按包名解析，落到 index.js
        │
        ▼
plugin/index.js
  export const inject = ['skills']                            ← 等 skills 服务就绪再 apply
  export function apply(ctx) {
    ctx.skills.registerProvider(() => provider)               ← 注册一个 SkillProvider
  }
```

`dsh plugin --profile <名> add @vastai/dsh-tripo-3d` 做的事：pnpm 把包装进
`$DSH_HOME/profiles/<名>/`，dsh 发现 manifest 里有 `dsh.bundle`，把包名追加到
`dsh.profile.bundles`。之后每次 boot，配置按这个顺序叠加：

```
1. @deepseek-ai/dsh-base            官方基础层
2. @deepseek-ai/dsh-web-app         （web profile 才有）
3. @vastai/dsh-tripo-3d             ← 本插件，insert 一行
4. profile 自己的 cordis.patch.yml  用户覆盖
5. $DSH_HOME/cordis.patch.yml       机器级覆盖
6. --patch <file> ...               命令行 overlay
```

后面的层按 `id` 覆盖前面的行。所以用户想禁用本插件，只需在自己的
`cordis.patch.yml` 里写一行同 `id` 的覆盖，不用卸载。

### SkillProvider 契约

`index.js` 里的 provider 实现 DSH skills 子系统的两个方法：

```
list()  →  [{ name, description, rank: 600, source: 'bundled',
              invocation: { modelInvocable: true, userInvocable: true },
              resourceBase: { kind: 'directory', path }, locator }]

get(candidate)  →  { ...同上, content: SKILL.md 去掉 frontmatter 的正文 }
```

几个值不是随意选的：

- **`rank: 600`** 是 `@deepseek-ai/dsh-skill` 里 `BUNDLED_SKILL_RANK` 的字面量镜像。
  同一层内同名 skill 按 rank 决胜，数值小者胜：项目 `.dsh/skills` 100、项目
  `.agents/skills` 200、用户级 400 / 500、打包 skill 600。也就是说用户在自己项目里
  放一个同名 `tripo-3d/SKILL.md` 就能覆盖本插件的版本。不为它引入
  `@deepseek-ai/dsh-skill` 依赖——见[硬约束](#硬约束及其原因)。
- **`source: 'bundled'`** 与官方 `@deepseek-ai/dsh-skill-badge` 同模式，
  目录里显示为 `tripo-3d[bundled]`。
- **每次 `list()` 都重读文件。** 注册表自己缓存已完成的目录；provider 不缓存，
  开发时改 SKILL.md 对已装 profile 即时生效。
- **skills 注册表在 host 层，** 所以 provider 注册进全局，对所有 agent preset
  （`cordis` / `ptc` / `standard`）都可见，不需要按 preset 分别注册。

### 模型看到什么

DSH 的 `tool-skill` 把目录里每个 skill 的 **`name` + `description`** 放进系统
提示，正文不放。模型判断某个 skill 相关时，调用 `skill` 工具加载正文。因此：

- **description 是唯一的触发面。** 它同时承担「英文场景描述」和「中文触发词」，
  并且必须在 DSH `catalogDescriptionMaxLength`（默认 500 字符）以内——超出部分在
  模型可见的目录里被截断，放在尾部的中文触发词就等于没写。`validate.mjs` 会
  归一化空白后检查这个长度。
- **正文可以长。** `tripo-3d` 正文约 200 行，只在被选中时进入上下文。

## 运行时：一次生成的完整生命周期

skill 正文规定了 agent 必须遵守的顺序。以「生成一个低模宝箱导出 FBX」为例：

```
  ┌─ 0. 前置 ──────────────────────────────────────────────────────────────┐
  │  shell 可用？网络可用？否 → 如实报告哪一步被阻断，停止。               │
  └────────────────────────────────────────────────────────────────────────┘
        │
  ┌─ 1. 诊断 ──────────────────────────────────────────────────────────────┐
  │  npx tripo-cli@latest doctor        检查 key / 网络 / 区域 / 余额      │
  │  exit 0 → 跳到 3                                                       │
  │  无 key  → 2                                                           │
  └────────────────────────────────────────────────────────────────────────┘
        │
  ┌─ 2. 设备码登录（无头）────────────────────────────────────────────────┐
  │  区域已知（用户说过 / TRIPO_REGION / whoami）→ 直接用                 │
  │  区域未知 → 问一句：「你的 Tripo 账号在国内站还是海外站？」          │
  │  npx tripo-cli@latest login --region cn|ov --yes                        │
  │    立即打印验证 URL + 一次性码，然后阻塞直到浏览器授权（≤15 min）     │
  │    agent 在进程仍运行时读出 URL 和码，原样展示给用户，逐步引导        │
  │  exit 0 → 回到 1 重跑 doctor      exit 3 → 码过期，重跑 login          │
  └────────────────────────────────────────────────────────────────────────┘
        │
  ┌─ 3. 生成 ──────────────────────────────────────────────────────────────┐
  │  tripo make "a low-poly treasure chest" --for game-mobile --json --yes   │
  │    阻塞：提交 → 轮询（CLI 自己的 1800s 超时）→ 下载 → 退出            │
  │    agent 不得自己轮询、不得设更短超时、不得把日志里的 task_id 当完成   │
  │  stdout 最后一行 = 结果 JSON；进度全在 stderr                          │
  └────────────────────────────────────────────────────────────────────────┘
        │
  ┌─ 4. 按 exit code 分支 ─────────────────────────────────────────────────┐
  │  0 成功        3 鉴权→doctor      4 积分不足      5 内容策略           │
  │  6 任务失败（积分已退，tripo redo）  7 网络   8 任务不存在→改传本地文件│
  │  9 限流→退避重试     1 致命     2 参数错误                              │
  └────────────────────────────────────────────────────────────────────────┘
        │
  ┌─ 5. 判断结果 ──────────────────────────────────────────────────────────┐
  │  读 preview.png，确认资产符合请求；不符 → 给用户看，问是否 redo        │
  │  不得默默重摇                                                          │
  └────────────────────────────────────────────────────────────────────────┘
        │
  ┌─ 6. 呈现 ──────────────────────────────────────────────────────────────┐
  │  文件已在磁盘：不提供「下载」，不把 .glb 渲染成链接                    │
  │  展示 preview.png；模型路径用反引号给出；提供下一步（open -R / 接入）  │
  │  报告 credits_consumed                                                  │
  └────────────────────────────────────────────────────────────────────────┘
```

结果 JSON 的形状（`--json` 时 stdout 的最后一行）：

```json
{
  "task_id": "...",
  "type": "convert_model",
  "status": "success",
  "credits_consumed": 25,
  "output_dir": "tripo-out/knight-1a2b3c4d",
  "files": ["model.fbx", "preview.png", "task.json"],
  "model_file": ".../model.fbx",
  "preview": ".../preview.png",
  "chain": [{ "task_id": "...", "type": "texture_model" }]
}
```

`model_file` / `preview` 指链的**最后一步**。convert 之后原生 GLB 在链里更早的
任务上，用 `tripo task get <chain task_id> --download` 免费取回，不要再付一次转换。

### 积分规则是 skill 的一部分

每次生成都花用户账户里的积分，skill 把这当作硬规则而不是提示：

- 批量生成前先确认；多资产任务先 `tripo balance`，结束后报告花费。
- 3D 打印等不需贴图的输出加 `-p texture=false -p pbr=false`，跳过贴图积分。
- `--for game-mobile` / `game-pc` / `print` / `ar-web` 预设的链尾带一个**付费**
  convert 步骤；用户只要 GLB 时改用无链预设（`toy`），或先告知额外格式要花积分。
- `decimate` 的面数是目标不是上限（1500 请求可能回 ~1900 三角面）；生成阶段的
  `face_limit` 才是上限。有硬预算的项目要读实际面数。

## 两个 skill

| skill              | 职责                                                         | 触发场景                                                                 |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `tripo-3d`         | 基础：shell 前置、登录、`tripo make`、exit code、积分、呈现 | 任何单个 3D 资产请求：文生 3D、图生 3D、绑骨、格式转换、3D 打印         |
| `tripo-game-asset` | 配方：面数预算、道具集、LOD 链、绑骨角色 + 动画、引擎接入   | 在做游戏 / 实时 3D 项目，需要的是「一批可导入的资产」而非一个模型        |

`tripo-game-asset` 显式声明「先读 `tripo-3d`」，自己只放配方，不重复基础规则。
两者都可由模型触发，也可由用户 `/tripo-3d` 直接调用。

`tripo-3d` 的输入类型由 CLI 自动检测——引号文本、图片路径 / URL、2–4 张图（多视角）、
模型文件（导入已有网格）、任务引用（`@last` / `@name` / task id）：

```bash
tripo make "a stylized treasure chest" --for game-mobile --json --yes
tripo make concept.png --for game-pc --json --yes
tripo make front.png back.png --json --yes            # 多视角
tripo make hero.glb --then texture,rig --json --yes   # 给已有网格贴图并绑骨
tripo make @last --then convert:fbx --json --yes      # 从上一个任务继续
```

## 双区域

Tripo 有两个彼此独立的站点，账号、控制台、支付方式都不通：

| region | 控制台                         | 登录 / 充值          |
| ------ | ------------------------------ | -------------------- |
| `cn`   | https://developers.tripo3d.com | +86 短信 / 支付宝    |
| `ov`   | https://developers.tripo3d.ai  | 邮箱 / Stripe        |

DeepSeek 用户以大陆为主，因此双区域是本插件的硬要求，体现在两处：

1. **登录引导覆盖两站。** skill 要求 agent 在区域未知时先问一句，因为在错误
   控制台上启动设备码流程会把用户送到一个没有其账号的站点。
2. **选错区域无害。** CLI 在 Key 验证时会探测两个区域并自纠（`tripo doctor`
   会报告 key-vs-region 不匹配并给出修法），skill 只需在 exit 3 时让 agent
   跑 `doctor`。

大陆网络下 `npx` 拉取 CLI 卡住时，skill 给出的兜底是切到 npmmirror：
`npm config set registry https://registry.npmmirror.com`。

## 硬约束及其原因

这些约束由 `scripts/validate.mjs` 强制，改动 `plugin/` 后必跑。

| 约束                                                        | 原因                                                                                                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` 无 `dependencies` / `devDependencies` / `peerDependencies` / `scripts` | git 安装只拉源码不跑构建；有 `prepare` 脚本会触发 pnpm ≥10 的构建许可拦截，也等于要求用户信任安装期代码执行。零依赖让 npm / tarball / 目录 / git 四种安装都不需要任何许可 |
| 纯 ESM，`main: index.js`，无 TypeScript                     | 同上：没有构建产物就没有「源码装上来但 lib/ 缺失」的问题                                                                                            |
| `rank` 写字面量 600，不 import `@deepseek-ai/dsh-skill`     | 保住零依赖；600 是 `BUNDLED_SKILL_RANK` 的镜像，值变了就是 DSH 的破坏性变更，届时手动同步                                                            |
| skill 名 kebab-case 且等于目录名                            | DSH 注册表按 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 校验，malformed candidate 直接 fail fast                                                                    |
| description 归一化后 ≤ 500 字符                             | DSH `tool-skill` 的 `catalogDescriptionMaxLength`；超出被截断，中文触发词在尾部                                                                     |
| 每个 skill 保留「shell 不可用时如实报告」条款               | DSH 会话可能在禁网或受限沙箱里跑                                                                                                                    |
| 正文不含本机路径、不含其他 agent 产品的表面残留             | skill 文本移植自姊妹项目，公开仓库不带内部痕迹                                                                                                      |
| `tripo-3d` 同时出现两个区域的控制台地址                     | 双区域硬要求                                                                                                                                       |
| patch 行只有 `id` + `name`                                  | 本插件无 Config schema；用户禁用靠同 `id` 覆盖                                                                                                      |
| scoped 包名须带 `publishConfig.access: public`              | 否则 `npm publish` 默认发私有包并失败                                                                                                              |

`validate.mjs` 除静态检查外，还真实 `import` `plugin/index.js`，用假 `ctx` 走一遍
`registerProvider → list() → get()`，断言候选形状（rank、source、invocation、
resourceBase）与正文已剥离 frontmatter。共 63 项。

## 仓库结构

```
Tripo3D-Plugin-dsh/
├── plugin/                        ← npm 包 @vastai/dsh-tripo-3d（唯一的分发物）
│   ├── package.json               dsh.bundle manifest；files 白名单
│   ├── cordis.patch.yml           bundle 层：insert 一行 → index.js
│   ├── index.js                   SkillProvider：读 SKILL.md，注册到 ctx.skills
│   ├── README.md                  npm 页面（英文为主，面向终端用户）
│   └── skills/
│       ├── tripo-3d/SKILL.md      基础 skill
│       └── tripo-game-asset/SKILL.md  游戏资产配方
├── scripts/validate.mjs           63 项校验（静态 + provider 行为）
├── .github/workflows/publish.yml  推 v* tag → 校验 → npm publish（OIDC）
└── README.md                      本文件
```

`plugin/` 之外的内容不进 npm 包（`files` 白名单控制）。

## 安装与验证

```bash
# 从 npm（发布后）
dsh plugin --profile web add @vastai/dsh-tripo-3d

# 从 GitHub（包在 plugin/ 子目录，用 pnpm 的 path: 语法；无构建脚本，不触发许可拦截）
dsh plugin --profile web add "github:VAST-AI-Research/Tripo3D-Plugin-dsh#path:/plugin"

# 从本地 checkout（开发用；pnpm link，改 skill 文件即时生效）
dsh plugin --profile web add /path/to/Tripo3D-Plugin-dsh/plugin
```

三步确认，前两步不花积分：

```bash
# 1. 配置层已叠加（不 boot）
dsh --profile web --dump-config          # 应出现 "# == @vastai/dsh-tripo-3d" 层

# 2. skill 已进目录
dsh web                                  # 输入框打 /，应看到 tripo-3d 与 tripo-game-asset

# 3. 端到端（花真实积分）
#    对 agent 说：生成一个低多边形的宝箱 3D 模型，导出 FBX
#    预期：agent 跑 doctor → 必要时引导设备码登录 → tripo make → 展示 preview.png
```

flag 顺序：`--profile` / `--patch` 是启动器 flag，必须在 `web` 等应用参数之前。
本地目录安装走 pnpm link，改 `skills/*/SKILL.md` 即时生效；改 `cordis.patch.yml`
或 `package.json` 后需重启 dsh。

## 发布

包在 `@vastai` scope 下，由组织成员发布。

**首发（一次性，手动）。** npm trusted publishing 只能绑定已存在的包：

```bash
node scripts/validate.mjs
cd plugin && npm login && npm publish
npm owner add <第二位维护者> @vastai/dsh-tripo-3d
```

之后在 npmjs.com → 包 → Settings → Trusted Publisher 绑定 GitHub Actions：
Organization `VAST-AI-Research`、Repository `Tripo3D-Plugin-dsh`、
Workflow `publish.yml`、Environment 留空。

**后续版本（自动，无 token）。** bump `plugin/package.json` 的 `version`，提交，
推同名 tag：

```bash
git tag v0.1.1 && git push origin v0.1.1
```

[`publish.yml`](.github/workflows/publish.yml) 跑 `validate.mjs`、核对 tag 与版本
一致，再 `npm publish`（OIDC 自动附带 provenance）。CLI 有破坏性 flag 变更时，
改 skill → bump version → 发版，在同一次变更里完成。

## 相关

- [`tripo-cli`](https://github.com/vast-enterprise/Tripo-API-CLI) — skill 驱动的
  CLI，命令契约的权威来源（`skill/commands/*.md` 是每个 flag 的参考）
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —
  `docs/user/develop/basic/publish.md`（bundle / profile / 层顺序）、
  `docs/subsystems/skills.md`（provider 契约、rank、catalog 行为）、
  `packages/skill/skill-badge`（同模式的官方内置范例）
- 发现渠道：GitHub topic [`dsh-plugin`](https://github.com/topics/dsh-plugin)

## License

MIT
