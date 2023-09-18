const mockConfig = require('./data/mock-config.json')
const ioPathResolver = require('../io-path-resolver.js')

test('ioPathResolver', () => {
  console.log(ioPathResolver(mockConfig, 'js'))
})
