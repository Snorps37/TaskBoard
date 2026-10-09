<script>
  import { db, ui, ymd, today, matchesFilter, accentOf, extendSeries } from './db.svelte.js';
  import { untrack } from 'svelte';
  import DayPanel from './DayPanel.svelte';
  import Board from './Board.svelte';
  import { fly } from 'svelte/transition';

  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let cursor = $state(startOfMonth(new Date()));
  let dir = $state(1);

  const title = $derived(cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));

  const cells = $derived.by(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return { date, key: ymd(date), inMonth: date.getMonth() === cursor.getMonth() };
    });
  });

  const byDay = $derived.by(() => {
    const map = {};
    for (const t of db.tasks) {
      if (t.due && matchesFilter(t)) (map[t.due] ??= []).push(t);
    }
    return map;
  });

  // Make sure repeating tasks exist for every day on screen.
  $effect(() => {
    const end = cells[cells.length - 1].key;
    untrack(() => extendSeries(end));
  });

  function shift(n) {
    dir = n;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
  }
  function goToday() {
    const target = startOfMonth(new Date());
    dir = target > cursor ? 1 : -1;
    cursor = target;
    ui.selectedDay = today();
  }
</script>

{#if ui.dayBoard}
  <div class="dayview" in:fly={{ y: 12, duration: 170 }}>
    <Board day={ui.dayBoard} />
  </div>
{:else}
<div class="wrap">
  <div class="cal">
    <div class="head">
      <h2>{title}</h2>
      <div class="row">
        <button aria-label="Previous month" onclick={() => shift(-1)}>‹</button>
        <button onclick={goToday}>Today</button>
        <button aria-label="Next month" onclick={() => shift(1)}>›</button>
      </div>
    </div>

    <div class="weekdays">
      {#each weekdays as w}<span>{w}</span>{/each}
    </div>

    {#key cursor.getTime()}
      <div class="grid" in:fly={{ x: dir * 28, duration: 170 }}>
        {#each cells as c (c.key)}
          {@const list = byDay[c.key] ?? []}
          <button
            class="cell"
            class:muted={!c.inMonth}
            class:today={c.key === today()}
            class:selected={ui.selectedDay === c.key}
            title="Double-click to open this day as a board"
            onclick={() => (ui.selectedDay = c.key)}
            ondblclick={() => (ui.dayBoard = c.key)}>
            <span class="num">{c.date.getDate()}</span>
            <span class="items">
              {#each list.slice(0, 3) as t (t.id)}
                <span class="pill" class:done={t.done} style:--c={accentOf(t) || 'var(--neutral)'}>{t.title || 'Untitled'}</span>
              {/each}
              {#if list.length > 3}<span class="more">+{list.length - 3} more</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    {/key}
  </div>

  {#if ui.selectedDay}<DayPanel />{/if}
</div>
{/if}

<style>
  .dayview { height: 100%; }
  .wrap { height: 100%; display: flex; min-height: 0; }
  .cal { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 18px 24px 24px; }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
  .weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; padding: 0 4px 6px; color: var(--muted); font-size: 12px; }
  .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(6, 1fr); gap: 6px; }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    min-height: 0;
    padding: 8px;
    text-align: left;
    overflow: hidden;
    background: var(--surface);
    border-radius: 10px;
  }
  .cell:hover { background: var(--surface-2); }
  .cell.muted { opacity: 0.45; }
  .cell.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .cell.today .num { background: var(--accent); color: var(--on-accent); }

  .num { align-self: flex-start; min-width: 22px; height: 22px; padding: 0 5px; display: grid; place-items: center; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .items { display: flex; flex-direction: column; gap: 3px; min-height: 0; }
  .pill {
    --c: var(--neutral);
    padding: 1px 6px;
    font-size: 11px;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-radius: 5px;
    border-left: 3px solid var(--c);
    background: color-mix(in srgb, var(--c) 16%, transparent);
  }
  .pill.done { text-decoration: line-through; opacity: 0.55; }
  .more { padding-left: 6px; font-size: 11px; color: var(--muted); }
</style>
