import { execSync } from 'node:child_process'
import log, { styledLog } from './utils/log.js'

// Every stage runExec fires a hook for.
export const EXEC_STAGES = ['reactor', 'scripts', 'images', 'markup', 'styles', 'copy', 'build']

// Every key config.exec accepts. A bare stage means "after the stage", `post:`
// is its explicit spelling, and `pre:` fires before the stage instead. A key
// outside this set never runs (runExec only looks up known ones), so it's
// almost always a typo (`style`, `script`, `after:markup`) — validateExec warns
// once at startup instead of letting the hook silently no-op.
export const EXEC_KEYS = EXEC_STAGES.flatMap((stage) => [`pre:${stage}`, stage, `post:${stage}`])

// Returns the unknown stage keys (for tests); warns for each as a side effect.
export function validateExec(config) {
  const unknown = Object.keys(config.exec || {}).filter((key) => !EXEC_KEYS.includes(key))
  for (const key of unknown) {
    log({ tag: 'exec', warn: true, text: `unknown stage "${key}" — never runs. Valid: ${EXEC_STAGES.join(', ')} — each also as pre:<stage> and post:<stage>` })
  }
  return unknown
}

// Per-stage shell hooks. `config.exec` maps a pipeline stage to a command (or
// array of commands) run around that stage compiling — in both build and watch,
// so a generator or post-processor (e.g. fetching data the templates read,
// stripping CSS comments) stays in sync during dev instead of only running
// behind `poops -b && cmd`.
// Sync + stdio:inherit so ordering is deterministic and output streams live;
// cwd is the project root, matching how the compilers resolve their paths.
// Returns true if any command failed, so build can fail the exit code; in watch
// the failure is logged and swallowed so the watcher survives.
// Stages: reactor, scripts, images, markup, styles (the after hook fires past
// PostCSS so the CSS is final, the pre hook ahead of Sass), copy, and build
// (once, around the full initial pipeline).
// `stage` is the config key, so callers pass 'markup' for the after hook and
// 'pre:markup' for the before one.
// `run` is injectable so tests exercise the branching without forking a shell.
export default function runExec(config, cwd, stage, run = execSync) {
  const exec = config.exec || {}
  // `post:markup` is the explicit spelling of a bare `markup`, so a config
  // carrying both fires both rather than silently dropping one — bare first,
  // since that is the older spelling. Each command keeps the key it was written
  // under, so the log names the spelling the config used rather than one the
  // reader would go looking for and not find.
  const keys = stage.startsWith('pre:') ? [stage] : [stage, `post:${stage}`]
  const cmds = keys.flatMap((key) => [exec[key]].flat().filter(Boolean).map((cmd) => [key, cmd]))
  if (!cmds.length) return false
  let failed = false
  for (const [key, cmd] of cmds) {
    try {
      styledLog(`⚡ {dim}exec ${key}:{/} ${cmd}`)
      run(cmd, { cwd, stdio: 'inherit' })
    } catch (err) {
      failed = true
      log({ tag: 'error', text: `exec ${key} failed: ${cmd}` })
    }
  }
  return failed
}
