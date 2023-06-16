#!/usr/bin/env node

const connect = require('connect')
const fs = require('node:fs')
const http = require('node:http')
const livereload = require('livereload')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const resolve = require('resolve')
const sass = require('sass')
const serveStatic = require('serve-static')

function getPackageInfo(pkg) {
  const pkgPath = resolve.sync(`${pkg}/package.json`, {
    basedir: process.cwd(),
  });
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

// Compile Sass to CSS
const compiledSass = sass.compile('src/scss/index.scss', {
//  style: 'compressed',
  sourceMap: true,
  sourceMapIncludeSources: true,
  importers: [{
    // An importer that redirects relative URLs starting with "~" to
    // `node_modules`.
    findFileUrl(url) {
      if (fs.existsSync(url)) return null;
      const urlPath = path.join(pathToFileURL('node_modules').pathname, url);
      console.log(fs.existsSync(path.relative(process.cwd(), urlPath)), path.relative(process.cwd(), urlPath));
      return new URL(path.relative(process.cwd(), urlPath), pathToFileURL('node_modules'));
    }
  }]
});

fs.writeFileSync('dist/styles.css.map', JSON.stringify(compiledSass.sourceMap));
fs.writeFileSync('dist/styles.css', compiledSass.css);

// Start local server with LiveReload
const app = connect();
app.use(serveStatic(__dirname));
const port = 4040;
http.createServer(app).listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

var lrserver = livereload.createServer();
lrserver.watch(__dirname);
