const mongoose = require('mongoose')
const redis = require('redis')
const util = require('util')
const keys = require('../config/keys')

const redisClient = redis.createClient(keys.redisUrl)
redisClient.hget = util.promisify(redisClient.hget)

const exec = mongoose.Query.prototype.exec

mongoose.Query.prototype.cached = function({ key = 'default' } = {}) {
  this.withCache = true
  console.info('this.withCache cached', this.withCache)
  this.hashKey = key

  return this
}

mongoose.Query.prototype.exec = async function() {
  console.info('this.withCache', this.withCache)
  if (!this.withCache) return exec.apply(this, arguments)

  const key = JSON.stringify(Object.assign(
    {},
    this.getFilter(),
    { collection: this.mongooseCollection.name }
  ))

  const cachedValue = await redisClient.hget(this.hashKey, key)

  if (cachedValue) {
    const doc = JSON.parse(cachedValue)
    console.info('doc', doc)
    return Array.isArray(doc)
      ? doc.map(v => new this.model(v))
      : new this.model(doc)
  }

  const result = await exec.apply(this.arguments)
  redisClient.hset(this.hashKey, key, JSON.stringify(result))

  return result
}