import { afterEach, beforeEach, it, describe, expect } from '@jest/globals'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, '..', 'changelog')
const TMP = path.join(__dirname, '_tmp-changelog')
const POSTS = path.join(TMP, 'posts')

// the script resolves CHANGELOG.md and the posts dir against process.cwd()
const cut = (version = '1.2.3') =>
  execFileSync('node', [SCRIPT, version, 'posts'], { cwd: TMP, encoding: 'utf8' })

beforeEach(() => {
  fs.mkdirSync(POSTS, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
  // the release notes land outside the repo, where script/publish reads them
  fs.rmSync(path.join(os.tmpdir(), '_tmp-changelog-release-notes-v1.2.3.md'), { force: true })
})

describe('script/changelog', () => {
  it('cuts [Unreleased] into a post and a released entry', () => {
    fs.writeFileSync(path.join(TMP, 'CHANGELOG.md'), `# Changelog

## [Unreleased] — fence info strings carry through

A fence could say more: than its language.

### Added

- The rest of the info string becomes classes.

#### Detail

- Nested.

## [1.2.2] - 2026-07-01 — older release
`)

    cut()

    const post = fs.readFileSync(path.join(POSTS, 'v1.2.3.md'), 'utf8')
    expect(post).toContain('layout: post')
    expect(post).toContain('title: "v1.2.3 — fence info strings carry through"')
    // colon in the prose survives because the scalar is quoted
    expect(post).toContain('description: "A fence could say more: than its language."')
    // headings promote one level, the CHANGELOG version heading has no counterpart
    expect(post).toContain('\n## Added\n')
    expect(post).toContain('\n### Detail\n')
    expect(post).not.toContain('A fence could say more: than its language.\n\n##')

    const changelog = fs.readFileSync(path.join(TMP, 'CHANGELOG.md'), 'utf8')
    expect(changelog).toMatch(/## \[Unreleased\]\n\n## \[1\.2\.3\] - \d{4}-\d{2}-\d{2} — fence info strings carry through/)
    // only the section above the next release heading is consumed
    expect(changelog).toContain('## [1.2.2] - 2026-07-01 — older release')
    expect(changelog).toContain('- The rest of the info string becomes classes.')
  })

  it('fences template tags so the engine leaves changelog prose alone', () => {
    fs.writeFileSync(path.join(TMP, 'CHANGELOG.md'), `## [Unreleased] — templating

### Added

- The {% highlight %} tag and {{ page.title }} now agree.
`)

    cut()

    const post = fs.readFileSync(path.join(POSTS, 'v1.2.3.md'), 'utf8')
    expect(post).toContain('{% raw %}{% highlight %}{% endraw %}')
    expect(post).toContain('{% raw %}{{ page.title }}{% endraw %}')
  })

  it('falls back to the title when there is no intro paragraph', () => {
    fs.writeFileSync(path.join(TMP, 'CHANGELOG.md'), `## [Unreleased] — no intro

### Fixed

- A thing.
`)

    cut()

    expect(fs.readFileSync(path.join(POSTS, 'v1.2.3.md'), 'utf8')).toContain('description: "no intro"')
  })

  it('ignores headings inside code fences, including nested ones', () => {
    fs.writeFileSync(path.join(TMP, 'CHANGELOG.md'), `# Changelog

## Contributing an entry

\`\`\`markdown
## [Unreleased] — the documented example

### Added
- Not a real entry.
\`\`\`

## [Unreleased] — the real one

### Added

- A real entry.

\`\`\`\`markdown
\`\`\`html preview
## still a sample, not a heading
\`\`\`
\`\`\`\`
`)

    cut()

    const post = fs.readFileSync(path.join(POSTS, 'v1.2.3.md'), 'utf8')
    // cut at the real heading, not the one in the fence above it
    expect(post).toContain('title: "v1.2.3 — the real one"')
    expect(post).toContain('- A real entry.')
    expect(post).not.toContain('Not a real entry.')
    // promotion skips fenced samples, so the four-backtick block is untouched
    expect(post).toContain('## still a sample, not a heading')

    // the documented example survives in CHANGELOG.md
    expect(fs.readFileSync(path.join(TMP, 'CHANGELOG.md'), 'utf8')).toContain('## [Unreleased] — the documented example')
  })

  it('never overwrites a post written by hand', () => {
    fs.writeFileSync(path.join(TMP, 'CHANGELOG.md'), '## [Unreleased] — generated\n\n### Added\n\n- A thing.\n')
    fs.writeFileSync(path.join(POSTS, 'v1.2.3.md'), 'hand-written demo')

    expect(cut()).toContain('already exists')
    expect(fs.readFileSync(path.join(POSTS, 'v1.2.3.md'), 'utf8')).toBe('hand-written demo')
    // the version still rolls over, the post is the only thing left alone
    expect(fs.readFileSync(path.join(TMP, 'CHANGELOG.md'), 'utf8')).toContain('## [1.2.3] - ')
  })

  it('leaves the entry in the temp dir for gh release create --notes-file', () => {
    fs.writeFileSync(path.join(TMP, 'CHANGELOG.md'), `## [Unreleased] — release notes

An intro paragraph.

### Added

- The {{ page.title }} tag.
`)

    cut()

    const notes = fs.readFileSync(path.join(os.tmpdir(), '_tmp-changelog-release-notes-v1.2.3.md'), 'utf8')
    // the entry as written: no front matter, headings and template tags untouched
    expect(notes).toBe('An intro paragraph.\n\n### Added\n\n- The {{ page.title }} tag.\n')
  })

  it('writes nothing when [Unreleased] is empty', () => {
    fs.writeFileSync(path.join(TMP, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n')

    expect(cut()).toContain('[Unreleased] is empty')
    expect(fs.existsSync(path.join(POSTS, 'v1.2.3.md'))).toBe(false)
  })

  it('is a no-op in a repo without a CHANGELOG.md', () => {
    expect(cut()).toContain('No CHANGELOG.md')
    expect(fs.existsSync(path.join(POSTS, 'v1.2.3.md'))).toBe(false)
  })

  // a repo whose site has no changelog section still has to get a release cut
  it('cuts the entry when there is no posts directory', () => {
    fs.writeFileSync(path.join(TMP, 'CHANGELOG.md'), '## [Unreleased] — no site\n\n### Added\n\n- A thing.\n')

    const out = execFileSync('node', [SCRIPT, '1.2.3', 'nowhere'], { cwd: TMP, encoding: 'utf8' })

    expect(out).toContain('writing no post')
    expect(fs.readFileSync(path.join(TMP, 'CHANGELOG.md'), 'utf8')).toContain('## [1.2.3] - ')
    expect(fs.existsSync(path.join(os.tmpdir(), '_tmp-changelog-release-notes-v1.2.3.md'))).toBe(true)
  })
})
