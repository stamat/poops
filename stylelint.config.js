// Browser-compatibility gate for the compiled example CSS, checked against
// .browserslistrc. Not a style linter — the only rule here is the compat one,
// so it never argues about formatting.
export default {
  plugins: ['stylelint-no-unsupported-browser-features'],
  // sulphuris writes `/* stylelint-disable */` as a loud CSS comment in both
  // _normalize.scss and _fixes.scss, and neither re-enables. Compiled together
  // the second one is a CssSyntaxError: "All rules have already been disabled".
  // Renaming the prefix demotes them to ordinary comments, which is what we
  // want anyway — a dependency shouldn't get to mute this gate.
  configurationComment: 'stylelint-poops',
  rules: {
    'plugin/no-unsupported-browser-features': [true, {
      // "Partial support" is mostly caniuse flagging a spec corner nobody
      // uses — without this the report is 48 multicolumn notes about
      // column-fill and nothing else.
      ignorePartialSupport: true,
      // Features that degrade to nothing on the platforms that lack them:
      // pointer cursors are inert on touch, custom scrollbars fall back to
      // the native one. Anything not on this list should fail the build.
      ignore: [
        'css3-cursors',
        'css3-cursors-grab',
        'css-scrollbar'
      ]
    }]
  }
}
