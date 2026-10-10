<script>
  import { db, ui, addTask, currentBoard, matchesFilter, accentOf, tagById, tagTask, setTaskDone, fmtTime, byTime } from './db.svelte.js';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';

  const day = $derived(ui.selectedDay);
  const label = $derived(
    new Date(day + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  );
  const items = $derived(db.tasks.filter((t) => t.due === day && matchesFilter(t)).sort(byTime));
  const doneCount = $derived(items.filter((t) => t.done).length);

  let title = $state('');
  let tagOver = $state(null);

  const dragTag = $derived(db.tags.find((x) => x.id === ui.dragTagId));
  $effect(() => {
    if (!ui.dragTagId) tagOver = null;
  });

  // Drop a tag dragged from the top bar onto a task.
  function overItem(e, t) {
    if (!ui.dragTagId) return;
    e.preventDefault();
    tagOver = t.id;
  }
  function dropItem(e, t) {
    if (!ui.dragTagId) return;
    e.preventDefault();
    tagTask(t, ui.dragTagId);
    ui.dragTagId = null;
  }

  function add() {
    const text = title.trim();
    const column = currentBoard()?.columns[0];
    if (!text || !column) return;
    addTask({ title: text, due: day, columnId: column.id });
    title = '';
  }
</script>

<aside class="panel" in:fly={{ x: 30, duration: 170 }} out:fly={{ x: 30, duration: 120 }}>
  <div class="top">
    <div>
      <h3>{label}</h3>
      <p class="muted">
        {#if items.length}{doneCount} of {items.length} done{:else}Nothing planned yet{/if}
      </p>
    </div>
    <button class="ghost" aria-label="Close" onclick={() => (ui.selectedDay = null)}>✕</button>
  </div>

  {#if items.length}
    <div class="bar"><i style:width="{(doneCount / items.length) * 100}%"></i></div>
  {/if}

  <input placeholder="Add a task for this day" bind:value={title} onkeydown={(e) => e.key === 'Enter' && add()} />

  <ul>
    {#each items as t (t.id)}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <li
        class:tag-target={ui.dragTagId && tagOver === t.id}
        style:--c={accentOf(t) || 'var(--neutral)'}
        style:--tc={dragTag?.color ?? 'var(--accent)'}
        ondragover={(e) => overItem(e, t)}
        ondrop={(e) => dropItem(e, t)}
        animate:flip={{ duration: 150 }}
        in:fly={{ y: 6, duration: 130 }}>
        <input type="checkbox" aria-label="Done" checked={t.done} onchange={(e) => setTaskDone(t, e.currentTarget.checked)} />
        <button class="task" class:done={t.done} onclick={() => (ui.editingId = t.id)}>
          <span>{#if t.time}<small class="time">{fmtTime(t.time)}</small> {/if}{t.title || 'Untitled'}</span>
          {#if t.tagIds.length}
            <span class="tags">
              {#each t.tagIds as id (id)}
                {@const tg = tagById(id)}
                {#if tg}<span class="chip" style:--c={tg.color}>{tg.name}</span>{/if}
              {/each}
            </span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>

  {#if !items.length}
    <p class="empty muted">Type a task above and press Enter to add it to this day.</p>
  {/if}
</aside>

<style>
  .panel {
    width: 340px;
    flex: none;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 18px 24px 24px 0;
    padding: 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
  }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  h3 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
  .bar { height: 4px; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); transition: width 200ms ease; }

  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; min-height: 0; }
  li {
    --c: var(--neutral);
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--c);
    border-radius: 10px;
  }
  li.tag-target { outline: 2px solid var(--tc, var(--accent)); outline-offset: 1px; }
  .task { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 0; text-align: left; background: none; border: 0; border-radius: 0; overflow-wrap: anywhere; }
  .task:hover { background: none; }
  .task.done > span:first-child { text-decoration: line-through; color: var(--muted); }
  .time { color: var(--muted); font-variant-numeric: tabular-nums; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .empty { font-size: 13px; }
</style>
