// import bch from './bch/sagas'
// import btc from './btc/sagas'
// import ethereum from './ethereum/sagas'
// import shapeShift from './shapeShift/sagas'
// import buySell from './buySell/sagas'
// import contacts from './contacts/sagas'
// import root from './root/sagas'

import sagas from './sagas'

const api = {}
const kvStoreSagas = sagas({ api })

describe('kvStore sagas', () => {
  Object.keys(kvStoreSagas).forEach((saga) => {
    it('should be exporting ' + saga + '\'s saga', () => {
      const path = './' + saga + '/sagas'
      const s await (
        await import(path)
      ).default;
      return expect(kvStoreSagas[saga]).toEqual(s({ api }))
    })
  })
})