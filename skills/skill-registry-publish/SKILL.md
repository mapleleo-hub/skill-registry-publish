---
name: skill-registry-publish
description: "Take an agent skill from personal use to public release, then get it discovered. 把一个自用 skill 泛化成可公开发布的版本，再推到公开目录。Includes a generalization pass (hardcoded paths, internal addresses, credentials), a market scan that derives capability dimensions from peer SKILL.md headings, name collision checks across three registries, one-command publish, and index verification. 含泛化检查、赛道分析、取名占用检查、一键发布、收录验证。用户要说「发布这个 skill」「上架」「泛化」「起个名字」「这个赛道有谁」「让人能搜到」时用。"
license: MIT
metadata:
  version: 0.6.0
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

## 五个环节

| 环节 | 做什么 | 工具 |
| --- | --- | --- |
| 泛化 | 把自用版本改成别人装得上、看得懂的 | `scripts/generalize.mjs` |
| 定位 | 这个赛道有谁，它们覆盖什么，哪段空白 | `scripts/analyze.mjs` |
| 取名 | 候选生成 + 三渠道占用检查 | `scripts/name-check.mjs` |
| 发布 | 检查、提交、推送、clawhub、触发遥测 | `scripts/publish.mjs` |
| 验证 | 索引是否真的生效 | `scripts/check.mjs` |

泛化是第一步，因为它会改文件内容。跳过它直接发，别人装上去看到的是你的机器路径。

## 零、泛化

自用的 skill 和能公开发布的 skill 差在什么地方：自用版本里到处是自己环境的痕迹，别人装上去第一步就报错。

```bash
node scripts/generalize.mjs <仓库路径>
```

扫三类问题，分三级处理：

| 级别 | 内容 | 处理 |
| --- | --- | --- |
| block | 绝对路径、内网地址、凭据形态 | 必须清零 |
| warn | 个人用户名、私有项目名、会过期的数字 | 逐条确认 |
| info | 安装命令里的账号 | 保留，本来就该是你的 |

```
=== 必须改（别人跑不起来或看到错误指引） ===
✗ 绝对路径  src/config.mjs:12
  "/path/to/your/local/file.json"
  为什么：别人机器上没有这个路径，报错信息会指错方向
```

### 脚本扫不出来的

文本扫描只能抓字符串。下面这些要靠人读代码判断：

**写死的端口和路径假设。** 默认用 9333 端口但不处理被占用、默认 `~/.config/x` 却不检查是否存在。

**依赖某个工具已装。** 代码里直接 spawn 一个命令，没装就崩，且报错说不清缺什么。

**示例数据的可信度。** 示例里用了自己的真实文件名、真实会话标题，能跑但会让人觉得这个 skill 只对作者有用。

**语言假设。** 输出全是中文，非中文用户看不懂。要么接受这个限制并在描述里说明，要么做成双语。

**平台假设。** 只写了 Windows 的 junction，macOS 和 Linux 用户不知道用什么；反过来也一样。

通用化的做法是：把环境相关的东西全部外置成配置项或环境变量，代码里只留默认值和清楚的报错。



### 输出语言

`check.mjs`、`generalize.mjs`、`publish.mjs` 的输出跟随系统 locale，也可用 `REG_LANG=en` 或 `REG_LANG=zh` 强制。

`analyze.mjs` 和 `name-check.mjs` 目前只有中文输出。它们的输出是分析结果和候选列表，结构简单，非中文用户看数字和 ID 也能用，所以没做。

## 一、赛道分析

```bash
node scripts/analyze.mjs "pdf" --top 6           # 任意赛道都行
```

**不预设维度。** 不同赛道的能力完全不同，预设一套维度只能分析一个赛道。脚本的做法是拉同类 SKILL.md，抽出它们的二级三级章节标题，归一化后按首个动词聚合，统计哪些在多数同类里出现。

```
=== 能力分布（从章节标题提炼） ===
  ✓ 4/4 extract        (extract text / extract images / extract pages)
  2/4      troubleshooting
  ! 独有  encrypt       ← pdftk-server
  ! 独有  add           ← anthropics/skills/pdf
```

`4/4` 是这个赛道的标配能力，`独有` 是差异化空间。同一份脚本换成 `"agent skill registry"` 或 `"image generation"` 都能用，维度是从数据里长出来的，不是写死的。

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

### 怎么读结果

1. **覆盖数高的维度别硬碰**。所有同类都写的章节，说明那是标配，你写了也不构成差异。
2. **「独有」不等于机会**。可能只是那个 skill 的特有场景。要看正文确认，再决定要不要补。
3. **没有共性说明搜错了**。如果一个赛道里全是「独有」章节，大概率是把不相干的项目混进来了，换更精确的词重搜。

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

一条命令跑完检查和发布：

```bash
node scripts/publish.mjs --repo <仓库路径> --version 0.5.0 --dry-run   # 先看计划
node scripts/publish.mjs --repo <仓库路径> --version 0.5.0             # 执行
```

它依次做：定位 skill、校验 frontmatter 必填项、提交推送、clawhub 发布、触发 skills.sh 遥测、打印后续动作。

两处会停下来要人接手：

- **clawhub 未登录**。设备码必须在浏览器里输入，脚本没法代做。
- **git 有冲突**。脚本不处理合并，报错退出。

`--dry-run` 只打印计划，`--skip-clawhub` / `--skip-git` 跳过对应步骤。

下面是每一步的细节，出问题时对着看。

### 3.1 布局

必须是 `skills/<name>/SKILL.md`。根目录直接放 SKILL.md 会让部分扫描逻辑提前返回。

本机继续用同一份源码，不要复制两份：把 `~/.agents/skills/<name>` 链接到仓库里的 `skills/<name>`。

```bash
# macOS / Linux
ln -s /path/to/repo/skills/<name> ~/.agents/skills/<name>

# Windows，用目录联接，不需要管理员权限
# PowerShell: New-Item -ItemType Junction -Path <link> -Target <target>
# cmd:        mklink /J <link> <target>
```

两份副本一周内必然漂移，链接不会。

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
- `scripts/generalize.mjs`：泛化检查（个人路径、内网地址、凭据）
- `scripts/analyze.mjs`：赛道分析（自下而上提炼维度）
- `scripts/name-check.mjs`：取名与占用检查
- `scripts/publish.mjs`：一键发布
- `scripts/check.mjs`：发布状态自检
