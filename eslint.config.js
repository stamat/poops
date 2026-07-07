import neostandard from 'neostandard'

export default [
  { ignores: ['example/dist/**'] },
  ...neostandard(),
  {
    rules: {
      '@stylistic/space-before-function-paren': ['error', 'never']
    }
  }
]
