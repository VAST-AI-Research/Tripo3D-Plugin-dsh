#!/usr/bin/env node
/**
 * 发布前校验：对照 DSH bundle 规范（deepseek-harness docs/user/develop/basic/publish.md）
 * 与本仓库的 skills-only 约束检查 plugin/ 目录。零依赖，node >= 18。
 *
 * 除静态检查外，还会真实 import plugin/index.js，用假 ctx 走一遍
 * registerProvider → list() → get()，验证 provider 行为与 DSH skills
 * 注册表的候选约束（kebab-case 名、bundled rank 600、frontmatter 剥离）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(ROOT, 'plugin');
/** DSH tool-skill 的 catalogDescriptionMaxLength 默认值：超长 description 会在模型目录里被截断 */
const CATALOG_DESCRIPTION_MAX = 500;
/** @deepseek-ai/dsh-skill 的 BUNDLED_SKILL_RANK：打包 skill provider 的标准 rank */
const BUNDLED_SKILL_RANK = 600;

let failures = 0;
let checks = 0;
const ok = (msg) => {
  checks += 1;
  console.log(`  ok  ${msg}`);
};
const fail = (msg) => {
  checks += 1;
  failures += 1;
  console.error(`FAIL  ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

// ---- bundle manifest（package.json）-----------------------------------------

console.log('bundle manifest');
const manifestPath = join(PLUGIN, 'package.json');
check(existsSync(manifestPath), 'plugin/package.json 存在');
let pkg = {};
try {
  pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
  ok('package.json 是合法 JSON');
} catch (err) {
  fail(`package.json 解析失败: ${err.message}`);
}

check(/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(pkg.name ?? ''), `name "${pkg.name}" 是合法 npm 包名`);
check(/^\d+\.\d+\.\d+$/.test(pkg.version ?? ''), `version "${pkg.version}" 是 x.y.z`);
check(typeof pkg.description === 'string' && pkg.description.length > 0, 'description 非空');
check(pkg.type === 'module', 'type 是 "module"（ESM 插件入口）');
check(pkg.main === 'index.js', 'main 指向 index.js');
check(existsSync(join(PLUGIN, 'index.js')), 'index.js 存在');
check((pkg.keywords ?? []).includes('dsh-plugin'), 'keywords 含 "dsh-plugin"（生态发现约定）');
check(pkg.license === 'MIT', 'license 是 MIT');

const patchRel = pkg.dsh?.bundle?.patch;
check(typeof patchRel === 'string' && patchRel.length > 0, 'dsh.bundle.patch 已声明（缺失则只作为普通依赖安装，不激活层）');
const patchPath = patchRel ? resolve(PLUGIN, patchRel) : null;
check(patchPath !== null && existsSync(patchPath), `patch 文件 ${patchRel} 存在`);

for (const entry of ['index.js', 'cordis.patch.yml', 'skills']) {
  check((pkg.files ?? []).includes(entry), `files 含 "${entry}"（npm 发包完整性）`);
}

// 零依赖 + 无 scripts：git/tarball/目录安装都不需要构建脚本许可（pnpm ≥10 会拦截）
for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'scripts']) {
  check(!(field in pkg) || Object.keys(pkg[field]).length === 0, `不含 "${field}"（零依赖、无安装期脚本约束）`);
}

// ---- cordis.patch.yml --------------------------------------------------------

console.log('cordis.patch.yml');
if (patchPath && existsSync(patchPath)) {
  const patchText = readFileSync(patchPath, 'utf8');
  check(/^\s*-\s*insert:/m.test(patchText), 'patch 含 insert 段');
  check(new RegExp(`name:\\s*['"]?${pkg.name}['"]?\\s*$`, 'm').test(patchText), `insert 行 name 引用包名 "${pkg.name}"（Node 解析安装后的代码）`);
  check(/id:\s*\S+/m.test(patchText), 'insert 行有 id（用户可按 id 覆盖或禁用）');
}

// ---- 插件模块行为 --------------------------------------------------------------

console.log('plugin module');
const mod = await import(pathToFileURL(join(PLUGIN, 'index.js')).href);
check(typeof mod.name === 'string' && mod.name.length > 0, `导出 name "${mod.name}"`);
check(Array.isArray(mod.inject) && mod.inject.includes('skills'), 'inject 声明 skills 服务');
check(typeof mod.apply === 'function', '导出 apply 函数');

const registered = [];
const fakeCtx = {
  skills: {
    registerProvider(create) {
      registered.push(create({ signal: new AbortController().signal, invalidate() {} }));
      return () => {};
    },
  },
};
mod.apply(fakeCtx);
check(registered.length === 1, 'apply 恰好注册一个 skill provider');
const provider = registered[0] ?? {};
check(typeof provider.name === 'string' && provider.name.length > 0, `provider 名 "${provider.name}"`);

const skillDirs = readdirSync(join(PLUGIN, 'skills')).filter((entry) =>
  statSync(join(PLUGIN, 'skills', entry)).isDirectory(),
);
let candidates = [];
try {
  candidates = await provider.list({});
  ok(`list() 返回 ${candidates.length} 个候选`);
} catch (err) {
  fail(`list() 抛错: ${err.message}`);
}
check(candidates.length === skillDirs.length, `候选数量与 skills/ 目录数一致（${skillDirs.length}）`);

for (const candidate of candidates) {
  const n = candidate.name;
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n ?? ''), `候选 "${n}" 是 kebab-case（DSH skill 名硬约束）`);
  check(skillDirs.includes(n), `候选 "${n}" 对应 skills/${n}/ 目录`);
  const normalized = (candidate.description ?? '').replaceAll(/\s+/g, ' ').trim();
  check(normalized.length > 0, `候选 "${n}" description 非空`);
  check(
    normalized.length <= CATALOG_DESCRIPTION_MAX,
    `候选 "${n}" description ${normalized.length} 字符 ≤ ${CATALOG_DESCRIPTION_MAX}（超出会在模型目录里被截断）`,
  );
  check(candidate.rank === BUNDLED_SKILL_RANK, `候选 "${n}" rank 为 ${BUNDLED_SKILL_RANK}（BUNDLED_SKILL_RANK）`);
  check(candidate.source === 'bundled', `候选 "${n}" source 为 bundled`);
  check(
    candidate.invocation?.modelInvocable === true && candidate.invocation?.userInvocable === true,
    `候选 "${n}" 模型与用户均可调用`,
  );
  check(
    candidate.resourceBase?.kind === 'directory' && existsSync(candidate.resourceBase.path),
    `候选 "${n}" resourceBase 指向存在的目录`,
  );

  let definition;
  try {
    definition = await provider.get(candidate, {});
  } catch (err) {
    fail(`get("${n}") 抛错: ${err.message}`);
    continue;
  }
  check(definition?.name === n, `get("${n}") 返回同名定义`);
  check(typeof definition?.content === 'string' && definition.content.trim().length > 0, `get("${n}") content 非空`);
  check(!definition?.content.startsWith('---'), `get("${n}") content 已剥离 frontmatter`);
}

// ---- skills 内容 ---------------------------------------------------------------

console.log('skills');
check(
  skillDirs.length === 2 && skillDirs.includes('tripo-3d') && skillDirs.includes('tripo-game-asset'),
  `skills/ 恰好包含 tripo-3d 与 tripo-game-asset（实际：${skillDirs.join(', ')}）`,
);

for (const dir of skillDirs) {
  const rel = `skills/${dir}/SKILL.md`;
  const file = join(PLUGIN, rel);
  check(existsSync(file), `${rel} 存在`);
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  check(!/([A-Z]:\\|\/Users\/|\/home\/)/.test(body), `${rel} 正文不含本机文件路径`);
  check(!/\bKimi\b|\bCodex\b/.test(body), `${rel} 正文无 Kimi/Codex 表面残留`);
  check(/cannot execute\s+shell/.test(body), `${rel} 保留 shell 前置条款`);
  const lines = text.split('\n').length;
  if (lines > 500) console.warn(`WARN  ${rel} 有 ${lines} 行，建议 SKILL.md 保持在 500 行以内`);
}

const tripoSkill = readFileSync(join(PLUGIN, 'skills/tripo-3d/SKILL.md'), 'utf8');
check(
  tripoSkill.includes('developers.tripo3d.com') && tripoSkill.includes('developers.tripo3d.ai'),
  'tripo-3d 覆盖双区域（cn developers.tripo3d.com + ov developers.tripo3d.ai）',
);
check(/npmmirror/.test(tripoSkill), 'tripo-3d 保留大陆网络 npmmirror 提示');

// ---- summary ----------------------------------------------------------------

console.log(failures === 0 ? `\n${checks}/${checks} 项检查全部通过` : `\n${checks - failures}/${checks} 项通过，${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
