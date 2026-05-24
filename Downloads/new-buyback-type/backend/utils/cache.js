const NodeCache = require('node-cache');

const ttlSeconds = (parseInt(process.env.CACHE_TTL_MINUTES, 10) || 60) * 60;

const cache = new NodeCache({ stdTTL: ttlSeconds, checkperiod: 120 });

function get(key) {
  return cache.get(key);
}

function set(key, value) {
  cache.set(key, value);
}

function buildKey({ brand, model, storage, carrier, condition }) {
  return `${brand}:${model}:${storage}:${carrier}:${condition}`;
}

module.exports = { get, set, buildKey };
