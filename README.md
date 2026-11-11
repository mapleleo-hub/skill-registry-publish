# skill-registry-publish

Take an agent skill from personal use to public release, then get it found.

Most skills live and die on one machine. The gap between "it works for me" and "someone else can install it" has two parts: the personal traces left in the code, and the fact that publishing to a registry does not mean the registry indexes you.

```bash
npx skills add mapleleo-hub/skill-registry-publish
```

[中文说明](README.zh.md)

## Five stages

| Stage | What it does | Tool |
| --- | --- | --- |
| Generalize | Strip personal paths, internal addresses, credentials | `scripts/generalize.mjs` |
| Position | Who else is in this space, what is left uncovered | `scripts/analyze.mjs` |
| Name | Generate candidates, check collisions in three registries | `scripts/name-check.mjs` |
| Publish | Validate, commit, push, clawhub, trigger telemetry | `scripts/publish.mjs` |
| Verify | Did the index actually pick it up | `scripts/check.mjs` |

The first two are decisions. Skipping them means re-doing work later.

## Generalization

A skill built for one machine carries that machine's fingerprints. A hardcoded `D:\work\data` in an error message sends every new user down a dead end.

```bash
$ node scripts/generalize.mjs <repo>

=== Must fix (blocks others from running it) ===
✗ Absolute path  src/config.mjs:12
  "D:/work/data/x.json"
✗ Internal address  src/config.mjs:15
  192.168.1.20:8080
✗ Credential shape  src/config.mjs:18
  sk-abcdefghijklmnopqrstuvwxyz123456
```

Three levels: `block` (must be zero before release), `warn` (personal usernames, private project names, numbers that will expire), `info` (the account name in your install command, which belongs there).

Wired into `publish.mjs` as stage 0. Any `block` finding aborts the release.

What the scan cannot see, and only code review catches: hardcoded port assumptions, dependencies on a tool being pre-installed, example data that only makes sense to the author, language assumptions, platform assumptions.

## Market scan

```bash
$ node scripts/analyze.mjs "pdf" --top 5

=== Capabilities (derived from section headings) ===
  ✓ 4/4 extract        (extract text / extract images / extract pages)
  2/4      troubleshooting
  ! unique encrypt     ← pdftk-server
  ! unique add         ← anthropics/skills/pdf
```

No preset dimensions. The script pulls peer SKILL.md files, extracts their section headings, normalizes and groups them by leading verb, then counts how many peers cover each.

That means it works on any domain. Run it against `"pdf"`, `"image generation"`, or `"agent skill registry"` and the dimensions come from the data, not from a hardcoded list.

`4/4` is table stakes. `unique` is where differentiation lives, though it may also just be that peer's special case.

## Naming

```bash
node scripts/name-check.mjs <candidate...> --owner <account>
node scripts/name-check.mjs --suggest "export chat conversations"
```

```
✓ clean    chat-publish     skills.sh    2 hits  GitHub    9 repos
! crowded  chat-archive     skills.sh    6 hits  GitHub  359 repos
✗ taken    export-chat      skills.sh   16 hits  GitHub  115 repos
```

Only a collision inside skills.sh or clawhub counts as a hard conflict. Same-name repos on GitHub are common across unrelated domains and only feed the density score.

## Publishing

```bash
node scripts/publish.mjs --repo <path> --version 0.6.0 --dry-run
node scripts/publish.mjs --repo <path> --version 0.6.0
```

Runs: generalize check, frontmatter validation, commit and push, clawhub publish, telemetry trigger, next-step summary.

Two points hand control back to you: clawhub login (the device code must be typed in a browser) and git conflicts (the script does not merge).

## The part nobody else covers

`clawhub publish` succeeding and skills.sh indexing your skill are unrelated events.

- skills.sh has no submission form and no publish command. Indexing comes only from install telemetry.
- The telemetry switch is `!process.env.DISABLE_TELEMETRY`, which means `DISABLE_TELEMETRY=0` disables it just as effectively as `1`.
- clawhub search matches `displayName` only. Description and tags do not participate. Optimizing your description improves conversion, not discoverability.
- An indexed skill and an HTTP 200 are different things. skills.sh is a SPA; unindexed paths return 200 too. The only reliable check is the `api/search` count.

## Verification

```bash
$ node scripts/check.mjs <owner>/<repo> <name>

=== Layout ===
  ✓ skills/my-skill/SKILL.md
=== Frontmatter ===
  ✓ name  ✓ description  ✓ license
=== skills.sh ===
  ✗ not indexed (0 results)
=== clawhub ===
  ✓ published  89 downloads
```

## Relationship to similar tools

| Tool | What it solves |
| --- | --- |
| `mercatorproj/skill-publisher` | Validate, package, push to your own repo |
| `zihad550/skills` @ship-skill | Distribute to every agent on this machine |
| `glebis/claude-skills` @publish-skill | Publish to a self-hosted site |
| `openclaw/openclaw` @clawhub | clawhub CLI usage |
| `stealth-factory/skills` @skill-publishing | SKILL.md authoring and CLI flags |

The dividing line: the others cover how to move files somewhere. This one covers why nobody finds them afterwards.

This niche is small. Peer install counts range from 18 to 399.

## License

MIT
