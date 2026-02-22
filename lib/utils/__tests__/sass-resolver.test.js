import { beforeEach, afterEach, it, describe, expect } from '@jest/globals'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  tryToFindFile,
  extractMainPathFromPackageJson,
  getPackagePath,
  sassPathResolver
} from '../sass-resolver.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'sass-resolver')
const FAKE_MODULES = path.join(FIXTURE_ROOT, 'fake_modules')

let originalCwd

beforeEach(() => {
  originalCwd = process.cwd()
  process.chdir(FIXTURE_ROOT)
})

afterEach(() => {
  process.chdir(originalCwd)
})

describe('getPackagePath', () => {
  it('returns the first directory segment for unscoped packages', () => {
    expect(getPackagePath('my-pkg/src/index.scss')).toBe('my-pkg')
  })

  it('returns scoped package path for @scoped packages', () => {
    expect(getPackagePath('@scoped/my-pkg/src/index.scss')).toBe(path.join('@scoped', 'my-pkg'))
  })

  it('returns first segment for deeper paths', () => {
    expect(getPackagePath('my-pkg/core/utils/helpers')).toBe('my-pkg')
  })

  it('returns null for bare names with no directory', () => {
    expect(getPackagePath('my-pkg')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getPackagePath('')).toBeNull()
  })
})

describe('tryToFindFile', () => {
  it('finds a file with an explicit extension', () => {
    const result = tryToFindFile('src/direct-file.scss', ['sass', 'scss', 'css'])
    expect(result).toBe('src/direct-file.scss')
  })

  it('appends extension when not provided', () => {
    const result = tryToFindFile('src/direct-file', ['sass', 'scss', 'css'])
    expect(result).toBe('src/direct-file.scss')
  })

  it('finds underscore partials at root level', () => {
    const result = tryToFindFile('src/partial', ['sass', 'scss', 'css'])
    expect(result).toBe('src/_partial.scss')
  })

  it('returns null for nonexistent files', () => {
    const result = tryToFindFile('src/nonexistent', ['sass', 'scss', 'css'])
    expect(result).toBeNull()
  })

  it('does not double-underscore already-prefixed names', () => {
    const result = tryToFindFile('src/_partial', ['sass', 'scss', 'css'])
    expect(result).toBe('src/_partial.scss')
  })

  it('finds files in subdirectories', () => {
    const result = tryToFindFile('src/subdir/item', ['sass', 'scss', 'css'])
    expect(result).toBe('src/subdir/_item.scss')
  })

  it('finds underscore partials in nested paths without extension', () => {
    const result = tryToFindFile(
      path.join('fake_modules', 'my-pkg', 'src', 'core', 'config'),
      ['sass', 'scss', 'css']
    )
    expect(result).toBe(path.join('fake_modules', 'my-pkg', 'src', 'core', '_config.scss'))
  })
})

describe('extractMainPathFromPackageJson', () => {
  it('returns sass field when present', () => {
    const result = extractMainPathFromPackageJson('fake_modules/my-pkg')
    expect(result).toBe('src/index.scss')
  })

  it('returns style field when sass is absent', () => {
    const result = extractMainPathFromPackageJson('fake_modules/style-field-pkg')
    expect(result).toBe('dist/main.css')
  })

  it('returns null when no style fields exist', () => {
    const result = extractMainPathFromPackageJson('fake_modules/no-style-pkg')
    expect(result).toBeNull()
  })

  it('returns null for nonexistent package', () => {
    const result = extractMainPathFromPackageJson('fake_modules/nonexistent-pkg')
    expect(result).toBeNull()
  })
})

describe('sassPathResolver', () => {
  const resolvePath = FAKE_MODULES
  const infilePath = path.join(FIXTURE_ROOT, 'src', 'styles.scss')

  it('resolves a package directory to its index file', () => {
    const result = sassPathResolver('my-pkg/src/core', resolvePath, infilePath)
    expect(result).not.toBeNull()
    expect(result.pathname).toContain(path.join('my-pkg', 'src', 'core', 'index.scss'))
  })

  it('resolves a package root via package.json sass field', () => {
    const result = sassPathResolver('my-pkg', resolvePath, infilePath)
    expect(result).not.toBeNull()
    expect(result.pathname).toContain(path.join('my-pkg', 'src', 'index.scss'))
  })

  it('resolves a direct file with extension', () => {
    const result = sassPathResolver('my-pkg/src/index.scss', resolvePath, infilePath)
    expect(result).not.toBeNull()
    expect(result.pathname).toContain(path.join('my-pkg', 'src', 'index.scss'))
  })

  it('resolves a direct file without extension', () => {
    const result = sassPathResolver('my-pkg/src/index', resolvePath, infilePath)
    expect(result).not.toBeNull()
    expect(result.pathname).toContain(path.join('my-pkg', 'src', 'index.scss'))
  })

  it('resolves scoped packages', () => {
    const result = sassPathResolver('@scoped/my-pkg', resolvePath, infilePath)
    expect(result).not.toBeNull()
    expect(result.pathname).toContain(path.join('@scoped', 'my-pkg', 'src', 'index.scss'))
  })

  it('resolves a subdirectory with index file', () => {
    const result = sassPathResolver('my-pkg/src/core/utils', resolvePath, infilePath)
    expect(result).not.toBeNull()
    expect(result.pathname).toContain(path.join('my-pkg', 'src', 'core', 'utils', 'index.scss'))
  })

  it('returns null for nonexistent resolve path', () => {
    const result = sassPathResolver('my-pkg', '/nonexistent/path', infilePath)
    expect(result).toBeNull()
  })

  it('returns null for nonexistent package', () => {
    const result = sassPathResolver('nonexistent-pkg/index', resolvePath, infilePath)
    expect(result).toBeNull()
  })

  it('resolves my-pkg/core/config (underscore partial via package path)', () => {
    const result = sassPathResolver('my-pkg/core/config', resolvePath, infilePath)
    expect(result).not.toBeNull()
    expect(result.pathname).toContain(path.join('my-pkg', 'src', 'core', '_config.scss'))
  })

  it('resolves my-pkg/core/utils/helpers (underscore partial via package path)', () => {
    const result = sassPathResolver('my-pkg/core/utils/helpers', resolvePath, infilePath)
    expect(result).not.toBeNull()
    expect(result.pathname).toContain(path.join('my-pkg', 'src', 'core', 'utils', '_helpers.scss'))
  })
})
