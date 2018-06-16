const store = require('../')
const ipfsAPI = require('ipfs-api')
const {test} = require('tap')

let ipfs = ipfsAPI('/ip4/127.0.0.1/tcp/5001')

test('basics: put', async t => {
  t.plan(2)
  let db = store(ipfs)
  let node = await db.put('/one/two/three', Buffer.from('test'))
  t.ok(node)
  for await (buff of db.ls('/one/two/three')) {
    t.same(buff, Buffer.from('test'))
  }
})

test('basics: write twice', async t => {
  t.plan(3)
  let db = store(ipfs)
  let node = await db.put('/one/two/three', Buffer.from('test1'))
  t.ok(node)
  node = await db.put('/one/two/three', Buffer.from('test2'))
  t.ok(node)
  let results = []
  for await (buff of db.ls('/one/two/three')) {
    results.push(buff.toString())
  }
  t.same(results, ['test1', 'test2'])
})

test('basics: write identical buffer', async t => {
  t.plan(3)
  let db = store(ipfs)
  let node = await db.put('/one/two/three', Buffer.from('test'))
  t.ok(node)
  node = await db.put('/one/two/three', Buffer.from('test'))
  t.ok(node)
  let results = []
  for await (buff of db.ls('/one/two/three')) {
    t.same(buff, Buffer.from('test'))
  }
})