<script>
  import { db, ui, accentOf, tagById, setTaskDone, tagTask, fmtTime, today } from './db.svelte.js';
  import { fly } from 'svelte/transition';

  let { t, showDate = false, compact = false } = $props();

  let tagHover = $state(false);
  const dragTag = $derived(db.tags.find((x) => x.id === ui.dragTagId));
  $effect(() => {
    if (!ui.dragTagId) tagHover = false;
  });

  const overdue = $derived(!t.done && !!t.due && t.due < today());
  const dateLabel = $derived(
    t.due ? new Date(t.due + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : ''
  );

  // A tag dragged from the top bar can be dropped on a task.
  function tagOver(e) {
    if (!ui.dragTagId) return;
    e.preventDefault();
    e.stopPropagation();
    tagHover = true;
  }
  function tagDrop(e) {
    if (!ui.dragTagId) return;
    e.preventDefault();
    e.stopPropagation();
    tagTask(t, ui.dragTagId);
    ui.dragTagId = null;
    tagHover = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="item"
  class:compact
  class:done={t.done}
  class:overdue
  class:tag-target={tagHover}
  style:--c={accentOf(t) || 'var(--neutral)'}
  style:--tc={dragTag?.color ?? 'var(--accent)'}
  draggable="true"
  ondragstart={(e) => {
    ui.dragTaskId = t.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', t.id);
  }}
  ondragend={() => (ui.dragTaskId = null)}
  ondragover={tagOver}
  ondragleave={(e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) tagHover = false;
  }}
  ondrop={tagDrop}
  in:fly={{ y: 6, duration: 130 }}>
  <input type="checkbox" aria-label="Done" checked={t.done} onchange={(e) => setTaskDone(t, e.currentTarget.checked)} />
  <div
    class="title"
    role="button"
    tabindex="0"
    onclick={() => (ui.editingId = t.id)}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (ui.editingId = t.id))}>
    {#if t.time}<small class="time">{fmtTime(t.time)}</small>{/if}
    <span>{t.title || 'Untitled'}</span>
  </div>
  {#if overdue}<small class="overdue-label">Overdue</small>{/if}
  {#if showDate && dateLabel}<small class="date">{dateLabel}</small>{/if}
  {#if t.tagIds.length}
    <span class="tags">
      {#each t.tagIds as id (id)}
        {@const tg = tagById(id)}
        {#if tg}<span class="chip" style:--c={tg.color}>{tg.name}</span>{/if}
      {/each}
    </span>
  {/if}
</div>

<style>
  .item {
    --c: var(--neutral);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--c);
    border-radius: 10px;
    cursor: grab;
    transition: border-color var(--fast), opacity var(--fast);
  }
  .item.compact { flex-wrap: wrap; align-items: flex-start; }
  .item.compact .title { flex: 1 1 100px; }
  .item.compact .tags, .item.compact .date { flex-basis: 100%; padding-left: 26px; }
  .item:hover { border-color: color-mix(in srgb, var(--c) 55%, var(--border)); border-left-color: var(--c); }
  .item.tag-target { outline: 2px solid var(--tc, var(--accent)); outline-offset: 1px; }
  input[type='checkbox'] { margin-top: 0; }
  .title { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; cursor: pointer; overflow-wrap: anywhere; }
  .time { color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; padding: 2px 6px; border-radius: 5px; background: var(--surface-3); font-size: 11px; }
  .item.done { background: var(--surface); border-left-color: var(--neutral); }
  .item.done .tags, .item.done .time { opacity: 0.6; }
  .overdue-label { color: var(--danger); font-size: 11px; white-space: nowrap; }
  .item.overdue { border-top-color: color-mix(in srgb, var(--danger) 25%, var(--border)); }
  .item.done .title span { text-decoration: line-through; color: var(--muted); }
  .date { color: var(--muted); white-space: nowrap; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
