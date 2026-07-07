#!/usr/bin/env node

import chokidar from 'chokidar'
import connect from 'connect'
import Copy from './lib/copy.js'
import { pathExists, doesFileBelongToPath } from './lib/utils/helpers.js'
import http from 'node:http'
import os from 'node:os'
import fs from 'node:fs'
import livereload from 'livereload'
import Markups from './lib/markups.js'
import path from 'node:path'
import serveStatic from 'serve-static'
import Reactor from './lib/reactor.js'
import Scripts from './lib/scripts.js'
import log, { styledLog, hasLoggedErrors } from './lib/utils/log.js'
import Styles from './lib/styles.js'
import PostCSS from './lib/postcss.js'
import Argoyle from 'argoyle'
import portscanner from 'portscanner'

const cwd = process.cwd() // Current Working Directory
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

const cli = new Argoyle(pkg.version)
  .line(`Usage: ${pkg.name} [config-file] [options]\n`)
  .option('build', { short: 'b', description: 'Build the project and exit' })
  .option('config', { short: 'c', value: '<path>', description: 'Specify the config file' })
  .option('port', { short: 'p', value: '<number>', description: 'Specify the port for the server, overrides the config file' })
  .option('livereload-port', { short: 'l', value: '<number>', description: 'Specify the port for the livereload server, overrides the config file' })
  .option('base-url', { short: 'u', value: '<path>', description: 'Set the base URL prefix for markup, overrides the config file' })

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
const overrideLivereloadPort = flags['livereload-port']
const overrideBaseURL = flags['base-url']

let configPath = path.join(cwd, defaultConfigPath)
if (!pathExists(configPath)) configPath = path.join(cwd, '💩.json') // TODO: Ok dude, I know it's late, but you can do better than this.

async function resolveLiveReloadPort(config) {
  if (!config.livereload) return null
  let liveReloadPort = overrideLivereloadPort || config.livereload.port || 35729
  if (!overrideLivereloadPort) liveReloadPort = await getAvailablePort(liveReloadPort, liveReloadPort + 10)
  config.livereload_port = liveReloadPort
}

function setupLiveReloadServer(config) {
  if (!config.livereload) return null
  const liveReloadExcludes = ['.git', '.svn', '.hg']

  if (config.watch) {
    liveReloadExcludes.push(...config.watch)
  }

  if (config.includePaths) {
    liveReloadExcludes.push(...config.includePaths)
  }

  if (config.livereload.exclude) {
    liveReloadExcludes.push(...config.livereload.exclude)
  }

  const liveReloadServer = livereload.createServer({
    exclusions: [...new Set(liveReloadExcludes)],
    port: config.livereload_port
  })
  styledLog(`🔃 {dim}LiveReload  :{/} ${liveReloadServer.config.port}`)
  console.log()
  liveReloadServer.watch(cwd)
}

function setupWatchers(config, modules) {
  if (!config.watch) return

  // TODO: think about watching the updates of the config file itself, we can reload the config and recompile everything.
  // TODO: ability to automatically create a watch list of directories if watch is set to true. The list will be generated from the `in` property of each task.
  // awaitWriteFinish: wait for saves to finish writing before recompiling, so a
  // mid-write (truncated/partial) file is never read. Fixes intermittent broken
  // builds on editor save. ponytail: default thresholds are fine; bump if slow disks flake.
  // Shared by 'change' and 'add': editors with atomic saves (rename-write)
  // fire unlink+add instead of change, so both events must trigger the same
  // rebuilds. 'add' also covers genuinely new files (e.g. a new markup page).
  const compileChanged = (file) => {
    if (/(\.m?jsx?|\.tsx?)$/i.test(file)) {
      modules.scripts.compile().catch(err => console.error(err))

      if (modules.reactor.belongsToReactor(file)) {
        modules.reactor.compile().then(() => {
          if (modules.reactor.renderedChanged) {
            config.reactorData = modules.reactor.getRendered()
            modules.markups.compile().then(() => modules.postcss.compile()).catch(err => console.error(err))
          }
        }).catch(err => console.error(err))
      }
    }
    if (/(\.sass|\.scss|\.css)$/i.test(file)) {
      modules.styles.compile().then(() => modules.postcss.compile()).catch(err => console.error(err))
    }
    if (/(\.html|\.xml|\.rss|\.atom|\.njk|\.liquid|\.md)$/i.test(file)) {
      modules.markups.compile().then(() => modules.postcss.compile()).catch(err => console.error(err))
    }

    if (/(\.json|\.ya?ml)$/i.test(file)) {
      modules.markups.reloadDataFiles().then(() => modules.markups.compile()).catch(err => console.error(err))
    }

    doesFileBelongToPath(file, config.copy) && modules.copy.execute().catch(err => console.error(err))
  }

  chokidar.watch(config.watch, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
  }).on('change', compileChanged)
    .on('add', compileChanged)
    .on('unlink', (file) => {
      if (/(\.html|\.xml|\.rss|\.atom|\.njk|\.liquid|\.md)$/i.test(file)) {
        modules.markups.compile().catch(err => console.error(err))
      }
      modules.copy.unlink(file, doesFileBelongToPath(file, config.copy))
    }).on('unlinkDir', (dirPath) => {
      doesFileBelongToPath(dirPath, config.markup) && modules.markups.compile().catch(err => console.error(err))
      modules.copy.unlink(dirPath, doesFileBelongToPath(dirPath, config.copy))
    })
}

// Main function 💩
async function poops() {
  const styles = new Styles(config)
  const postcss = new PostCSS(config)
  const reactor = new Reactor(config)
  const scripts = new Scripts(config)
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
  config.reactorData = reactor.getRendered()
  await step(() => scripts.compile())
  await step(() => markups.compile())
  await step(() => postcss.compile())
  await step(() => copy.execute())

  if (build || (!config.watch && !config.livereload && !config.serve)) {
    process.exit(failed || hasLoggedErrors() ? 1 : 0)
  }

  setupWatchers(config, { styles, postcss, reactor, scripts, markups, copy })
}

// CLI Header
const title = `💩 Poops — v${pkg.version}`
styledLog(`\n{#8b4513}${title}\n${title.replace(/./g, '-')}{/}{bell}\n`)

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

if (config.watch) {
  config.watch = Array.isArray(config.watch) ? config.watch : [config.watch]
}

if (config.includePaths) {
  config.includePaths = Array.isArray(config.includePaths) ? config.includePaths : [config.includePaths]
} else {
  config.includePaths = ['node_modules']
}

// Backwards compatibility: support "ssg" as alias for "reactor"
if (!config.reactor && config.ssg) {
  config.reactor = config.ssg
}

if (overrideBaseURL && config.markup) {
  config.markup.baseURL = overrideBaseURL
}

async function getAvailablePort(port, max) {
  while (port < max) {
    const status = await portscanner.checkPortStatus(port, 'localhost')
    if (status === 'closed') {
      return port
    } else {
      port++
    }
  }
  return port
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
  await resolveLiveReloadPort(config)
  await poops() // Initial compilation before starting the server
  const app = connect()

  const base = config.serve.base && pathExists(cwd, config.serve.base)
    ? path.join(cwd, config.serve.base)
    : cwd

  app.use(serveStatic(base))

  // Serve 404.html for unmatched routes
  const notFoundPage = path.join(base, '404.html')
  app.use((req, res) => {
    res.statusCode = 404
    if (pathExists(notFoundPage)) {
      fs.createReadStream(notFoundPage).pipe(res)
    } else {
      res.end('Not Found')
    }
  })

  let port = overridePort || config.serve.port || 4040
  if (!overridePort) port = await getAvailablePort(port, port + 10)

  // eslint-disable-next-line @stylistic/space-before-function-paren
  http.createServer(app).listen(parseInt(port), '0.0.0.0', async () => {
    console.log()
    styledLog(`🏠 {dim}Local server:{/} {underline|http://localhost:${port}}`)
    styledLog(`🛜 {dim} Network     :{/} {underline|http://${getLocalIP()}:${port}}`)
    setupLiveReloadServer(config)
  })
}

// Start the webserver
if (!build && config.serve) {
  startServer()
} else {
  poops()
}
