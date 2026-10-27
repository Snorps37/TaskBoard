<script>
  import { ui, settings, saveSettings, uid, isDesktop } from './db.svelte.js';
  import { PRESETS, resolveTheme } from './theme.js';
  import { canNotify } from './reminders.js';
  import { update, checkForUpdates } from './updates.svelte.js';
  import { VERSION } from '../version.js';
  import { fade, scale } from 'svelte/transition';

  const FIELDS = [
    ['bg', 'Background'],
    ['surface', 'Cards and panels'],
    ['text', 'Text'],
    ['accent', 'Accent']
  ];

  const tiles = $derived([...PRESETS, ...settings.customThemes]);
  const current = $derived(resolveTheme(settings));
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

  const close = () => (ui.showPrefs = false);

  // ---- notifications ----
  const REMIND = [
    [-1, 'Off'],
    [0, 'At the time'],
    [5, '5 minutes before'],
    [10, '10 minutes before'],
    [15, '15 minutes before'],
    [30, '30 minutes before'],
    [60, '1 hour before']
  ];
  // Browsers ask before showing notifications; the desktop app is always allowed.
  let permission = $state(canNotify() ? Notification.permission : 'unsupported');
  async function allowNotifications() {
    permission = await Notification.requestPermission();
  }
  const canStartAtLogin = ['win32', 'darwin'].includes(window.api?.platform);

  const updateText = $derived(
    {
      checking: 'Checking…',
      none: "You're on the latest version.",
      downloading: `Downloading ${update.version}… ${update.percent}%`,
      ready: `${update.version} is ready. It installs when you restart.`,
      available: `${update.version} is out. This copy can't update itself, so download it from GitHub.`,
      error: `Could not check: ${update.message}`
    }[update.state] ?? ''
  );

  function choose(id) {
    settings.theme = id;
    saveSettings();
  }

  let saveTimer;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettings, 300);
  };

  // Makes a saved theme from a built-in or another saved theme, and switches to it.
  function createTheme(base, name) {
    const { bg, surface, text, accent, danger } = base;
    const t = { id: uid(), name, bg, surface, text, accent, ...(danger ? { danger } : {}) };
    settings.customThemes.push(t);
    settings.theme = t.id;
    saveSettings();
  }
  const newFromCurrent = () => createTheme(current, `Custom ${settings.customThemes.length + 1}`);

  function remove(t) {
    if (!confirm(`Delete the theme "${t.name}"?`)) return;
    const i = settings.customThemes.findIndex((x) => x.id === t.id);
    if (i >= 0) settings.customThemes.splice(i, 1);
    settings.theme = 'midnight';
    saveSettings();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()} transition:fade={{ duration: 120 }}>
  <div class="modal wide" transition:scale={{ start: 0.96, duration: 140 }}>
    <div class="row">
      <h3>Preferences</h3>
      <span class="spacer"></span>
      <button class="primary" onclick={close}>Done</button>
    </div>

    <div class="field">
      <span class="label">Theme</span>
      <div class="grid">
        {#each tiles as p (p.id)}
          <button class="tile" class:active={settings.theme === p.id} onclick={() => choose(p.id)}>
            <span class="preview" style:background={p.bg}>
              <i style:background={p.surface}></i>
              <b style:background={p.accent}></b>
            </span>
            <span class="name">{p.name}</span>
          </button>
        {/each}
        <button class="tile new" onclick={newFromCurrent}>
          <span class="plus">+</span>
          <span class="name">New theme</span>
        </button>
      </div>
    </div>

    <div class="field">
      {#each settings.customThemes.filter((t) => t.id === settings.theme) as t (t.id)}
        <span class="label">Edit this theme</span>
        <div class="editor">
          <input class="themename" aria-label="Theme name" bind:value={t.name} onchange={saveSettings} />
          {#each FIELDS as [key, label] (key)}
            <div class="crow">
              <span>{label}</span>
              <input
                type="color"
                aria-label={label}
                value={t[key]}
                oninput={(e) => {
                  t[key] = e.currentTarget.value;
                  saveSoon();
                }} />
              <input
                class="hex"
                maxlength="7"
                aria-label="{label} hex"
                value={t[key]}
                oninput={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (isHex(v)) {
                    t[key] = v.toLowerCase();
                    saveSoon();
                  }
                }} />
            </div>
          {/each}
          <div class="row">
            <button onclick={() => createTheme(t, `${t.name} copy`)}>Duplicate</button>
            <button class="ghost danger" onclick={() => remove(t)}>Delete theme</button>
          </div>
        </div>
      {:else}
        <p class="muted">
          {current.name} is a built-in theme. Make an editable copy to change its colors, or start a new theme with the + tile.
        </p>
        <div class="row">
          <button onclick={() => createTheme(current, `${current.name} copy`)}>Make an editable copy</button>
        </div>
      {/each}
    </div>

    <details class="shortcuts">
      <summary>Keyboard shortcuts and quick add</summary>
      <dl>
        <dt>Tab · Ctrl/Cmd+K</dt><dd>Go to a page, find or add a task</dd>
        <dt>Ctrl/Cmd+Z</dt><dd>Undo (text undo while typing)</dd>
        <dt>Ctrl/Cmd+Shift+Z · Ctrl/Cmd+Y</dt><dd>Redo</dd>
        <dt>Ctrl/Cmd+Shift+T</dt><dd>Today's board</dd>
        <dt>Ctrl/Cmd+Shift+U</dt><dd>Upcoming</dd>
        <dt>Ctrl/Cmd+Shift+C</dt><dd>Calendar</dd>
        <dt>Escape</dt><dd>Close a dialog or command bar</dd>
      </dl>
      <p class="muted">In quick add, type / for options. Use /tag personal, /color blue, /group "Study tasks", /date tomorrow or /time 4pm. Quote values containing spaces. Arrow keys choose suggestions; Tab or Enter completes; Enter adds the task after completing options.</p>
    </details>

    <div class="field">
      <span class="label">When the app opens</span>
      <select bind:value={settings.startup} onchange={saveSettings}>
        <option value="today">Today's board</option>
        <option value="board">Upcoming</option>
        <option value="calendar">Month calendar</option>
      </select>
    </div>

    <div class="field">
      <span class="label">Reminders for tasks with a time</span>
      <select bind:value={settings.remindBefore} onchange={saveSettings}>
        {#each REMIND as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
      <label class="check">
        <input
          type="checkbox"
          checked={!!settings.dailySummary}
          onchange={(e) => {
            settings.dailySummary = e.currentTarget.checked ? '08:00' : '';
            saveSettings();
          }} />
        <span>A morning list of the day's tasks at</span>
        <input type="time" class="time" disabled={!settings.dailySummary} bind:value={settings.dailySummary} onchange={saveSettings} />
      </label>
      {#if permission === 'default' || permission === 'denied'}
        <div class="row">
          <span class="muted">This browser needs your permission to show notifications.</span>
          <button onclick={allowNotifications} disabled={permission === 'denied'}>
            {permission === 'denied' ? 'Blocked in browser settings' : 'Allow notifications'}
          </button>
        </div>
      {:else if permission === 'unsupported'}
        <span class="muted">This browser can't show notifications.</span>
      {:else if !isDesktop}
        <small class="muted">Reminders only arrive while this tab is open.</small>
      {/if}
    </div>

    {#if isDesktop}
      <div class="field">
        <span class="label">Running in the background</span>
        <label class="check">
          <input type="checkbox" bind:checked={settings.keepInTray} onchange={saveSettings} />
          <span>Keep running in the tray when the window is closed, so reminders still arrive</span>
        </label>
        {#if canStartAtLogin}
          <label class="check">
            <input
              type="checkbox"
              bind:checked={settings.openAtLogin}
              onchange={() => {
                window.api.setOpenAtLogin(settings.openAtLogin);
                saveSettings();
              }} />
            <span>Start in the tray when I sign in</span>
          </label>
        {/if}
      </div>

      <div class="field">
        <span class="label">Updates</span>
        <div class="row">
          <span>Version {VERSION}</span>
          <span class="spacer"></span>
          <button
            onclick={() => checkForUpdates()}
            disabled={update.state === 'checking' || update.state === 'downloading' || update.state === 'ready'}>
            Check for updates
          </button>
        </div>
        {#if updateText}<span class="muted">{updateText}</span>{/if}
        <label class="check">
          <input type="checkbox" bind:checked={settings.autoUpdate} onchange={saveSettings} />
          <span>Check for updates automatically</span>
        </label>
      </div>
    {/if}

    <div class="field">
      <span class="label">Upcoming layout</span>
      <select bind:value={settings.upcomingLayout} onchange={saveSettings}>
        <option value="horizontal">Horizontal (a column for each day)</option>
        <option value="vertical">Vertical (one long list)</option>
      </select>
    </div>
  </div>
</div>

<style>
  .shortcuts { padding: 12px; border: 1px solid var(--border); border-radius: 10px; }
  summary { cursor: pointer; font-weight: 600; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 12px 0; font-size: 12px; }
  dd { color: var(--muted); }
  h3 { font-size: 17px; font-weight: 600; }
  .wide { width: min(640px, calc(100vw - 40px)); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
  .tile { display: flex; flex-direction: column; gap: 8px; align-items: stretch; padding: 8px; text-align: left; border-radius: 10px; }
  .tile.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .tile.new { justify-content: center; align-items: center; border-style: dashed; background: transparent; color: var(--muted); }
  .plus { font-size: 22px; line-height: 34px; }
  .preview { display: flex; align-items: center; gap: 5px; height: 34px; padding: 7px; border-radius: 6px; border: 1px solid var(--border); }
  .preview i { flex: 1; height: 100%; border-radius: 3px; }
  .preview b { width: 12px; height: 12px; border-radius: 50%; flex: none; }
  .name { font-size: 12px; }
  .editor { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; }
  .themename { font-weight: 600; }
  .crow { display: grid; grid-template-columns: 1fr 44px 96px; gap: 10px; align-items: center; }
  .crow input[type='color'] { width: 44px; height: 30px; padding: 2px; cursor: pointer; }
  .hex { font-variant-numeric: tabular-nums; }
  .check { display: flex; gap: 10px; align-items: flex-start; }
  .check .time { width: auto; padding: 2px 6px; margin-top: -3px; }
</style>
