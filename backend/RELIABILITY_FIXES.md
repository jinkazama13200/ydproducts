# YD Backend API Reliability Fixes

**Date:** 2026-04-07  
**Status:** ✅ Completed and deployed

## Problems Fixed

1. ✅ **API calls fail occasionally causing data loss** → Now falls back to cached data
2. ✅ **Only 1 retry with short 300ms delay** → Now 5 retries with exponential backoff
3. ✅ **No persistent cache** → Now has file-based cache in `/tmp/yd-cache/`
4. ✅ **15s timeout too short** → Now 45s for paginated calls
5. ✅ **No circuit breaker** → Now opens after 5 consecutive failures

## Changes Made

### 1. Enhanced Retry Logic
- **Before:** 1 retry, 300ms linear delay
- **After:** 5 retries with exponential backoff (300ms, 600ms, 1200ms, 2400ms, 4800ms)
- **Config:** `MAX_RETRIES=5`, `BASE_RETRY_DELAY_MS=300`

### 2. Persistent File-Based Cache
- **Location:** `/tmp/yd-cache/` (configurable via `CACHE_DIR`)
- **TTL:** 5 minutes (300000ms, configurable via `CACHE_MAX_AGE_MS`)
- **Behavior:** 
  - Saves successful API responses to disk
  - On API failure, serves cached data with warning in response
  - Auto-cleanup of expired cache files on startup
- **Files:** JSON format with `expiresAt`, `payload`, `cachedAt`

### 3. Increased Timeout for Paginated Calls
- **Before:** 15 seconds for all calls
- **After:** 45 seconds for paginated calls (`/api/mchProductStat`, `/api/payOrder`)
- **Config:** `PAGINATED_CALL_TIMEOUT_MS=45000`

### 4. Circuit Breaker
- **Threshold:** 5 consecutive failures → opens circuit
- **Reset timeout:** 3 minutes (180000ms)
- **States:** CLOSED → OPEN → HALF_OPEN → CLOSED
- **Behavior:** 
  - When OPEN, rejects calls immediately with error
  - After reset timeout, allows one test call (HALF_OPEN)
  - On success, closes circuit; on failure, reopens

### 5. Enhanced Error Logging
- **Before:** Basic error messages
- **After:** Full error details including:
  - Attempt number and max retries
  - HTTP status code
  - Error code (ECONNABORTED, ETIMEDOUT, etc.)
  - Full stack trace
  - Timeout configuration
  - Whether call was paginated
  - Circuit breaker state

## New Environment Variables

```bash
# Persistent Cache
CACHE_DIR=/tmp/yd-cache
CACHE_MAX_AGE_MS=300000

# Retry Configuration
MAX_RETRIES=5
BASE_RETRY_DELAY_MS=300

# Timeout for Paginated Calls
PAGINATED_CALL_TIMEOUT_MS=45000

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT_MS=180000
```

## Testing Performed

1. ✅ **Syntax check:** `node --check server.js` passed
2. ✅ **Server startup:** PM2 restart successful
3. ✅ **Health endpoint:** Shows all new config values
4. ✅ **Cache directory:** Created at `/tmp/yd-cache/`
5. ✅ **Error logging:** Verified detailed logs in PM2
6. ✅ **Circuit breaker:** Tracking failures correctly

## Health Endpoint

The `/health` endpoint now includes:
```json
{
  "cacheMaxAgeMs": 300000,
  "cacheDir": "/tmp/yd-cache",
  "circuitBreakerState": "CLOSED",
  "circuitBreakerFailures": 0,
  "config": {
    "maxRetries": 5,
    "baseRetryDelayMs": 300,
    "paginatedCallTimeoutMs": 45000,
    "circuitBreakerThreshold": 5,
    "circuitBreakerResetTimeoutMs": 180000
  }
}
```

## Fallback Behavior

When API fails and cached data is available:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "warning": "Serving cached data due to API failure",
    "cachedAt": "2026-04-07T00:58:00.000Z",
    "error": { ... }
  }
}
```

## Files Modified

- `/home/jinkazama132oo/.openclaw/workspace/ydproducts/backend/server.js`
- `/home/jinkazama132oo/.openclaw/workspace/ydproducts/backend/.env.example`

## Deployment

Deployed via PM2:
```bash
pm2 restart product-monitor-backend
```

Server is running and healthy as of 2026-04-07 08:58 GMT+8.
