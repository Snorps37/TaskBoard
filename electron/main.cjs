const { app, BrowserWindow, ipcMain, shell, net, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const updater = require('./updater.cjs');
const { saveData } = require('./persistence.cjs');

// Same data folder in development and in installed builds (Linux: ~/.config/taskboard,
// Windows: %APPDATA%\taskboard, macOS: ~/Library/Application Support/taskboard).
app.setName('taskboard');
app.setPath('userData', path.join(app.getPath('appData'), 'taskboard'));
// Lets Linux desktops match the window to taskboard.desktop (and so to its icon).
if (process.platform === 'linux' && typeof app.setDesktopName === 'function') app.setDesktopName('taskboard.desktop');

// Use native Wayland when available, fall back to X11 otherwise.
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
// Windows only shows notifications for an app with an ID, and it must match the installer's shortcut (appId).
if (process.platform === 'win32') app.setAppUserModelId('com.taskboard.app');

const dataFile = () => path.join(app.getPath('userData'), 'data.json');
// Settings (including the private Schoology feed link) are kept apart from the task data.
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

const iconPath = path.join(__dirname, '..', 'build', 'icon.png');

let win = null;
let tray = null;
let keepInTray = false; // set from Preferences: closing the window hides it so reminders keep coming
let quitting = false;
// Started by "Open when I sign in": stay in the tray until clicked.
const startHidden = process.argv.includes('--hidden');

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function ensureTray() {
  if (tray) return;
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 }));
  tray.setToolTip('TaskBoard');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open TaskBoard', click: showWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
  tray.on('click', showWindow);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0f14',
    autoHideMenuBar: true,
    title: 'TaskBoard',
    show: !startHidden,
    icon: iconPath,
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

  win.on('close', (e) => {
    if (keepInTray && !quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => (win = null));

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
  saveData(dataFile(), json);
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

// ---- background, sign-in and updates ----
ipcMain.handle('app:keepInTray', (_event, value) => {
  keepInTray = !!value;
  if (keepInTray) ensureTray();
  else if (tray && !startHidden) {
    tray.destroy();
    tray = null;
  }
});

ipcMain.handle('app:openAtLogin', (_event, value) => {
  if (!app.isPackaged) return; // a dev run would register the bare Electron binary
  app.setLoginItemSettings({
    openAtLogin: !!value,
    path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
    args: ['--hidden']
  });
});

// Clicking a reminder brings the window back, even from the tray.
ipcMain.handle('win:show', () => showWindow());

ipcMain.handle('update:status', () => updater.getStatus());
ipcMain.handle('update:check', (_event, auto) => updater.check(!!auto));
ipcMain.handle('update:install', () => updater.install());

// Opening TaskBoard again while it's already running (say, from the tray) shows the open window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    updater.setup((status) => win?.webContents.send('update:status', status));
    if (startHidden) ensureTray();
    createWindow();
  });
}

app.on('before-quit', () => (quitting = true));
app.on('window-all-closed', () => app.quit());
