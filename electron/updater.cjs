const { app, net } = require('electron');

const REPO = 'Snorps37/TaskBoard';

// electron-updater can replace the installed app (the Windows installer, or a Linux AppImage).
// The portable .exe and runs from source can't update themselves, so for those we only say a new version is out.
const canInstall =
  app.isPackaged &&
  !process.env.PORTABLE_EXECUTABLE_DIR &&
  (process.platform === 'win32' || (process.platform === 'linux' && !!process.env.APPIMAGE));

// state: idle | checking | none | downloading | ready | available | error
let status = { state: 'idle', canInstall };
let send = () => {};
let autoUpdater = null;

function set(next) {
  status = { ...next, canInstall };
  send(status);
}

function setup(onStatus) {
  send = onStatus;
  if (!canInstall) return;
  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => set({ state: 'none' }));
  autoUpdater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => set({ ...status, state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (e) => set({ state: 'error', message: String(e?.message ?? e).split('\n')[0] }));
}

// "0.10.0" > "0.9.2"
function newer(a, b) {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

// For builds that can't install updates: ask GitHub for the latest release and link to it.
async function checkLatest() {
  set({ state: 'checking' });
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) throw new Error(`GitHub answered with status ${res.status}`);
    const release = await res.json();
    const latest = String(release.tag_name).replace(/^v/, '');
    if (newer(latest, app.getVersion())) set({ state: 'available', version: latest, url: release.html_url });
    else set({ state: 'none' });
  } catch (e) {
    set({ state: 'error', message: String(e?.message ?? e) });
  }
}

// Automatic checks only run in packaged builds; "Check for updates" in Preferences works anywhere.
function check(auto) {
  if (auto && !app.isPackaged) return;
  if (['checking', 'downloading', 'ready'].includes(status.state)) return;
  if (autoUpdater) autoUpdater.checkForUpdates().catch(() => {}); // failures arrive through the 'error' event
  else checkLatest();
}

function install() {
  if (autoUpdater && status.state === 'ready') autoUpdater.quitAndInstall(true, true);
}

module.exports = { setup, check, install, getStatus: () => status };
