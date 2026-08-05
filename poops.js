#!/usr/bin/env node

import chokidar from 'chokidar'
import Copy from './lib/copy.js'
import runExec, { validateExec } from './lib/exec.js'
import { pathExists, doesFileBelongToPath, pathContainsPathSegment, deriveWatchDirs, toPosix, hasOutTemplate, outTemplateBase, KNOWN_CONFIG_KEYS, projectPackageNames } from './lib/utils/helpers.js'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import fs from 'node:fs'
import Markups from './lib/markups.js'
import Images from './lib/images.js'
import path from 'node:path'
import Reactor from './lib/reactor.js'
import { createStaticHandler, createReloadHub } from './lib/server.js'
import Scripts from './lib/scripts.js'
import log, { styledLog, hasLoggedErrors } from './lib/utils/log.js'
import Styles from './lib/styles.js'
import PostCSS from './lib/postcss.js'
import Argoyle from 'argoyle'

const cwd = process.cwd() // Current Working Directory
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

const cli = new Argoyle(pkg.version)
  .line(`Usage: ${pkg.name} [config-file] [options]\n`)
  .option('build', { short: 'b', description: 'Build the project and exit' })
  .option('config', { short: 'c', value: '<path>', description: 'Specify the config file' })
  .option('port', { short: 'p', value: '<number>', description: 'Specify the port for the server, overrides the config file' })
  .option('base-url', { short: 'u', value: '<path>', description: 'Set the base URL prefix for markup, overrides the config file' })
  .option('quiet', { short: 'q', description: 'Hide the header and the server/livereload info lines' })

let flags, positionals
try {
  ({ flags, positionals } = cli.parse())
} catch (err) {
  log({ tag: 'error', text: err.message })
  process.exit(1)
}

const build = flags.build
const defaultConfigPath = flags.config || positionals[0] || 'poops.json'
const overridePort = flags.port
const overrideBaseURL = flags['base-url']
const quiet = flags.quiet // hides the header and the address lines only — build logs, warnings and errors still print

let configPath = path.join(cwd, defaultConfigPath)
if (!pathExists(configPath)) configPath = path.join(cwd, '💩.json') // the canonical alternative config name

// Nothing fs-watches on behalf of the browser: watching the project meant every
// output file written during a build fired its own reload (dozens of browser
// flickers per build, some mid-write). Instead the rebuild chains in
// setupWatchers call reload() once their compile settles; the debounce folds
// the several module compiles one save triggers into a single refresh.
// 500ms: long enough to fold cascaded chains — a style/script compile writes
// into a watched copy source (Shopify theme assets/), whose chokidar event
// (awaitWriteFinish 150ms) triggers the copy-to-dist chain ~300-400ms after
// the first chain's reload. One save = one refresh, after dist is current.
//
// reload(file) collects paths over the debounce window. If everything in the
// window is .css, the paths ride a `css` event so the client hot-swaps
// stylesheets in place (no page reload, styles update without flicker);
// anything else escalates to one full `reload`.
const reloadHub = createReloadHub()
let reloadTimer = null
const reloadPaths = new Set()
function reload(file) {
  if (!config.livereload) return
  reloadPaths.add(file || '/')
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    const paths = [...reloadPaths]
    reloadPaths.clear()
    if (paths.every((p) => p.endsWith('.css'))) {
      reloadHub.send('css', paths)
    } else {
      reloadHub.send('reload', '/')
    }
  }, 500)
}

// The css files the last styles compile actually wrote — what the styles chain
// reports to reload() so style edits hot-swap. Read off the compiler rather
// than guessed from the config: a glob or a templated `out` names one output
// per match, and a guessed path the browser has no stylesheet for silently
// downgrades the hot-swap to a full page reload.
// toPosix: the livereload client matches these against URL paths, so Windows
// backslashes would silently break the CSS hot-swap.
function styleOutputs(styles) {
  return styles.outputs.map(toPosix)
}

// Per-stage shell hooks (config.exec). Runs after a stage compiles in both
// build and watch; see lib/exec.js. `hook(stage)` binds config + cwd here.
const hook = (stage) => runExec(config, cwd, stage)

function setupWatchers(config, modules) {
  if (!config.watch) return

  // awaitWriteFinish: wait for saves to finish writing before recompiling, so a
  // mid-write (truncated/partial) file is never read. Fixes intermittent broken
  // builds on editor save. Bump thresholds if slow disks flake.
  // Shared by 'change' and 'add': editors with atomic saves (rename-write)
  // fire unlink+add instead of change, so both events must trigger the same
  // rebuilds. 'add' also covers genuinely new files (e.g. a new markup page).
  // Rebuild branches shared by change/add/deletion: a deletion needs the same
  // rebuilds (a deleted-but-still-imported file must surface the error).
  // Scripts/styles outputs can land inside a watched dir (e.g. a Shopify
  // theme's assets/): the compiler's own write must not retrigger that
  // compiler, or watch loops forever. Zones are the dirs the compilers write
  // into; only their own extensions are skipped there, so e.g. a hand-edited
  // .liquid asset in the same dir still rebuilds markup.
  // markup/images outs are deliberately NOT zoned: markup sources legitimately
  // live beside markup output (Shopify theme dirs), so zoning them would stop
  // hand-edits from rebuilding. Constraint: keep markup.out/images.out outside
  // the watch list, or every compile retriggers itself.
  const outputZones = [config.scripts, config.styles].flat()
    .filter((entry) => entry && entry.out)
    // A templated `out` is only static up to its first token, so zone on that
    // prefix — `dist/{{dir}}/theme.css` writes into `dist`, not `dist/{{dir}}`
    .map((entry) => (hasOutTemplate(entry.out)
      ? outTemplateBase(entry.out)
      : (path.extname(entry.out) ? path.dirname(entry.out) : entry.out)))
    .filter((zone) => zone && zone !== '.')
  const isBuildOutput = (file) => outputZones.some((zone) => pathContainsPathSegment(file, zone))

  // One chokidar event fires per written file, so a single build that writes
  // several outputs into a watched dir (css + map + min.css) triggers the same
  // rebuild branch once per file. The trailing debounce folds such a burst
  // into one run; the window collects the paths so the handler can still
  // reason per-file (the copy branch's css hot-swap vs full reload). 300ms:
  // outlives the 150ms awaitWriteFinish settle between files of one burst.
  const coalesce = (fn, ms = 300) => {
    let timer
    const files = new Set()
    return (file) => {
      files.add(file)
      clearTimeout(timer)
      timer = setTimeout(() => {
        const batch = [...files]
        files.clear()
        fn(batch)
      }, ms)
    }
  }

  const recompileStyles = coalesce(() => {
    modules.styles.compile().then(() => modules.postcss.compile())
      .then(() => { hook('styles'); styleOutputs(modules.styles).forEach((out) => reload(out)) })
      .catch(err => console.error(err))
  })

  // A copied .css (e.g. the styles compiler's own output landing in a copy
  // source) stays a hot-swap; any other copied file escalates to a full
  // reload — reload() itself folds the batch into one refresh.
  const recopy = coalesce((batch) => {
    modules.copy.execute()
      .then(() => {
        hook('copy')
        batch.forEach((file) => reload(/\.css$/i.test(file) ? file : undefined))
      })
      .catch(err => console.error(err))
  })

  const rebuild = (file) => {
    // Engines that keep compiled templates across compiles (nunjucks) drop
    // exactly this file's entries; shared by change/add/unlink via rebuild.
    modules.markups.invalidate(file)
    if (/(\.m?jsx?|\.tsx?)$/i.test(file) && !isBuildOutput(file)) {
      modules.scripts.compile().then(() => { hook('scripts'); reload() }).catch(err => console.error(err))

      if (modules.reactor.belongsToReactor(file)) {
        modules.reactor.compile().then(() => {
          if (modules.reactor.renderedChanged) {
            config.reactorData = modules.reactor.getRendered()
            modules.markups.compile().then(() => modules.postcss.compile()).then(() => { hook('markup'); reload() }).catch(err => console.error(err))
          }
        }).catch(err => console.error(err))
      }
    }
    if (/(\.sass|\.scss|\.css)$/i.test(file) && !isBuildOutput(file)) {
      recompileStyles(file)
    }
    if (/(\.html|\.xml|\.rss|\.atom|\.njk|\.liquid|\.md)$/i.test(file)) {
      // Incremental: re-render only the pages whose last render touched this
      // file; falls back to a full compile for anything it can't prove safe
      // (deletions, new files, collection members, engines without dep info).
      modules.markups.compileIncremental(file).then(() => modules.postcss.compile()).then(() => { hook('markup'); reload() }).catch(err => console.error(err))
    }

    if (/(\.json|\.ya?ml)$/i.test(file)) {
      // Engine-owned markup with a data extension (Shopify templates/*.json)
      // goes incremental; real data files reload globals + full compile.
      modules.markups.compileDataChange(file).then(() => { hook('markup'); reload() }).catch(err => console.error(err))
    }
  }

  // Source image extensions handled by poops-images. The doesFileBelongToPath
  // guard (against config.images.in) also breaks the feedback loop: generated
  // variants land in the `out` dir, never in `in`, so they don't retrigger.
  const imageExtRe = /(\.jpe?g|\.png|\.tiff?|\.webp|\.heic|\.heif|\.svg|\.gif)$/i
  const belongsToImages = (file) => imageExtRe.test(file) && doesFileBelongToPath(file, config.images)

  const compileChanged = (file) => {
    rebuild(file)
    if (belongsToImages(file)) {
      modules.images.compile()
        .then(() => modules.markups.compile())
        .then(() => modules.postcss.compile())
        .then(() => { hook('images'); hook('markup'); reload() })
        .catch(err => console.error(err))
    }
    doesFileBelongToPath(file, config.copy) && recopy(file)
  }

  // Atomic-save editors (rename-write) fire unlink+add for every save, so an
  // unlink only counts as a real deletion if no add for the same path follows
  // within the settle window. Must outlive the 150ms awaitWriteFinish delay
  // on 'add'. Fixed 300ms; make configurable if slow disks flake.
  const UNLINK_SETTLE_MS = 300
  const pendingUnlinks = new Map()

  const scheduleUnlink = (target, handler) => {
    clearTimeout(pendingUnlinks.get(target))
    pendingUnlinks.set(target, setTimeout(() => {
      pendingUnlinks.delete(target)
      handler(target)
    }, UNLINK_SETTLE_MS))
  }

  const handleDeleted = (file) => {
    modules.markups.removeOutput(file)
    if (belongsToImages(file)) {
      // Deleted source: drop its variants + cache entry, then recompile markup
      // so galleries/srcsets reading the image cache no longer reference it.
      modules.images.remove(file)
        .then(() => modules.markups.compile())
        .then(() => modules.postcss.compile())
        .then(() => { hook('images'); hook('markup'); reload() })
        .catch(err => console.error(err))
    }
    rebuild(file)
    modules.copy.unlink(file, doesFileBelongToPath(file, config.copy))
  }

  const handleDeletedDir = (dirPath) => {
    modules.markups.invalidate(dirPath) // prefix match drops every template under it
    modules.markups.removeOutput(dirPath)
    if (doesFileBelongToPath(dirPath, config.markup)) {
      modules.markups.compile().then(() => modules.postcss.compile()).then(() => { hook('markup'); reload() }).catch(err => console.error(err))
    }
    modules.copy.unlink(dirPath, doesFileBelongToPath(dirPath, config.copy))
  }

  chokidar.watch(config.watch, {
    ignoreInitial: true,
    // Reactor's temp wrapper/bundle files are written next to the component
    // source (a watched dir) — without this they'd retrigger the script/
    // reactor rebuild that created them, looping the watcher.
    ignored: /\.reactor-(tmp|bundle)-/,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
  }).on('change', compileChanged)
    .on('add', (file) => {
      const pending = pendingUnlinks.get(file)
      if (pending) {
        clearTimeout(pending)
        pendingUnlinks.delete(file)
      }
      compileChanged(file)
    })
    .on('unlink', (file) => scheduleUnlink(file, handleDeleted))
    .on('unlinkDir', (dirPath) => scheduleUnlink(dirPath, handleDeletedDir))
}

// Main function 💩
async function poops() {
  validateExec(config)
  const styles = new Styles(config)
  const postcss = new PostCSS(config)
  const reactor = new Reactor(config)
  const scripts = new Scripts(config)
  const images = new Images(config)
  const markups = new Markups(config)
  const copy = new Copy(config)

  // Thrown errors are caught so one failing step doesn't stop the rest;
  // `failed` + hasLoggedErrors() (module-internal, swallowed errors) decide
  // the build exit code, so a broken compile can't ship as a green build.
  let failed = false
  const step = async(task) => {
    try { await task() } catch (err) { failed = true; console.error(err) }
  }

  await step(() => styles.compile())
  await step(() => reactor.compile())
  failed = hook('reactor') || failed
  config.reactorData = reactor.getRendered()
  await step(() => scripts.compile())
  failed = hook('scripts') || failed
  await step(() => images.compile()) // before markups: engines read the poops-images cache
  failed = hook('images') || failed
  await step(() => markups.compile())
  failed = hook('markup') || failed
  await step(() => postcss.compile())
  failed = hook('styles') || failed // after PostCSS so the CSS is final
  await step(() => copy.execute())
  failed = hook('copy') || failed
  failed = hook('build') || failed

  if (build || (!config.watch && !config.livereload && !config.serve)) {
    process.exit(failed || hasLoggedErrors() ? 1 : 0)
  }

  setupWatchers(config, { styles, postcss, reactor, scripts, images, markups, copy })
}

// CLI Header
if (!quiet) {
  const title = `💩 Poops — v${pkg.version}`
  styledLog(`\n{#8b4513}${title}\n${title.replace(/./g, '-')}{/}{bell}\n`)
}

// Check if poops.json exists
if (!pathExists(configPath)) {
  styledLog(`{bold.redBright|[error]} \`{underline|${defaultConfigPath}}\` or \`{underline|💩.json}\` not found.
{dim}Configuration file \`${defaultConfigPath}\` or \`💩.json\` not found in your working directory: {underline}${cwd}{/}{dim}\n
{/}{dim}Please specify another file path or create a \`poops.json\` or \`💩.json\` file in your working directory and try again.\n
{/}{dim}For information on the structure of the configuration file, please visit: \n{underline}https://stamat.github.io/poops{/}\n`)
  process.exit(1)
}

// Load poops.json
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

// A typo'd top-level key ("stlyes") is otherwise silently ignored — warn, same
// idea as validateExec for exec stages. The set lives in helpers.js so the
// published JSON Schema can be checked against it.
//
// Keys that meant something in 1.x. They fall through the check above, and
// "unknown config key" would be accurate and useless — name the replacement.
const REMOVED_CONFIG_KEYS = { ssg: 'renamed to "reactor" in 2.0' }

// poops.json is shared: a companion package can own a top-level block in it and
// read the same file (septic's `septic`). Checked after the removed-key names so
// a 1.x key still gets its rename notice even if something by that name is
// installed, and last of all so the common paths never touch the filesystem.
const companionKeys = projectPackageNames(cwd)

for (const key of Object.keys(config)) {
  if (KNOWN_CONFIG_KEYS.has(key)) continue
  if (REMOVED_CONFIG_KEYS[key]) {
    log({ tag: 'info', warn: true, text: `Config key "${key}" is ${REMOVED_CONFIG_KEYS[key]} — ignored.` })
    continue
  }
  if (companionKeys.has(key)) continue
  log({ tag: 'info', warn: true, text: `Unknown config key "${key}" — ignored. Valid: ${[...KNOWN_CONFIG_KEYS].join(', ')}` })
}

// The reload channel is an endpoint on the static server, so livereload has
// nothing to attach to without `serve` — say so rather than idling in a mode
// that can never reach a browser.
if (!build && config.livereload && !config.serve) {
  log({ tag: 'info', warn: true, text: 'Ignoring "livereload": it needs "serve" — the reload channel is served on the same port.' })
  config.livereload = false
}

if (config.watch === true) {
  config.watch = deriveWatchDirs(config)
} else if (config.watch) {
  config.watch = Array.isArray(config.watch) ? config.watch : [config.watch]
}

if (config.includePaths) {
  config.includePaths = Array.isArray(config.includePaths) ? config.includePaths : [config.includePaths]
} else {
  config.includePaths = ['node_modules']
}

if (overrideBaseURL && config.markup) {
  // options is the canonical home, and it also wins over a config that still
  // carries the deprecated markup-level key — the flag must override both
  config.markup.options = config.markup.options || {}
  config.markup.options.baseURL = overrideBaseURL
}

// poops-images resolves custom handlers/composites relative to the config file;
// without this it would default to cwd. Matches poops-images' own loadConfig.
if (config.images && typeof config.images === 'object' && config.images.configDir === undefined) {
  config.images.configDir = path.dirname(configPath)
}

// Bind probe on 0.0.0.0 — the same interface the servers listen on, so a
// "free" answer here can't be beaten to the port by a localhost-only check.
function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(port, '0.0.0.0')
  })
}

async function getAvailablePort(port, max) {
  for (; port <= max; port++) {
    if (await isPortFree(port)) return port
  }
  log({ tag: 'error', text: `No free port found in range ${max - 10}-${max}.` })
  process.exit(1)
}

function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const iface of Object.values(interfaces)) {
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) return info.address
    }
  }
  return 'localhost'
}

async function startServer() {
  await poops() // Initial compilation before starting the server

  // Almost every config sets serve.base to the markup `out` it just built, so
  // that is the default when it's unset. Falls back to cwd for a project with
  // no markup — and an explicit serve.base still wins, including one pointing
  // somewhere else entirely.
  const serveBase = config.serve.base || (config.markup && config.markup.out)
  const base = serveBase && pathExists(cwd, serveBase)
    ? path.join(cwd, serveBase)
    : cwd

  let port = overridePort || config.serve.port || 4040
  if (!overridePort) port = await getAvailablePort(port, port + 10)

  // The hub is only wired in when livereload is on; without it the server
  // neither answers the reload endpoint nor injects the client into pages.
  const handler = createStaticHandler(base, config.livereload ? reloadHub : null)

  // eslint-disable-next-line @stylistic/space-before-function-paren
  http.createServer(handler).listen(parseInt(port), '0.0.0.0', async () => {
    if (!quiet) {
      console.log()
      styledLog(`🏠 {dim}Local server:{/} {underline|http://localhost:${port}}`)
      styledLog(`🛜 {dim} Network     :{/} {underline|http://${getLocalIP()}:${port}}`)
      if (config.livereload) styledLog('🔃 {dim}Live reload :{/} on')
      console.log()
    }
  })
}

// A rejection here is a startup failure (port scan, initial compile) — exit
// loudly instead of dying as an unhandled rejection.
const die = (err) => {
  console.error(err)
  process.exit(1)
}

// Start the webserver
if (!build && config.serve) {
  startServer().catch(die)
} else {
  poops().catch(die)
}
