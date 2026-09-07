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
docs/testing.md             本地安装与端到端测试 runbook
AGENTS.md                   给 AI agent 的工作上下文与硬约束
CHANGELOG.md                版本记录
```

## 校验与打包

```bash
node scripts/validate.mjs                # 62 项检查
cd plugin && npm pack --pack-destination ../dist   # 产出 dsh-tripo-3d-<version>.tgz
```

## 本地测试

```bash
# 装进 web profile（首次使用自动初始化为 base + web-app；目录 / tarball / npm 包名均可）
git clone https://github.com/VAST-AI-Research/Tripo3D-Plugin-dsh.git
npx @deepseek-ai/dsh plugin --profile web add /绝对路径/Tripo3D-Plugin-dsh/plugin

# 不启动即可确认层已生效（应出现 "# == dsh-tripo-3d" 层）
npx @deepseek-ai/dsh --profile web --dump-config

# 启动 Web UI（dsh web 是 --profile web 的硬编码别名），输入 / 应能看到两个 skill
npx @deepseek-ai/dsh web
```

注意 flag 顺序：`--profile` / `--patch` 是启动器 flag，必须在 `web` 等应用参数
之前；`dsh --profile <自定义名> web` 会被拒绝。

跑正向用例需要真实账号且消耗积分，完整步骤见 [`docs/testing.md`](docs/testing.md)。

## 分发

DSH 无应用商店，三种等效渠道（详见官方 publish 文档）：

1. **npm 发布**：`cd plugin && npm publish`，用户 `dsh plugin add dsh-tripo-3d`
2. **tarball**：分发 `npm pack` 产物，用户 `dsh plugin add ./dsh-tripo-3d-0.1.0.tgz`
3. **GitHub**：从本仓库
   [VAST-AI-Research/Tripo3D-Plugin-dsh](https://github.com/VAST-AI-Research/Tripo3D-Plugin-dsh)
   安装（本包无构建脚本，不触发 pnpm 的构建许可拦截）。注意 npm 包位于 `plugin/`
   子目录而非仓库根，git 源需指向该子目录；最简单的方式是 clone 后按上文用本地
   目录安装

本仓库已作为公开插件仓库对 DSH 用户开放；加 `dsh-plugin` GitHub topic 以便社区发现。

## License

MIT
