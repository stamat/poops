import { execSync } from 'node:child_process'
import log, { styledLog } from './utils/log.js'

// Every stage runExec fires a hook for. A key in config.exec outside this set
// never runs (runExec only looks up known stages), so it's almost always a typo
// (e.g. `style`, `script`). validateExec warns once at startup instead of
// letting the hook silently no-op.
export const EXEC_STAGES = ['reactor', 'scripts', 'images', 'markup', 'styles', 'copy', 'build']

// Returns the unknown stage keys (for tests); warns for each as a side effect.
export function validateExec(config) {
  const unknown = Object.keys(config.exec || {}).filter((key) => !EXEC_STAGES.includes(key))
  for (const key of unknown) {
    log({ tag: 'exec', warn: true, text: `unknown stage "${key}" — never runs. Valid: ${EXEC_STAGES.join(', ')}` })
  }
  return unknown
}

// Post-stage shell hooks. `config.exec` maps a pipeline stage to a command (or
// array of commands) run after that stage compiles — in both build and watch,
// so a post-processor (e.g. stripping CSS comments, regenerating a reference)
// stays in sync during dev instead of only running behind `poops -b && cmd`.
// Sync + stdio:inherit so ordering is deterministic and output streams live;
// cwd is the project root, matching how the compilers resolve their paths.
// Returns true if any command failed, so build can fail the exit code; in watch
// the failure is logged and swallowed so the watcher survives.
// Stages: reactor, scripts, images, markup, styles (fires after PostCSS, so the
// CSS is final), copy, and build (once, after the full initial pipeline).
// `run` is injectable so tests exercise the branching without forking a shell.
export default function runExec(config, cwd, stage, run = execSync) {
  const hooks = config.exec && config.exec[stage]
  if (!hooks) return false
  let failed = false
  for (const cmd of [hooks].flat()) {
    try {
      styledLog(`⚡ {dim}exec ${stage}:{/} ${cmd}`)
      run(cmd, { cwd, stdio: 'inherit' })
    } catch (err) {
      failed = true
      log({ tag: 'error', text: `exec ${stage} failed: ${cmd}` })
    }
  }
  return failed
}
