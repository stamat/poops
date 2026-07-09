import PrintStyle from 'printstyle'

const pstyle = new PrintStyle()

const TAG_COLORS = {
  script: 'yellowBright',
  reactor: 'yellowBright',
  style: 'magentaBright',
  markup: 'cyanBright',
  copy: 'green',
  image: 'greenBright',
  info: 'blue',
  error: 'redBright'
}

const DEFAULT_COLOR = 'white'

/**
 * @param {Object} options
 * @param {string} options.tag - Tag label (e.g. 'script', 'style', 'markup', 'reactor', 'copy', 'info')
 * @param {boolean} [options.error] - Whether this is an error message
 * @param {boolean} [options.warn] - Whether this is a warning (does not fail the build)
 * @param {string} options.text - Main message text
 * @param {string} [options.link] - File path or URL to display underlined
 * @param {string} [options.size] - File size string
 * @param {string} [options.time] - Build time string
 */
let errorLogged = false

// Build mode exits non-zero if any module reported an error, even ones
// swallowed internally (log-and-continue). log() is the single point
// every module error passes through, so the flag lives here.
export function hasLoggedErrors() {
  return errorLogged
}

export default function log({ tag, error, warn, text, link, size, time }) {
  if (tag === 'error') error = true
  if (error) errorLogged = true
  const color = TAG_COLORS[tag] || DEFAULT_COLOR
  let msg = pstyle.paint(`{${color}.bold|[${tag}]}`)

  if (error) {
    msg += pstyle.paint(' {redBright.bold|[error]}')
  } else if (warn) {
    msg += pstyle.paint(' {yellowBright.bold|[warn]}')
  }

  msg += pstyle.paint(` {dim|${text}}`)

  if (link) {
    msg += pstyle.paint(` {italic.underline|${link}}`)
  }

  if (size) {
    msg += pstyle.paint(` {greenBright|${size}}`)
  }

  if (time) {
    msg += pstyle.paint(` {green|(${time})}`)
  }

  if (error) {
    msg += pstyle.bell
  }

  if (error) {
    console.error(msg)
  } else {
    console.log(msg)
  }
}

export const bell = pstyle.bell

export function styledLog(template) {
  console.log(pstyle.paint(template))
}
