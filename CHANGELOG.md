# Changelog

## 0.1.0 — 2026-08-31

首个版本。从 Kimi 版（`../Tripo-Api-Plugin-Kimi` 0.1.0）移植为 DSH bundle：

- `plugin/` 以 npm 包形态承载 `dsh.bundle.patch`，insert 一个 host 行
- `index.js` 按官方 `dsh-skill-badge` 模式向 `ctx.skills` 注册打包 skill
  provider（rank 600 / source bundled），零依赖纯 ESM，无构建步骤
- skill 正文与 Kimi 版一致（双区域 + 中文触发词 + npmmirror 提示），仅：
  - Kimi 表面措辞（Kimi Work / Kimi Code）替换为 DSH 通用的 shell 前置条款
  - frontmatter description 压缩到归一化 ≤ 500 字符，适配 DSH
    `catalogDescriptionMaxLength` 默认截断
- `scripts/validate.mjs`：62 项发布前校验（manifest、patch、provider 行为、
  skill 内容约束）
