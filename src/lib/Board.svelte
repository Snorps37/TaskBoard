<script>
  import {
    db, ui, currentBoard, addTask, moveTask, addColumn, removeColumn, addBoard,
    matchesFilter, accentOf, tagById, today, showsOnBoard, tagTask, setTaskDone, addDays, fmtTime, nowHM, modalOpen, moveTaskToDay,
    isCollapsed, toggleGroup, setGroupDone
  } from './db.svelte.js';
  import { groupTasks } from './overview.js';
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
  let tagOver = $state(null);

  const dragTag = $derived(db.tags.find((x) => x.id === ui.dragTagId));
  $effect(() => {
    if (!ui.dragTagId) tagOver = null;
  });
  // If the drag was ended elsewhere (dropped on the tray, say), reset this board's own drag state.
  $effect(() => {
    if (!ui.dragTaskId) {
      dragId = null;
      overCol = null;
      overCard = null;
    }
  });

  function quickAdd(col) {
    const title = (drafts[col.id] ?? '').trim();
    if (!title) return;
    addTask({ title, columnId: col.id, due: day ?? '' });
    drafts[col.id] = '';
  }

  function dragStart(e, t) {
    dragId = t.id;
    ui.dragTaskId = t.id; // shows the tray at the bottom
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', t.id);
  }
  function dragEnd() {
    ui.dragTaskId = null;
    dragId = null;
    overCol = null;
    overCard = null;
  }
  function cardOver(e, t) {
    if (ui.dragTagId) {
      e.preventDefault();
      e.stopPropagation();
      tagOver = t.id;
      return;
    }
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    overCol = t.columnId;
    overCard = t.id;
  }
  // A tag dragged from the top bar and dropped on a card. (Card drags are handled by the column.)
  function dropOnCard(e, t) {
    if (!ui.dragTagId) return;
    e.preventDefault();
    e.stopPropagation();
    tagTask(t, ui.dragTagId);
    ui.dragTagId = null;
  }
  function colOver(e, col) {
    if (!dragId) return;
    e.preventDefault();
    overCol = col.id;
    overCard = null;
  }
  function drop(e, col) {
    e.preventDefault();
    if (dragId) {
      moveTask(dragId, col.id, overCard && overCard !== dragId ? overCard : null);
      if (day) moveTaskToDay(dragId, day); // dropping into this day's board schedules it for this day
    }
    dragEnd();
  }

  function deleteColumn(col) {
    const n = db.tasks.filter((t) => t.columnId === col.id).length;
    if (n && !confirm(`Delete "${col.name}" and its ${n} task${n === 1 ? '' : 's'}?`)) return;
    removeColumn(col.id);
  }

  const dueLabel = (due) =>
    new Date(due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const isLate = (t) => t.due && !t.done && (t.due < today() || (t.due === today() && t.time && t.time < nowHM()));

  // ---- stepping between days (day board only) ----
  let dir = $state(1);
  function go(n) {
    dir = n;
    ui.dayBoard = addDays(day, n);
    ui.selectedDay = ui.dayBoard;
  }
  // Drop a card on an arrow to move it one day; hold it there to flip to that day and drop it anywhere.
  let navTimer = null;
  function arrowOver(e, n) {
    if (!dragId) return;
    e.preventDefault();
    if (!navTimer) {
      navTimer = setTimeout(() => {
        navTimer = null;
        go(n);
      }, 650);
    }
  }
  function arrowLeave() {
    clearTimeout(navTimer);
    navTimer = null;
  }
  function arrowDrop(e, n) {
    if (!dragId) return;
    e.preventDefault();
    arrowLeave();
    moveTaskToDay(dragId, addDays(day, n));
    dragEnd();
  }

  function goToday() {
    dir = day < today() ? 1 : -1;
    ui.dayBoard = today();
    ui.selectedDay = ui.dayBoard;
  }
  // Left and right arrow keys step a day, unless you're typing or a dialog is open.
  function onKey(e) {
    if (!day || modalOpen() || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const el = e.target;
    const typing =
      el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'checkbox'));
    if (typing) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="board">
  {#if day}
    <div class="day-head">
      <button onclick={() => (ui.dayBoard = null)}>‹ Calendar</button>
      <div class="stepper">
        <button
          class="ghost"
          class:hint={dragId}
          aria-label="Previous day"
          title="Previous day (left arrow key). Drop a card here to move it to the previous day."
          onclick={() => go(-1)}
          ondragover={(e) => arrowOver(e, -1)}
          ondragleave={arrowLeave}
          ondrop={(e) => arrowDrop(e, -1)}>‹</button>
        <h2>{dayLabel}</h2>
        <button
          class="ghost"
          class:hint={dragId}
          aria-label="Next day"
          title="Next day (right arrow key). Drop a card here to move it to the next day."
          onclick={() => go(1)}
          ondragover={(e) => arrowOver(e, 1)}
          ondragleave={arrowLeave}
          ondrop={(e) => arrowDrop(e, 1)}>›</button>
      </div>
      <button disabled={day === today()} onclick={goToday}>Today</button>
      {#if db.boards.length > 1}
        <select aria-label="Board" bind:value={db.currentBoardId}>
          {#each db.boards as b (b.id)}
            <option value={b.id}>{b.name}</option>
          {/each}
        </select>
      {/if}
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
    {#key day}
    <div class="columns" in:fly={{ x: dir * 28, duration: 150 }}>
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
            {#if board.columns.length > 1}
              <button class="ghost" title="Delete column" aria-label="Delete column" onclick={() => deleteColumn(col)}>✕</button>
            {/if}
          </div>

          <div class="cards">
            {#each groupTasks(db.tasks.filter((t) => t.columnId === col.id && matchesFilter(t) && inScope(t))) as e (e.key)}
              <div class="entry" animate:flip={{ duration: 160 }}>
                {#if e.group}
                  {@render groupCard(e)}
                {:else}
                  {@const t = e.task}
                  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
                  <article
                    class="card"
                    class:colored={!!accentOf(t)}
                    class:done={t.done}
                    class:dragging={dragId === t.id}
                    class:before={dragId && overCard === t.id && dragId !== t.id}
                    class:tag-target={ui.dragTagId && tagOver === t.id}
                    style:--c={accentOf(t) || 'var(--neutral)'}
                    style:--tc={dragTag?.color ?? 'var(--accent)'}
                    draggable="true"
                    ondragstart={(e) => dragStart(e, t)}
                    ondragend={dragEnd}
                    ondragover={(e) => cardOver(e, t)}
                    ondrop={(e) => dropOnCard(e, t)}
                    onclick={() => (ui.editingId = t.id)}
                    in:fly={{ y: 8, duration: 140 }}>
                    <input
                      type="checkbox"
                      aria-label="Done"
                      checked={t.done}
                      onchange={(e) => setTaskDone(t, e.currentTarget.checked)}
                      onclick={(e) => e.stopPropagation()} />
                    <div class="body">
                      <span class="title">{t.title || 'Untitled'}</span>
                      {#if (t.due && (!day || t.time)) || t.tagIds.length}
                        <div class="meta">
                          {#if t.due && (!day || t.time)}
                            <span class="due" class:late={isLate(t)}>{#if !day}{dueLabel(t.due)}{/if}{#if !day && t.time}, {/if}{#if t.time}{fmtTime(t.time)}{/if}</span>
                          {/if}
                          {#each t.tagIds as id (id)}
                            {@const tg = tagById(id)}
                            {#if tg}<span class="chip" style:--c={tg.color}>{tg.name}</span>{/if}
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </article>
                {/if}
              </div>
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
    {/key}
  {/if}
</div>

<!-- Tasks that share a group name: one card, with each task as a line you can check, open, or drag on its own. -->
{#snippet groupCard(g)}
  {@const done = g.items.filter((t) => t.done).length}
  {@const open = !isCollapsed(g.group)}
  {@const first = g.items[0]}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="card group"
    class:colored={!!accentOf(first)}
    class:done={done === g.items.length}
    class:before={dragId && overCard === first.id && !g.items.some((t) => t.id === dragId)}
    style:--c={accentOf(first) || 'var(--neutral)'}
    ondragover={(e) => cardOver(e, first)}
    in:fly={{ y: 8, duration: 140 }}>
    <input
      type="checkbox"
      aria-label="All of {g.group} done"
      checked={done === g.items.length}
      onchange={(e) => setGroupDone(g.items, e.currentTarget.checked)} />
    <div class="body">
      <button class="group-head" aria-expanded={open} title={open ? 'Fold up' : 'Show tasks'} onclick={() => toggleGroup(g.group)}>
        <span class="chev" class:open>›</span>
        <span class="title">{g.group}</span>
        <span class="count">{done}/{g.items.length}</span>
      </button>
      {#if open}
        <ul class="members">
          {#each g.items as t (t.id)}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <li
              class:done={t.done}
              class:dragging={dragId === t.id}
              class:before={dragId && overCard === t.id && dragId !== t.id && t.id !== first.id}
              draggable="true"
              ondragstart={(e) => {
                e.stopPropagation();
                dragStart(e, t);
              }}
              ondragend={dragEnd}
              ondragover={(e) => cardOver(e, t)}>
              <input type="checkbox" aria-label="Done" checked={t.done} onchange={(e) => setTaskDone(t, e.currentTarget.checked)} />
              <button class="m-title" onclick={() => (ui.editingId = t.id)}>
                {#if t.time && (!day || t.due === day)}<small class="due" class:late={isLate(t)}>{fmtTime(t.time)}</small>{/if}
                <span>{t.title || 'Untitled'}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/snippet}

<style>
  .board { height: 100%; display: flex; flex-direction: column; }
  .toolbar { display: flex; gap: 10px; padding: 14px 24px 0; }
  .toolbar select { min-width: 160px; }
  .day-head { display: flex; align-items: center; gap: 14px; padding: 14px 24px 0; }
  .day-head h2 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; min-width: 15em; text-align: center; }
  .stepper { display: flex; align-items: center; gap: 4px; }
  .stepper button { font-size: 18px; padding: 2px 12px; }
  .stepper button.hint { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--text); }
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
    --c: var(--neutral);
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
  .card.tag-target { outline: 2px solid var(--tc, var(--accent)); outline-offset: 1px; }
  .card.done .title { text-decoration: line-through; color: var(--muted); }

  .body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .title { overflow-wrap: anywhere; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .due { font-size: 12px; color: var(--muted); }
  .due.late { color: var(--danger); }

  .card.group { cursor: default; }
  .card.group > input[type='checkbox'] { margin-top: 4px; }
  .card.group .body { flex: 1; }
  .group-head { display: flex; align-items: center; gap: 8px; padding: 0; text-align: left; background: none; border: 0; border-radius: 0; }
  .group-head:hover { background: none; }
  .group-head:active { transform: none; }
  .group-head .title { font-weight: 600; }
  .group-head .count { margin-left: auto; }
  .chev { color: var(--muted); display: inline-block; width: 10px; transition: transform var(--fast); }
  .chev.open { transform: rotate(90deg); }
  .members { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .members li { display: flex; align-items: center; gap: 8px; padding: 3px 6px; margin: 0 -6px; border-radius: 6px; cursor: grab; }
  .members li:hover { background: color-mix(in srgb, var(--text) 5%, transparent); }
  .members li.dragging { opacity: 0.4; }
  .members li.before { box-shadow: 0 -2px 0 0 var(--accent); }
  .members li input[type='checkbox'] { margin-top: 0; }
  .members li.done span { text-decoration: line-through; color: var(--muted); }
  .m-title { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; padding: 0; text-align: left; background: none; border: 0; border-radius: 0; overflow-wrap: anywhere; }
  .m-title:hover { background: none; }
  .m-title:active { transform: none; }
</style>
