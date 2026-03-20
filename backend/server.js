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

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function todayRange() {
  const n = new Date();
  const day = `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
  return { start: `${day} 00:00:00`, end: `${day} 23:59:59` };
}
function headers() {
  return {
    accept: 'application/json, text/plain, */*',
    itoken: PRODUCT_TOKEN,
    origin: PRODUCT_ORIGIN,
    referer: `${PRODUCT_ORIGIN}/`,
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty'
  };
}

async function fetchMchProductStatAll() {
  const { start, end } = todayRange();
  const pageSize = 100;
  const first = await axios.get(`${PRODUCT_API_BASE}/api/mchProductStat`, {
    params: { pageNumber: 1, pageSize, createdStart: start, createdEnd: end },
    headers: headers(),
    timeout: 15000
  });

  if (first?.data?.code !== 0) throw new Error('mchProductStat failed');

  let records = first.data?.data?.records || [];
  const total = Number(first.data?.data?.total || records.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagesToFetch = Math.min(totalPages, MAX_PAGES);

  for (let page = 2; page <= pagesToFetch; page++) {
    const res = await axios.get(`${PRODUCT_API_BASE}/api/mchProductStat`, {
      params: { pageNumber: page, pageSize, createdStart: start, createdEnd: end },
      headers: headers(),
      timeout: 15000
    });
    records = records.concat(res?.data?.data?.records || []);
  }
  return records;
}

async function fetchRateMap() {
  const end = new Date();
  const start = new Date(end.getTime() - RATE_WINDOW_MINUTES * 60 * 1000);

  const res = await axios.get(`${PRODUCT_API_BASE}/api/payOrder`, {
    params: {
      pageNumber: 1,
      pageSize: 500,
      createdStart: fmtDate(start),
      createdEnd: fmtDate(end)
    },
    headers: headers(),
    timeout: 15000
  });

  const map = new Map();
  const records = res?.data?.data?.records || [];
  for (const r of records) {
    const k = `${r.mchName || 'UNKNOWN'}|||${r.productName || 'UNKNOWN'}`;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/api/running-products', async (_, res) => {
  try {
    if (!PRODUCT_TOKEN) return res.status(500).json({ error: 'Missing PRODUCT_TOKEN' });

    const [statRecords, rateMap] = await Promise.all([
      fetchMchProductStatAll(),
      fetchRateMap()
    ]);

    const running = statRecords
      .filter(r => Number(r.totalOrderCount || 0) > 0 && Number(r.orderSuccessCount || 0) > 0)
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

    res.json({
      fetchedAt: new Date().toISOString(),
      rateWindowMinutes: RATE_WINDOW_MINUTES,
      merchantCount: Object.keys(grouped).length,
      pairCount: running.length,
      data: grouped
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on :${PORT}`);
});
