const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const compression = require('compression');
const { Server: SocketIOServer } = require('socket.io');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');

// Compression middleware (before routes)
app.use(compression());

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

// === NEW: Persistent Cache Configuration ===
const CACHE_DIR = process.env.CACHE_DIR || '/tmp/yd-cache';
const CACHE_MAX_AGE_MS = Math.max(1000, toNumber(process.env.CACHE_MAX_AGE_MS, 300000)); // 5 minutes default

// === NEW: Circuit Breaker Configuration ===
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = Math.max(1, toNumber(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 5));
const CIRCUIT_BREAKER_RESET_TIMEOUT_MS = Math.max(1000, toNumber(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS, 180000)); // 3 minutes default

// === NEW: Retry Configuration ===
const MAX_RETRIES = Math.max(1, toNumber(process.env.MAX_RETRIES, 5));
const BASE_RETRY_DELAY_MS = Math.max(100, toNumber(process.env.BASE_RETRY_DELAY_MS, 300));

// === NEW: Timeout for paginated calls ===
const PAGINATED_CALL_TIMEOUT_MS = Math.max(5000, toNumber(process.env.PAGINATED_CALL_TIMEOUT_MS, 45000)); // 45 seconds default

// === Real-time Push Configuration ===
const PUSH_INTERVAL_MS = Math.max(2000, toNumber(process.env.PUSH_INTERVAL_MS, 5000)); // Auto-poll interval (default 5s)
const PUSH_ENABLED = String(process.env.PUSH_ENABLED || 'true').toLowerCase() === 'true';

const runtimeState = {
  startedAt: Date.now(),
  lastSuccessAt: null,
  lastError: null,
  circuitBreakerState: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  circuitBreakerFailures: 0,
  circuitBreakerLastFailureAt: null
};

const cache = new Map(); // In-memory cache: key -> { expiresAt, payload }
const ipBuckets = new Map(); // ip -> { windowStart, count }

// === NEW: Ensure cache directory exists ===
function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o755 });
      log('info', 'cache_dir_created', { path: CACHE_DIR });
    }
  } catch (e) {
    log('error', 'cache_dir_creation_failed', { path: CACHE_DIR, error: e.message });
  }
}

// === NEW: File-based cache functions ===
function getCacheFilePath(key) {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CACHE_DIR, `${safeKey}.json`);
}

function readPersistentCache(key) {
  try {
    const filePath = getCacheFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const entry = JSON.parse(content);
    if (!entry || entry.expiresAt <= Date.now()) {
      // Cache expired, delete it
      fs.unlinkSync(filePath);
      return null;
    }
    return entry;
  } catch (e) {
    log('warn', 'persistent_cache_read_error', { key, error: e.message });
    return null;
  }
}

function writePersistentCache(key, payload, ttlMs) {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(key);
    const tmpPath = filePath + '.tmp';
    const entry = {
      expiresAt: Date.now() + ttlMs,
      payload,
      cachedAt: Date.now()
    };
    // Atomic write: write to .tmp then rename (POSIX atomic)
    fs.writeFileSync(tmpPath, JSON.stringify(entry), 'utf8');
    fs.renameSync(tmpPath, filePath);
    log('debug', 'persistent_cache_write', { key, ttlMs, path: filePath });
  } catch (e) {
    log('error', 'persistent_cache_write_error', { key, error: e.message });
  }
}

function cleanupPersistentCache() {
  try {
    ensureCacheDir();
    const files = fs.readdirSync(CACHE_DIR);
    let deleted = 0;
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(CACHE_DIR, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const entry = JSON.parse(content);
        if (!entry || entry.expiresAt <= Date.now()) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch (e) {
        // Delete corrupted files
        fs.unlinkSync(filePath);
        deleted++;
      }
    }
    if (deleted > 0) {
      log('info', 'persistent_cache_cleanup', { deletedCount: deleted });
    }
  } catch (e) {
    log('error', 'persistent_cache_cleanup_error', { error: e.message });
  }
}

// === NEW: Circuit Breaker Functions ===
function circuitBreakerCanCall() {
  if (runtimeState.circuitBreakerState === 'CLOSED') {
    return true;
  }
  if (runtimeState.circuitBreakerState === 'OPEN') {
    const timeSinceFailure = Date.now() - (runtimeState.circuitBreakerLastFailureAt || 0);
    if (timeSinceFailure >= CIRCUIT_BREAKER_RESET_TIMEOUT_MS) {
      runtimeState.circuitBreakerState = 'HALF_OPEN';
      log('info', 'circuit_breaker_half_open', { 
        failures: runtimeState.circuitBreakerFailures,
        timeSinceFailureMs: timeSinceFailure 
      });
      return true;
    }
    return false;
  }
  // HALF_OPEN: allow one test call
  return true;
}

function circuitBreakerRecordSuccess() {
  if (runtimeState.circuitBreakerState !== 'CLOSED') {
    log('info', 'circuit_breaker_closed', { 
      previousState: runtimeState.circuitBreakerState,
      failures: runtimeState.circuitBreakerFailures 
    });
    // Emit WebSocket event when circuit breaker closes
    emitConnectionStatus(false);
  }
  runtimeState.circuitBreakerState = 'CLOSED';
  runtimeState.circuitBreakerFailures = 0;
}

function circuitBreakerRecordFailure() {
  runtimeState.circuitBreakerFailures++;
  runtimeState.circuitBreakerLastFailureAt = Date.now();
  
  if (runtimeState.circuitBreakerFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    runtimeState.circuitBreakerState = 'OPEN';
    log('warn', 'circuit_breaker_opened', { 
      failures: runtimeState.circuitBreakerFailures,
      resetTimeoutMs: CIRCUIT_BREAKER_RESET_TIMEOUT_MS 
    });
    // Emit WebSocket event when circuit breaker opens
    emitConnectionStatus(true);
  } else {
    log('warn', 'circuit_breaker_failure_recorded', { 
      failures: runtimeState.circuitBreakerFailures,
      threshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD 
    });
  }
}

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

// === UPDATED: Enhanced retry with exponential backoff ===
async function getWithRetry(url, options = {}, isPaginated = false) {
  let lastErr;
  const timeout = isPaginated ? PAGINATED_CALL_TIMEOUT_MS : (options.timeout || UPSTREAM_TIMEOUT_MS);
  
  // Check circuit breaker before attempting
  if (!circuitBreakerCanCall()) {
    const timeSinceFailure = Date.now() - (runtimeState.circuitBreakerLastFailureAt || 0);
    const retryAfterMs = CIRCUIT_BREAKER_RESET_TIMEOUT_MS - timeSinceFailure;
    log('warn', 'circuit_breaker_blocking_call', { 
      url, 
      state: runtimeState.circuitBreakerState,
      retryAfterMs,
      failures: runtimeState.circuitBreakerFailures 
    });
    throw new Error(`Circuit breaker OPEN. Retry after ${Math.round(retryAfterMs / 1000)}s`);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(url, {
        ...options,
        timeout
      });
      
      // Success - reset circuit breaker
      circuitBreakerRecordSuccess();
      return response;
      
    } catch (e) {
      lastErr = e;
      const status = Number(e?.response?.status || 0);
      const retryable = !status || (status >= 500 && status < 600) || e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT';
      
      // Enhanced error logging
      log('warn', 'api_call_attempt_failed', {
        url,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        status,
        code: e.code,
        message: e.message,
        retryable,
        isPaginated,
        timeout,
        stack: e.stack
      });
      
      // Don't retry on 401 or non-retryable errors
      if (status === 401 || !retryable) {
        circuitBreakerRecordFailure();
        throw e;
      }
      
      // Last attempt - record failure and throw
      if (attempt === MAX_RETRIES - 1) {
        circuitBreakerRecordFailure();
        log('error', 'api_call_all_retries_exhausted', {
          url,
          attempts: MAX_RETRIES,
          finalError: e.message,
          code: e.code,
          status
        });
        throw e;
      }
      
      // Exponential backoff: 300ms, 600ms, 1200ms, 2400ms, ...
      const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
      log('info', 'api_call_retrying', { 
        attempt: attempt + 1, 
        maxRetries: MAX_RETRIES, 
        delayMs,
        url 
      });
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  circuitBreakerRecordFailure();
  throw lastErr;
}

async function fetchMchProductStatAll(token) {
  const { start, end } = todayRangeSg();
  const pageSize = 100;
  const first = await getWithRetry(`${PRODUCT_API_BASE}/api/mchProductStat`, {
    params: { pageNumber: 1, pageSize, createdStart: start, createdEnd: end },
    headers: headers(token)
  }, true); // isPaginated = true

  if (first?.data?.code !== 0) throw new Error('mchProductStat failed');

  let records = first.data?.data?.records || [];
  const total = Number(first.data?.data?.total || records.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagesToFetch = Math.min(totalPages, MAX_PAGES);

  for (let page = 2; page <= pagesToFetch; page++) {
    const res = await getWithRetry(`${PRODUCT_API_BASE}/api/mchProductStat`, {
      params: { pageNumber: page, pageSize, createdStart: start, createdEnd: end },
      headers: headers(token)
    }, true); // isPaginated = true
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
  }, true); // isPaginated = true

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

  if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') {
    return {
      status: 504,
      body: buildErrorBody('UPSTREAM_TIMEOUT', 'Upstream timeout', true, { 
        code: e.code,
        timeout: e.config?.timeout 
      })
    };
  }

  if (status >= 500 && status < 600) {
    return {
      status: 502,
      body: buildErrorBody('UPSTREAM_5XX', 'Upstream server error', true, {
        upstreamStatus: status
      })
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    body: buildErrorBody('INTERNAL_ERROR', e?.message || 'Unknown error', false, {
      code: e.code,
      stack: e.stack
    })
  };
}

app.use(cors({
  origin(origin, callback) {
    // Allow all origins only if ALLOWED_ORIGINS is empty (development)
    if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
    // Require origin header when origins are configured
    if (!origin) return callback(new Error('Origin header required'));
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
    cacheMaxAgeMs: CACHE_MAX_AGE_MS,
    cacheEntries: cache.size,
    cacheDir: CACHE_DIR,
    circuitBreakerState: runtimeState.circuitBreakerState,
    circuitBreakerFailures: runtimeState.circuitBreakerFailures,
    lastSuccessAt: runtimeState.lastSuccessAt,
    lastError: runtimeState.lastError,
    config: {
      maxRetries: MAX_RETRIES,
      baseRetryDelayMs: BASE_RETRY_DELAY_MS,
      paginatedCallTimeoutMs: PAGINATED_CALL_TIMEOUT_MS,
      circuitBreakerThreshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      circuitBreakerResetTimeoutMs: CIRCUIT_BREAKER_RESET_TIMEOUT_MS
    }
  }));
});

app.get('/api/debug/upstream', async (req, res) => {
  if (!ENABLE_DEBUG_UPSTREAM) {
    return res.status(404).json(buildErrorBody('NOT_FOUND', 'Debug endpoint is disabled', false));
  }

  // Require internal API key for debug endpoint in production
  if (NODE_ENV === 'production') {
    const provided = String(req.header('x-internal-key') || '').trim();
    if (!provided || provided !== INTERNAL_API_KEY) {
      return res.status(401).json(buildErrorBody('UNAUTHORIZED', 'Debug endpoint requires internal API key in production', false));
    }
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
    
    // === UPDATED: Check persistent cache first ===
    let hit = cache.get(cacheKey);
    let cacheSource = 'memory';
    
    if (!hit || hit.expiresAt <= Date.now()) {
      // Try persistent cache
      const persistentHit = readPersistentCache(cacheKey);
      if (persistentHit) {
        hit = persistentHit;
        cacheSource = 'persistent';
        // Restore to memory cache
        cache.set(cacheKey, hit);
      }
    }
    
    if (hit && hit.expiresAt > Date.now()) {
      log('info', 'running_products_cache_hit', { 
        reqId: req.reqId, 
        token: tokenId(runtimeToken), 
        ms: Date.now() - t0,
        source: cacheSource 
      });
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

    // === UPDATED: Write to both memory and persistent cache ===
    const cacheTtl = CACHE_MAX_AGE_MS; // Use the longer TTL for persistent cache
    cache.set(cacheKey, { expiresAt: Date.now() + cacheTtl, payload });
    writePersistentCache(cacheKey, payload, cacheTtl);
    
    runtimeState.lastSuccessAt = new Date().toISOString();
    runtimeState.lastError = null;

    // === NEW: Emit WebSocket data-update event ===
    emitDataUpdate(payload);

    log('info', 'running_products_ok', {
      reqId: req.reqId,
      token: tokenId(runtimeToken),
      merchants: payload.data.merchantCount,
      pairs: payload.data.pairCount,
      ms: Date.now() - t0,
      cacheWritten: true
    });

    return res.json(payload);
  } catch (e) {
    const apiErr = buildApiError(e);
    runtimeState.lastError = {
      at: new Date().toISOString(),
      code: apiErr.body.error?.code,
      message: apiErr.body.error?.message,
      circuitBreakerState: runtimeState.circuitBreakerState
    };

    // === NEW: Try to return cached data on failure ===
    const cacheKey = tokenCacheKey(String(req.header('x-product-token') || PRODUCT_TOKEN || '').trim());
    const cachedData = readPersistentCache(cacheKey) || cache.get(cacheKey);
    
    if (cachedData && cachedData.expiresAt > Date.now()) {
      log('warn', 'running_products_fallback_to_cache', {
        reqId: req.reqId,
        error: apiErr.body.error?.message,
        cacheAge: Date.now() - cachedData.cachedAt,
        circuitBreakerState: runtimeState.circuitBreakerState
      });
      
      return res.json({
        ...cachedData.payload,
        meta: {
          ...cachedData.payload.meta,
          warning: 'Serving cached data due to API failure',
          cachedAt: new Date(cachedData.cachedAt).toISOString(),
          error: apiErr.body.error
        }
      });
    }

    log('error', 'running_products_error', {
      reqId: req.reqId,
      code: apiErr.body.error?.code,
      status: apiErr.status,
      message: apiErr.body.error?.message,
      ms: Date.now() - t0,
      circuitBreakerState: runtimeState.circuitBreakerState,
      failures: runtimeState.circuitBreakerFailures,
      stack: e.stack
    });

    return res.status(apiErr.status).json({
      ...apiErr.body,
      meta: {
        reqId: req.reqId,
        ms: Date.now() - t0,
        circuitBreakerState: runtimeState.circuitBreakerState
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
    message: err?.message || 'Unknown error',
    stack: err?.stack
  });
  return res.status(status).json(buildErrorBody(status === 403 ? 'CORS_FORBIDDEN' : 'INTERNAL_ERROR', err?.message || 'Unknown error', false));
});

// === WebSocket (Socket.IO) Setup ===
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// === Real-time: Track previous state for level-change detection ===
const prevLevelMap = new Map(); // "merchant|||product" -> "hot"|"warm"|"idle"
let lastPushPayload = null; // Cache last pushed payload for new client sync

// WebSocket connection handling
io.on('connection', (socket) => {
  log('info', 'ws_client_connected', { socketId: socket.id });

  // Send current state on connect
  socket.emit('connection-status', {
    circuitBreaker: runtimeState.circuitBreakerState,
    usingCache: runtimeState.circuitBreakerState === 'OPEN'
  });

  // Send last known data immediately so new client doesn't wait
  if (lastPushPayload) {
    socket.emit('data-update', lastPushPayload);
  }

  socket.on('disconnect', (reason) => {
    log('info', 'ws_client_disconnected', { socketId: socket.id, reason });
  });
});

// Helper to emit connection status to all clients
function emitConnectionStatus(usingCache) {
  io.emit('connection-status', {
    circuitBreaker: runtimeState.circuitBreakerState,
    usingCache
  });
}

// Helper to emit data updates to all clients
function emitDataUpdate(payload) {
  lastPushPayload = payload;
  io.emit('data-update', payload);
}

// Helper to detect and emit level changes
function detectAndEmitLevelChanges(grouped) {
  const currentLevelMap = new Map();

  for (const [merchant, items] of Object.entries(grouped)) {
    for (const item of items) {
      const key = `${merchant}|||${item.product || 'UNKNOWN'}`;
      const n = Number(item.ordersInWindow || 0);
      const newLevel = n >= 10 ? 'hot' : n >= 3 ? 'warm' : 'idle';
      currentLevelMap.set(key, newLevel);

      const prevLevel = prevLevelMap.get(key);
      if (prevLevel && prevLevel !== newLevel) {
        emitLevelChange(merchant, item.product || 'UNKNOWN', prevLevel, newLevel, n);
      }
    }
  }

  // Detect products that disappeared (were in prev but not in current)
  for (const [key, prevLevel] of prevLevelMap.entries()) {
    if (!currentLevelMap.has(key)) {
      const [merchant, product] = key.split('|||');
      emitLevelChange(merchant, product, prevLevel, 'idle', 0);
    }
  }

  prevLevelMap.clear();
  for (const [k, v] of currentLevelMap) {
    prevLevelMap.set(k, v);
  }
}

// Helper to emit level changes
function emitLevelChange(merchant, product, prevLevel, newLevel, orders) {
  io.emit('level-change', {
    merchant,
    product,
    prevLevel,
    newLevel,
    orders,
    timestamp: new Date().toISOString()
  });
}

// === Real-time: Auto-fetch and push data to all WebSocket clients ===
let pushInProgress = false;

async function autoFetchAndPush() {
  if (pushInProgress) return; // Prevent overlapping calls
  if (!PRODUCT_TOKEN) return; // Need server-side token for auto-poll
  if (io.engine.clientsCount === 0) return; // No clients connected, skip

  pushInProgress = true;
  const t0 = Date.now();

  try {
    // Auto-push ALWAYS fetches fresh data for real-time updates
    // Do NOT check cache freshness here — cache is only for HTTP endpoint fallback
    const cacheKey = tokenCacheKey(PRODUCT_TOKEN);

    const [statResult, rateResult] = await Promise.all([
      fetchMchProductStatAll(PRODUCT_TOKEN),
      fetchRateMap(PRODUCT_TOKEN)
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
      statPagesFetched: statResult.pagesFetched,
      statTotalPages: statResult.totalPages,
      statTruncated: statResult.truncated,
      payOrderFetchedCount: rateResult.fetchedCount,
      payOrderTotal: rateResult.total,
      payOrderTruncated: rateResult.truncated,
      ms: Date.now() - t0,
      source: 'auto-push'
    });

    // Update caches — use short TTL for in-memory (prevents HTTP endpoint over-fetching)
    // Persistent cache uses longer TTL for fallback when API is down
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload, cachedAt: Date.now() });
    writePersistentCache(cacheKey, payload, CACHE_MAX_AGE_MS);

    runtimeState.lastSuccessAt = new Date().toISOString();
    runtimeState.lastError = null;

    // Detect level changes and emit
    detectAndEmitLevelChanges(grouped);

    // Push to all connected clients
    emitDataUpdate(payload);

    log('info', 'auto_push_ok', {
      merchants: Object.keys(grouped).length,
      pairs: running.length,
      clients: io.engine.clientsCount,
      ms: Date.now() - t0
    });
  } catch (e) {
    log('error', 'auto_push_failed', {
      message: e.message,
      code: e.code,
      stack: e.stack,
      ms: Date.now() - t0
    });
  } finally {
    pushInProgress = false;
  }
}

const server = httpServer.listen(PORT, () => {
  log('info', 'backend_started', {
    port: PORT,
    nodeEnv: NODE_ENV,
    debugUpstreamEnabled: ENABLE_DEBUG_UPSTREAM,
    allowedOrigins: ALLOWED_ORIGINS.length,
    cacheDir: CACHE_DIR,
    cacheMaxAgeMs: CACHE_MAX_AGE_MS,
    maxRetries: MAX_RETRIES,
    baseRetryDelayMs: BASE_RETRY_DELAY_MS,
    paginatedCallTimeoutMs: PAGINATED_CALL_TIMEOUT_MS,
    circuitBreakerThreshold: CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    circuitBreakerResetTimeoutMs: CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
    pushEnabled: PUSH_ENABLED,
    pushIntervalMs: PUSH_INTERVAL_MS
  });

  // Initialize cache directory on startup
  ensureCacheDir();
  // Clean up old cache files on startup
  cleanupPersistentCache();
  // Periodic cache cleanup every 5 minutes
  setInterval(cleanupPersistentCache, 5 * 60 * 1000);

  // === Real-time: Auto-poll and push data via WebSocket ===
  if (PUSH_ENABLED && PRODUCT_TOKEN) {
    log('info', 'realtime_push_started', { intervalMs: PUSH_INTERVAL_MS });

    // Initial fetch immediately
    autoFetchAndPush();

    // Then on interval
    setInterval(autoFetchAndPush, PUSH_INTERVAL_MS);
  } else {
    log('info', 'realtime_push_disabled', {
      reason: !PUSH_ENABLED ? 'PUSH_ENABLED=false' : 'PRODUCT_TOKEN not set'
    });
  }
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
