---
name: skill-registry-publish
description: 把一个 agent skill 发布到公开目录并尽可能被人发现。含赛道分析（同类、能力矩阵、空白点）、取名候选生成与占用检查、repo 布局改造、clawhub 提交、skills.sh 遥测触发、索引验证。用户要说「发布这个 skill」「上架」「起个名字」「这个赛道有谁」「让人能搜到」时用。
license: MIT
metadata:
  version: 0.4.0
  openclaw:
    requires:
      bins: ["node", "git"]
triggers:
- 发布 skill
- 上架 skill
- skill 怎么发布
- 让 skill 被搜到
- 给 skill 取名
- skill 名字重复
- 这个赛道有谁
- skill 竞品分析
- publish skill
- 发布到 clawhub
- 上 skills.sh
- skill 收录
---

# skill-registry-publish

发布 agent skill 到公开目录，并争取被发现。

## 四个环节

| 环节 | 做什么 | 工具 |
| --- | --- | --- |
| 定位 | 这个赛道有谁，它们覆盖什么，哪段空白 | `scripts/analyze.mjs` |
| 取名 | 候选生成 + 三渠道占用检查 | `scripts/name-check.mjs` |
| 发布 | 布局、frontmatter、clawhub、skills.sh 遥测 | 手工，见下方流程 |
| 验证 | 索引是否真的生效 | `scripts/check.mjs` |

前两个是决策，后两个是执行。跳过前两个直接发，多半会白做。

## 一、赛道分析

```bash
node scripts/analyze.mjs "agent skill registry" --top 6
```

输出三块：同类清单（按安装量）、能力矩阵（每项谁覆盖了）、空白点。

```
=== 同类（按安装量） ===
   11063  google/skills/agent-platform-skill-registry
     249  microsoftdocs/agent-skills/azure-container-registry
=== 能力矩阵 ===
  能力                    覆盖   谁有
  打包与版本管理           ✗ 0/5 空白
  名字占用检查             ✗ 0/5 空白
=== 空白点 ===
  ✓ 打包与版本管理
```

怎么读这个结果：

1. **空白点不等于机会**。可能是同行也没解决，也可能是伪需求。先确认有没有人抱怨过这个问题。
2. **覆盖数高的维度别硬碰**。五个同类都做的事情，再做一遍没有意义。
3. **候选需要人工筛**。脚本按 id 里的词匹配，`registry` 既指 skill 目录也指容器镜像仓库，会混进来同词不同义的项目。

判定靠 SKILL.md 正文的关键词正则，不是语义理解。正文取不到的会全部判为未覆盖。结论要回原文核对。

### 十一项能力维度

这套维度是拆「skill 从写完到被装上」的链路得到的，可以照着评任何一个 skill：

| 维度 | 判定线索 |
| --- | --- |
| SKILL.md 写法 | description 当触发器、渐进披露 |
| frontmatter 校验 | 检查 name/description 合法性 |
| 多 skill 仓库布局 | skills/ 目录结构、monorepo |
| 打包与版本管理 | 语义化版本、changelog |
| 推送到 GitHub | git push、创建仓库 |
| 分发到本机 agent | `~/.agents/skills`、symlink |
| 发布到第三方目录 | clawhub、registry publish |
| 收录与索引验证 | 遥测、api/search、收录 |
| 名字占用检查 | 撞名检测、改名建议 |
| 发布前脱敏 | PII、密钥、个人路径 |
| SEO metadata | topics、可发现性 |

## 二、取名

```bash
node scripts/name-check.mjs <候选1> <候选2> --owner <账号>          # 查占用
node scripts/name-check.mjs --suggest "export chat conversations"   # 出候选并排序
```

```
✓ 干净  chat-publish     skills.sh    2 条  GitHub    9 个
! 拥挤  chat-archive     skills.sh    6 条  GitHub  359 个
✗ 撞名  export-chat      skills.sh   16 条  GitHub  115 个
建议：chat-publish 或 backup-chat
```

三档判定：干净、拥挤（模糊命中密集，检索时沉底）、撞名（skill 生态里有同名，必须换）。

只有 skills.sh 和 clawhub 的同名算硬撞车。GitHub 上不同领域的同名仓库很多，不构成冲突，只计入密度。

## 三、发布

### 3.1 布局

必须是 `skills/<name>/SKILL.md`。根目录直接放 SKILL.md 会让部分扫描逻辑提前返回。

本机继续用同一份源码：`~/.agents/skills/<name>` 指向仓库里的 `skills/<name>`。Windows 用 junction，不要复制两份。

**完成条件**：`npx skills add <owner>/<repo> --list` 能列出这个 skill。

### 3.2 frontmatter

```yaml
---
name: <name>                      # kebab-case，与目录名一致
description: 做什么 + 什么时候用，高频词放最前
license: MIT                      # clawhub 校验，缺失会报 acceptLicenseTerms
metadata:
  openclaw:
    requires:
      bins: ["node"]
triggers:
- 中文触发词
- english keywords
---
```

**完成条件**：`node scripts/check.mjs <owner>/<repo>` 的仓库、布局、frontmatter 三项全绿。

### 3.3 clawhub

```bash
npx clawhub login                       # 设备码，必须人工在浏览器输入
npx clawhub skill publish ./skills/<name> \
  --slug <name> --version 0.1.0 \
  --tags "a,b,c" --changelog "..."
```

发布后进安全扫描队列 24 到 72 小时。版本号必须语义化递进。设备码登录没法自动化。

**完成条件**：返回 `Update submitted for <name>@<version>`。

### 3.4 skills.sh 遥测

**最容易白做的一步。** CLI 的判断只看变量是否存在：

```js
function isEnabled() {
  return !process.env.DISABLE_TELEMETRY && !process.env.DO_NOT_TRACK;
}
```

`DISABLE_TELEMETRY=0` 也算存在，等于关闭。

```bash
env | grep -iE "disable_telemetry|do_not_track"    # 先确认
DISABLE_TELEMETRY= DO_NOT_TRACK= npx skills add <owner>/<repo> --skill <name> -y
```

**完成条件**：安装输出有摘要，目标目录出现 `SKILL.md`。

## 四、验证

```bash
node scripts/check.mjs <owner>/<repo> <name>
```

只认 skills.sh 的 `api/search` 返回 count。CLI 能装、页面 200、README 有链接，都不是收录证据。

## 发布前 checklist

- [ ] `--list` 能列出这个 skill
- [ ] `name-check.mjs` 判定不是撞名或太泛
- [ ] frontmatter 有 `name`、`description`、`license`
- [ ] 脱敏：脚本里没有个人路径、密钥、账号、内部 URL
- [ ] README 首屏有安装命令，徽章不指向可能不存在的页面
- [ ] 仓库 `topics` 填了，这是 GitHub 侧的 SEO

## 三个反直觉的事实

1. **clawhub 搜索只匹配 displayName**。描述和 tags 不参与检索。实测 `chat` 命中、`backup` 无结果。
2. **skills.sh 没有提交入口**。没有表单、没有 publish 命令，只有安装遥测一条路。
3. **HTTP 200 不等于有内容**。skills.sh 是 SPA，未收录的路径也回 200。必须看 API 的 count。

## 渠道优先级

| 顺序 | 渠道 | 进入方式 | 成本 |
| --- | --- | --- | --- |
| 1 | clawhub.ai | CLI 发布 + 审核 | 30 分钟 + 等 1 到 3 天 |
| 2 | skills.sh | 安装遥测 | 5 分钟 + 等 |
| 3 | GitHub 直发 | push | 一次性，喂饱 6 个自动抓取目录 |
| 4 | 小站表单 | 人工填表 | 每个 10 分钟 |

smithery 已于 2026-10-31 关停。

## 和同类的关系

| 同类 | 它解决什么 |
| --- | --- |
| `mercatorproj/skill-publisher` | 校验、打包、推到自己仓库 |
| `zihad550/skills` @ship-skill | 铺到本机各 agent |
| `glebis/claude-skills` @publish-skill | 发到自建站点 |
| `openclaw/openclaw` @clawhub | clawhub CLI 用法 |
| `stealth-factory/skills` @skill-publishing | SKILL.md 写法与 skills CLI 参数 |

一句话分辨：别人管「文件怎么放过去」，这里管「放过去之后为什么搜不到」。

这个赛道不大，同类安装量在 18 到 399 之间。别抱不切实际的期待。

## 参考

- `references/positioning.md`：赛道分析的方法、实测案例、局限
- `references/channels.md`：16 个渠道的流量、进入方式、失效状态
- `references/pitfalls.md`：11 条踩坑，带现象与根因
- `scripts/analyze.mjs`：赛道分析
- `scripts/name-check.mjs`：取名与占用检查
- `scripts/check.mjs`：发布状态自检
