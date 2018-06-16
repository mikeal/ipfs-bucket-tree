const fs = require('fs')
const zlib = require('zlib')
const smaz = require('smaz')
const JSONStream = require('json-stream')
const bent = require('bent')
const dagCBOR = require('ipld-dag-cbor')

const getHttp = bent('GET', 200)

const cache = {
  buff: new Set(),
  cbor: new Set(),
  gzip: new Set(),
  smaz: new Set()
}

const sum = (x, y) => x + y
const count = _set => Array.from(_set).map(b => b.length).reduce(sum, 0)

const mkcbor = obj => new Promise((resolve, reject) => {
  dagCBOR.util.serialize(obj, (err, buff) => {
    if (err) return reject(err)
    resolve(buff)
  })
})

const testSerializer = async () => {
  let url = `http://data.gharchive.org/2018-01-01-0.json.gz`
  console.log({url})
  let stream = await getHttp(url)
  let reader = stream.pipe(zlib.createUnzip()).pipe(JSONStream())

  for await (let obj of reader) {
    let buff = Buffer.from(JSON.stringify(obj))
    cache.buff.add(buff)
    cache.gzip.add(zlib.gzipSync(buff))
    cache.smaz.add(smaz.compress(JSON.stringify(obj)))
    cache.cbor.add(await mkcbor(obj))

    let base = count(cache.buff)
    let calc = x => ((x / base) * 100).toFixed(2) + '%'
    console.log({
      buff: calc(base),
      cbor: calc(count(cache.cbor)),
      gzip: calc(count(cache.gzip)),
      smaz: calc(count(cache.smaz))
    })
  }
}
testSerializer()

// { buff: '100.00%',
//   cbor: '90.63%',
//   gzip: '29.67%',
//   smaz: '92.20%' }

/* Conclusion, gzip is way smaller :) */