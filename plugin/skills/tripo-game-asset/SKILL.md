---
name: tripo-game-asset
description: Recipes for producing game-ready 3D assets with Tripo and wiring them into a game project - low-poly props on a face budget, PBR hero assets, LOD chains, and rigged characters with locomotion clips for Unity, Unreal, Godot or Three.js. Use when the user is building a game or real-time 3D scene and needs props, characters, placeholder art, LODs, or an animated rig, rather than a single one-off model. 中文触发词：游戏资产、游戏素材、游戏模型、低模道具、面数预算、LOD、角色绑骨、走跑跳动画、Unity/Unreal/Godot 模型导入。
---

# Game asset pipeline

Recipes on top of the `tripo-3d` skill. Read that skill first for the shell
requirement, auth, the blocking behaviour of `tripo make`, exit codes, and credit
rules. Every recipe here is a shell command: if this environment cannot execute
shell commands, stop and tell the user what is blocked instead of pretending to
run them.

The point of these recipes is that assets land in the project's own directory
structure. Always pass `-o` pointing at wherever the project keeps its art — but note
`-o` is the parent: the files end up in `<dir>/tripo-out/<name>-<id8>/`, so move them
to their final location afterwards if the user named a specific path.

## Pick a budget first

| target                        | preset              | what it does                                          |
| ----------------------------- | ------------------- | ----------------------------------------------------- |
| mobile, WebGL, many instances | `--for game-mobile` | P1 low-poly model, face_limit 15000, 2K textures, FBX |
| PC / console hero asset       | `--for game-pc`     | v3.1, detailed PBR                                    |
| animated character            | `--for anim`        | rig-check, then rig, then retarget                    |

Override the face budget when the project has a stricter one:

```bash
tripo make "a health potion bottle" --for game-mobile \
  -p face_limit=3000 --then convert:format=FBX,texture_size=1024 \
  -o ./Assets/Art/Props --json --yes
```

## Props

```bash
tripo make "an ornate treasure chest, fantasy style" --for game-pc \
  -o ./assets/models --json --yes
```

For a set of props, generate them one at a time and check each `preview.png` before
continuing — a bad seed early is cheaper to catch than at the end of a batch. For
genuinely large sets use `tripo batch run manifest.yaml`, which is resumable.

## LOD chain from one source

```bash
tripo make "a stone golem" --for game-pc --then decimate:5000 --json --yes
tripo make @last --then decimate:1500,convert:fbx --json --yes
```

`decimate` bakes normals by default, so the low LODs keep the silhouette detail of
the source. Each `@last` continues from the previous task rather than regenerating.

**`decimate`'s face budget is a target, not a ceiling** — a 1500-face request can come
back at ~1900 triangles. Read the actual triangle count from the result before handing
an LOD to a project with a hard budget, and reduce it locally if it overshoots.
Generation's own `face_limit` does hold as an upper bound, so this caveat is specific
to `decimate`.

## Characters with animation

```bash
tripo make "a knight in full armor, T-pose, standing straight" --for anim --json --yes
```

`--for anim` runs `rig-check` first, which gates the chain: if the mesh is not
riggable it stops before spending rigging credits.

Explicit control over the rig and clips:

```bash
tripo make "a robot soldier, T-pose" --json --yes \
  | tripo anim check --json \
  | tripo anim rig --spec mixamo --out-format fbx --json \
  | tripo anim retarget --animation preset:idle preset:walk preset:run --json
```

- Prompt for a **T-pose** — rigging quality depends heavily on it.
- `--spec mixamo` produces a Unity Humanoid-compatible skeleton.
- `--animate-in-place` for locomotion clips driven by game code rather than root motion.
- Retarget is billed per animation and accepts at most five.
- To animate a mesh the project already has:
  `tripo make hero.glb --then rig-check,rig,retarget:preset:walk --json --yes`

## Format notes

- **Three.js / web**: GLB. `--for ar-web` adds the web-oriented defaults.
- **Unity / Unreal**: FBX via `--then convert:fbx`, or `--for game-mobile` which
  already converts.
- Quads (`-p quad=true`) force FBX — glTF cannot store them, so `convert:glb`
  combined with quads is rejected.
- `texture_size` is set on the convert step, not at generation:
  `--then convert:format=FBX,texture_size=2048`.

## Wiring into the project

After a successful run, `model_file` in the result JSON is the path to import. Do the
integration work the user actually asked for — add the loader call, register the
prefab, update the asset manifest — rather than stopping at "the file is generated".
Check `preview.png` first so a wrong asset does not get wired in.
