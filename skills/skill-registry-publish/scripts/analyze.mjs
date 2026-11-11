#!/usr/bin/env node
// 赛道分析：给一个关键词，拉同类 skill 的 SKILL.md，按能力维度打分，找空白位置。
//
//   node analyze.mjs "<关键词>" [--top 6] [--json]
//
// 用途是回答三个问题：这个赛道有谁、它们各自覆盖了什么、哪一段没人做。
// 判定靠 SKILL.md 正文的关键词启发式，不是人工逐篇读。会有误判，结论要回到原文核对。

const argv = process.argv.slice(2);
let keyword = '';
let top = 6;
let json = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--top') top = Number(argv[++i]) || 6;
  else if (argv[i] === '--json') json = true;
  else if (!keyword) keyword = argv[i];
}

if (!keyword) {
  console.error('用法：node analyze.mjs "<关键词>" [--top 6] [--json]');
  process.exit(2);
}

const C = {
  ok: (s) => `\x1b[32m✓\x1b[0m ${s}`,
  warn: (s) => `\x1b[33m!\x1b[0m ${s}`,
  bad: (s) => `\x1b[31m✗\x1b[0m ${s}`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// 能力维度。正则尽量宽，因为各家措辞差别大，漏判比误判更麻烦
const CAPS = [
  { key: 'writing', label: 'SKILL.md 写法', re: /description.*(trigger|触发)|progressive disclosure|渐进披露|how to write|写法/i },
  { key: 'frontmatter', label: 'frontmatter 校验', re: /frontmatter|yaml.*(valid|check|校验)|schema.*check/i },
  { key: 'layout', label: '多 skill 仓库布局', re: /skills\/<|repo(?:sitory)? layout|多.?skill|monorepo|目录结构/i },
  { key: 'version', label: '打包与版本管理', re: /--version|semver|semantic version|changelog|版本号/i },
  { key: 'github', label: '推送到 GitHub', re: /git push|gh repo create|push.*(github|remote)|创建仓库/i },
  { key: 'local', label: '分发到本机 agent', re: /~\/\.agents\/skills|symlink|junction|install.*global|-g\b.*安装|实体目录/i },
  { key: 'registry', label: '发布到第三方目录', re: /clawhub|skills\.sh.*(publish|submit)|registry.*publish|上架/i },
  { key: 'index', label: '收录与索引验证', re: /telemetry|遥测|api\/search|收录|indexing|索引/i },
  { key: 'name', label: '名字占用检查', re: /name.?check|撞名|name collision|名字占用|rename/i },
  { key: 'redact', label: '发布前脱敏', re: /\bPII\b|redact|sanitize|脱敏|secrets? scan|凭据/i },
  { key: 'seo', label: 'SEO metadata', re: /\btopics\b|seo|discoverab|可发现/i },
];

function parseId(id) {
  const parts = String(id).split('/');
  if (parts.length < 3) return null;
  return { owner: parts[0], repo: parts[1], skill: parts.slice(2).join('/') };
}

async function fetchSkillMd({ owner, repo, skill }) {
  const paths = [
    `skills/${skill}/SKILL.md`,
    `${skill}/SKILL.md`,
    'SKILL.md',
    `skills/${repo}/SKILL.md`,
  ];
  for (const p of paths) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${p}`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (r.ok) return await r.text();
    } catch {
      /* 试下一个路径 */
    }
  }
  return '';
}

async function search(q) {
  const r = await fetch(`https://www.skills.sh/api/search?q=${encodeURIComponent(q)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('skills.sh 搜索失败 HTTP ' + r.status);
  return r.json();
}

// 单个模糊查询会被热门大词淹没：搜 "skill publish" 排前面的是 find-skills、azure-deploy 这类
// 与发布无关的高安装量 skill。所以拆成几个变体词分别搜，合并后按词相关性过滤。
const variants = [
  keyword,
  keyword.replace(/\s+/g, '-'),
  'skill-publish',
  'publish-skill',
  'skill-publisher',
  'skill-publishing',
];
const words = keyword.toLowerCase().split(/[\s-]+/).filter((w) => w.length > 3);

const seenIds = new Set();
const pool = [];
let reportedCount = 0;
for (const q of [...new Set(variants)]) {
  try {
    const d = await search(q);
    reportedCount = Math.max(reportedCount, d.count || 0);
    for (const s of d.skills || []) {
      if (seenIds.has(s.id) || !parseId(s.id)) continue;
      seenIds.add(s.id);
      pool.push(s);
    }
  } catch {
    /* 某个变体失败不影响整体 */
  }
}

// 相关性用交集：所有关键词都要出现在 id 里。
// 用并集会把 find-skills、azure-deploy 这类只含 "skill" 的高安装量项目拉进来，淹没真正的同类。
const strict = pool.filter((s) => {
  const id = s.id.toLowerCase();
  return words.every((w) => id.includes(w));
});
// 交集为空时退一步，只要求含最后一个词（通常是动作词）
const loose = pool.filter((s) => s.id.toLowerCase().includes(words[words.length - 1] || ''));
const data = { count: reportedCount, skills: strict.length ? strict : loose.length ? loose : pool };
if (!strict.length && data.skills.length) {
  console.log(C.dim('提示：没有 id 同时含全部关键词的同类，已退化为只匹配动作词。结果偏杂，请人工筛。'));
}

// 按安装量取前 N，同 id 去重
const seen = new Set();
const picked = [];
for (const s of [...data.skills].sort((a, b) => (b.installs || 0) - (a.installs || 0))) {
  if (seen.has(s.id)) continue;
  seen.add(s.id);
  picked.push(s);
  if (picked.length >= top) break;
}

console.log(`\n${C.bold('关键词')} ${keyword}   候选 ${data.count || data.skills.length} 条，取前 ${picked.length} 个分析\n`);

const rows = [];
for (const s of picked) {
  const id = parseId(s.id);
  const md = await fetchSkillMd(id);
  const hits = {};
  for (const c of CAPS) hits[c.key] = c.re.test(md);
  rows.push({ id: s.id, installs: s.installs || 0, chars: md.length, hits });
}

// 同类清单
console.log(C.bold('=== 同类（按安装量） ==='));
for (const r of rows) {
  console.log(`  ${String(r.installs).padStart(7)}  ${r.id}${r.chars ? '' : C.dim('  (正文取不到)')}`);
}

// 能力矩阵
console.log('\n' + C.bold('=== 能力矩阵 ==='));
const header = '  ' + '能力'.padEnd(22) + '覆盖   谁有';
console.log(C.dim(header));
const blanks = [];
for (const c of CAPS) {
  const have = rows.filter((r) => r.hits[c.key]);
  const mark = have.length === 0 ? C.bad('0/' + rows.length) : have.length === rows.length ? C.ok(have.length + '/' + rows.length) : C.warn(have.length + '/' + rows.length);
  const who = have.length ? have.map((r) => r.id.split('/')[0]).slice(0, 3).join(', ') : C.dim('空白');
  console.log(`  ${c.label.padEnd(22)} ${mark.padEnd(14)} ${who}`);
  if (!have.length) blanks.push(c.label);
}

// 结论
console.log('\n' + C.bold('=== 空白点 ==='));
if (blanks.length) {
  for (const b of blanks) console.log('  ' + C.ok(b));
  console.log(C.dim('  这几项没人覆盖，是切入位置。但先确认它们真的是需求，而不是同行也没解决的问题。'));
} else {
  console.log(C.dim('  没有空白，每个维度都有人做。差异化要往深度或场景走，不要靠补覆盖。'));
}

const withMd = rows.filter((r) => r.chars).length;
console.log(C.dim(`\n判定依据：${withMd}/${rows.length} 个 SKILL.md 正文可读，靠关键词正则匹配，不是语义理解。`));
console.log(C.dim('两点局限：候选只按 id 里的词筛，同词不同义的项目会混进来（比如 registry 既能指 skill 目录也能指容器镜像仓库）；'));
console.log(C.dim('正文取不到的会全部判为未覆盖。结论要回原文核对，别直接拿去当决策依据。\n'));

if (json) {
  console.log(JSON.stringify({ keyword, count: data.count, rows, blanks }, null, 2));
}
