import PrintStyle from 'printstyle'

const pstyle = new PrintStyle()

const TAG_COLORS = {
  script: 'yellowBright',
  reactor: 'yellowBright',
  style: 'magentaBright',
  markup: 'cyanBright',
  copy: 'green',
  info: 'blue',
  error: 'redBright'
}

const DEFAULT_COLOR = 'white'

/**
 * @param {Object} options
 * @param {string} options.tag - Tag label (e.g. 'script', 'style', 'markup', 'reactor', 'copy', 'info')
 * @param {boolean} [options.error] - Whether this is an error message
 * @param {string} options.text - Main message text
 * @param {string} [options.link] - File path or URL to display underlined
 * @param {string} [options.size] - File size string
 * @param {string} [options.time] - Build time string
 */
export default function log({ tag, error, text, link, size, time }) {
  if (tag === 'error') error = true
  const color = TAG_COLORS[tag] || DEFAULT_COLOR
  let msg = pstyle.paint(`{${color}.bold|[${tag}]}`)

  if (error) {
    msg += pstyle.paint(' {redBright.bold|[error]}')
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
