<script>
  import {
    db, ui, currentBoard, addTask, moveTask, addColumn, removeColumn, addBoard,
    matchesFilter, accentOf, tagById, today, showsOnBoard
  } from './db.svelte.js';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';

  // When `day` is set, this is the full board filtered to tasks due that day.
  let { day = null } = $props();

  const board = $derived(currentBoard());
  const dayLabel = $derived(
    day
      ? new Date(day + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      : ''
  );
  const inScope = (t) => (day ? t.due === day : showsOnBoard(t));

  let dragId = $state(null);
  let overCol = $state(null);
  let overCard = $state(null);
  let drafts = $state({});
  let newColumn = $state('');
  let newBoard = $state('');

  function quickAdd(col) {
    const title = (drafts[col.id] ?? '').trim();
    if (!title) return;
    addTask({ title, columnId: col.id, due: day ?? '' });
    drafts[col.id] = '';
  }

  function dragStart(e, t) {
    dragId = t.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', t.id);
  }
  function dragEnd() {
    dragId = null;
    overCol = null;
    overCard = null;
  }
  function cardOver(e, t) {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    overCol = t.columnId;
    overCard = t.id;
  }
  function colOver(e, col) {
    if (!dragId) return;
    e.preventDefault();
    overCol = col.id;
    overCard = null;
  }
  function drop(e, col) {
    e.preventDefault();
    if (dragId) moveTask(dragId, col.id, overCard && overCard !== dragId ? overCard : null);
    dragEnd();
  }

  function deleteColumn(col) {
    const n = db.tasks.filter((t) => t.columnId === col.id).length;
    if (n && !confirm(`Delete "${col.name}" and its ${n} task${n === 1 ? '' : 's'}?`)) return;
    removeColumn(col.id);
  }

  const dueLabel = (due) =>
    new Date(due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const isLate = (t) => t.due && !t.done && t.due < today();
</script>

<div class="board">
  {#if day}
    <div class="day-head">
      <button onclick={() => (ui.dayBoard = null)}>‹ Calendar</button>
      <h2>{dayLabel}</h2>
    </div>
  {:else}
  <div class="toolbar">
    <select aria-label="Board" bind:value={db.currentBoardId}>
      {#each db.boards as b (b.id)}
        <option value={b.id}>{b.name}</option>
      {/each}
    </select>
    <input
      placeholder="New board"
      bind:value={newBoard}
      onkeydown={(e) => {
        if (e.key === 'Enter' && newBoard.trim()) {
          addBoard(newBoard.trim());
          newBoard = '';
        }
      }} />
  </div>
  {/if}

  {#if board}
    <div class="columns">
      {#each board.columns as col (col.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <section
          class="col"
          class:over={dragId && overCol === col.id}
          ondragover={(e) => colOver(e, col)}
          ondrop={(e) => drop(e, col)}>
          <div class="col-head">
            <input class="col-name" aria-label="Column name" bind:value={col.name} />
            <span class="count">{db.tasks.filter((t) => t.columnId === col.id && inScope(t)).length}</span>
            {#if !day && board.columns.length > 1}
              <button class="ghost" title="Delete column" aria-label="Delete column" onclick={() => deleteColumn(col)}>✕</button>
            {/if}
          </div>

          <div class="cards">
            {#each db.tasks.filter((t) => t.columnId === col.id && matchesFilter(t) && inScope(t)) as t (t.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
              <article
                class="card"
                class:colored={!!accentOf(t)}
                class:done={t.done}
                class:dragging={dragId === t.id}
                class:before={dragId && overCard === t.id && dragId !== t.id}
                style:--c={accentOf(t) || '#3a4154'}
                draggable="true"
                ondragstart={(e) => dragStart(e, t)}
                ondragend={dragEnd}
                ondragover={(e) => cardOver(e, t)}
                onclick={() => (ui.editingId = t.id)}
                animate:flip={{ duration: 160 }}
                in:fly={{ y: 8, duration: 140 }}>
                <input type="checkbox" aria-label="Done" bind:checked={t.done} onclick={(e) => e.stopPropagation()} />
                <div class="body">
                  <span class="title">{t.title || 'Untitled'}</span>
                  {#if t.due || t.tagIds.length}
                    <div class="meta">
                      {#if t.due}<span class="due" class:late={isLate(t)}>{dueLabel(t.due)}</span>{/if}
                      {#each t.tagIds as id (id)}
                        {@const tg = tagById(id)}
                        {#if tg}<span class="chip" style:--c={tg.color}>{tg.name}</span>{/if}
                      {/each}
                    </div>
                  {/if}
                </div>
              </article>
            {/each}
          </div>

          <input
            class="quick"
            placeholder="Add a task"
            bind:value={drafts[col.id]}
            onkeydown={(e) => e.key === 'Enter' && quickAdd(col)} />
        </section>
      {/each}

      <div class="col add">
        <input
          placeholder="Add a column"
          bind:value={newColumn}
          onkeydown={(e) => {
            if (e.key === 'Enter' && newColumn.trim()) {
              addColumn(newColumn.trim());
              newColumn = '';
            }
          }} />
      </div>
    </div>
  {/if}
</div>

<style>
  .board { height: 100%; display: flex; flex-direction: column; }
  .toolbar { display: flex; gap: 10px; padding: 14px 24px 0; }
  .toolbar select { min-width: 160px; }
  .day-head { display: flex; align-items: center; gap: 14px; padding: 14px 24px 0; }
  .day-head h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
  .columns { flex: 1; min-height: 0; display: flex; gap: 16px; padding: 16px 24px 24px; overflow-x: auto; align-items: flex-start; }

  .col {
    width: 300px;
    flex: none;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    transition: border-color var(--fast), background var(--fast);
  }
  .col.over { border-color: color-mix(in srgb, var(--accent) 60%, transparent); background: color-mix(in srgb, var(--accent) 5%, var(--surface)); }
  .col.add { padding: 10px; background: transparent; border-style: dashed; }

  .col-head { display: flex; align-items: center; gap: 6px; padding: 12px 12px 6px; }
  .col-name { flex: 1; min-width: 0; background: transparent; border-color: transparent; font-weight: 600; padding: 4px 6px; }
  .col-name:hover { border-color: var(--border); }
  .count { color: var(--muted); font-size: 12px; }

  .cards { display: flex; flex-direction: column; gap: 8px; padding: 6px 10px; overflow-y: auto; min-height: 48px; }
  .quick { margin: 6px 10px 10px; }

  .card {
    --c: #3a4154;
    position: relative;
    display: flex;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: grab;
    transition: border-color var(--fast), box-shadow var(--fast), opacity var(--fast);
  }
  .card::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 3px; background: var(--c); }
  .card.colored { background: linear-gradient(90deg, color-mix(in srgb, var(--c) 14%, var(--surface-2)), var(--surface-2) 75%); }
  .card:hover { border-color: color-mix(in srgb, var(--c) 55%, var(--border)); }
  .card.dragging { opacity: 0.4; }
  .card.before { box-shadow: 0 -3px 0 0 var(--accent); }
  .card.done .title { text-decoration: line-through; color: var(--muted); }

  .body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .title { overflow-wrap: anywhere; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .due { font-size: 12px; color: var(--muted); }
  .due.late { color: var(--danger); }
</style>
