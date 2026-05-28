// ============================================================
// EXPENSE//DIARY — Electron Main Process
// ============================================================
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// Hot Reloading (Development only)
try {
  require('electron-reloader')(module);
} catch (_) {}

// Data file lives in the user's home directory / expense-diary
const DATA_DIR  = path.join(os.homedir(), 'expense-diary-data');
const DATA_FILE = path.join(DATA_DIR, 'expenses.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Window ────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:  1280,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'icon.png'),
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Read data ────────────────────────────────────────
ipcMain.handle('load-data', async () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return { expenses: [], nextId: 1 };
    const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { expenses: [], nextId: 1 };
  }
});

// ── IPC: Write data ───────────────────────────────────────
ipcMain.handle('save-data', async (_event, data) => {
  try {
    await fs.promises.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── IPC: Export CSV ───────────────────────────────────────
ipcMain.handle('export-csv', async (_event, csvString) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Expenses',
    defaultPath: path.join(os.homedir(), 'my_expenses.csv'),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    await fs.promises.writeFile(filePath, csvString, 'utf8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── IPC: Get data file path (for status display) ──────────
ipcMain.handle('get-data-path', () => DATA_FILE);
