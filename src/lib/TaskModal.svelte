<script>
  import { db, ui, removeTask, toggleTag, pushSeries, describeSeries } from './db.svelte.js';
  import ColorPicker from './ColorPicker.svelte';
  import { fade, scale } from 'svelte/transition';

  // The modal is created fresh each time a task is opened, so a plain lookup is enough.
  const task = db.tasks.find((t) => t.id === ui.editingId);
  const board = db.boards.find((b) => b.columns.some((c) => c.id === task?.columnId));

  const series = task?.seriesId ? db.series.find((s) => s.id === task.seriesId) : null;
  let pushBy = $state(1);

  const close = () => (ui.editingId = null);
  function remove() {
    removeTask(task.id);
    close();
  }
  const focusEl = (node) => node.focus();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()} transition:fade={{ duration: 120 }}>
  <div class="modal" transition:scale={{ start: 0.96, duration: 140 }}>
    <input class="title-input" aria-label="Title" placeholder="Task title" use:focusEl bind:value={task.title} />

    <div class="field">
      <span class="label">Notes</span>
      <textarea rows="4" bind:value={task.notes}></textarea>
      {#if task.url}<a class="link" href={task.url} target="_blank" rel="noreferrer">Open in Schoology</a>{/if}
    </div>

    <div class="two">
      <div class="field">
        <span class="label">Due date</span>
        <div class="row">
          <input type="date" aria-label="Due date" bind:value={task.due} />
          {#if task.due}<button class="ghost" onclick={() => (task.due = '')}>Clear</button>{/if}
        </div>
      </div>
      <div class="field">
        <span class="label">Column</span>
        <select aria-label="Column" bind:value={task.columnId}>
          {#each board?.columns ?? [] as c (c.id)}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="field">
      <span class="label">Color</span>
      <ColorPicker bind:value={task.color} />
    </div>

    <div class="field">
      <span class="label">Tags</span>
      <div class="row">
        {#each db.tags as tg (tg.id)}
          <button class="chip" class:off={!task.tagIds.includes(tg.id)} style:--c={tg.color} onclick={() => toggleTag(task, tg.id)}>{tg.name}</button>
        {/each}
        {#if !db.tags.length}<span class="muted">No tags yet. Use Edit tags in the top bar to create some.</span>{/if}
      </div>
    </div>

    {#if series}
      <div class="field">
        <span class="label">Repeats: {describeSeries(series)}</span>
        <div class="row">
          <button onclick={() => { pushSeries(series.id, task.due, pushBy); close(); }}>Push this and later ones back</button>
          <input class="num" type="number" aria-label="Days to push" bind:value={pushBy} />
          <span class="muted">day(s)</span>
        </div>
      </div>
    {/if}

    <div class="row">
      <button class="danger" onclick={remove}>Delete task</button>
      <span class="spacer"></span>
      <button class="primary" onclick={close}>Done</button>
    </div>
  </div>
</div>

<style>
  .title-input { font-size: 18px; font-weight: 600; background: transparent; border-color: transparent; padding: 6px 8px; margin: -6px -8px; }
  .title-input:hover { border-color: var(--border); }
  .num { width: 72px; }
  .link { color: var(--accent); font-size: 13px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
</style>
