const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());

const PORT = Number(process.env.PORT || 8787);
const PRODUCT_API_BASE = process.env.PRODUCT_API_BASE || 'https://yida-new-mgr-omnxqgbi-api.yznba.com';
const PRODUCT_ORIGIN = process.env.PRODUCT_ORIGIN || 'https://yida-new-mgr-y5cf7h6r.yznba.com';
const PRODUCT_TOKEN = process.env.PRODUCT_TOKEN || '';
const MAX_PAGES = Number(process.env.MAX_PAGES || 20);
const RATE_WINDOW_MINUTES = Number(process.env.RATE_WINDOW_MINUTES || 5);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 15000);
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 15000);
const UPSTREAM_RETRIES = Number(process.env.UPSTREAM_RETRIES || 1);
const REQUESTS_PER_MINUTE = Number(process.env.REQUESTS_PER_MINUTE || 120);

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

function pad(n) { return String(n).padStart(2, '0'); }

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
  return records;
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
  for (const r of records) {
    const k = `${r.mchName || 'UNKNOWN'}|||${r.productName || 'UNKNOWN'}`;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

function buildApiError(e) {
  const status = Number(e?.response?.status || 500);
  if (status === 401) {
    return {
      status: 401,
      body: { code: 'UPSTREAM_401', message: 'Yida token expired/invalid (401). Vui lòng lấy token mới rồi thử lại.', retryable: false }
    };
  }

  if (e?.code === 'ECONNABORTED') {
    return {
      status: 504,
      body: { code: 'UPSTREAM_TIMEOUT', message: 'Upstream timeout', retryable: true }
    };
  }

  if (status >= 500 && status < 600) {
    return {
      status: 502,
      body: { code: 'UPSTREAM_5XX', message: 'Upstream server error', retryable: true }
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    body: { code: 'INTERNAL_ERROR', message: e?.message || 'Unknown error', retryable: false }
  };
}

// lightweight in-memory rate limit
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
    return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests', retryable: true });
  }
  return next();
});

app.get('/health', (_, res) => {
  const now = Date.now();
  res.json({
    ok: true,
    uptimeSec: Math.floor((now - runtimeState.startedAt) / 1000),
    cacheTtlMs: CACHE_TTL_MS,
    cacheEntries: cache.size,
    lastSuccessAt: runtimeState.lastSuccessAt,
    lastError: runtimeState.lastError
  });
});

app.get('/api/debug/upstream', async (req, res) => {
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const token = String(req.query.token || req.header('x-product-token') || PRODUCT_TOKEN || '').trim();
  if (!token) {
    return res.status(400).json({ code: 'MISSING_TOKEN', message: 'Missing token', retryable: false });
  }

  const t0 = Date.now();
  const { start, end } = todayRangeSg();

  try {
    const test = await getWithRetry(`${PRODUCT_API_BASE}/api/mchProductStat`, {
      params: { pageNumber: 1, pageSize: 1, createdStart: start, createdEnd: end },
      headers: headers(token)
    });

    return res.json({
      ok: true,
      reqId,
      ms: Date.now() - t0,
      upstreamStatus: Number(test?.status || 200),
      upstreamCode: Number(test?.data?.code),
      tokenHint: tokenId(token),
      dateRange: { start, end },
      sampleCount: Array.isArray(test?.data?.data?.records) ? test.data.data.records.length : 0
    });
  } catch (e) {
    const apiErr = buildApiError(e);
    return res.status(apiErr.status).json({
      ok: false,
      reqId,
      ms: Date.now() - t0,
      tokenHint: tokenId(token),
      upstreamStatus: Number(e?.response?.status || 0),
      code: apiErr.body.code,
      message: apiErr.body.message,
      retryable: apiErr.body.retryable
    });
  }
});

app.get('/api/running-products', async (req, res) => {
  const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const t0 = Date.now();

  try {
    const runtimeToken = String(req.query.token || req.header('x-product-token') || PRODUCT_TOKEN || '').trim();
    if (!runtimeToken) {
      return res.status(400).json({ code: 'MISSING_TOKEN', message: 'Missing PRODUCT_TOKEN', retryable: false });
    }

    const cacheKey = runtimeToken;
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      log('info', 'running_products_cache_hit', { reqId, token: tokenId(runtimeToken), ms: Date.now() - t0 });
      return res.json(hit.payload);
    }

    const [statRecords, rateMap] = await Promise.all([
      fetchMchProductStatAll(runtimeToken),
      fetchRateMap(runtimeToken)
    ]);

    const running = statRecords
      .filter(r => Number(r.totalOrderCount || 0) > 0)
      .map(r => ({
        merchant: r.mchName || 'UNKNOWN',
        product: r.productName || 'UNKNOWN',
        totalOrderCount: Number(r.totalOrderCount || 0),
        orderSuccessCount: Number(r.orderSuccessCount || 0),
        totalAmount: Number(r.totalAmount || 0),
        ordersInWindow: rateMap.get(`${r.mchName || 'UNKNOWN'}|||${r.productName || 'UNKNOWN'}`) || 0
      }));

    const grouped = {};
    for (const row of running) {
      if (!grouped[row.merchant]) grouped[row.merchant] = [];
      grouped[row.merchant].push(row);
    }

    for (const k of Object.keys(grouped)) {
      grouped[k].sort((a, b) => b.ordersInWindow - a.ordersInWindow || b.totalAmount - a.totalAmount);
    }

    const payload = {
      fetchedAt: new Date().toISOString(),
      rateWindowMinutes: RATE_WINDOW_MINUTES,
      merchantCount: Object.keys(grouped).length,
      pairCount: running.length,
      data: grouped
    };

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    runtimeState.lastSuccessAt = new Date().toISOString();
    runtimeState.lastError = null;

    log('info', 'running_products_ok', {
      reqId,
      token: tokenId(runtimeToken),
      merchants: payload.merchantCount,
      pairs: payload.pairCount,
      ms: Date.now() - t0
    });

    return res.json(payload);
  } catch (e) {
    const apiErr = buildApiError(e);
    runtimeState.lastError = {
      at: new Date().toISOString(),
      code: apiErr.body.code,
      message: apiErr.body.message
    };

    log('error', 'running_products_error', {
      reqId,
      code: apiErr.body.code,
      status: apiErr.status,
      message: apiErr.body.message,
      ms: Date.now() - t0
    });

    return res.status(apiErr.status).json(apiErr.body);
  }
});

app.listen(PORT, () => {
  log('info', 'backend_started', { port: PORT });
});
