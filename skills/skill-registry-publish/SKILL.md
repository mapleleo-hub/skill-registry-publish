---
name: skill-registry-publish
description: 把一个 agent skill 发布到公开目录并尽可能被人发现。含取名候选生成与占用检查、repo 布局改造、frontmatter 要件、clawhub 提交、skills.sh 遥测触发、索引验证、曝光优化。用户要说「发布这个 skill」「上架」「起个名字」「让人能搜到」「publish to clawhub/skills.sh」时用。
license: MIT
metadata:
  version: 0.3.0
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
- publish skill
- 发布到 clawhub
- 上 skills.sh
- skill 收录
---

# skill-registry-publish

发布 agent skill 到公开目录，并争取被发现。

## 先划清边界

这个领域已有若干同类，各管一段。动手前先确认需求落在哪一段，别用错工具。

| 同类 | 它解决什么 | 本 skill 的不同 |
| --- | --- | --- |
| `mercatorproj/skill-publisher` | 校验、打包、推送到自己的 GitHub 仓库 | 只管仓库，不管第三方目录的收录机制 |
| `zihad550/skills` @ship-skill | 把 skill 铺到本机各 agent 的配置目录 | 本地分发，不涉及公开曝光 |
| `glebis/claude-skills` @publish-skill | 发到自建的 Astro 站点 | 单一出口，自建站 |
| `openclaw/openclaw` @clawhub | clawhub CLI 的用法 | 一个渠道，不含收录原理与验证 |

本 skill 覆盖的是**第三方目录**：clawhub、skills.sh、以及一批自动抓 GitHub 的聚合站。核心价值在收录机制那部分，其他同类没有。

这个赛道不大。同类安装量在 18 到 399 之间，最大的是 `camacho/ai-skills` 的 399。写它的意义是把知识固化，不指望它出圈。完整的市场份额、能力矩阵与风险见 `references/positioning.md`。

## 两种模式

按请求判断，开头一句话说明当前在哪一档。

- **检查**：只读。跑 `scripts/check.mjs` 和 `scripts/name-check.mjs`，不改文件、不动远程。
- **发布**：改远程之前必须先说明目标仓库、版本号、要推的文件，得到确认再执行。

不要把「检查一下」做成「顺手发了」。

## 流程

### 0. 取名（发布前必做）

两种用法。已经想好名字就直接查占用：

```bash
node scripts/name-check.mjs <候选1> <候选2> --owner <你的账号>
```

只有一个功能描述，让它出候选并排序：

```bash
node scripts/name-check.mjs --suggest "export chat conversations to markdown" --owner <你的账号>
```

输出示例：

```
✓ 干净  chat-publish     skills.sh    2 条  GitHub    9 个
! 拥挤  chat-archive     skills.sh    6 条  GitHub  359 个
✗ 撞名  export-chat      skills.sh   16 条  GitHub  115 个
建议：chat-publish 或 backup-chat
```

查三个地方：skills.sh 有无同名 skill、clawhub 有无同名条目、GitHub 有几个同名仓库。

判定三档：

| 判定 | 含义 | 动作 |
| --- | --- | --- |
| 干净 | 无精确同名，命中数少 | 直接用 |
| 略拥挤 | 无同名但模糊命中 10 到 50 条 | 可用，注意辨识度 |
| 撞名 / 太泛 | skill 生态里有同名，或命中密度过高 | 换名 |

只有 skills.sh 和 clawhub 里的同名才算硬撞车。GitHub 上不同领域的同名仓库很多，不构成冲突，只计入密度。

实测案例：`ship-skill` 在 skills.sh 有同名、GitHub 73 个同名仓库，属于硬撞车；`skill-registry-publish` 三项全干净。

名字里带高频词（publish、registry、export）能提升检索命中，但太泛会沉底。可检索性比可读性重要，因为 clawhub 的搜索只匹配 displayName。

### 1. 改布局

必须是 `skills/<name>/SKILL.md`。根目录直接放 SKILL.md 会让部分扫描逻辑提前返回。

```
repo/
├── README.md
├── LICENSE
└── skills/
    └── <name>/
        ├── SKILL.md
        ├── scripts/
        └── references/
```

本机继续用同一份源码：`~/.agents/skills/<name>` 指向仓库里的 `skills/<name>`。Windows 用 junction，不要复制两份。

**完成条件**：`npx skills add <owner>/<repo> --list` 能列出这个 skill。列不出来就是 frontmatter 或路径问题，不要往下走。

### 2. 补 frontmatter

```yaml
---
name: <name>                      # kebab-case，与目录名一致
description: 做什么 + 什么时候用，高频词放最前
license: MIT                      # clawhub 校验，缺失会报 acceptLicenseTerms
metadata:
  openclaw:
    requires:
      bins: ["node"]              # 硬依赖，诚实写
triggers:
- 中文触发词
- english keywords
---
```

**完成条件**：`node scripts/check.mjs <owner>/<repo>` 的仓库、布局、frontmatter 三项全绿。

### 3. 发布到 clawhub

```bash
npx clawhub login                       # 设备码，必须人工在浏览器输入
npx clawhub skill publish ./skills/<name> \
  --slug <name> --version 0.1.0 \
  --tags "a,b,c" --changelog "..."
```

- 发布后进安全扫描队列，24 到 72 小时，期间不公开
- 版本号必须语义化递进，重复版本会被拒
- 设备码登录没法自动化，直达带参数的 URL 会绕过绑定，OAuth 回来 code 就丢了

**完成条件**：返回 `Update submitted for <name>@<version>`。

### 4. 触发 skills.sh 遥测

**这一步最容易白做。** CLI 的判断是：

```js
function isEnabled() {
  return !process.env.DISABLE_TELEMETRY && !process.env.DO_NOT_TRACK;
}
```

只看变量是否存在，`DISABLE_TELEMETRY=0` 也算存在，等于关闭。

```bash
env | grep -iE "disable_telemetry|do_not_track"    # 先确认
DISABLE_TELEMETRY= DO_NOT_TRACK= npx skills add <owner>/<repo> --skill <name> -y
```

**完成条件**：安装输出有摘要，且目标目录里出现 `SKILL.md`。

### 5. 验证

```bash
node scripts/check.mjs <owner>/<repo> <name>
```

只认 skills.sh 的 `api/search` 返回 count。CLI 能装、页面 200、README 有链接，都不是收录证据。

**完成条件**：`api/search` 的结果里出现 `<owner>/<repo>/<name>`。没有就等待，索引是异步的。

## 三个反直觉的事实

1. **clawhub 搜索只匹配 displayName**。描述和 tags 不参与检索。实测 `chat` 命中、`backup` 无结果。描述优化只影响用户点进来之后的转化。
2. **skills.sh 没有提交入口**。没有表单、没有 publish 命令，只有安装遥测一条路。
3. **HTTP 200 不等于有内容**。skills.sh 是 SPA，未收录的路径也回 200。必须看 API 的 count。

## 发布前 checklist

六项过一遍再发，跳过的都会在后面变成返工。

- [ ] `npx skills add <owner>/<repo> --list` 能列出这个 skill
- [ ] `name-check.mjs` 判定不是撞名或太泛
- [ ] frontmatter 有 `name`、`description`、`license`
- [ ] 脱敏：脚本里没有个人路径、密钥、账号、内部 URL；示例数据已泛化
- [ ] README 首屏有安装命令，徽章不指向可能不存在的页面
- [ ] 仓库 `topics` 填了，这是 GitHub 侧的 SEO，与 description 同等重要

脱敏这条来自同类的实践（`aperivue/medsci-skills` 的 publish-skill 专做这件事）：把自己的 skill 开源前，先查有没有把个人环境带出去。本机路径、内部服务地址、真实人名、测试账号都属于要清掉的东西。

## 安全边界

1. 改远程前说明目标、版本、文件，得到确认。
2. 不用 `--force` 类操作，不覆盖已有 tag 或 release。
3. 提交前看 `git status`，不把无关文件带进发布。
4. 版本号不静默覆盖，已存在就升版本。
5. 报告时区分「实际跑过的检查」和「建议做的检查」。

## 渠道优先级

| 顺序 | 渠道 | 进入方式 | 成本 |
| --- | --- | --- | --- |
| 1 | clawhub.ai | CLI 发布 + 审核 | 30 分钟 + 等 1 到 3 天 |
| 2 | skills.sh | 安装遥测，无提交 | 5 分钟 + 等 |
| 3 | GitHub 直发 | push | 一次性，同时喂饱 6 个自动抓取目录 |
| 4 | 小站表单 | 人工填表 | 每个 10 分钟 |

smithery 已于 2026-10-31 关停，不要再试。细节见 `references/channels.md`。

## 不要做的事

- 不要定时重装刷安装量。官方禁止，事件带机器标识。
- 不要维护两份 skill 副本，用链接。
- 不要在 CI 里触发安装测收录，CI 事件会被单独标记。
- 不要在确认索引前把徽章指向目录页，会变死链。

## 参考

- `references/positioning.md`：市场定位、能力矩阵、同类强项、风险
- `references/channels.md`：16 个渠道的流量、进入方式、失效状态
- `references/pitfalls.md`：11 条踩坑，带现象与根因
- `scripts/name-check.mjs`：名字占用检查
- `scripts/check.mjs`：发布状态自检
