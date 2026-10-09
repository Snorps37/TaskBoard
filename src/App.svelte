<script>
  import { db, ui, init, storage, loadSettings, syncSchoology } from './lib/db.svelte.js';
  import { onMount, tick, untrack } from 'svelte';
  import Board from './lib/Board.svelte';
  import Calendar from './lib/Calendar.svelte';
  import TaskModal from './lib/TaskModal.svelte';
  import TagManager from './lib/TagManager.svelte';
  import SeriesManager from './lib/SeriesManager.svelte';
  import SchoologyModal from './lib/SchoologyModal.svelte';
  import { fade, fly } from 'svelte/transition';

  let timer;
  let pending = null;

  // Load data, then pull in Schoology (if connected) now and once an hour while the app is open.
  init().then(async () => {
    await loadSettings();
    syncSchoology();
  });
  onMount(() => {
    const id = setInterval(syncSchoology, 60 * 60 * 1000);
    return () => clearInterval(id);
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

  // ---- Settings menu ----
  let menuOpen = $state(false);
  let menuEl;
  const menuItems = [
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
      if (!restoring && (cur.view !== last.view || cur.dayBoard !== last.dayBoard)) {
        stack.push(last);
        if (stack.length > 50) stack.shift();
      }
      last = cur;
    });
  });

  // Back closes the top-most thing first: dialogs, the menu, the calendar side panel, then the previous page.
  function goBack() {
    if (ui.editingId) ui.editingId = null;
    else if (ui.showTags) ui.showTags = false;
    else if (ui.showSeries) ui.showSeries = false;
    else if (ui.showSchoology) ui.showSchoology = false;
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
  onmousedown={(e) => (e.button === 3 || e.button === 4) && e.preventDefault()}
  onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)} />

{#if db.loaded}
  <div class="app">
    <header>
      <div class="brand">TaskBoard</div>
      <nav class="tabs">
        <button class:active={ui.view === 'board'} onclick={() => (ui.view = 'board')}>Board</button>
        <button class:active={ui.view === 'calendar'} onclick={() => { ui.view = 'calendar'; ui.dayBoard = null; }}>Calendar</button>
      </nav>
      <div class="spacer"></div>
      <div class="filters">
        {#each db.tags as t (t.id)}
          <button
            class="chip"
            class:off={ui.filterTagId && ui.filterTagId !== t.id}
            style:--c={t.color}
            title="Show only {t.name}"
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
            <Board />
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
  </div>
{/if}

<style>
  .app { height: 100%; display: flex; flex-direction: column; }
  header {
    flex: none;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 24px;
    border-bottom: 1px solid var(--border);
  }
  .brand { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
  .tabs { display: flex; gap: 4px; padding: 3px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  .tabs button { border: none; background: transparent; padding: 5px 14px; border-radius: 7px; color: var(--muted); }
  .tabs button:hover { background: var(--surface-2); color: var(--text); }
  .tabs button.active { background: var(--surface-3); color: var(--text); }
  .filters { display: flex; gap: 6px; align-items: center; }
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
