import path from 'node:path'

export function replaceOutExtensions(outputPath) {
  switch (path.extname(outputPath)) {
    case '.md':
      outputPath = outputPath.replace(/\.md$/, '.html')
      break
    case '.njk':
      outputPath = outputPath.replace(/\.njk$/, '.html')
      break
    case '.liquid':
      outputPath = outputPath.replace(/\.liquid$/, '.html')
      break
  }
  return outputPath
}

export function getUpDirPrefix(relativeDir) {
  if (relativeDir.trim() === '') return ''
  if (relativeDir.startsWith('/')) relativeDir = relativeDir.slice(1)
  if (relativeDir.endsWith('/')) relativeDir = relativeDir.slice(0, -1)
  const relativePathParts = relativeDir.split('/')
  let upDir = ''
  for (let i = 0; i < relativePathParts.length; i++) {
    upDir += '../'
  }
  return upDir
}

export function getRelativePathPrefix(outputDir, fromDir) {
  let relativeDir = path.relative(process.cwd(), outputDir)
  const fromRelativeDir = fromDir ? path.relative(process.cwd(), fromDir) : ''

  if (fromRelativeDir && relativeDir.startsWith(fromRelativeDir)) {
    relativeDir = relativeDir.replace(fromRelativeDir, '')
  }

  return getUpDirPrefix(relativeDir)
}

export function getPageUrl(outputPath) {
  outputPath = replaceOutExtensions(outputPath)
  return /index\.[a-z]+$/.test(path.basename(outputPath)) ? path.relative(process.cwd(), path.dirname(outputPath)) : path.relative(process.cwd(), outputPath)
}

export function getPageUrlRelativeToOutput(outputPath, outputDir) {
  const pageUrl = getPageUrl(outputPath)
  return path.relative(outputDir, pageUrl)
}
