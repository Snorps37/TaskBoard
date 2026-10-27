<script>
  import { db, ui, settings, init, storage, loadSettings, syncSchoology, today, modalOpen, refreshDay } from './lib/db.svelte.js';
  import { applyTheme, resolveTheme } from './lib/theme.js';
  import { onMount, tick, untrack } from 'svelte';
  import Upcoming from './lib/Upcoming.svelte';
  import Calendar from './lib/Calendar.svelte';
  import TaskModal from './lib/TaskModal.svelte';
  import TagManager from './lib/TagManager.svelte';
  import SeriesManager from './lib/SeriesManager.svelte';
  import SchoologyModal from './lib/SchoologyModal.svelte';
  import PreferencesModal from './lib/PreferencesModal.svelte';
  import DragTray from './lib/DragTray.svelte';
  import CommandBar from './lib/CommandBar.svelte';
  import { VERSION } from './version.js';
  import { startReminders } from './lib/reminders.js';
  import { update, checkForUpdates, installUpdate } from './lib/updates.svelte.js';
  import { createHistory } from './lib/history.js';
  import { fade, fly } from 'svelte/transition';

  const history = createHistory();
  const historyKeys = ['boards', 'tasks', 'tags', 'series', 'dismissed', 'savedColors', 'collapsedGroups'];
  const snapshot = () => JSON.stringify(Object.fromEntries(historyKeys.map((key) => [key, db[key]])));
  $effect(() => {
    if (db.loaded) history.record(snapshot());
  });
  function restoreHistory(redo = false) {
    // Capture an action even if its reactive effect has not run yet.
    history.record(snapshot());
    const saved = redo ? history.redo() : history.undo();
    if (!saved) return;
    Object.assign(db, JSON.parse(saved));
    ui.editingId = null;
    ui.dragTaskId = null;
    ui.dragTagId = null;
    ui.toast = redo ? 'Redone' : 'Undone';
  }
  onMount(() => {
    function refresh() {
      const previous = today();
      if (refreshDay() && ui.dayBoard === previous) ui.dayBoard = today();
    }
    // Also catches clock changes and wake from sleep; focus refreshes immediately.
    const timer = setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  });

  let timer;
  let pending = null;

  // Start-up: settings first (theme, start page), then your data, then open the start page and sync Schoology.
  (async () => {
    await loadSettings();
    await init();
    openStartPage();
    syncSchoology();
  })();

  // Apply the chosen theme whenever it changes.
  $effect(() => {
    if (settings.loaded) applyTheme(resolveTheme(settings));
  });
  onMount(() => {
    const id = setInterval(syncSchoology, 60 * 60 * 1000);
    return () => clearInterval(id);
  });
  onMount(startReminders);

  // Desktop: tell the window whether closing it should keep the app running in the tray.
  $effect(() => {
    if (settings.loaded) window.api?.setKeepInTray(settings.keepInTray);
  });
  // Desktop: look for a new version shortly after start and every 6 hours.
  $effect(() => {
    if (!settings.loaded || !settings.autoUpdate) return;
    const first = setTimeout(() => checkForUpdates(true), 10 * 1000);
    const id = setInterval(() => checkForUpdates(true), 6 * 60 * 60 * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  });

  // Save a moment after the last change.
  $effect(() => {
    if (!db.loaded) return;
    pending = JSON.stringify(db);
    clearTimeout(timer);
    timer = setTimeout(flush, 250);
  });

  function flush() {
    clearTimeout(timer);
    if (pending) {
      storage.save(pending);
      pending = null;
    }
  }

  // ---- Drag safety ----
  // If a drag ends somewhere we never hear about (the dragged item vanished, or Esc was pressed),
  // clear it the next time the mouse moves. Mouse events don't fire during a real drag.
  let dragStarted = 0;
  $effect(() => {
    if (ui.dragTaskId || ui.dragTagId) dragStarted = Date.now();
  });
  function clearStuckDrag() {
    if ((ui.dragTaskId || ui.dragTagId) && Date.now() - dragStarted > 400) {
      ui.dragTaskId = null;
      ui.dragTagId = null;
    }
  }

  // Short confirmation message ("Moved to Tomorrow").
  $effect(() => {
    if (!ui.toast) return;
    const id = setTimeout(() => (ui.toast = ''), 2200);
    return () => clearTimeout(id);
  });

  // ---- Settings menu ----
  let menuOpen = $state(false);
  let menuEl = $state();
  const menuItems = [
    { label: 'Preferences', open: () => (ui.showPrefs = true) },
    { label: 'Repeating tasks', open: () => (ui.showSeries = true) },
    { label: 'Schoology', open: () => (ui.showSchoology = true) }
  ];
  function pick(item) {
    menuOpen = false;
    item.open();
  }
  function onWindowClick(e) {
    if (menuOpen && menuEl && !menuEl.contains(e.target)) menuOpen = false;
  }

  // ---- Back (mouse back button) ----
  // Remembers which page (tab + day board) you were on, like a browser history.
  const stack = [];
  let last = { view: ui.view, dayBoard: ui.dayBoard };
  let restoring = false;

  $effect(() => {
    const cur = { view: ui.view, dayBoard: ui.dayBoard };
    untrack(() => {
      // Stepping from one day to another replaces the page, so Back leaves the day board in one step.
      const dayToDay = cur.view === last.view && cur.dayBoard && last.dayBoard;
      if (!restoring && !dayToDay && (cur.view !== last.view || cur.dayBoard !== last.dayBoard)) {
        stack.push(last);
        if (stack.length > 50) stack.shift();
      }
      last = cur;
    });
  });

  // Back closes the top-most thing first: dialogs, the menu, the calendar side panel, then the previous page.
  function goBack() {
    if (ui.showCommand) ui.showCommand = false;
    else if (ui.editingId) ui.editingId = null;
    else if (ui.showTags) ui.showTags = false;
    else if (ui.showSeries) ui.showSeries = false;
    else if (ui.showSchoology) ui.showSchoology = false;
    else if (ui.showPrefs) ui.showPrefs = false;
    else if (menuOpen) menuOpen = false;
    else if (ui.view === 'calendar' && !ui.dayBoard && ui.selectedDay) ui.selectedDay = null;
    else if (stack.length) {
      const prev = stack.pop();
      restoring = true;
      ui.view = prev.view;
      ui.dayBoard = prev.dayBoard;
      tick().then(() => (restoring = false));
    }
  }

  // Which page the app opens on (Preferences, "When the app opens").
  // "Today's board" starts on today's board with the calendar one step back.
  function openStartPage() {
    restoring = true;
    if (settings.startup === 'board') {
      ui.view = 'board';
    } else if (settings.startup === 'calendar') {
      ui.view = 'calendar';
    } else {
      ui.view = 'calendar';
      ui.dayBoard = today();
      stack.push({ view: 'calendar', dayBoard: null });
    }
    tick().then(() => (restoring = false));
  }

  // Tab (or Ctrl+K) opens the command bar, unless you're typing somewhere or a dialog is open.
  function onKey(e) {
    if (e.key === 'Escape') menuOpen = false;
    const el = e.target;
    const typing =
      el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'checkbox'));
    const modifier = e.ctrlKey || e.metaKey;
    if (!typing && modifier && !e.altKey && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      restoreHistory(e.shiftKey || e.key.toLowerCase() === 'y');
      return;
    }
    if (modalOpen()) return;
    if (!typing && modifier && e.shiftKey && !e.altKey) {
      const key = e.key.toLowerCase();
      if (['t', 'u', 'c'].includes(key)) {
        e.preventDefault();
        ui.view = key === 'u' ? 'board' : 'calendar';
        ui.dayBoard = key === 't' ? today() : null;
        return;
      }
    }
    const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
    const tab = e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && !typing;
    if (ctrlK || tab) {
      e.preventDefault();
      menuOpen = false;
      ui.showCommand = true;
    }
  }

  function onMouseUp(e) {
    if (e.button === 3) {
      e.preventDefault();
      goBack();
    }
  }
</script>

<svelte:window
  onbeforeunload={flush}
  onclick={onWindowClick}
  onmouseup={onMouseUp}
  onmousemove={clearStuckDrag}
  ondragend={() => {
    ui.dragTaskId = null;
    ui.dragTagId = null;
  }}
  onmousedown={(e) => (e.button === 3 || e.button === 4) && e.preventDefault()}
  onkeydown={onKey} />

{#if db.loaded}
  <div class="app">
    <header>
      <div class="brand">
        <span>TaskBoard</span>
        <span class="version">v{VERSION}</span>
      </div>
      <nav class="tabs">
        <button class:active={ui.view === 'board'} onclick={() => (ui.view = 'board')}>Upcoming</button>
        <button class:active={ui.view === 'calendar'} onclick={() => { ui.view = 'calendar'; ui.dayBoard = null; }}>Calendar</button>
      </nav>
      <button class="ghost go" title="Go to a day or page, or add a task (Tab)" onclick={() => (ui.showCommand = true)}>
        Go to or add… <kbd>Tab</kbd>
      </button>
      <div class="spacer"></div>
      <div class="filters">
        {#each db.tags as t (t.id)}
          <button
            class="chip"
            class:off={ui.filterTagId && ui.filterTagId !== t.id}
            style:--c={t.color}
            title="Click to show only {t.name}. Drag onto a task to tag it."
            draggable="true"
            ondragstart={(e) => {
              ui.dragTagId = t.id;
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/plain', 'tag:' + t.id);
            }}
            ondragend={() => (ui.dragTagId = null)}
            onclick={() => (ui.filterTagId = ui.filterTagId === t.id ? null : t.id)}>{t.name}</button>
        {/each}
      </div>
      <button onclick={() => (ui.showTags = true)}>Edit tags</button>
      <div class="menu-wrap" bind:this={menuEl}>
        <button aria-haspopup="menu" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>Settings</button>
        {#if menuOpen}
          <div class="menu" role="menu" transition:fly={{ y: -6, duration: 120 }}>
            {#each menuItems as item (item.label)}
              <button class="ghost item" role="menuitem" onclick={() => pick(item)}>{item.label}</button>
            {/each}
          </div>
        {/if}
      </div>
    </header>

    <main>
      {#key ui.view}
        <div class="view" in:fade={{ duration: 140 }}>
          {#if ui.view === 'board'}
            <Upcoming />
          {:else}
            <Calendar />
          {/if}
        </div>
      {/key}
    </main>

    {#if ui.editingId}<TaskModal />{/if}
    {#if ui.showTags}<TagManager />{/if}
    {#if ui.showSeries}<SeriesManager />{/if}
    {#if ui.showSchoology}<SchoologyModal />{/if}
    {#if ui.showPrefs}<PreferencesModal />{/if}
    {#if ui.showCommand}<CommandBar />{/if}
    {#if ui.dragTaskId}<DragTray />{/if}
    {#if (update.state === 'downloading' || update.state === 'ready' || update.state === 'available') && !update.dismissed}
      <div class="update" role="status" in:fly={{ y: 12, duration: 160 }} out:fade={{ duration: 120 }}>
        {#if update.state === 'downloading'}
          <div class="download-status"><span>Downloading update · {update.percent}%</span><progress max="100" value={update.percent} aria-label="Update download progress"></progress></div>
        {:else if update.state === 'ready'}
          <span>TaskBoard {update.version} is ready. Restart to update.</span>
          <button class="primary" onclick={installUpdate}>Restart now</button>
        {:else}
          <span>TaskBoard {update.version} is out.</span>
          <button class="primary" onclick={() => window.open(update.url)}>Download</button>
        {/if}
        {#if update.state !== 'downloading'}<button class="ghost" onclick={() => (update.dismissed = true)}>Later</button>{/if}
      </div>
    {/if}
    {#if ui.toast}
      <div class="toast-wrap">
        <div class="toast" role="status" in:fly={{ y: 12, duration: 140 }} out:fade={{ duration: 120 }}>{ui.toast}</div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .app { height: 100%; display: flex; flex-direction: column; }
  header {
    flex: none;
    min-height: 64px;
    flex-wrap: wrap;
    padding-top: 10px;
    padding-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding-left: 24px;
    padding-right: 24px;
    border-bottom: 1px solid var(--border);
  }
  .brand { display: flex; align-items: baseline; gap: 8px; font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
  .version { font-size: 11px; font-weight: 400; color: var(--muted); opacity: 0.6; }
  .tabs { display: flex; gap: 4px; padding: 3px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  .tabs button { border: none; background: transparent; padding: 5px 14px; border-radius: 7px; color: var(--muted); }
  .tabs button:hover { background: var(--surface-2); color: var(--text); }
  .tabs button.active { background: var(--surface-3); color: var(--text); }
  .go { display: flex; align-items: center; gap: 8px; }
  .go kbd { font: inherit; font-size: 11px; padding: 0 5px; border: 1px solid var(--border-strong); border-radius: 4px; }
  .filters { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; max-width: min(40vw, 560px); }
  @media (max-width: 1100px) { .filters { order: 2; max-width: none; flex-basis: 100%; } header { gap: 10px; } }
  .download-status { display: grid; gap: 6px; min-width: 230px; }
  progress { width: 100%; height: 5px; accent-color: var(--accent); }
  .toast-wrap { position: fixed; left: 0; right: 0; bottom: 28px; display: flex; justify-content: center; pointer-events: none; z-index: 60; }
  .toast { padding: 8px 16px; background: var(--surface-3); border: 1px solid var(--border-strong); border-radius: 999px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4); }
  .update {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 55;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px 10px 16px;
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  }
  .menu-wrap { position: relative; }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 40;
    min-width: 190px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
  }
  .item { width: 100%; text-align: left; color: var(--text); border-radius: 8px; }
  main { flex: 1; min-height: 0; }
  .view { height: 100%; }
</style>
