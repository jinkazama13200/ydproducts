const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  win.loadFile(indexPath);

  // Debug helpers for white-screen issues on packaged builds
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load:', code, desc, url);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('render-process-gone:', details);
  });

  if (process.env.ELECTRON_DEBUG === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function todayRange() {
  const n = new Date();
  const day = `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
  return { start: `${day} 00:00:00`, end: `${day} 23:59:59` };
}

async function fetchRunningProducts(cfg) {
  const PRODUCT_API_BASE = (cfg.apiBase || '').trim();
  const PRODUCT_ORIGIN = (cfg.origin || '').trim();
  const PRODUCT_TOKEN = (cfg.token || '').trim();
  const MAX_PAGES = Number(cfg.maxPages || 20);
  const RATE_WINDOW_MINUTES = Number(cfg.rateWindowMinutes || 5);

  if (!PRODUCT_API_BASE || !PRODUCT_ORIGIN || !PRODUCT_TOKEN) {
    throw new Error('Thiếu apiBase/origin/token');
  }

  const headers = {
    accept: 'application/json, text/plain, */*',
    itoken: PRODUCT_TOKEN,
    origin: PRODUCT_ORIGIN,
    referer: `${PRODUCT_ORIGIN}/`,
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty'
  };

  const { start, end } = todayRange();
  const pageSize = 100;
  const first = await axios.get(`${PRODUCT_API_BASE}/api/mchProductStat`, {
    params: { pageNumber: 1, pageSize, createdStart: start, createdEnd: end },
    headers,
    timeout: 15000
  });
  if (first?.data?.code !== 0) throw new Error('mchProductStat failed');

  let statRecords = first.data?.data?.records || [];
  const total = Number(first.data?.data?.total || statRecords.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagesToFetch = Math.min(totalPages, MAX_PAGES);

  for (let page = 2; page <= pagesToFetch; page++) {
    const res = await axios.get(`${PRODUCT_API_BASE}/api/mchProductStat`, {
      params: { pageNumber: page, pageSize, createdStart: start, createdEnd: end },
      headers,
      timeout: 15000
    });
    statRecords = statRecords.concat(res?.data?.data?.records || []);
  }

  const now = new Date();
  const from = new Date(now.getTime() - RATE_WINDOW_MINUTES * 60 * 1000);
  const pay = await axios.get(`${PRODUCT_API_BASE}/api/payOrder`, {
    params: {
      pageNumber: 1,
      pageSize: 500,
      createdStart: fmtDate(from),
      createdEnd: fmtDate(now)
    },
    headers,
    timeout: 15000
  });

  const rateMap = new Map();
  for (const r of (pay?.data?.data?.records || [])) {
    const k = `${r.mchName || 'UNKNOWN'}|||${r.productName || 'UNKNOWN'}`;
    rateMap.set(k, (rateMap.get(k) || 0) + 1);
  }

  const running = statRecords
    .filter(r => Number(r.totalOrderCount || 0) > 0 && Number(r.orderSuccessCount || 0) > 0)
    .map(r => ({
      merchant: r.mchName || 'UNKNOWN',
      product: r.productName || 'UNKNOWN',
      ordersInWindow: rateMap.get(`${r.mchName || 'UNKNOWN'}|||${r.productName || 'UNKNOWN'}`) || 0
    }));

  const grouped = {};
  for (const row of running) {
    if (!grouped[row.merchant]) grouped[row.merchant] = [];
    grouped[row.merchant].push(row);
  }

  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => b.ordersInWindow - a.ordersInWindow);
  }

  return {
    fetchedAt: new Date().toISOString(),
    rateWindowMinutes: RATE_WINDOW_MINUTES,
    merchantCount: Object.keys(grouped).length,
    pairCount: running.length,
    data: grouped
  };
}

ipcMain.handle('get-running-products', async (_, cfg) => {
  return fetchRunningProducts(cfg || {});
});

ipcMain.handle('check-updates-now', async () => {
  manualUpdateCheck = true;
  await autoUpdater.checkForUpdates();
  return true;
});

let manualUpdateCheck = false;

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', async (info) => {
    const r = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Update now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update available',
      message: `Có bản mới ${info?.version || ''}. Cập nhật ngay?`
    });
    if (r.response === 0) autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-downloaded', async () => {
    const r = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Install & Restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: 'Bản cập nhật đã tải xong. Cài đặt và khởi động lại ngay?'
    });
    manualUpdateCheck = false;
    if (r.response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('update-not-available', async () => {
    if (!manualUpdateCheck) return;
    manualUpdateCheck = false;
    await dialog.showMessageBox({
      type: 'info',
      buttons: ['OK'],
      title: 'No update',
      message: 'Hiện tại bạn đang ở bản mới nhất.'
    });
  });

  autoUpdater.on('error', async (e) => {
    console.error('autoUpdater error:', e?.message || e);
    if (manualUpdateCheck) {
      manualUpdateCheck = false;
      await dialog.showMessageBox({
        type: 'error',
        buttons: ['OK'],
        title: 'Update error',
        message: `Không kiểm tra được cập nhật: ${e?.message || e}`
      });
    }
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  createWindow();
  if (!process.env.ELECTRON_DEBUG) setupAutoUpdater();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
