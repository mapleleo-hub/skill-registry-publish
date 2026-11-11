#!/usr/bin/env node
// 名字可用性检查：在 skills.sh、clawhub、GitHub 三个地方看候选名被占用到什么程度。
//
//   node name-check.mjs <name> [更多候选...]
//
// 判定分三档：干净 / 可用但拥挤 / 撞名。撞名或太泛就该换，否则发出去会被淹没。

const argv = process.argv.slice(2);
let selfOwner = '';
const names = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--owner') selfOwner = argv[++i] || '';
  else names.push(argv[i]);
}

if (!names.length) {
  console.error('用法：node name-check.mjs <name> [更多候选...] [--owner <自己的账号>]');
  process.exit(2);
}

const C = {
  ok: (s) => `\x1b[32m✓\x1b[0m ${s}`,
  warn: (s) => `\x1b[33m!\x1b[0m ${s}`,
  bad: (s) => `\x1b[31m✗\x1b[0m ${s}`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'skill-registry-publish' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// skills.sh：模糊搜索，count 大说明这个词在生态里被大量使用，检索时会沉底
async function checkSkillsSh(name) {
  try {
    const j = await getJson(`https://www.skills.sh/api/search?q=${encodeURIComponent(name)}`);
    const list = j.skills || [];
    const exact = list.filter((s) => s.skillId === name || s.name === name);
    return { count: j.count || 0, exact, sample: list.slice(0, 3).map((s) => s.id) };
  } catch (e) {
    return { error: e.message };
  }
}

// clawhub：只匹配 displayName，有精确同名就是硬撞车
async function checkClawhub(name) {
  try {
    const j = await getJson(`https://clawhub.ai/api/search?q=${encodeURIComponent(name)}`);
    const list = j.results || [];
    const mine = (r) => selfOwner && String(r.install && r.install.reference || '').startsWith(selfOwner + '/');
    const exact = list.filter((r) => r.displayName === name && !mine(r));
    const own = list.filter((r) => r.displayName === name && mine(r));
    return { count: list.length, exact, own };
  } catch (e) {
    return { error: e.message };
  }
}

// GitHub：同名仓库多说明这个名字在别的语境里已被占用，用户搜到会很困惑
async function checkGithub(name) {
  try {
    const j = await getJson(
      `https://api.github.com/search/repositories?q=${encodeURIComponent('"' + name + '"')}+in:name&per_page=5`
    );
    const exact = (j.items || []).filter((r) => r.name === name && !(selfOwner && r.owner.login === selfOwner));
    return { total: j.total_count || 0, exact: exact.map((r) => r.full_name) };
  } catch (e) {
    return { error: e.message };
  }
}

function verdict(ss, ch, gh) {
  if (ss.error || ch.error || gh.error) return { level: 'warn', text: '部分查询失败，重跑一次' };
  if (ch.exact.length) return { level: 'bad', text: `clawhub 已被占用：${ch.exact.map((x) => x.install && x.install.reference).join(', ')}` };
  if (ss.exact.length) return { level: 'bad', text: `skills.sh 有同名 skill：${ss.exact.map((x) => x.id).slice(0, 3).join(', ')}` };
  if (ss.count > 50) return { level: 'warn', text: `太泛（skills.sh ${ss.count} 条命中），检索时会沉底` };
  if (ss.count > 10) return { level: 'warn', text: `略拥挤（${ss.count} 条命中），至少有辨识度` };
  return { level: 'ok', text: '干净' };
}

const results = [];

for (const name of names) {
  console.log(`\n=== ${name} ===`);
  const [ss, ch, gh] = await Promise.all([checkSkillsSh(name), checkClawhub(name), checkGithub(name)]);

  if (ss.error) console.log(C.bad(`skills.sh 查询失败：${ss.error}`));
  else {
    const tag = ss.exact.length ? C.bad('有同名') : ss.count > 50 ? C.warn('太泛') : C.ok('无同名');
    console.log(`skills.sh  ${String(ss.count).padStart(4)} 条  ${tag}`);
    if (ss.sample.length) console.log(C.dim('            ' + ss.sample.join(', ')));
  }

  if (ch.error) console.log(C.bad(`clawhub 查询失败：${ch.error}`));
  else {
    const ownNote = ch.own && ch.own.length ? C.dim('（自己已发布，不算占用）') : '';
    console.log(`clawhub    ${ch.exact.length ? C.bad('已占用') : C.ok('未占用')} ${ownNote}`);
  }

  if (gh.error) console.log(C.bad(`GitHub 查询失败：${gh.error}`));
  else {
    console.log(`GitHub     ${String(gh.total).padStart(4)} 个同名仓库  ${gh.exact.length ? C.warn('存在同名') : C.ok('无同名')}`);
    if (gh.exact.length) console.log(C.dim('            ' + gh.exact.join(', ')));
  }

  const v = verdict(ss, ch, gh);
  const mark = v.level === 'ok' ? C.ok(v.text) : v.level === 'warn' ? C.warn(v.text) : C.bad(v.text);
  console.log(`判定：${mark}`);
  results.push({ name, level: v.level, score: v.level === 'ok' ? 0 : v.level === 'warn' ? 1 : 2 });
}

if (results.length > 1) {
  const best = results.filter((r) => r.score === Math.min(...results.map((x) => x.score)));
  console.log('\n建议：' + best.map((r) => r.name).join(' 或 '));
  console.log(C.dim('取向：优先无精确同名，其次命中数少的。名字里的高频词（publish、registry、export）能带来检索命中，但太泛会沉底。'));
}
console.log('');
