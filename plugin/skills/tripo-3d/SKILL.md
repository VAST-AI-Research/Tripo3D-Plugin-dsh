---
name: tripo-3d
description: Generate a 3D model from a text prompt, a reference image, or an existing mesh, and write it into the project as GLB, FBX, OBJ, STL, USDZ or 3MF. Use when the user asks for a 3D asset, prop, character or texture for a game, renderer, AR scene or 3D print — e.g. "make me a low-poly X", "turn this image into 3D", "rig this character", "convert to FBX". 中文触发词：生成3D模型、建模、3D素材、图生3D、文生3D、绑骨、角色动画、贴图、低模、减面、3D打印、手办、格式转换。Also use to re-run, refine, convert or inspect a previous Tripo generation.
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
- `--then <steps>` overrides the chain. Steps: `refine` `texture` `stylize` `convert`
  `import` `rig-check` `rig` `retarget` `segment` `complete` `decimate` `smartsegment`.
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
  `texture_quality=detailed`, `negative_prompt=...`.
- `--model <m>` forces the generation model: `tripo-v3.1` (high fidelity, default),
  `tripo-p1` (low-poly, `face_limit` 50-20000, no `quad`) or `tripo-p2` (P-series
  preview: adds `quad`, `face_limit` 48-50000 tri / 48-25000 quad; the CLI never
  auto-selects it and it costs ~100+ credits per generation versus 30-50 for P1).
  Illegal P-series parameters (`smart_low_poly`, `generate_parts`,
  `geometry_quality`, and `quad` on P1) are stripped locally with a warning.

## Rules that matter

1. **`tripo make` is blocking.** It submits, polls, downloads, then exits. Wait for
   the process to finish. Do not re-implement polling, do not set a timeout shorter
   than the CLI's own (default 1800s), and do not treat a `task_id` appearing in the
   logs as completion.
2. **stdout is the contract.** With `--json`, stdout carries exactly one final JSON
   line; progress goes to stderr. Parse the last stdout line, not the logs.
3. **Branch on exit codes**, don't parse error text:
   `0` ok · `1` fatal, and what `doctor` returns when a critical check fails ·
   `2` bad parameters · `3` auth · `4` insufficient credits · `5` content
   policy · `6` task failed (credits auto-refunded, `tripo redo` often succeeds) ·
   `7` network · `8` not found — a task id only resolves under the key that created
   it, so when an older task 404s, fall back to passing the local model file ·
   `9` rate limit (retry with backoff).
4. **Judge the result before moving on.** The result JSON gives `model_file` and
   `preview`. Read `preview.png` to check the asset actually matches the request; if
   it does not, `tripo redo` re-rolls with a new seed.
5. **Never invent parameters.** The full parameter / model / preset reference from
   the official API docs ships inside the CLI: `tripo docs --topic commands/make`
   for the flag list, `tripo docs --topic commands/generate` (3D + image
   generation parameters), `tripo docs --topic commands/process` (texture /
   convert / rig / retarget / mesh steps), `tripo docs --topic common-errors` for
   the error table. Read those instead of sending the user to the website.
6. **Let the CLI choose the model version.** It selects `tripo-v3.1` (high fidelity)
   or `tripo-p1` (low-poly, face budget 50-20000) automatically — any
   `face_limit` ≤ 20000 or a "low poly" prompt flips to P1. Only pass `--model`
   when the user explicitly asks for one (`tripo-p2` for quad low-poly,
   `tripo-v3.0` / `tripo-v2.5` to reproduce old projects) or the rule picks wrong.

## Spending the user's credits

Every generation costs credits from the user's account, and `credits_consumed` is
reported on each result.

- Confirm the request before generating more than one asset in a batch.
- Run `tripo balance` first when the user asks for several assets, and report the
  cost back after finishing. `balance`, `frozen` and `credits_consumed` are decimals
  (e.g. `48.00`) — parse as float, never as int.
- Concurrency is pooled per account and per category (exit code 9 when a pool is
  full; other pools are unaffected): 10 parallel v3.x generations, 5 P-series
  (P1/P2), 10 animation, 5 texture/convert/refine, 10 mesh ops — and **only 1
  image generation** (text-to-image, image-to-image, multiview). Never fan out
  image jobs; run them one after another.
- For 3D printing and other untextured output, add `-p texture=false -p pbr=false`
  — it skips texture credits entirely.
- Do not silently re-roll a disappointing result. Show the user the preview and ask.

## Result shape

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
| `tripo task get <id> --download` | fetch or re-download an earlier task |
| `tripo balance` / `tripo usage`  | credits remaining / recent spend     |
| `tripo redo [@last]`             | same request, new seed               |
| `tripo files upload <path>`      | get a `file_token` for an image      |
| `tripo batch run manifest.yaml`  | bulk jobs, resumable                 |
| `tripo docs --topic <topic>`     | full docs: `commands/make` `commands/generate` `commands/process` `examples/<scenario>` `common-errors` |

Download URLs returned by the API expire in about five minutes — never cache one.
Re-run `tripo task get <id> --download` instead.
