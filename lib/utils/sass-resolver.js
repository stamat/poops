import fs from 'node:fs'
import {
  pathExists,
  pathIsDirectory
} from './helpers.js'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function tryToFindFile(filePath, extensions) {
  const pathParts = path.parse(filePath)
  if (pathParts.ext && pathParts.ext.length > 0 && extensions.includes(pathParts.ext.slice(1))) {
    if (fs.existsSync(filePath)) return filePath
  }

  let fileExt = extensions.find(ext => fs.existsSync(`${filePath}.${ext}`))
  if (fileExt) return `${filePath}.${fileExt}`

  if (!pathParts.name.startsWith('_')) {
    pathParts.name = `_${pathParts.name}`
    pathParts.base = ''
    const underscoredFilePath = path.format(pathParts)
    fileExt = extensions.find(ext => fs.existsSync(`${underscoredFilePath}.${ext}`))
    if (fileExt) return `${underscoredFilePath}.${fileExt}`
  }

  return null
}

export function extractMainPathFromPackageJson(packageJsonPath) {
  if (!pathExists(packageJsonPath, 'package.json')) return null

  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), packageJsonPath, 'package.json'), 'utf-8'))

  const mainPath = pkg.sass || pkg.scss || pkg.style || pkg.css || pkg.main
  if (!mainPath) return null

  return mainPath
}

export function getPackagePath(url) {
  const parts = path.parse(url)
  if (!parts.dir) return null
  const dirChunks = parts.dir.split(path.sep)
  if (dirChunks.length === 0) return null
  if (dirChunks[0].startsWith('@') && dirChunks.length > 1) {
    return path.join(dirChunks[0], dirChunks[1])
  }
  return dirChunks[0]
}

export function sassPathResolver(url, resolvePath, infilePath) {
  // check if resolve path, like `node_modules` exists
  const resolvedPath = pathToFileURL(resolvePath)
  if (!fs.existsSync(resolvedPath.pathname)) return null
  const importPath = path.relative(process.cwd(), path.join(resolvedPath.pathname, url))

  // 1. Maybe it's a directory?
  if (pathExists(importPath) && pathIsDirectory(importPath)) {
    // Try to find an index file within the directory
    const correctIndexFile = tryToFindFile(path.join(importPath, 'index'), ['sass', 'scss', 'css'])
    if (correctIndexFile) return new URL(correctIndexFile, resolvedPath)

    // package.json discovery
    const style = extractMainPathFromPackageJson(importPath)

    const stylePath = new URL(path.join(importPath, style), resolvedPath)
    if (fs.existsSync(stylePath)) return stylePath
  }

  // 2. Maybe it's a file?
  if (pathExists(importPath)) return pathToFileURL(importPath)

  // 2.1 Try to find the correct file with different formats
  const correctFile = tryToFindFile(importPath, ['sass', 'scss', 'css'])
  if (correctFile) return new URL(correctFile, resolvedPath)

  // 2.2 Maybe it's a file within a package?
  const packagePath = getPackagePath(url)
  if (packagePath) {
    const packageFullPath = path.relative(process.cwd(), path.join(resolvedPath.pathname, packagePath))
    const stylePath = extractMainPathFromPackageJson(packageFullPath)

    if (stylePath) {
      const styleDir = path.dirname(stylePath)
      const styleFinalPath = path.join(packageFullPath, styleDir, url.replace(packagePath, ''))

      const correctPackageFile = tryToFindFile(styleFinalPath, ['sass', 'scss', 'css'])
      if (correctPackageFile) return new URL(correctPackageFile, resolvedPath)
    }
  }

  return null
}
