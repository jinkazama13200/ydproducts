const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const PORT = toNumber(process.env.PORT, 8787);
const PRODUCT_API_BASE = process.env.PRODUCT_API_BASE || 'https://yida-new-mgr-omnxqgbi-api.yznba.com';
const PRODUCT_ORIGIN = process.env.PRODUCT_ORIGIN || 'https://yida-new-mgr-y5cf7h6r.yznba.com';
const PRODUCT_TOKEN = String(process.env.PRODUCT_TOKEN || '').trim();
const INTERNAL_API_KEY = String(process.env.INTERNAL_API_KEY || '').trim();
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const NODE_ENV = process.env.NODE_ENV || 'development';
const MAX_PAGES = Math.max(1, toNumber(process.env.MAX_PAGES, 20));
const RATE_WINDOW_MINUTES = Math.max(1, toNumber(process.env.RATE_WINDOW_MINUTES, 5));
const CACHE_TTL_MS = Math.max(1000, toNumber(process.env.CACHE_TTL_MS, 15000));
const UPSTREAM_TIMEOUT_MS = Math.max(1000, toNumber(process.env.UPSTREAM_TIMEOUT_MS, 15000));
const UPSTREAM_RETRIES = Math.max(0, toNumber(process.env.UPSTREAM_RETRIES, 1));
const REQUESTS_PER_MINUTE = Math.max(1, toNumber(process.env.REQUESTS_PER_MINUTE, 120));
const ENABLE_DEBUG_UPSTREAM = String(process.env.ENABLE_DEBUG_UPSTREAM || (NODE_ENV !== 'production' ? 'true' : 'false')).toLowerCase() === 'true';

const runtimeState = {
  startedAt: Date.now(),
  lastSuccessAt: null,
  lastError: null
};

const cache = new Map(); // key -> { expiresAt, payload }
const ipBuckets = new Map(); // ip -> { windowStart, count }

function log(level, event, meta = {}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...meta
  }));
}

function getTzParts(date = new Date(), timeZone = 'Asia/Singapore') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second
  };
}

function fmtInSg(date) {
  const p = getTzParts(date, 'Asia/Singapore');
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function todayRangeSg() {
  const p = getTzParts(new Date(), 'Asia/Singapore');
  const day = `${p.year}-${p.month}-${p.day}`;
  return { start: `${day} 00:00:00`, end: `${day} 23:59:59` };
}

function headers(token) {
  return {
    accept: 'application/json, text/plain, */*',
    itoken: token,
    origin: PRODUCT_ORIGIN,
    referer: `${PRODUCT_ORIGIN}/`,
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty'
  };
}

function tokenId(token) {
  if (!token) return 'none';
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function tokenCacheKey(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (!entry || entry.expiresAt <= now) cache.delete(key);
  }
}

function cleanupExpiredRateBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of ipBuckets.entries()) {
    if (!bucket || now - bucket.windowStart >= 60000) ipBuckets.delete(ip);
  }
}

function buildSuccess(data, meta = {}) {
  return { success: true, data, meta };
}

function buildErrorBody(code, message, retryable = false, extra = {}) {
  return {
    success: false,
    error: {
      code,
      message,
      retryable,
      ...extra
    }
  };
}

async function getWithRetry(url, options = {}) {
  let lastErr;
  const attempts = Math.max(1, UPSTREAM_RETRIES + 1);

  for (let i = 0; i < attempts; i++) {
    try {
      return await axios.get(url, {
        ...options,
        timeout: options.timeout || UPSTREAM_TIMEOUT_MS
      });
    } catch (e) {
      lastErr = e;
      const status = Number(e?.response?.status || 0);
      const retryable = !status || (status >= 500 && status < 600) || e.code === 'ECONNABORTED';
      if (status === 401 || !retryable || i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }

  throw lastErr;
}

async function fetchMchProductStatAll(token) {
  const { start, end } = todayRangeSg();
  const pageSize = 100;
  const first = await getWithRetry(`${PRODUCT_API_BASE}/api/mchProductStat`, {
    params: { pageNumber: 1, pageSize, createdStart: start, createdEnd: end },
    headers: headers(token)
  });

  if (first?.data?.code !== 0) throw new Error('mchProductStat failed');

  let records = first.data?.data?.records || [];
  const total = Number(first.data?.data?.total || records.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagesToFetch = Math.min(totalPages, MAX_PAGES);

  for (let page = 2; page <= pagesToFetch; page++) {
    const res = await getWithRetry(`${PRODUCT_API_BASE}/api/mchProductStat`, {
      params: { pageNumber: page, pageSize, createdStart: start, createdEnd: end },
      headers: headers(token)
    });
    records = records.concat(res?.data?.data?.records || []);
  }

  return { records, totalPages, pagesFetched: pagesToFetch, truncated: totalPages > pagesToFetch };
}

async function fetchRateMap(token) {
  const end = new Date();
  const start = new Date(end.getTime() - RATE_WINDOW_MINUTES * 60 * 1000);

  const res = await getWithRetry(`${PRODUCT_API_BASE}/api/payOrder`, {
    params: {
      pageNumber: 1,
      pageSize: 500,
      createdStart: fmtInSg(start),
      createdEnd: fmtInSg(end)
    },
    headers: headers(token)
  });

  const map = new Map();
  const records = res?.data?.data?.records || [];
  const total = Number(res?.data?.data?.total || records.length);
  for (const r of records) {
    const k = `${r.mchName || 'UNKNOWN'}|||${r.productName || 'UNKNOWN'}`;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return { map, truncated: total > records.length, fetchedCount: records.length, total };
}

function buildApiError(e) {
  const status = Number(e?.response?.status || 500);
  if (status === 401) {
    return {
      status: 401,
      body: buildErrorBody('UPSTREAM_401', 'Yida token expired/invalid (401). Vui lòng lấy token mới rồi thử lại.', false)
    };
  }

  if (e?.code === 'ECONNABORTED') {
    return {
      status: 504,
      body: buildErrorBody('UPSTREAM_TIMEOUT', 'Upstream timeout', true)
    };
  }

  if (status >= 500 && status < 600) {
    return {
      status: 502,
      body: buildErrorBody('UPSTREAM_5XX', 'Upstream server error', true)
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    body: buildErrorBody('INTERNAL_ERROR', e?.message || 'Unknown error', false)
  };
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
}));

app.use((req, res, next) => {
  cleanupExpiredCache();
  cleanupExpiredRateBuckets();
  req.reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('x-request-id', req.reqId);
  next();
});

app.use((req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || now - b.windowStart >= 60000) {
    ipBuckets.set(ip, { windowStart: now, count: 1 });
    return next();
  }

  b.count += 1;
  if (b.count > REQUESTS_PER_MINUTE) {
    return res.status(429).json(buildErrorBody('RATE_LIMITED', 'Too many requests', true));
  }
  return next();
});

app.use('/api', (req, res, next) => {
  if (!INTERNAL_API_KEY) return next();
  const provided = String(req.header('x-internal-key') || '').trim();
  if (!provided || provided !== INTERNAL_API_KEY) {
    return res.status(401).json(buildErrorBody('UNAUTHORIZED', 'Missing or invalid internal API key', false));
  }
  return next();
});

app.get('/health', (_, res) => {
  const now = Date.now();
  return res.json(buildSuccess({
    ok: true,
    uptimeSec: Math.floor((now - runtimeState.startedAt) / 1000),
    cacheTtlMs: CACHE_TTL_MS,
    cacheEntries: cache.size,
    lastSuccessAt: runtimeState.lastSuccessAt,
    lastError: runtimeState.lastError
  }));
});

app.get('/api/debug/upstream', async (req, res) => {
  if (!ENABLE_DEBUG_UPSTREAM) {
    return res.status(404).json(buildErrorBody('NOT_FOUND', 'Debug endpoint is disabled', false));
  }

  const token = String(req.header('x-product-token') || PRODUCT_TOKEN || '').trim();
  if (!token) {
    return res.status(400).json(buildErrorBody('MISSING_TOKEN', 'Missing token', false));
  }

  const t0 = Date.now();
  const { start, end } = todayRangeSg();

  try {
    const test = await getWithRetry(`${PRODUCT_API_BASE}/api/mchProductStat`, {
      params: { pageNumber: 1, pageSize: 1, createdStart: start, createdEnd: end },
      headers: headers(token)
    });

    return res.json(buildSuccess({
      upstreamStatus: Number(test?.status || 200),
      upstreamCode: Number(test?.data?.code),
      tokenHint: tokenId(token),
      dateRange: { start, end },
      sampleCount: Array.isArray(test?.data?.data?.records) ? test.data.data.records.length : 0
    }, {
      reqId: req.reqId,
      ms: Date.now() - t0
    }));
  } catch (e) {
    const apiErr = buildApiError(e);
    return res.status(apiErr.status).json({
      ...apiErr.body,
      meta: {
        reqId: req.reqId,
        ms: Date.now() - t0,
        tokenHint: tokenId(token),
        upstreamStatus: Number(e?.response?.status || 0)
      }
    });
  }
});

app.get('/api/running-products', async (req, res) => {
  const t0 = Date.now();

  try {
    const runtimeToken = String(req.header('x-product-token') || PRODUCT_TOKEN || '').trim();
    if (!runtimeToken) {
      return res.status(400).json(buildErrorBody('MISSING_TOKEN', 'Missing PRODUCT_TOKEN', false));
    }

    const cacheKey = tokenCacheKey(runtimeToken);
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      log('info', 'running_products_cache_hit', { reqId: req.reqId, token: tokenId(runtimeToken), ms: Date.now() - t0 });
      return res.json(hit.payload);
    }

    const [statResult, rateResult] = await Promise.all([
      fetchMchProductStatAll(runtimeToken),
      fetchRateMap(runtimeToken)
    ]);

    const running = statResult.records
      .filter(r => Number(r.totalOrderCount || 0) > 0)
      .map(r => ({
        merchant: r.mchName || 'UNKNOWN',
        product: r.productName || 'UNKNOWN',
        totalOrderCount: Number(r.totalOrderCount || 0),
        orderSuccessCount: Number(r.orderSuccessCount || 0),
        totalAmount: Number(r.totalAmount || 0),
        ordersInWindow: rateResult.map.get(`${r.mchName || 'UNKNOWN'}|||${r.productName || 'UNKNOWN'}`) || 0
      }));

    const grouped = {};
    for (const row of running) {
      if (!grouped[row.merchant]) grouped[row.merchant] = [];
      grouped[row.merchant].push(row);
    }

    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => b.ordersInWindow - a.ordersInWindow || b.totalAmount - a.totalAmount);
    }

    const payload = buildSuccess({
      fetchedAt: new Date().toISOString(),
      rateWindowMinutes: RATE_WINDOW_MINUTES,
      merchantCount: Object.keys(grouped).length,
      pairCount: running.length,
      data: grouped
    }, {
      reqId: req.reqId,
      statPagesFetched: statResult.pagesFetched,
      statTotalPages: statResult.totalPages,
      statTruncated: statResult.truncated,
      payOrderFetchedCount: rateResult.fetchedCount,
      payOrderTotal: rateResult.total,
      payOrderTruncated: rateResult.truncated,
      ms: Date.now() - t0
    });

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    runtimeState.lastSuccessAt = new Date().toISOString();
    runtimeState.lastError = null;

    log('info', 'running_products_ok', {
      reqId: req.reqId,
      token: tokenId(runtimeToken),
      merchants: payload.data.merchantCount,
      pairs: payload.data.pairCount,
      ms: Date.now() - t0
    });

    return res.json(payload);
  } catch (e) {
    const apiErr = buildApiError(e);
    runtimeState.lastError = {
      at: new Date().toISOString(),
      code: apiErr.body.error?.code,
      message: apiErr.body.error?.message
    };

    log('error', 'running_products_error', {
      reqId: req.reqId,
      code: apiErr.body.error?.code,
      status: apiErr.status,
      message: apiErr.body.error?.message,
      ms: Date.now() - t0
    });

    return res.status(apiErr.status).json({
      ...apiErr.body,
      meta: {
        reqId: req.reqId,
        ms: Date.now() - t0
      }
    });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err?.message === 'Not allowed by CORS' ? 403 : 500;
  log('error', 'unhandled_error', {
    reqId: req?.reqId,
    status,
    message: err?.message || 'Unknown error'
  });
  return res.status(status).json(buildErrorBody(status === 403 ? 'CORS_FORBIDDEN' : 'INTERNAL_ERROR', err?.message || 'Unknown error', false));
});

const server = app.listen(PORT, () => {
  log('info', 'backend_started', {
    port: PORT,
    nodeEnv: NODE_ENV,
    debugUpstreamEnabled: ENABLE_DEBUG_UPSTREAM,
    allowedOrigins: ALLOWED_ORIGINS.length
  });
});

function shutdown(signal) {
  log('info', 'shutdown_started', { signal });
  server.close(() => {
    log('info', 'shutdown_complete', { signal });
    process.exit(0);
  });

  setTimeout(() => {
    log('error', 'shutdown_forced', { signal });
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
