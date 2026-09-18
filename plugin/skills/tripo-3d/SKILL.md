---
name: tripo-3d
description: Generate a 3D model from a text prompt, a reference image, or a mesh, and write it into the project as GLB, FBX, OBJ, STL, USDZ or 3MF. Use when the user asks for a 3D asset, prop, character or texture for a game, renderer, AR scene or 3D print — e.g. "make me a low-poly X", "turn this image into 3D", "rig this character", "convert to FBX". 中文触发词：生成3D模型、建模、3D素材、图生3D、文生3D、绑骨、角色动画、贴图、低模、减面、3D打印、手办、格式转换。Also use to re-run, convert or inspect a previous Tripo generation (v3.1, P1, P2 Preview).
---

# Tripo 3D

Generate engine-ready 3D assets with the `tripo` CLI. One command turns a prompt or
an image into local files: a model, a `preview.png` render, and a `task.json` record.

## Requires a shell

Every command below runs through the shell tool and needs network access plus
Node.js on the host. If this environment cannot execute shell commands, or a
sandbox blocks `npx` or the network, stop here: tell the user exactly what is
blocked instead of describing the commands as if they had run.

## Before the first generation

```bash
npx tripo-cli@latest doctor     # verifies key, network, region, balance
```

Auth resolves from `TRIPO_API_KEY` (a `tsk_...` key) or a previous `tripo login`.
If `doctor` reports no key, start the device login yourself — do not ask for
permission first, and never ask the user to paste a key into the chat.

Tripo has two regions with separate accounts and consoles:

| region                | console                        | sign-in / top-up               |
| --------------------- | ------------------------------ | ------------------------------ |
| `cn` — China mainland | https://developers.tripo3d.com | +86 SMS sign-in, Alipay top-up |
| `ov` — International  | https://developers.tripo3d.ai  | email sign-in, Stripe top-up   |

Pick the region yourself only when the context already says which site the
user's account is on — they mentioned it, `tripo whoami` shows a profile, or
`TRIPO_REGION` is set. Otherwise ask one question before starting the login:
"你的 Tripo 账号在国内站还是海外站？" An account lives in exactly one region,
and starting the device flow on the wrong console sends the user to a site
where their account does not exist. No account yet? China-mainland users
should pick `cn` (Alipay top-up), everyone else `ov` — signing up during the
login flow is fine and new accounts get free credits.

```bash
npx tripo-cli@latest login --region cn --yes    # or: --region ov
```

`--yes` forces the non-interactive device flow. The command prints a
verification URL and a one-time code right away, then blocks until the user
approves in a browser — up to 15 minutes. Do not kill it early, and do not
wait for it to exit before talking to the user: read the URL and code from
its output while it is still running (run it in the background or stream its
stderr). **Show the user the full verification URL and the code verbatim**,
plus the matching console address (`cn`: https://developers.tripo3d.com,
`ov`: https://developers.tripo3d.ai), and walk them through every step —
assume they have never seen this page:

1. Open the verification URL in a browser.
2. If the page asks to sign in, they are not logged in on the web either:
   sign in — or sign up at the console address above; new accounts get
   free credits — then return to the verification page.
3. Type the one-time code into the **"Verification code"** field.
4. An account that already has several API keys is asked to pick one — any
   of them works, the CLI will use the chosen key. With no keys, one is
   created automatically and there is nothing to choose.
5. Click the **Authorize** button. The key arrives in the CLI and is stored —
   nothing to copy by hand.

When the command exits 0, re-run `doctor` and continue. Exit code 3 means the
code expired or was denied — run the same login command again for a fresh
code. If an older CLI rejects headless login with a usage error, fall back to
asking the user to run `npx tripo-cli@latest login` in their own terminal.

Installing globally (`npm install -g tripo-cli`) makes repeated calls faster and
is what makes the bare `tripo` command exist — ask before doing it. Without a
global install, run every `tripo ...` command in this and related skills as
`npx tripo-cli@latest ...`; npx downloads the CLI on first use, so a fresh machine
needs no manual install. If `npx` itself is missing, Node.js is not installed —
have the user install Node.js LTS first. On China-mainland networks, when the
npx download stalls, switch to the npmmirror registry and retry:
`npm config set registry https://registry.npmmirror.com`.

Exit code 3 means auth failed; run `tripo doctor`, which diagnoses key-vs-region
mismatches (`ov` = international, `cn` = China mainland) and prints the exact fix.

## The command

```bash
tripo make "a stylized treasure chest" --for game-mobile --json --yes
tripo make concept.png --for game-pc --json --yes
tripo make front.png back.png --json --yes           # 2-4 images -> multiview
tripo make hero.glb --then texture,rig --json --yes  # import an existing mesh
tripo make @last --then convert:fbx --json --yes     # continue from the last task
```

Input type is auto-detected: quoted text, an image path or URL, 2-4 images, a model
file (GLB/GLTF/FBX/OBJ/STL ≤150 MB — a `.gltf` references external files, so it only
works as a URL; pass a `.glb` for local files), or a task reference (`@last`, `@name`,
a task id).

A local image file is uploaded by the CLI itself — always reliable. An image
URL is passed straight to the API and **fetched by Tripo's servers**, so when
the user gives a URL, tell them explicitly: it must be publicly reachable and
served through a CDN or globally accelerated host, or the server-side fetch
can fail or time out (auth-protected, region-locked and slow-origin links all
break). When in doubt, download the image locally first and pass the file
path instead.

- `--for <scenario>` picks model, parameters, chain and export format:
  `game-mobile` `game-pc` `film` `print` `ar-web` `anim` `toy`.
  The base generation already outputs GLB; some preset chains append a **paid**
  convert step (`game-mobile`/`game-pc` → FBX, `print` → STL, `ar-web` → USDZ).
  When the user only wants GLB, that convert buys a format nobody asked for —
  use a chain-free preset instead (`toy` for low-poly, with `-p face_limit=...`)
  or tell the user the extra format costs credits before running.
- `--then <steps>` overrides the chain. Steps: `texture` `stylize` `convert` `import`
  `rig-check` `rig` `retarget` `segment` `complete` `decimate` `smartsegment`.
  There is no `refine` step — the API endpoint behind it has been retired.
  Arguments use `step:key=value`; a bare value maps to the step's primary argument
  (`convert:fbx`, `stylize:lego`, `decimate:5000`).
- `-o, --out <dir>` sets the **parent** directory, not the artifact directory. `make`
  always creates `<dir>/tripo-out/<name>-<id8>/` underneath it, so `-o ./assets` writes
  `./assets/tripo-out/<name>-<id8>/model.glb`. Pass `-o` to keep artifacts inside the
  project instead of the shell's working directory, but when the user asked for a file
  at a specific path, **move it there after the run and report the final path** — `-o`
  alone cannot put it there. (`tripo task get <id> --download -o <dir>` is the
  exception: its `-o` is the final directory.)
- `-p key=value` passes an API parameter, repeatable. Useful ones: `face_limit=15000`,
  `texture=false pbr=false` (bare geometry, skips texture credits), `auto_size=true`,
  `texture_quality=detailed`, `negative_prompt=...`. The full list, with the
  constraints the server enforces, is in "Capability reference" below.
- `--model <m>` forces the generation model, `--seed <n>` fixes `model_seed`,
  `-n <2-4>` generates that many candidates with different seeds (`-n` together with
  `--then` needs an interactive terminal to pick the winner — chain afterwards with
  `tripo make @<task> --then ...` instead).
- `--name <name>` records the task under that name, so later commands can say
  `@name` instead of a task id. `--timeout <seconds>` (default 1800) is the watch
  timeout. `--no-wait` submits and exits with `{"task_id"}` — only for a run the user
  explicitly wants to leave in the background; resume it with `tripo task watch <id>
  --download`. `--dry-run` plans and validates without submitting (see next section).

## Plan first, run after the user confirms

Credits are frozen the moment a task is submitted, so before running any command
that generates or processes (`make`, `generate`, `redo`, `batch run`, `model|anim|mesh
<step>` other than `rig-check`), show the user a plan and wait for a yes:

- **input** — the prompt, image(s), file or task reference (`@last` → which task);
- **model** — the CLI alias *and* the wire value it sends (`tripo-p1` → `P1-20260311`);
- **steps** — one numbered line per API call, in run order: endpoint, what it does,
  arguments. `--for` presets expand to a chain (`game-mobile` = generation → convert
  FBX 2K; `anim` = generation → rig-check → rig → retarget), so list every step the
  preset adds, not just the flag;
- **deliverables** — the files that will land on disk and where (`-o`, then any move);
- **estimated cost** — per step from the price table under "Spending the user's
  credits", plus the total, and that failed steps are refunded.

Get the facts for the plan from the CLI itself: run the exact `tripo make` command
with `--dry-run --json` appended. It plans and validates with **zero network calls,
no credits and no API key**, and prints the plan on stdout:

```bash
tripo make concept.png --for game-mobile --then rig,convert:fbx --dry-run --json
# {"dry_run":true,"valid":true,"model":"P1-20260311","model_reason":"scenario game-mobile",
#  "steps":[{"name":"image-to-model","endpoint":"/v3/generation/image-to-model","task_type":"image_to_model",
#            "payload":{"input":"<upload:concept.png>","model":"P1-20260311","texture":true,"pbr":true,"face_limit":15000}},
#           {"name":"rig","endpoint":"/v3/animations/rig","payload":{"input":"<upstream>","model":"v2.5-20260210"}},
#           {"name":"convert","endpoint":"/v3/models/convert","payload":{"input":"<upstream>","format":"FBX"}}],
#  "pending_uploads":["concept.png"],"deliverables":["FBX","GLB"],
#  "warnings":["--then overrides the default game-mobile processing chain"],"errors":[],"cost_notes":[]}
```

`steps[].payload` is the exact body each call will POST (scenario defaults merged,
aliases turned into wire values, illegal parameters already stripped). `errors` are
blocking — the dry run exits 2 on them, exactly like the real run would before
spending; fix them and dry-run again. `warnings` are auto-adjustments (`P1 does not
support quad (removed)`) — show them to the user, they change the outcome. Only when
`valid` is true turn the steps into the plan below. On a CLI too old for `--dry-run`
(0.4.0 rejects the flag with a usage error, exit 2) build the same plan by hand from
the tables in this skill.

Example of the shape (a `--for game-mobile` text prompt):

```
1. text-to-model  POST /v3/generation/text-to-model — generate the mesh
   model=P1-20260311 face_limit=15000 texture=true pbr=true          ~40 credits
2. convert        POST /v3/models/convert — export FBX, texture_size=2048   ~10 credits
→ ./Assets/Art/Props/tripo-out/<name>-<id8>/model.fbx (+ model.glb, preview.png)   ≈ 50 credits
```

Wait for explicit confirmation — silence is not a yes. Then run exactly the command
you showed, with `--yes` and without `--dry-run`; if the user changes anything, redo
the plan. A batch of several assets needs one confirmation for the whole list, not
one per asset. Free commands (`doctor`, `balance`, `usage`, `whoami`, `task get|list|
watch`, `history`, `rig-check`, `docs`, `files upload`, anything with `--dry-run`)
need no confirmation.

Newer CLI builds print the same plan card on stderr right before submitting (a TTY
user is asked "Run this plan?"; with `--yes` or when headless it is printed and the
run continues; `--quiet` hides it). Use it to check that what ran matches what you
showed, and say so if it differs. Older builds print no card — the plan you show the
user does not depend on it.

## Rules that matter

1. **`tripo make` is blocking.** It submits, polls, downloads, then exits. Wait for
   the process to finish. Do not re-implement polling, do not set a timeout shorter
   than the CLI's own (default 1800s), and do not treat a `task_id` appearing in the
   logs as completion.
2. **stdout is the contract.** With `--json`, stdout carries exactly one final JSON
   line; progress goes to stderr. Parse the last stdout line, not the logs.
3. **Branch on exit codes**, don't parse error text:
   `0` ok · `1` fatal, and what `doctor` returns when a critical check fails ·
   `2` bad parameters · `3` auth · `4` insufficient credits — tell the user to run
   `tripo topup` in their own terminal (it opens the billing page and waits for the
   credits to land); do not run it yourself · `5` content
   policy · `6` task failed (credits auto-refunded, `tripo redo` often succeeds) ·
   `7` network · `8` not found — a task id only resolves under the key that created
   it, so when an older task 404s, fall back to passing the local model file ·
   `9` rate limit (retry with backoff).
4. **Judge the result before moving on.** The result JSON gives `model_file` and
   `preview`. Read `preview.png` to check the asset actually matches the request; if
   it does not, `tripo redo` re-rolls with a new seed.
5. **Never invent parameters.** Everything the API accepts is listed in "Capability
   reference" below; `tripo docs --topic commands/generate` and `tripo docs --topic
   commands/process` print the same tables with more detail, and
   `tripo docs --topic common-errors` the error table. Do not send the user to the
   website for a parameter name.
6. **Let the CLI choose the model version.** It selects `tripo-v3.1` (high fidelity)
   or `tripo-p1` (low-poly) automatically — see "Models" below for the rule. Only
   pass `--model` when the user explicitly asks for one or the rule picks wrong.

## Capability reference

Mirrors the official API docs so the agent never has to leave the shell. Everything
here is passed with `-p key=value` (generation) or `step:key=value` (`--then`).

### Models & Versions

Keywords: model versions · H series (`tripo-v3.x`) · P series (`tripo-p1`, `tripo-p2`
Preview) · CLI alias → API `model` value · GA / Preview / Legacy · quad.

| `--model` (CLI alias) | wire value sent as `model` | status | use for | limits |
| --- | --- | --- | --- | --- |
| `tripo-v3.1` (default) | `v3.1-20260211` | GA | H series, high fidelity: PC/console, film, print | full parameter set |
| `tripo-p1` | `P1-20260311` | GA | P series, clean low-poly: mobile, UGC, ~2 s mesh | `face_limit` 50–20000; no `quad`, `smart_low_poly`, `generate_parts`, `geometry_quality` (the CLI strips them with a warning); adds `export_uv` |
| `tripo-p2` | `P2-20260801` | **Preview** | P1 upgrade: low-poly **with quads** or a bigger budget | `face_limit` 48–50000 tri / 48–25000 quad; supports `quad`, still not `smart_low_poly`, `generate_parts`, `geometry_quality` (stripped with a warning). Never auto-selected — needs an explicit `--model` |
| `tripo-v3.0`, `tripo-v2.5` | `v3.0-20250812`, `v2.5-20250123` | Legacy | only when the user asks | |

**Alias vs wire value.** `tripo-*`, `p1`, `p2`, `v3.1`… are CLI-side aliases: the CLI
always puts the dated wire value in the request's `model` field (`--model tripo-p2` →
`"model": "P2-20260801"`), and `task.json` records the value actually used. The v3
server whitelist accepts wire values only — an alias sent straight to the API returns
`1004 invalid model` with the allowed list. When the user quotes a model from the
website, map it through this table; the Models & Versions page lists the marketing
names, the P Series endpoint pages list the wire values. `tripo-turbo` and
`tripo-v2.0` appear in older docs but the server rejects them.

Auto-selection: low-poly words in the prompt ("low poly", "voxel") or **any
`face_limit` ≤ 20000** pick P1; everything else is v3.1. So `-p face_limit=15000` on
its own switches to P1 — add `--model tripo-v3.1` when the user wants v3.1 quality
under a face cap.

**P series through the same endpoints.** P1/P2 are not separate endpoints; only the
`model` value changes. `tripo make` picks P1 by the rule above; for an exact call use
`tripo generate <endpoint> --model tripo-p1|tripo-p2` (see "2D steps before 3D"). The
official docs document them as a separate "P Series" tab on each generation page:

| endpoint | H series page | P series page |
| --- | --- | --- |
| `POST /v3/generation/text-to-model` | `…/docs/generation-text-to-model/standard` | <https://developers.tripo3d.ai/en/docs/generation-text-to-model/p> |
| `POST /v3/generation/image-to-model` | `…/docs/generation-image-to-model/standard` | <https://developers.tripo3d.ai/en/docs/generation-image-to-model/p> |
| `POST /v3/generation/multiview-to-model` | `…/docs/generation-multiview-to-model/standard` | <https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/p> |

Reference pages (status and links only — parameter names come from this skill):
Models & Versions <https://developers.tripo3d.ai/en/docs/models-and-versions> · P
Series model detail <https://developers.tripo3d.ai/en/models/p1>.

### Generation parameters

| param | default | notes |
| --- | --- | --- |
| `face_limit` | adaptive | upper bound on triangles. v3.1 any; P1 50–20000; P2 48–50000 |
| `texture`, `pbr` | `true`, `true` | `pbr=true` forces `texture=true`. `texture=false pbr=false` = bare geometry, no texture credits |
| `texture_quality` | `standard` | `standard` / `detailed` (HD, +10 credits) / `extreme` (8K, +20). The API also has `fast` (v3.5 textures only; same price and texture size as `standard`, less detail), but the CLI's local validation still rejects it with exit 2 — do not pass it until the CLI accepts it |
| `texture_version` | derived from `model` | pins the texture model independently of the geometry model: `v3.5-20260815` (newest), `v3.0-20250812` (default for v3.x and P-series geometry), `v2.5-20250123` (default for v2.5 geometry). All generation models incl. P1/P2; passes through the CLI unchanged |
| `delight` | `true` | v3.5 textures only (`texture_version=v3.5-20260815`): remove baked-in lighting from the reference image before texturing; `false` keeps the original shading. Older texture versions ignore it |
| `geometry_quality` | `standard` | `detailed` = Ultra geometry (+20). v3.x only |
| `quad` | `false` | quad mesh (+5); **forces FBX output** — quads cannot be stored in GLB. v3.x and P2 |
| `smart_low_poly` | `false` | hand-modelled-style low-poly topology (+10); with `face_limit`, the window is 500–20000 tri / 500–10000 quad. v3.x only |
| `generate_parts` | `false` | editable segmented parts (+20). **Always pass `texture=false pbr=false` with it** — the server defaults `texture` to true and rejects the request (`1004`) if either is on; the CLI only corrects an explicit `true`. Re-texture afterwards with `--then texture`. `quad` is ignored; `smart_low_poly` wins and suppresses parts. v3.x only |
| `auto_size` | `false` | scale the model to real-world metres |
| `compress` | – | `geometry` = meshopt-compressed output. v3.x only |
| `model_seed`, `texture_seed`, `image_seed` | random | reproducibility; `task.json` records the seeds used. `--seed` sets `model_seed` |
| `negative_prompt` | – | text input only, ≤255 chars (prompt ≤1024) |
| `enable_image_autofix` | `false` | image input: repair a low-quality photo first |
| `texture_alignment` | `original_image` | image/multiview: `original_image` matches the picture, `geometry` matches the mesh |
| `orientation` | `default` | image/multiview: `align_image` faces the model like the input viewpoint |
| `export_uv` | `true` | P series only: `false` skips UV unwrap (faster, smaller file) |
| `export_orientation` | `+x` | forward axis `+x` `-x` `+y` `-y`. **Generation only**: downstream steps (texture, rig, convert…) read the default orientation and return a wrongly oriented `success` with no error. When a chain follows, leave it unset and pass `export_orientation` to the final `convert` step instead |

Multiview (2–4 images): a front view is mandatory and at least two views are needed.
Filenames containing `front`, `back`, `left` or `right` assign the views; otherwise
the order is front, left, back, right.

### Processing steps (`--then`)

Every step accepts `@last`, a task id or a model file as input, except `retarget`
(needs a `rig` task), `complete` (needs a `segment` task) and `smartsegment` (file or
URL only, cannot follow a task). A bare value after `:` sets the primary argument.

| step | primary arg | arguments and constraints |
| --- | --- | --- |
| `texture` | `texture_quality` | `standard`/`detailed`/`extreme`, `pbr`, `texture_seed`; `model` `v3.0-20250812` (default) / `v3.5-20260815` (newest; also unlocks `delight`) / `v2.5-20250123`. Re-textures any model, including imported files |
| `stylize` | `style` | `lego` `voxel` `voronoi` `minecraft`; `block_size` 32–128 (minecraft only, default 80) |
| `convert` | `format` | `GLTF` `USDZ` `FBX` `OBJ` `STL` `3MF` (3MF = single-colour print). Mesh: `quad`, `force_symmetry` (quad only), `face_limit`, `flatten_bottom` + `flatten_bottom_threshold` (0.01). Texture: `texture_size` (4096), `texture_format` `JPEG`/`PNG`/`WEBP`/`BMP`/`TIFF`/`TARGA`/`HDR`/`DPX`/`OPEN_EXR`, `bake` (true), `pack_uv`, `export_vertex_colors` (OBJ/GLTF only). Export: `pivot_to_center_bottom`, `scale_factor`, `with_animation` (true), `animate_in_place`, `part_names`, `export_orientation`, `fbx_preset` `blender`/`3dsmax`/`mixamo`. `quad` with `GLTF` is rejected. Any non-default option bills the complex tier (10 credits instead of 5) |
| `import` | – | GLB/GLTF/FBX/OBJ/STL ≤150 MB; `make <file>` runs it implicitly. A `.gltf` references external files, so it only works as a URL — pass a `.glb` for local files |
| `rig-check` | – | free. GLB input. Returns `riggable` and `rig_type`: `biped` `quadruped` `hexapod` `octopod` `avian` `serpentine` `aquatic`. Gate step — the chain continues from the same model |
| `rig` | `rig_type` | one of the seven types above (default `biped`; take it from rig-check); `spec` `tripo`/`mixamo` (Mixamo = Unity Humanoid-compatible skeleton); `out_format` `glb`/`fbx`; `model` — CLI default `v2.5-20260210` (presets for every body type), legacy `v1.0-20240301` (biped only, 90+ presets); the marketing names `rig-v2.0` / `rig-v1.0` are accepted and normalised to those wire values |
| `retarget` | `animation` | needs a `rig` task. One clip per `--then retarget:preset:walk`; for several clips use `tripo anim retarget --animation preset:idle preset:walk` (≤5 per task, billed per clip). `out_format` `glb`/`fbx`, `animate_in_place` (no root motion), `bake_animation` (glb only), `export_with_geometry` |
| `segment` | `model` | `v1.0-20250506` (geometry-based, default) or `v2.0-20260430` (semantic, beta) with `segmentation_granularity` `simple`/`balanced`/`detailed`, `split_by_connectivity`, `ref_image` (overrides the other two) |
| `complete` | – | needs a `segment` task. `completion_mode` `ai_completion` (default) / `quick_cap` (hole fill, cheaper); `part_names` |
| `decimate` | `face_limit` | target 500–20000 tri / 500–10000 with `quad=true`; `bake=true` bakes textures onto the low-poly; `part_names`. `model=v1.0` accepts up to 2 000 000 faces but requires `face_limit` and has no `bake`/`part_names`. The budget is a target, not a ceiling |
| `smartsegment` | `granularity` | file/URL only, so in practice `tripo mesh smartsegment <file> --seg-type image\|model`. `seg_type=image` (photo → model → parts, 85 credits) or `seg_type=model` (GLB only, 55, default); `granularity` `coarse`/`medium`/`fine`; `hint` |

Retarget presets for the v2.5 rig (all body types): `preset:idle` `preset:walk`
`preset:run` `preset:dive` `preset:climb` `preset:jump` `preset:slash` `preset:shoot`
`preset:hurt` `preset:fall` `preset:turn`, plus body-specific `preset:quadruped:walk`
`preset:hexapod:walk` `preset:octopod:walk` `preset:serpentine:march`
`preset:aquatic:march`. The v1.0 rig uses `preset:biped:<name>` (`idle`, `walk`,
`run`, `dance_01`…, `greet_01`…, `box_01`…) and is biped only.

### 2D steps before 3D (`tripo generate`)

```bash
tripo generate text-to-image "full-body front view of a ninja" -p template=t_pose --json --yes
tripo generate image-to-image sketch.png --prompt "clean concept art, neutral background" --json --yes
tripo generate image-to-model @last --json --yes           # an image task id is a valid input
tripo generate image-to-multiview photo.png --json --yes   # 1 image -> front/left/back/right sheet
tripo generate edit-multiview @last -p 'prompts=[{"view":"front","prompt":"add a sword"}]' --json --yes  # 1-4 {view,prompt} edits on that sheet
tripo generate image-to-splat photo.png --json --yes       # gaussian splat, not a mesh
# P series, same 3D endpoints, explicit model (the CLI sends the wire value):
tripo generate text-to-model "a low poly knight" --model tripo-p1 -p face_limit=8000 --json --yes   # model=P1-20260311
tripo generate image-to-model photo.png --model tripo-p2 -p quad=true -p face_limit=12000 --json --yes  # model=P2-20260801 (Preview), FBX out
```

- Templates (`-p template=...`) are whitelisted per endpoint. text-to-image:
  `t_pose` (the pre-step for rigging), `character_completion`, `asset_extraction`,
  `variants`, `figure`. image-to-image: `t_pose`, `character_completion`,
  `3d_enhance` (clean a photo before image-to-model), `variants`, `figure`. The docs
  also list `head_extraction` and `print_clay`, but they are not on the server-side
  whitelist the CLI mirrors — expect a parameter error. Shortcuts: `-p t_pose=true`, `-p sketch_to_render=true`.
- Image models (`--model`, sent as-is — no alias mapping): `seedream_v4`
  (text-to-image default; not accepted by image-to-image), `seedream_v5`,
  `gemini-2.5-flash`, `gemini-3-pro`, `gemini-3.1-flash`, `chat_image_2`,
  `chat_image_2.5_flare` (faster), `chat_image_2.5_sunburst` (keeps untouched regions
  of an edited image closer to the original) — the two 2.5 models cost the same.
  `chat_image_1` retires 2026-10-23 and `chat_image_1.5` on 2026-12-01: pick
  `chat_image_2` or a 2.5 model instead.
  GPT-image options: `-p quality=low|medium|high` (`chat_image_2`; the 2.5 models add
  `xhigh`, `max`; omitted = `low`; `high` and above cost extra and take longer; any
  other model rejects the field), `-p background=auto|opaque|transparent` (2.5 only;
  `transparent` needs `-p output_format=png`; other models ignore the field).
  `image-to-image` takes several references via `-p 'inputs=["<url or file_token>", ...]'`
  (seedream ≤4, gemini ≤10, GPT image ≤16; get tokens with `tripo files upload`),
  referenced in the prompt as `[image 1]`.
- `image-to-splat` returns a `.splat` file (30 credits, ~4 min): no texture, rig or
  convert downstream — use image-to-model when a mesh is needed.

## Spending the user's credits

Every generation costs credits from the user's account, and `credits_consumed` is
reported on each result.

- Every paid run goes through "Plan first, run after the user confirms" above; a
  batch of several assets gets one confirmation for the whole list.
- Run `tripo balance` first when the user asks for several assets.
- **After the run, report the cost twice: the total and the itemised breakdown** —
  one line per task in run order: step type, task id, credits actually billed, then
  the total, and the remaining balance when a batch was involved. Newer CLI builds
  put this in the result JSON as `credits_breakdown` (chained runs; `credits_consumed`
  is then the total) and print `credits consumed (total)` plus one line per task in
  human mode. When the field is missing — a single task, or an older CLI whose
  `chain` entries carry only `task_id` and `type` — run `tripo task get <task_id>
  --json` for each chain entry and the top-level task: every task record has its own
  `credits_consumed`. Quote billed numbers, not the estimate from the plan.
  `balance`, `frozen` and `credits_consumed` are decimals (e.g. `48.00`) — parse as
  float, never as int.
- Concurrency is pooled per account and per category (exit code 9 when a pool is
  full): 10 parallel v3.x generations, 5 P-series, 10 animation, 5 texture/convert,
  10 mesh ops — and **only 1 image generation** (text-to-image, image-to-image,
  multiview). Never fan out image jobs; run them one after another.
- For 3D printing and other untextured output, add `-p texture=false -p pbr=false`
  — it skips texture credits entirely.
- Do not silently re-roll a disappointing result. Show the user the preview and ask.

Approximate list prices, so the cost can be quoted before a run (the authoritative
number is `credits_consumed` on the result; `balance` and `credits_consumed` are
decimals, not integers):

| operation | credits |
| --- | --- |
| text-to-model, v3.1 | 10 bare / 20 textured |
| image- or multiview-to-model, v3.1 | 20 bare / 30 textured |
| text-to-model, P1 | 30 bare / 40 textured (P2: 100 / 110) |
| image- or multiview-to-model, P1 | 40 bare / 50 textured (P2: 100 / 110) |
| add-ons per generation | `texture_quality=detailed` +10, `extreme` +20, `geometry_quality=detailed` +20, `quad` +5, `smart_low_poly` +10, `generate_parts` +20 |
| texture step | 10 standard / 20 detailed / 30 extreme |
| convert | 5, or 10 with any non-default option |
| decimate | 30 (v2.0) / 10 (v1.0) |
| segment / complete | 40 / 50 (`quick_cap` 30) |
| smartsegment | 85 image / 55 model |
| rig-check / rig / retarget | free / 25 / 10 per clip |
| text-to-image, image-to-image | 5–20 depending on model and size tier |
| image-to-multiview / edit-multiview / image-to-splat | 10 / 5 per edited view / 30 |

Failed and cancelled tasks are never charged: credits are frozen at submission and
released on failure.

## Result shape

```json
{
  "task_id": "...",
  "type": "convert_model",
  "status": "success",
  "credits_consumed": 145,
  "credits_breakdown": [
    { "task_id": "<generation>", "type": "text_to_model", "credits_consumed": 110 },
    { "task_id": "<texture>", "type": "texture_model", "credits_consumed": 30 },
    { "task_id": "<convert>", "type": "convert_model", "credits_consumed": 5 }
  ],
  "output_dir": "tripo-out/knight-1a2b3c4d",
  "files": ["model.fbx", "preview.png", "task.json"],
  "model_file": ".../model.fbx",
  "preview": ".../preview.png",
  "source_task_id": "<generation>",
  "chain": [
    { "task_id": "<texture>", "type": "texture_model", "credits_consumed": 30 },
    { "task_id": "<convert>", "type": "convert_model", "credits_consumed": 5 }
  ]
}
```

With `--then`, `credits_consumed` is the **total** for the run and `credits_breakdown`
lists every task, generation first. A single task has no `credits_breakdown`. CLI
0.4.0 and earlier omit `credits_breakdown`, `source_task_id` and the per-entry
`credits_consumed` in `chain` — see "Spending the user's credits" for the fallback.

`model_file` and `preview` describe the **final** chain step. After a convert
step the native GLB and `preview.png` live on the earlier generation task —
fetch them free with `tripo task get <chain task_id> --download` instead of
paying for another conversion.

## Presenting the finished asset

Every file is already on the user's disk when `tripo make` exits — never offer
a "download". Do not render the model file as a clickable link either: chat
UIs generally cannot preview binary meshes, so the link just looks broken when
clicked. Instead:

- show `preview.png` — images render fine;
- give the model's location as a plain path in backticks;
- offer the next real action: reveal it in the file manager (`open -R <path>`
  on macOS, `explorer /select,<path>` on Windows) or wire it into the project.

## Other commands

| command                          | purpose                              |
| -------------------------------- | ------------------------------------ |
| `tripo task get <id> --download` | fetch or re-download an earlier task (`@last`/`@name` work; `--step` adds pipeline step details; `-o` here is the final directory) |
| `tripo task watch <id> --download` | block on a task started with `--no-wait` or from elsewhere; with `--json` progress streams as NDJSON lines and the last line is the task detail; exit 6 = failed |
| `tripo task list [ids...]`       | batch query; no ids = recent local history refreshed from the server. `missed` lists ids the server could not find (wrong key or region) |
| `tripo history`                  | local task history with the `@name` references: `task_id`, `type`, `name`, `status`, `output_dir` |
| `tripo balance` / `tripo usage`  | credits remaining (`{"balance","frozen"}`; `frozen` = holds for running tasks) / recent per-task spend |
| `tripo whoami`                   | masked key, active profile, region, balance — the quick "which account is this" check |
| `tripo topup`                    | opens the billing page and polls until credits arrive — a human action, never run it for the user |
| `tripo redo [@last] [--seed N]`  | same request, new seed; only for tasks this CLI created (the history holds the payload) |
| `tripo files upload <path>`      | get a `file_token`: images PNG/JPEG/WebP/BMP/TIFF ≤20 MB, models GLB/FBX/OBJ/STL ≤150 MB; `.gltf` is not uploadable |
| `tripo batch run manifest.yaml`  | bulk jobs, resumable — manifest below |
| `tripo generate <endpoint> ...`  | one exact endpoint, no auto-chain: `text-to-model` `image-to-model` `multiview-to-model` `text-to-image` `image-to-image` `image-to-multiview` `edit-multiview` `image-to-splat` |
| `tripo model\|anim\|mesh <step>` | one processing step with explicit flags (`tripo model convert @last --format FBX --fbx-preset mixamo`); input = argument > piped stdin JSON > `@last`; shared flags `--json --yes -o --no-wait --no-download --timeout --name -p` |
| `tripo config context key=value` | per-directory defaults in `.tripo/context.json`, e.g. `default_scenario=game-mobile output_dir=./assets`; `tripo config list` shows the merged config |
| `--profile <name>` / `tripo use <name>` | several accounts: one-shot override on any command (`TRIPO_PROFILE` env works too) / switch the active profile. An unknown profile exits 3 with the fix in the message — do not retry blindly |
| `tripo docs --topic <topic>`     | full docs: `commands/make` `commands/generate` `commands/process` `commands/task` `commands/account` `commands/batch` `commands/view` `examples/<scenario>` `common-errors` |

`tripo view` opens a local browser viewer for humans — read `preview.png` instead.
`tripo ai` is the interactive wizard/LLM planner for humans in a terminal — use
`tripo make --for <scenario>`, which is deterministic and needs no LLM. `tripo mcp`
starts the CLI's own MCP server; it is not part of this plugin, do not configure it.

Batch manifest (`tripo batch run assets.yaml [--concurrency 2] [--retries 1] [--fresh]`):

```yaml
concurrency: 2
defaults: { for: game-mobile, then: "convert:fbx", out: ./assets }
jobs:
  - input: "a bronze sword"
  - input: "a wooden shield"
    name: shield                       # becomes @shield and the resume key
  - input: cat.png
    for: print
    then: "convert:stl,flatten_bottom=true"
  - inputs: [hero-front.png, hero-back.png]
    name: hero
    params: { texture_quality: detailed }
```

State is saved next to the manifest (`assets.yaml.state.json`) after every job, so
re-running the same command skips the jobs that already succeeded; `--fresh` starts
over. Failed jobs retry `--retries` times and the run exits 6 if any stays failed.
Final stdout JSON: `{"total","success","failed","state_file","jobs":{...}}` — each job
entry carries `status`, `attempts` and the final `task_id`; the itemised credit report
for a batch comes from `tripo task get <task_id> --json` (and `tripo usage`). Keep `concurrency` within the
pools listed under "Spending the user's credits" (image jobs: 1).

Download URLs returned by the API expire in about five minutes — never cache one.
Re-run `tripo task get <id> --download` instead. Task status can also be `banned`
(content policy — change the input) or `expired` (output files gone — regenerate);
the CLI treats both as terminal failures.
