<script>
  import {
    db, ui, today, addSeries, removeSeries, pushSeries, describeSeries, toggleTag, WEEKDAYS
  } from './db.svelte.js';
  import ColorPicker from './ColorPicker.svelte';
  import { fade, scale, slide } from 'svelte/transition';

  const blank = () => ({
    title: '',
    rule: 'daily',
    every: 2,
    days: [],
    stepsText: '',
    start: today(),
    until: '',
    color: '',
    tagIds: []
  });

  let adding = $state(db.series.length === 0);
  let draft = $state(blank());
  let error = $state('');
  let pushBy = $state(1);

  const close = () => (ui.showSeries = false);

  function nextDue(s) {
    const now = today();
    return db.tasks
      .filter((t) => t.seriesId === s.id && !t.done && t.due >= now)
      .map((t) => t.due)
      .sort()[0];
  }
  const dayLabel = (d) =>
    d ? new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'none upcoming';

  function toggleDay(i) {
    const k = draft.days.indexOf(i);
    if (k >= 0) draft.days.splice(k, 1);
    else draft.days.push(i);
  }

  function create() {
    const title = draft.title.trim();
    if (!title) {
      error = 'Give it a name.';
      return;
    }
    const s = {
      title,
      rule: draft.rule,
      start: draft.start || today(),
      until: draft.until,
      color: draft.color,
      tagIds: [...draft.tagIds]
    };
    if (draft.rule === 'every') s.every = Math.max(1, Math.trunc(Number(draft.every)) || 1);
    if (draft.rule === 'weekdays') {
      if (!draft.days.length) {
        error = 'Pick at least one weekday.';
        return;
      }
      s.days = [...draft.days];
    }
    if (draft.rule === 'cycle') {
      const steps = draft.stepsText.split(',').map((x) => x.trim()).map((x) => (x === '-' ? '' : x));
      if (steps.length < 2 || steps.every((x) => !x)) {
        error = 'List at least two steps, separated by commas.';
        return;
      }
      s.steps = steps;
    }
    addSeries(s);
    draft = blank();
    error = '';
    adding = false;
  }

  function del(s) {
    if (confirm(`Delete "${s.title}"? Upcoming unfinished tasks in it are removed. Finished and past ones stay.`)) {
      removeSeries(s.id);
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()} transition:fade={{ duration: 120 }}>
  <div class="modal wide" transition:scale={{ start: 0.96, duration: 140 }}>
    <div class="row">
      <h3>Repeating tasks</h3>
      <span class="spacer"></span>
      <button class="primary" onclick={close}>Done</button>
    </div>

    {#if db.series.length}
      <div class="row pushrow">
        <span class="muted">Missed a day? Push a schedule back by</span>
        <input class="num" type="number" aria-label="Days to push" bind:value={pushBy} />
        <span class="muted">day(s)</span>
      </div>
    {/if}

    {#each db.series as s (s.id)}
      <div class="series" style:--c={s.color || 'var(--neutral)'}>
        <div class="info">
          <strong>{s.title}</strong>
          <span class="muted">{describeSeries(s)}</span>
          <span class="muted">Next: {dayLabel(nextDue(s))}</span>
        </div>
        <div class="row">
          <button onclick={() => pushSeries(s.id, today(), pushBy)}>Push back from today</button>
          <button class="ghost danger" onclick={() => del(s)}>Delete</button>
        </div>
      </div>
    {/each}

    {#if !adding}
      <button onclick={() => (adding = true)}>New repeating task</button>
    {:else}
      <div class="form" transition:slide={{ duration: 140 }}>
        <div class="field">
          <span class="label">Name</span>
          <input bind:value={draft.title} placeholder="Workout, Vitamins, Laundry" />
        </div>

        <div class="two">
          <div class="field">
            <span class="label">Repeats</span>
            <select bind:value={draft.rule}>
              <option value="daily">Every day</option>
              <option value="every">Every few days</option>
              <option value="weekdays">On certain weekdays</option>
              <option value="cycle">Rotation (a repeating list)</option>
            </select>
          </div>
          {#if draft.rule === 'every'}
            <div class="field">
              <span class="label">Every how many days</span>
              <input type="number" min="1" bind:value={draft.every} />
            </div>
          {/if}
        </div>

        {#if draft.rule === 'weekdays'}
          <div class="row">
            {#each WEEKDAYS as w, i}
              <button class="chip" class:off={!draft.days.includes(i)} onclick={() => toggleDay(i)}>{w}</button>
            {/each}
          </div>
        {/if}

        {#if draft.rule === 'cycle'}
          <div class="field">
            <span class="label">Steps, one per day</span>
            <input bind:value={draft.stepsText} placeholder="Anterior, Posterior, -" />
            <small>Separate with commas. Use - for a day with no task. The list repeats.</small>
          </div>
        {/if}

        <div class="two">
          <div class="field">
            <span class="label">First day</span>
            <input type="date" bind:value={draft.start} />
          </div>
          <div class="field">
            <span class="label">Last day (optional)</span>
            <input type="date" bind:value={draft.until} />
          </div>
        </div>

        <div class="field">
          <span class="label">Color</span>
          <ColorPicker bind:value={draft.color} />
        </div>

        <div class="field">
          <span class="label">Tags</span>
          <div class="row">
            {#each db.tags as tg (tg.id)}
              <button class="chip" class:off={!draft.tagIds.includes(tg.id)} style:--c={tg.color} onclick={() => toggleTag(draft, tg.id)}>{tg.name}</button>
            {/each}
          </div>
        </div>

        {#if error}<p class="error">{error}</p>{/if}
        <div class="row">
          <button class="primary" onclick={create}>Create</button>
          {#if db.series.length}<button class="ghost" onclick={() => (adding = false)}>Cancel</button>{/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  h3 { font-size: 17px; font-weight: 600; }
  .wide { width: min(620px, calc(100vw - 40px)); }
  .num { width: 72px; }
  .pushrow { gap: 10px; }
  .series {
    --c: var(--neutral);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--c);
    border-radius: 10px;
  }
  .info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .form { display: flex; flex-direction: column; gap: 16px; padding: 16px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  small { color: var(--muted); font-size: 11px; }
  .error { color: var(--danger); font-size: 12px; }
</style>
