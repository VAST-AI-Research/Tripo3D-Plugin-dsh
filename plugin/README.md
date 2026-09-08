# tripo-dsh

[Tripo](https://www.tripo3d.ai) 3D generation skills for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

用一句话或一张图生成带贴图的 3D 模型，支持骨骼绑定、动画、减面和格式转换
（GLB/FBX/OBJ/STL/USDZ/3MF），文件直接落到你的本地项目里。国内站与海外站
账号均可使用。

Generate textured, rig-ready 3D models from a text prompt or a reference
image — files land directly in your local project. Exports GLB/FBX/OBJ/STL/
USDZ/3MF for games, film, AR and 3D printing. Works with both Tripo regions
(China mainland and international).

## Install

```bash
dsh plugin --profile web add tripo-dsh
dsh web
```

Or install straight from the GitHub repository (the package lives in `plugin/`):

```bash
dsh plugin --profile web add "github:VAST-AI-Research/Tripo3D-Plugin-dsh#path:/plugin"
```

## What it does

The bundle registers two skills on the global skill registry:

- **tripo-3d** — text/image/mesh → model: device login, `tripo make`,
  exit codes, credit rules, result handling.
- **tripo-game-asset** — game pipeline recipes: low-poly props on a face
  budget, LOD chains, rigged characters with locomotion clips.

The skills drive the [`tripo-cli`](https://www.npmjs.com/package/tripo-cli)
through the agent's shell tool (`npx tripo-cli@latest`, no preinstall needed).
The agent guides you through a one-time device login; API keys are stored by
the CLI, never pasted into chat.

Try prompts like:

- 生成一个低多边形的宝箱 3D 模型，导出 FBX 给 Unity 用
- Turn this concept image into a textured 3D model and export it as GLB
- 生成一个可 3D 打印的骑士小雕像，导出 STL 文件

## Uninstall

```bash
dsh plugin --profile web remove tripo-dsh
```

## Source & feedback

Source code and issue tracker:
[VAST-AI-Research/Tripo3D-Plugin-dsh](https://github.com/VAST-AI-Research/Tripo3D-Plugin-dsh)
(the package lives in the `plugin/` directory).

## License

MIT © VAST
