# 市场定位与差异

2026-11 的实测数据。同类安装量取自 skills.sh 的 installs 字段。

## 这个赛道有多大

先把预期摆正。搜 publish、registry、skill-publisher 相关词能命中上百个 skill，但真正做「发布 skill」的只有六七个，安装量都在几十到几百之间：

| skill | 安装量 |
| --- | --- |
| camacho/ai-skills @publish-skill | 399 |
| joeseesun/qiaomu-skill-publisher | 263 |
| aperivue/medsci-skills @publish-skill | 110 |
| glebis/claude-skills @publish-skill | 87 |
| mercatorproj/skill-publisher | 76 |
| stealth-factory/skills @skill-publishing | 41 |
| zihad550/skills @ship-skill | 18 |

对比参照：`google/agents-cli` 的某个子技能有 562.9K，`chat-share-reader` 在 clawhub 三天 89 次下载。

结论：需求真实但小众，天花板不高。写这个 skill 的价值在于把知识固化下来，不在于占领市场。

## 能力矩阵

按「一个 skill 从写完到被人装上」的链路拆成八段，看谁覆盖了哪一段。

| 能力 | skill-publishing | qiaomu | mercatorproj | publish-skill(medsci) | ship-skill | 本 skill |
| --- | --- | --- | --- | --- | --- | --- |
| SKILL.md 写法与 description 作为触发器 | 是 | 部分 | 部分 | - | - | 部分（引用规范） |
| frontmatter 校验 | 是 | 是 | 是 | 是 | - | 是 |
| 多 skill 仓库布局 | 是 | - | 是 | - | 是 | 是 |
| 打包与版本管理 | - | 是 | 是 | 是 | 是 | 部分 |
| 推送到自己的 GitHub 仓库 | 是 | 是 | 是 | 是 | 是 | 是 |
| 分发到本机各 agent | - | 是 | - | - | 是 | 部分 |
| **发布到第三方目录（clawhub 等）** | - | - | - | - | - | **是** |
| **收录机制与索引验证** | - | - | - | - | - | **是** |
| **名字占用检查** | - | - | - | - | - | **是** |
| 发布前脱敏（PII、密钥） | - | - | 部分 | 是 | - | 是 |

加粗的三行是别人没有的，也是这个 skill 存在的理由。

## 各家的强项，值得借鉴的

| 工具 | 它的强项 | 本 skill 的处理 |
| --- | --- | --- |
| skill-publishing | description 当触发器的写法、渐进披露、`skills` CLI 的 `--all` 陷阱与 lock 文件差异、SEO topics | 采纳 checklist 与 topics 部分 |
| qiaomu-skill-publisher | 区分 skill 名与仓库名、用真实安装验证、发布后同步本地实体目录 | 采纳：验证必须真装一次 |
| mercatorproj | 三档模式（审计/打包/发布）、远程变更前必须确认、preflight 与 postflight 分离 | 全盘采纳，写进「两种模式」与「安全边界」 |
| publish-skill（medsci） | 发布前脱敏：PII 审计、泛化个人细节、license 兼容、跨平台适配 | 采纳为 checklist 的独立一项 |
| ship-skill | 每步给可验收的完成条件 | 采纳，五个步骤各带完成条件 |

## 它不做什么

边界清楚才不会越界干活。

- 不教怎么写 skill。那是 `skill-creator` 一类的事，这里假设内容已经写好。
- 不做打包与版本发布的细节。`skill-publisher` 做得更细。
- 不做本地多 agent 分发。`ship-skill` 专做这个。
- 不做自建站点。`publish-skill`（glebis）是那个方向。
- 不承诺收录。没有任何渠道保证收录，这个 skill 只给判断方法和验证手段。

## 什么情况下用这个

用户的诉求落在「已经写好、但没人搜到」这一段时用：

- 「我发布到 clawhub 了，为什么搜不到」
- 「skills.sh 上怎么没有我的 skill」
- 「这个 skill 叫什么名好，会不会撞车」
- 「除了 clawhub 还能发哪」

如果诉求是「怎么写一个 skill」「怎么推到自己仓库」「怎么装到本机各 agent」，用别的工具。

## 竞争优势与风险

优势：

- 收录机制这部分是实测出来的，包括一个字符串真值导致的静默失败，别处查不到。
- 有可执行的验证脚本，不是只给建议。
- 渠道状态是核实过的，包括已经关停的 smithery。

风险：

- 平台机制会变。skills.sh 的遥测实现、clawhub 的搜索规则都可能改版，这份文档需要定期复核。
- 赛道天花板低，安装量难做。这是客观事实，写的时候就没指望靠它出圈。
- 收录本身不可控。能做的只有把可空的部分做到位，剩下等。
