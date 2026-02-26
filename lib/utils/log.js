import PrintStyle from './print-style.js'

const pstyle = new PrintStyle()

const TAG_COLORS = {
  script: 'yellowBright',
  ssg: 'yellowBright',
  style: 'magentaBright',
  markup: 'cyanBright',
  copy: 'green',
  info: 'blue',
  error: 'redBright'
}

const DEFAULT_COLOR = 'white'

/**
 * @param {Object} options
 * @param {string} options.tag - Tag label (e.g. 'script', 'style', 'markup', 'ssg', 'copy', 'info')
 * @param {boolean} [options.error] - Whether this is an error message
 * @param {string} options.text - Main message text
 * @param {string} [options.link] - File path or URL to display underlined
 * @param {string} [options.size] - File size string
 * @param {string} [options.time] - Build time string
 */
export default function log({ tag, error, text, link, size, time }) {
  if (tag === 'error') error = true
  const color = TAG_COLORS[tag] || DEFAULT_COLOR
  let msg = `${pstyle[color] + pstyle.bold}[${tag}]${pstyle.reset}`

  if (error) {
    msg += ` ${pstyle.redBright + pstyle.bold}[error]${pstyle.reset}`
  }

  msg += ` ${pstyle.dim}${text}${pstyle.reset}`

  if (link) {
    msg += ` ${pstyle.italic + pstyle.underline}${link}${pstyle.reset}`
  }

  if (size) {
    msg += ` ${pstyle.greenBright}${size}${pstyle.reset}`
  }

  if (time) {
    msg += ` ${pstyle.green}(${time})${pstyle.reset}`
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
