# 本地测试 runbook

正向用例消耗真实 Tripo 积分。

## 前置

- Node.js LTS（skill 通过 `npx tripo-cli@latest` 驱动 CLI，无需预装；
  dsh 本体也通过 npx 运行）
- 一个 Tripo 账号：cn 站 https://developers.tripo3d.com 或 ov 站
  https://developers.tripo3d.ai，新账号有免费额度
- 不要预先 `export TRIPO_API_KEY`——首轮测试就该走 skill 里的设备码登录引导，
  这是真实用户遇到的第一个流程
- DSH 侧需要一个可用的模型供应商（设置页配置，或参考官方 providers 文档）

## 安装与加载

```bash
# 1. 静态校验全绿
node scripts/validate.mjs

# 2. 装进 web profile（本地目录，pnpm link；web profile 首次使用自动初始化为 base + web-app）
npx @deepseek-ai/dsh plugin --profile web add /绝对路径/Tripo-Api-Plugin-Deepseek/plugin

# 3. 不启动即可确认组合层
npx @deepseek-ai/dsh --profile web --dump-config
#    预期：出现 "# == dsh-tripo-3d" 层，含 id: tripo-3d 的 insert 行

# 4. 启动 Web UI（dsh web 是 --profile web 的硬编码别名；
#    注意 --profile/--patch 等启动器 flag 不能与 web 子命令混用）
npx @deepseek-ai/dsh web
```

加载验证（不花积分）：

- 启动日志无 `tripo-3d` 相关报错
- Web UI 输入框敲 `/`，skill 列表应出现 `tripo-3d` 与 `tripo-game-asset`
- 对话让模型调用 `skill` 工具加载 `tripo-3d`，返回内容应为完整正文
  （无 frontmatter）

改动 `plugin/skills/**` 后无需重装（provider 每次现读文件，watcher 之外
catalog 可能有缓存延迟，新会话必然生效）；改 `cordis.patch.yml` /
`package.json` / `index.js` 后重启 dsh 进程。

卸载：`npx @deepseek-ai/dsh plugin --profile web remove dsh-tripo-3d`。

不依赖 Web UI 的运行时自检（不花积分）：写一个 `inject: ['skills']` 的一次性
探针插件调用 `ctx.skills.list({})` 打印目录，用 `--patch` overlay 随任意
base-backed profile boot，预期出现 `tripo-3d[bundled/tripo-3d]` 与
`tripo-game-asset[bundled/tripo-3d]`（0.1.0 已按此路径验证通过）。

## 正向用例

| # | prompt | 验证点 |
| --- | --- | --- |
| 1 | 生成一个低多边形的宝箱 3D 模型，导出 FBX 给 Unity 用 | 触发 tripo-3d skill；`tripo make` 阻塞等待；产物落盘、展示 preview.png、路径用反引号 |
| 2 | Turn this concept image into a textured 3D model, export GLB（附图） | 本地图片走 CLI 上传；GLB 无多余付费 convert |
| 3 | 生成一个可 3D 打印的骑士小雕像，导出 STL | `--for print` 链路；建议 `-p texture=false -p pbr=false` 省贴图积分 |
| 4 | 生成 T-pose 机器人角色并绑骨加走路动画 | 触发 tripo-game-asset；`--for anim` 先 rig-check |
| 5 | 查一下我的 Tripo 余额 | `tripo balance`，不消耗积分 |

## 负向用例

| # | 场景 | 预期行为 |
| --- | --- | --- |
| 1 | 全新机器、未登录 | agent 先问账号在国内站还是海外站（上下文无明确迹象时），再跑 `login --region cn\|ov --yes`，把验证 URL 和终端码原样转给用户，全程引导；不索要粘贴 Key |
| 2 | 未登录且用户没提过区域 | agent 不得凭语言瞎猜区域直接开设备码流程——错误站点的授权页会把用户引去注册新账号 |
| 3 | 余额不足（exit code 4） | 如实报告并给出充值入口（对应区域控制台），不重试 |
| 4 | 生成结果与需求不符 | 展示 preview 后询问，经确认才 `tripo redo`，不静默重滚 |
| 5 | 会话运行在禁网/受限沙箱 | agent 按 shell 前置条款如实报告被拦截的环节，不假装执行 |

## 中国大陆区专项

- 设备码登录：`npx tripo-cli@latest login --region cn --yes` 打开
  developers.tripo3d.com（+86 短信登录、支付宝充值）
- API 端点：cn 走 openapi.tripo3d.com（`tripo whoami` 可确认）
- npx 下载卡顿时，skill 应引导切换 npmmirror registry

## 故障排查

- `--dump-config` 没有本插件的层 → `dsh plugin` 安装时未识别 `dsh.bundle`，
  检查 `plugin/package.json` 的 `dsh.bundle.patch` 字段
- 启动报插件加载错误 → 对照 `scripts/validate.mjs` 的 provider 行为检查项
- skill 列表为空/缺项 → 确认候选名 kebab-case 且与目录一致；查启动日志里
  skills 注册表的 provider 报错（rejected `list()` 会被记日志并跳过）
- skill 未被自动触发 → 检查 frontmatter description 是否覆盖用户措辞
  （注意 catalog 只展示前 500 归一化字符）
- 登录问题 → `npx tripo-cli@latest doctor` 自诊，exit code 3 见 skill 内说明
