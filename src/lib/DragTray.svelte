<script>
  import { db, ui, today, moveTaskToDay } from './db.svelte.js';
  import { trayTiles } from './overview.js';
  import { fly } from 'svelte/transition';

  let over = $state(null);

  const task = $derived(db.tasks.find((t) => t.id === ui.dragTaskId));
  const tiles = $derived(trayTiles(today(), task?.due ?? ''));

  const dateOf = (d) => new Date(d + 'T00:00');
  const short = (d) => dateOf(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const weekday = (d) => dateOf(d).toLocaleDateString(undefined, { weekday: 'short' });
  const label = (t) =>
    t.kind === 'none' ? 'No date' : t.kind === 'week' ? '+1 week' : t.i === 0 ? 'Today' : t.i === 1 ? 'Tomorrow' : weekday(t.date);
  const sub = (t) => (t.kind === 'none' ? 'remove date' : short(t.date));
  const message = (t) =>
    t.kind === 'none'
      ? 'Date removed'
      : t.kind === 'day' && t.i <= 1
        ? `Moved to ${label(t)}`
        : `Moved to ${weekday(t.date)}, ${short(t.date)}`;

  function drop(e, t) {
    e.preventDefault();
    if (!ui.dragTaskId) return;
    moveTaskToDay(ui.dragTaskId, t.date);
    ui.toast = message(t);
    ui.dragTaskId = null;
    over = null;
  }
</script>

<div class="wrap">
  <div class="tray" in:fly={{ y: 24, duration: 140 }} out:fly={{ y: 24, duration: 100 }}>
    <span class="hint">Move to</span>
    {#each tiles as t (t.key)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="tile"
        class:over={over === t.key}
        class:far={t.kind !== 'day'}
        ondragover={(e) => {
          e.preventDefault();
          over = t.key;
        }}
        ondragleave={() => over === t.key && (over = null)}
        ondrop={(e) => drop(e, t)}>
        <b>{label(t)}</b>
        <small>{sub(t)}</small>
      </div>
    {/each}
  </div>
</div>

<style>
  .wrap { position: fixed; left: 0; right: 0; bottom: 16px; display: flex; justify-content: center; pointer-events: none; z-index: 45; }
  .tray {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100vw - 32px);
    padding: 10px 12px;
    overflow-x: auto;
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(10px);
    border: 1px solid var(--border-strong);
    border-radius: 16px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }
  .hint { color: var(--muted); font-size: 12px; padding: 0 4px; white-space: nowrap; }
  .tile {
    flex: none;
    min-width: 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 10px;
    background: var(--surface-2);
    border: 1px dashed var(--border-strong);
    border-radius: 10px;
    transition: background var(--fast), border-color var(--fast), transform var(--fast);
  }
  .tile > * { pointer-events: none; }
  .tile b { font-weight: 600; white-space: nowrap; }
  .tile small { color: var(--muted); font-size: 11px; white-space: nowrap; }
  .tile.far { background: transparent; }
  .tile.over { border-style: solid; border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, var(--surface-2)); transform: translateY(-3px); }
</style>
