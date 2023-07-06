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

const { pathExists } = helpers

const cwd = process.cwd() // Current Working Directory
const pkg = require('./package.json')
const args = process.argv.slice(2)

let defaultConfigPath = 'poops.json'

if (args.length) {
  defaultConfigPath = args[0]
}

const configPath = path.join(cwd, defaultConfigPath)
// Load poops.json
const config = require(configPath)

const pstyle = new PrintStyle()

// JS/TS Compiler

// Main function 💩
function poops() {
  const styles = new Styles(config)
  const scripts = new Scripts(config)
  const markups = new Markups(config)

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
      port: config.livereload.port || 35729
    })
    console.log(`${pstyle.blue + pstyle.bold}[info]${pstyle.reset} ${pstyle.dim}🔃 LiveReload server:${pstyle.reset} ${pstyle.italic + pstyle.underline}http://localhost:${lrserver.config.port}${pstyle.reset}`)
    lrserver.watch(cwd)
  }

  styles.compile()
  scripts.compile()
  markups.compile()

  if (config.watch) {
    chokidar.watch(config.watch).on('change', (file) => {
      if (/(\.js|\.ts)$/i.test(file)) scripts.compile()
      if (/(\.sass|\.scss|\.css)$/i.test(file)) styles.compile()
      if (/(\.html|\.njk|\.json|\.yml)$/i.test(file)) markups.compile()
    })
  }

  if (!config.watch && !config.livereload && !config.serve) {
    process.exit(1)
  }
}

// CLI Header
console.log(`\n${pstyle.color('#8b4513')}💩 Poops — v${pkg.version}
----------------${pstyle.reset + pstyle.bell}\n`)

// Check if poops.json exists
if (!pathExists(configPath)) {
  console.log(`${pstyle.redBright + pstyle.bold}[error]${pstyle.reset} \`${pstyle.underline}${defaultConfigPath}${pstyle.reset}\` not found.
${pstyle.dim}Configuration file \`${pstyle.underline}${defaultConfigPath}${pstyle.reset}${pstyle.dim}\` not found in your working directory: ${pstyle.underline}${cwd}${pstyle.reset}\n
${pstyle.dim}Please specify another file path or create a \`poops.json\` file in your working directory and try again.\n
${pstyle.dim}For information on the structure of the configuration file, please visit: \n${pstyle.underline}https://stamat.github.io/poops${pstyle.reset}\n`)
  process.exit(1)
}

if (config.watch) {
  config.watch = Array.isArray(config.watch) ? config.watch : [config.watch]
}

if (config.includePaths) {
  config.includePaths = Array.isArray(config.includePaths) ? config.includePaths : [config.includePaths]
} else {
  config.includePaths = ['node_modules']
}

// Start the webserver
if (config.serve) {
  const app = connect()

  if (config.serve.base && pathExists(cwd, config.serve.base)) {
    app.use(serveStatic(path.join(cwd, config.serve.base)))
  } else {
    app.use(serveStatic(cwd))
  }

  const port = config.serve.port ? parseInt(config.serve.port, 10) : 4040
  http.createServer(app).listen(port, () => {
    console.log(`${pstyle.blue + pstyle.bold}[info]${pstyle.reset} ${pstyle.dim}🌍 Local server:${pstyle.reset} ${pstyle.italic + pstyle.underline}http://localhost:${port}${pstyle.reset}`)
    poops()
  })
} else {
  poops()
}
