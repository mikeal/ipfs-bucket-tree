// const IPFS = require('ipfs')
// const Graph = require('ipld-graph-builder')
const zlib = require('zlib')
const util = require('util')
const mh = require('multihashes')
const mhs = multihash => mh.toB58String(multihash)

const gzip = util.promisify(zlib.gzip)
const gunzip = util.promisify(zlib.gunzip)

const nest = (map, key, block) => {
  key = key.split('/').filter(k => k)
  while (key.length) {
    let _key = key.shift()
    if (!map.has(_key)) map.set(_key, new Map())
    map = map.get(_key)
  }
  map.set(mhs(block.cid.multihash), block)
}

const toLink = (name, node) => {
  if (!node) throw new Error('node is a required argument')
  let hash
  let size
  if (node.multihash) {
    hash = mhs(node.multihash)
  } else if (node.cid) {
    hash = mhs(node.cid.multihash)
  }
  if (typeof node.size !== 'undefined') {
    size = node.size
  } else if (node.data) {
    size = node.data.length
  }
  if (!hash || typeof size !== 'number') {
    throw new Error('Unknown type, cannot convert to link.')
  }
  return {name, size, hash}
}

class API {
  constructor (ipfs) {
    this.ipfs = ipfs
  }
  async mkblock (buffer) {
    if (!Buffer.isBuffer(buffer)) throw new Error('Block must be buffer.')
    let compressed = await gzip(buffer)
    return this.ipfs.block.put(compressed)
  }
  async put (...args) {
    let value = args.pop()
    let block = await this.mkblock(value)
    let bulk = new Map()
    args.forEach(key => {
      if (!key.startsWith('/')) throw new Error('Keys must begin with "/".')
      nest(bulk, key, block)
    })
    return this._write(bulk)
  }
  ls (path) {
    let ipfs = this.ipfs
    let root = this.root
    if (!root) throw new Error('No root node has been set.')

    let list = (async function* listBucket() {
      path = path.split('/').filter(x => x)
      let dir = await ipfs.object.get(root)
      while (path.length) {
        let sub = path.shift()
        let link = dir.links.find(l => l.name === sub)
        dir = await ipfs.object.get(link.multihash)
        if (!dir) throw new Error(`Cannot find subdirectory "${sub}".`)
      }
      for (let link of dir.links) {
        if (link.name === '.file') {
          let block = await ipfs.block.get(link.multihash)
          let buff = await gunzip(block.data)
          yield buff
        }
      }
    })()

    list.root = root
    return list
  }
  async _write (bulk) {
    const _iter = async (map, node) => {
      let keys = Array.from(map.keys()).sort()
      let links = {}
      let files = {}
      if (node) {
        node.links.forEach(link => {
          if (link.name === '.file') files[mhs(link.multihash)] = link
          else links[link.name] = link
        })
      }
      for (let key of keys) {
        let value = map.get(key)
        if (value instanceof Map) {
          let _node
          if (links[key]) {
            _node = await this.ipfs.object.get(links[key].multihash)
          }
          links[key] = await _iter(value, _node)
        } else {
          if (!value.cid) throw new Error('Unknown value in bulk _write.')
          files[toLink('', value).hash] = value
        }
      }
      let _links = []
      Object.keys(links).forEach(k => {
        _links.push(toLink(k, links[k]))
      })
      Object.keys(files).forEach(k => {
        _links.push(toLink('.file', files[k]))
      })
      let obj = {
        Data: Buffer.alloc(0),
        Links: _links
      }

      let o = await this.ipfs.object.put(obj)
      // TODO: we can get out of this get() if we prepare the internal
      // links as proper DagNode's, then we can just return the put
      // with the links attached.
      return this.ipfs.object.get(o.multihash)
    }
    let root = this.root ? await this._getNode(this.root) : null
    let newRoot = await _iter(bulk, root)
    let hash = newRoot.toJSON().multihash
    this.root = hash
    return hash
  }
  async _getNode (hash) {
    return this.ipfs.object.get(hash)
  }
}

module.exports = (...args) => new API(...args)
module.exports.toLink = toLink // exported for testing.
