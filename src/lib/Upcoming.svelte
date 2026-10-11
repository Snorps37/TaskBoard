<script>
  import { db, ui, today, addTask, currentBoard, matchesFilter, moveTaskToDay } from './db.svelte.js';
  import { buildOverview } from './overview.js';
  import TaskRow from './TaskRow.svelte';
  import { slide } from 'svelte/transition';

  const model = $derived(buildOverview(db.tasks, today(), matchesFilter));

  let title = $state('');
  let when = $state(today());
  let overKey = $state(null);
  let showAllLater = $state(false);

  const LATER_LIMIT = 12;
  const laterShown = $derived(showAllLater ? model.later : model.later.slice(0, LATER_LIMIT));

  const shortDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const dayName = (g) =>
    g.i === 0 ? 'Today' : g.i === 1 ? 'Tomorrow' : new Date(g.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'long' });
  const doneCount = (g) => g.items.filter((t) => t.done).length;

  $effect(() => {
    if (!ui.dragTaskId) overKey = null;
  });

  function add() {
    const text = title.trim();
    const column = currentBoard()?.columns[0];
    if (!text || !column) return;
    addTask({ title: text, due: when, columnId: column.id });
    title = '';
  }

  // Dropping a task on a day (or on "No date") reschedules just that task.
  function over(e, key) {
    if (!ui.dragTaskId) return;
    e.preventDefault();
    overKey = key;
  }
  function drop(e, date) {
    if (!ui.dragTaskId) return;
    e.preventDefault();
    moveTaskToDay(ui.dragTaskId, date);
    ui.dragTaskId = null;
    overKey = null;
  }

  function moveOverdueToToday() {
    for (const t of model.overdue) if (!t.seriesId) t.due = today();
  }
</script>

<div class="overview">
  <div class="inner">
    <div class="add">
      <input placeholder="Add a task" aria-label="Add a task" bind:value={title} onkeydown={(e) => e.key === 'Enter' && add()} />
      <input type="date" aria-label="Date (clear it for no date)" bind:value={when} />
      <button class="primary" disabled={!title.trim()} onclick={add}>Add</button>
    </div>

    {#if model.overdue.length}
      <section class="group overdue" in:slide={{ duration: 140 }}>
        <header>
          <h3>Overdue</h3>
          <span class="sub">{model.overdue.length}</span>
          <span class="spacer"></span>
          <button class="ghost" title="Moves one-off tasks to today. Repeating tasks stay where they are." onclick={moveOverdueToToday}>Move to today</button>
        </header>
        {#each model.overdue as t (t.id)}<TaskRow {t} showDate />{/each}
      </section>
    {/if}

    {#each model.days as g (g.date)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <section
        class="group"
        class:over={ui.dragTaskId && overKey === g.date}
        ondragover={(e) => over(e, g.date)}
        ondrop={(e) => drop(e, g.date)}>
        <header>
          <h3>{dayName(g)}</h3>
          <span class="sub">{shortDate(g.date)}</span>
          <span class="spacer"></span>
          {#if g.items.length}
            <span class="sub">
              {#if g.i === 0}{doneCount(g)} of {g.items.length} done{:else}{g.items.length} task{g.items.length === 1 ? '' : 's'}{/if}
            </span>
          {/if}
        </header>
        {#each g.items as t (t.id)}
          <TaskRow {t} />
        {:else}
          <p class="empty">Nothing planned</p>
        {/each}
      </section>
    {/each}

    {#if model.later.length}
      <section class="group">
        <header>
          <h3>Later</h3>
          <span class="sub">{model.later.length}</span>
        </header>
        {#each laterShown as t (t.id)}<TaskRow {t} showDate />{/each}
        {#if model.later.length > LATER_LIMIT}
          <button class="ghost more" onclick={() => (showAllLater = !showAllLater)}>
            {showAllLater ? 'Show fewer' : `Show all ${model.later.length}`}
          </button>
        {/if}
      </section>
    {/if}

    {#if model.undated.length || ui.dragTaskId}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <section
        class="group"
        class:over={ui.dragTaskId && overKey === 'none'}
        ondragover={(e) => over(e, 'none')}
        ondrop={(e) => drop(e, '')}>
        <header>
          <h3>No date</h3>
          <span class="sub">{model.undated.length}</span>
        </header>
        {#each model.undated as t (t.id)}
          <TaskRow {t} />
        {:else}
          <p class="empty">Drop here to remove a task's date</p>
        {/each}
      </section>
    {/if}
  </div>
</div>

<style>
  .overview { height: 100%; overflow-y: auto; }
  .inner { max-width: 860px; margin: 0 auto; padding: 18px 24px 48px; display: flex; flex-direction: column; gap: 14px; }

  .add { display: flex; gap: 10px; }
  .add input:first-child { flex: 1; min-width: 0; }

  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    transition: border-color var(--fast), background var(--fast);
  }
  .group.over { border-color: color-mix(in srgb, var(--accent) 60%, transparent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
  .group.overdue { border-color: color-mix(in srgb, var(--danger) 40%, var(--border)); }
  .group.overdue h3 { color: var(--danger); }

  header { display: flex; align-items: baseline; gap: 10px; padding: 0 2px; }
  h3 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  .sub { color: var(--muted); font-size: 12px; }
  .empty { color: var(--muted); font-size: 13px; padding: 2px; }
  .more { align-self: flex-start; }
</style>
