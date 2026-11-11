# ship-skill

把一个 agent skill 发布到公开渠道，并争取被人发现。

这套流程是在一个真实 skill 上完整跑过一轮之后固化下来的。每一步对应一个实际踩过的坑，不是从文档里抄的。

```bash
npx skills add mapleleo-hub/ship-skill
```

## 它解决什么

写完一个 skill，能装、能跑，然后呢。

渠道有十几个，每个的收录机制都不一样：有的要 CLI 发布加人工审核，有的只认安装遥测，有的自动抓 GitHub，有的已经关停但榜单上还挂着。而"符合 SKILL.md 规范"和"被目录收录"是两件事，混起来会白白浪费几天。

这个 skill 把这些整理成一条可执行的路径，并给出唯一的可信验证方式。

## 内容

| 文件 | 作用 |
| --- | --- |
| `SKILL.md` | 5 步流程、三个反直觉事实、不要做的事 |
| `references/channels.md` | 16 个渠道的流量、进入方式、审核规则、失效状态 |
| `references/pitfalls.md` | 11 条踩坑，每条带现象与根因 |
| `scripts/check.mjs` | 一条命令查仓库布局、frontmatter、skills.sh 索引、clawhub 下载量 |

## 自检脚本

```bash
$ node scripts/check.mjs <owner>/<repo> [skill-name]

=== 仓库 ===
  owner/repo  公开  分支 main  ★0

=== 布局 ===
  ✓ skills/my-skill/SKILL.md

=== frontmatter ===
  ✓ name: my-skill（与目录名一致）
  ✓ description: ...
  ✓ license: MIT

=== skills.sh ===
  ✗ 未收录（搜索结果 0 条）

=== clawhub ===
  ✓ 已发布  89 次下载
```

## 三条最容易错的

1. **遥测开关只看变量是否存在**。`DISABLE_TELEMETRY=0` 和 `=1` 效果一样，都会让安装事件一个都发不出去。
2. **clawhub 搜索只匹配 displayName**。描述和标签不参与检索，优化描述不会提升曝光。
3. **CLI 能装不等于网站能搜到**。两套系统，只认 `api/search` 返回的 count。

## 相关的

- [chat-share-reader](https://github.com/mapleleo-hub/chat-share-reader)：这套流程的实际来源，一个导出 AI 对话的工具
- [deja-vu](https://github.com/vshulcz/deja-vu)：43 个 agent 的会话格式登记表，做同类工具时省大量逆向

## 许可

MIT
