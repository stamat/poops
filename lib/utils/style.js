module.exports = class Style {
  reset = '\x1b[0m'
  bold = '\x1b[1m'
  dim = '\x1b[2m'
  italic = '\x1b[3m'
  underline = '\x1b[4m'
  blink = '\x1b[5m'
  inverse = '\x1b[7m'
  hidden = '\x1b[8m'
  strikethrough = '\x1b[9m'
  black = '\x1b[30m'
  red = '\x1b[31m'
  redBright = '\x1b[91m'
  green = '\x1b[32m'
  greenBright = '\x1b[92m'
  yellow = '\x1b[33m'
  yellowBright = '\x1b[93m'
  blue = '\x1b[34m'
  blueBright = '\x1b[94m'
  magenta = '\x1b[35m'
  magentaBright = '\x1b[95m'
  cyan = '\x1b[36m'
  cyanBright = '\x1b[96m'
  white = '\x1b[37m'
  whiteBright = '\x1b[97m'
  gray = '\x1b[90m'
  bgBlack = '\x1b[40m'
  bgRed = '\x1b[41m'
  bgRedBright = '\x1b[101m'
  bgGreen = '\x1b[42m'
  bgGreenBright = '\x1b[102m'
  bgYellow = '\x1b[43m'
  bgYellowBright = '\x1b[103m'
  bgBlue = '\x1b[44m'
  bgBlueBright = '\x1b[104m'
  bgMagenta = '\x1b[45m'
  bgMagentaBright = '\x1b[105m'
  bgCyan = '\x1b[46m'
  bgCyanBright = '\x1b[106m'
  bgWhite = '\x1b[47m'
  bgWhiteBright = '\x1b[107m'
  bgGray = '\x1b[100m'
  bell = '\x07'

  hexToRgb(hex) {
    const sanitizedHex = hex.replace('#', '')
    const red = parseInt(sanitizedHex.substring(0, 2), 16)
    const green = parseInt(sanitizedHex.substring(2, 4), 16)
    const blue = parseInt(sanitizedHex.substring(4, 6), 16)

    return [red, green, blue]
  }

  terminalColorIndex(red, green, blue) {
    return 16 +
      Math.round(red / 255 * 5) * 36 +
      Math.round(green / 255 * 5) * 6 +
      Math.round(blue / 255 * 5)
  }

  color(hex) {
    const [red, green, blue] = this.hexToRgb(hex)

    return `\x1b[38;5;${this.terminalColorIndex(red, green, blue)}m`
  }

  background(hex) {
    const [red, green, blue] = this.hexToRgb(hex)

    return `\x1b[48;5;${this.terminalColorIndex(red, green, blue)}m`
  }
}
