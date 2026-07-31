// Browser-compatibility gate for the compiled example CSS, checked against
// .browserslistrc. Not a style linter — the only rule here is the compat one,
// so it never argues about formatting.
//
// It runs on styles.min.css rather than styles.css because sulphuris ships a
// `/* stylelint-disable */` comment that survives into the unminified bundle,
// and a second copy of it makes stylelint bail with a CssSyntaxError. The
// minifier strips comments, so the same CSS parses clean.
export default {
  plugins: ['stylelint-no-unsupported-browser-features'],
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
