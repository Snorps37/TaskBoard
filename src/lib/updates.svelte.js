// Update status from the desktop app (see electron/updater.cjs). The web version is always current.
export const update = $state({ state: 'idle', canInstall: false, version: '', percent: 0, url: '', message: '', dismissed: false });

if (window.api?.onUpdateStatus) {
  const apply = (s) => Object.assign(update, s.state !== update.state ? { dismissed: false } : {}, { version: '', percent: 0, url: '', message: '' }, s);
  window.api.updateStatus().then(apply);
  window.api.onUpdateStatus(apply);
}

export const checkForUpdates = (auto = false) => window.api?.checkForUpdates(auto);
export const installUpdate = () => window.api?.installUpdate();
