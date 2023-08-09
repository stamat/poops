#!/usr/bin/env node

const chokidar = require('chokidar')
const connect = require('connect')
const helpers = require('./lib/utils/helpers.js')
const http = require('node:http')
const livereload = require('livereload')
const Markups = require('./lib/markups.js')
const path = require('node:path')
const serveStatic = require('serve-static')
const Scripts = require('./lib/scripts.js')
const PrintStyle = require('./lib/utils/print-style.js')
const Styles = require('./lib/styles.js')
const portscanner = require('portscanner')

const { pathExists } = helpers

const cwd = process.cwd() // Current Working Directory
const pkg = require('./package.json')
const args = process.argv.slice(2)
const pstyle = new PrintStyle()

let build = false
let defaultConfigPath = 'poops.json'
let overridePort = null
let overrideLivereloadPort = null

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  switch (arg) {
    case '-b':
    case '--build':
      build = true
      break
    case '-c':
    case '--config':
      if (args.length === i + 1 || args[i + 1].startsWith('-')) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} Missing config file path`)
        process.exit(1)
      }
      defaultConfigPath = args[i + 1]
      i++
      break
    case '-p':
    case '--port':
      if (args.length === i + 1 || args[i + 1].startsWith('-') || isNaN(args[i + 1])) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} Missing port number`)
        process.exit(1)
      }
      overridePort = args[i + 1]
      i++
      break
    case '-l':
    case '--livereload':
      if (args.length === i + 1 || args[i + 1].startsWith('-') || isNaN(args[i + 1])) {
        console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} Missing livereload port number`)
        process.exit(1)
      }
      overrideLivereloadPort = args[i + 1]
      i++
      break
    case '-v':
    case '--version':
      console.log(pkg.version)
      process.exit(0)
      break
    case '-h':
    case '--help':
      console.log(`Usage: ${pkg.name} [config-file] [options]
      -b, --build\t\tBuild the project and exit
      -c, --config\t\tSpecify the config file
      -h, --help\t\tShow this help message
      -l, --livereload\t\tSpecify the port to use for the livereload server, overrides the config file
      -p, --port\t\tSpecify the port to use for the server, overrides the config file
      -v, --version\t\tShow version number`)
      process.exit(0)
      break
    default:
      if (arg.startsWith('-')) {
        console.log(`Unknown option: ${arg}`)
        process.exit(1)
      } else {
        defaultConfigPath = arg
      }
  }
}

let configPath = path.join(cwd, defaultConfigPath)
if (!args.length && !pathExists(configPath)) configPath = path.join(cwd, '💩.json')

// Main function 💩
async function poops() {
  let lport
  if (config.livereload) {
    lport = overrideLivereloadPort || config.livereload.port || 35729
    if (!overrideLivereloadPort) lport = await getAvailablePort(lport, lport + 10)
    config.livereload_port = lport
  }

  const styles = new Styles(config)
  const scripts = new Scripts(config)
  const markups = new Markups(config)

  if (build || (!config.watch && !config.livereload && !config.serve)) {
    await styles.compile()
    await scripts.compile()
    await markups.compile()
    process.exit(0)
  }

  if (config.livereload) {
    const lrExcludes = ['.git', '.svn', '.hg']

    if (config.watch) {
      lrExcludes.push(...config.watch)
    }

    if (config.includePaths) {
      lrExcludes.push(...config.includePaths)
    }

    if (config.livereload.exclude) {
      lrExcludes.push(...config.livereload.exclude)
    }

    const lrserver = livereload.createServer({
      exclusions: [...new Set(lrExcludes)],
      port: lport
    })
    console.log(`${pstyle.blue + pstyle.bold}[info]${pstyle.reset} ${pstyle.dim}🔃 LiveReload server:${pstyle.reset} ${pstyle.italic + pstyle.underline}http://localhost:${lrserver.config.port}${pstyle.reset}`)
    lrserver.watch(cwd)
  }

  await styles.compile()
  await scripts.compile()
  await markups.compile()

  if (config.watch) {
    // TODO: think about watching the updates of the config file itself, we can reload the config and recompile everything.
    // TODO: ability to automatically create a watch list of directories if watch is set to true. The list will be generated from the `in` property of each task.
    chokidar.watch(config.watch).on('change', (file) => {
      if (/(\.m?js|\.ts)$/i.test(file)) scripts.compile()
      if (/(\.sass|\.scss|\.css)$/i.test(file)) styles.compile()
      if (/(\.html|\.njk)$/i.test(file)) markups.compile()

      // TODO: We can actually reload the page only if the data file from data has changed.
      if (/(\.json|\.ya?ml)$/i.test(file)) {
        markups.reloadDataFiles().then(() => {
          markups.compile()
        })
      }
    })
  }
}

// CLI Header
const title = `💩 Poops — v${pkg.version}`
console.log(`\n${pstyle.color('#8b4513')}${title}
${title.replace(/./g, '-')}${pstyle.reset + pstyle.bell}\n`)

// Check if poops.json exists
if (!pathExists(configPath)) {
  console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} \`${pstyle.underline}${defaultConfigPath}${pstyle.reset}\` or \`${pstyle.underline}💩.json${pstyle.reset}\` not found.
${pstyle.dim}Configuration file \`${defaultConfigPath}\` or \`💩.json\` not found in your working directory: ${pstyle.underline}${cwd}${pstyle.reset}\n
${pstyle.dim}Please specify another file path or create a \`poops.json\` or \`💩.json\` file in your working directory and try again.\n
${pstyle.dim}For information on the structure of the configuration file, please visit: \n${pstyle.underline}https://stamat.github.io/poops${pstyle.reset}\n`)
  process.exit(1)
}

// Load poops.json
const config = require(configPath)

if (config.watch) {
  config.watch = Array.isArray(config.watch) ? config.watch : [config.watch]
}

if (config.includePaths) {
  config.includePaths = Array.isArray(config.includePaths) ? config.includePaths : [config.includePaths]
} else {
  config.includePaths = ['node_modules']
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

async function startServer() {
  const app = connect()

  if (config.serve.base && pathExists(cwd, config.serve.base)) {
    app.use(serveStatic(path.join(cwd, config.serve.base)))
  } else {
    app.use(serveStatic(cwd))
  }

  let port = overridePort || config.serve.port || 4040
  if (!overridePort) port = await getAvailablePort(port, port + 10)

  http.createServer(app).listen(parseInt(port), () => {
    console.log(`${pstyle.blue + pstyle.bold}[info]${pstyle.reset} ${pstyle.dim}🌍 Local server:${pstyle.reset} ${pstyle.italic + pstyle.underline}http://localhost:${port}${pstyle.reset}`)
    poops()
  })
}

// Start the webserver
if (!build && config.serve) {
  startServer()
} else {
  poops()
}
