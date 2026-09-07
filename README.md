# Tripo 3D — DeepSeek Harness (DSH) 插件

Tripo 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件
（skills-only）。skill 指导 agent 通过 shell 驱动
[`tripo-cli`](https://github.com/vast-enterprise/Tripo-API-CLI)，生成的 3D 资产
直接落到用户本地项目。

本仓库（[VAST-AI-Research/Tripo3D-Plugin-dsh](https://github.com/VAST-AI-Research/Tripo3D-Plugin-dsh)）
是面向 DSH 用户公开的插件仓库：`plugin/` 是可直接安装的 npm 包，问题与建议请提
[Issue](https://github.com/VAST-AI-Research/Tripo3D-Plugin-dsh/issues)。

插件以 DSH **bundle**（npm 包）形态分发：`package.json` 声明 `dsh.bundle.patch`，
patch 插入一个 host 行，该行的插件模块向全局 `ctx.skills` 注册表注册两个打包
skill（对所有 agent preset 可见，模式同官方 `@deepseek-ai/dsh-skill-badge`）。
纯 ESM 零依赖、无构建步骤，npm / tarball / 目录 / git 四种方式安装均不需要
构建脚本许可。

支持双区域账号：中国大陆站（developers.tripo3d.com）与海外站
（developers.tripo3d.ai），区域由 CLI 在 Key 验证时自动探测。

## 布局

```
plugin/                     分发物——npm 包（bundle）
├── package.json            dsh.bundle manifest
├── cordis.patch.yml        bundle 层 patch（insert 一个 host 行）
├── index.js                Cordis 插件：注册 SkillProvider
└── skills/
    ├── tripo-3d/           主 skill：登录、tripo make、exit codes、积分规则
    └── tripo-game-asset/   游戏资产配方：道具、LOD、绑骨角色

scripts/validate.mjs        发布前校验
```

## 校验与打包

```bash
node scripts/validate.mjs                # 63 项检查
cd plugin && npm pack --pack-destination ../dist   # 产出 vastai-dsh-tripo-3d-<version>.tgz
```

## 本地测试

```bash
# 装进 web profile（首次使用自动初始化为 base + web-app；目录 / tarball / npm 包名均可）
git clone https://github.com/VAST-AI-Research/Tripo3D-Plugin-dsh.git
npx @deepseek-ai/dsh plugin --profile web add /绝对路径/Tripo3D-Plugin-dsh/plugin

# 不启动即可确认层已生效（应出现 "# == @vastai/dsh-tripo-3d" 层）
npx @deepseek-ai/dsh --profile web --dump-config

# 启动 Web UI（dsh web 是 --profile web 的硬编码别名），输入 / 应能看到两个 skill
npx @deepseek-ai/dsh web
```

注意 flag 顺序：`--profile` / `--patch` 是启动器 flag，必须在 `web` 等应用参数
之前；`dsh --profile <自定义名> web` 会被拒绝。

跑正向用例需要真实 Tripo 账号且消耗积分。

## 分发

DSH 无应用商店，三种等效渠道（详见官方 publish 文档）：

1. **npm**：用户 `dsh plugin --profile web add @vastai/dsh-tripo-3d`
2. **GitHub**：用户
   `dsh plugin --profile web add "github:VAST-AI-Research/Tripo3D-Plugin-dsh#path:/plugin"`
   （npm 包位于 `plugin/` 子目录，`path:` 是 pnpm 的子目录语法；本包无构建脚本，
   不触发 pnpm 的构建许可拦截）
3. **tarball**：分发 `npm pack` 产物，用户 `dsh plugin add ./vastai-dsh-tripo-3d-<version>.tgz`

本仓库已作为公开插件仓库对 DSH 用户开放，并带 `dsh-plugin` GitHub topic 以便社区发现。

## 发布到 npm

包名在 `@vastai` scope 下，由组织成员发布。发布分两个阶段：

**首次发布（手动，一次性）。** npm 的 trusted publishing 只能绑定到已存在的包，
所以 0.1.0 必须由 `@vastai` 组织成员在本机发一次：

```bash
node scripts/validate.mjs
cd plugin
npm login                 # @vastai 组织成员账号
npm publish               # publishConfig.access 已设为 public，2FA 会要求 OTP
npm owner add <第二位维护者> @vastai/dsh-tripo-3d   # 至少两人持有
```

**之后的版本（GitHub Actions，无 token）。** 首发完成后，在
npmjs.com → 包页面 → Settings → Trusted Publisher 选 GitHub Actions，填：
Organization `VAST-AI-Research`、Repository `Tripo3D-Plugin-dsh`、
Workflow filename `publish.yml`、Environment 留空。此后发版流程是：

```bash
# 1. bump plugin/package.json 的 version（如 0.1.1）并提交
# 2. 打同名 tag 并推送，workflow 自动校验并发布，附带 provenance 证明
git tag v0.1.1 && git push origin v0.1.1
```

[`.github/workflows/publish.yml`](.github/workflows/publish.yml) 会先跑 `validate.mjs`、
核对 tag 与 `package.json` 版本一致，再 `npm publish`。

## License

MIT
