const { app, BrowserWindow, ipcMain, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');

// Same data folder in development and in installed builds (Linux: ~/.config/taskboard,
// Windows: %APPDATA%\taskboard, macOS: ~/Library/Application Support/taskboard).
app.setName('taskboard');
app.setPath('userData', path.join(app.getPath('appData'), 'taskboard'));
// Lets Linux desktops match the window to taskboard.desktop (and so to its icon).
if (process.platform === 'linux' && typeof app.setDesktopName === 'function') app.setDesktopName('taskboard.desktop');

// Use native Wayland when available, fall back to X11 otherwise.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');

const dataFile = () => path.join(app.getPath('userData'), 'data.json');
// Settings (including the private Schoology feed link) are kept apart from the task data.
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0f14',
    autoHideMenuBar: true,
    title: 'TaskBoard',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.VITE_DEV) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// Data lives in one JSON file, written atomically so a crash can't corrupt it.
ipcMain.handle('db:load', () => {
  try {
    return fs.readFileSync(dataFile(), 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('db:save', (_event, json) => {
  const file = dataFile();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, file);
  return true;
});

ipcMain.handle('settings:load', () => {
  try {
    return fs.readFileSync(settingsFile(), 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('settings:save', (_event, json) => {
  const file = settingsFile();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, json, { mode: 0o600 });
  fs.renameSync(tmp, file);
  return true;
});

// Downloads a calendar feed. Done here (not in the page) so browser CORS rules don't block it.
ipcMain.handle('ics:fetch', async (_event, rawUrl) => {
  const url = String(rawUrl).trim().replace(/^webcal:/i, 'https:');
  if (!/^https:\/\//i.test(url)) throw new Error('The link must start with webcal:// or https://');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await net.fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`The server answered with status ${res.status}`);
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That link did not return a calendar feed');
    return text;
  } finally {
    clearTimeout(timer);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());
