# Release Notes (1.1.0)

## Breaking Changes

- **CommonJS to ESM migration** — The entire codebase has been converted from CommonJS to ES modules. This aligns with modern Node.js conventions and enables native ESM features throughout.

## Bug Fixes

- **Sass resolver: underscore partial resolution** — Fixed `tryToFindFile` where `path.format` ignored the `_` prefix because `base` takes precedence over `name`. Deep package imports like `pkg/core/utils/helpers` now correctly resolve to `_helpers.scss`.
- **Non-blocking compiler execution** — Each compiler (styles, scripts, markups, copy) now runs in its own try/catch. A failure in one no longer blocks the others from executing.
- **Script build error handling** — `compileEntry` now returns early after a failed esbuild build, preventing a secondary crash from `fileSize()` on a non-existent output file.
- **Sass resolver null guard** — `extractMainPathFromPackageJson` returning null no longer causes a TypeError in `path.join`.
- **Markup options guard** — `this.config.markup.options` is now safely defaulted to `{}`, preventing crashes when the config has no `options` property.
- **`buildTime` rounding** — Replaced `.toFixed(0)` (which rounds) with `Math.floor` (which truncates). `3500ms` now correctly displays as `3s 500ms` instead of `4s 500ms`.
- **`fileSize` MB tier** — Fixed the MB remainder to display in KB instead of raw bytes.
- **`pathForFile` dotfile matching** — Switched from regex to `path.extname()` so dotfiles like `.gitignore` are no longer misidentified as having extensions.
- **`minimatch` dependency** — Fixed minimatch dependency version conflict via overrides.
- **Deprecated API cleanup** — Replaced `rmDirSync` with `rmSync`, updated tsconfig `moduleResolution` from `node` to `bundler`.

## Features

- **JSX and TSX bundling** — `.jsx` and `.tsx` files are now first-class citizens in the `scripts` pipeline. esbuild handles JSX natively, so no extra configuration is needed. Supports both classic (`React.createElement`) and automatic JSX runtime via the `jsx` option.
- **React SSG (Static Site Generation)** — New `ssg` config section renders React components to HTML at build time using `renderToString`, then bundles a client entry for hydration. Pages load with pre-rendered content instead of an empty `<div>`. SSG runs after Styles but before Scripts and Markups in the pipeline. In watch mode, JSX/TSX changes trigger SSG re-rendering followed by a markup recompile. Poops itself does not need `react`/`react-dom` as a dependency — they are resolved from the project's `node_modules`.
- **Extended glob support** — `convertGlobToRegex` now supports `**` (globstar), `?()`, `*()`, `+()`, `@()`, and `!()` (negation) extglob patterns. Copy paths in the config can now use patterns like `!(vendor)/*.js`.
- **Sass resolver extracted** — The custom sass import resolver has been extracted from `styles.js` into its own module [sass-path-resolver](https://www.npmjs.com/package/sass-path-resolver), making it independently testable and reusable as a package.
- **Livereload and server info ordering** — Server and livereload info is now printed after the initial build, so it's always visible regardless of build warnings.
- **Livereload and watcher refactoring** — `setupLiveReloadServer` and `setupWatchers` extracted from the main function for better readability and maintainability.

## Testing

- **Jest test suite added** — Configured Jest with native ESM support (`--experimental-vm-modules`).
- **Sass resolver tests** — 26 tests covering `tryToFindFile`, `extractMainPathFromPackageJson`, `getPackagePath`, and `sassPathResolver` including directory resolution, package.json discovery, scoped packages, and underscore partials.
- **Helpers tests** — 87 tests covering all exported helper functions: path utilities, directory operations, output path builders, time/size formatting, banner templates, data file reading, front matter parsing, glob-to-regex conversion, and path matching.
- **Tests excluded from published package** via `!lib/**/__tests__/` in the `files` field.

## Housekeeping

- Migrated ESLint config from `.eslintrc.yml` to flat config (`eslint.config.js`) with neostandard.
- Renamed `removeDirNavWildcards` to `stripDirNavSegments` for accuracy.
- Removed duplicate guard in Markups constructor.
- Updated README with extglob examples in the copy configuration section.
