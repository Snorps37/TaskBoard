<script>
  import { db, ui, today, addDays, addTask, addTag, currentBoard, fmtTime, tagById } from './db.svelte.js';
  import { parseTask, compactTag } from './quickadd.js';
  import { fade, fly } from 'svelte/transition';

  // Tab opens this bar. Type where to go ("thursday", "settings", "upcoming"),
  // search your tasks by name or notes ("essay"),
  // or type a task ("do laundry thursday 4pm tag:personal") and press Enter to add it.

  let query = $state('');
  let sel = $state(0);
  let inputEl;
  let listEl = $state();

  const close = () => (ui.showCommand = false);

  const dayLabel = (d) => {
    if (d === today()) return 'Today';
    if (d === addDays(today(), 1)) return 'Tomorrow';
    if (d === addDays(today(), -1)) return 'Yesterday';
    return new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const longDay = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  function openDay(d) {
    ui.view = 'calendar';
    ui.dayBoard = d;
    ui.selectedDay = d;
  }

  // Places you can go. `words` are extra names it answers to.
  const places = $derived.by(() => {
    const list = [
      { label: 'Today', kind: 'Day', day: today(), words: 'board', run: () => openDay(today()) },
      { label: 'Tomorrow', kind: 'Day', day: addDays(today(), 1), run: () => openDay(addDays(today(), 1)) },
      { label: 'Yesterday', kind: 'Day', day: addDays(today(), -1), run: () => openDay(addDays(today(), -1)) },
      { label: 'Upcoming', kind: 'Page', words: 'overview week list', run: () => (ui.view = 'board') },
      { label: 'Calendar', kind: 'Page', words: 'month', run: () => { ui.view = 'calendar'; ui.dayBoard = null; } },
      { label: 'Preferences', kind: 'Settings', words: 'settings options theme startup layout', run: () => (ui.showPrefs = true) },
      { label: 'Repeating tasks', kind: 'Settings', words: 'recurring series routines settings', run: () => (ui.showSeries = true) },
      { label: 'Schoology', kind: 'Settings', words: 'sync import calendar feed settings', run: () => (ui.showSchoology = true) },
      { label: 'Edit tags', kind: 'Settings', words: 'tags labels', run: () => (ui.showTags = true) }
    ];
    // The next 7 days by weekday name.
    for (let k = 2; k < 7; k++) {
      const d = addDays(today(), k);
      const name = new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'long' });
      list.push({ label: name, kind: 'Day', day: d, hint: dayLabel(d), run: () => openDay(d) });
    }
    for (const t of db.tags) {
      list.push({ label: `Show only ${t.name}`, kind: 'Filter', words: 'filter tag', color: t.color, run: () => (ui.filterTagId = t.id) });
    }
    if (ui.filterTagId) list.push({ label: 'Show all tags', kind: 'Filter', words: 'clear filter reset', run: () => (ui.filterTagId = null) });
    return list;
  });

  // Every word you typed must be the start of one of the place's words.
  function score(p, words) {
    const label = p.label.toLowerCase();
    const pool = (label + ' ' + (p.words ?? '')).toLowerCase().split(/\s+/);
    if (!words.every((w) => pool.some((x) => x.startsWith(w)))) return 0;
    const q = words.join(' ');
    return label === q ? 3 : label.startsWith(q) ? 2 : 1;
  }

  // Tasks where every word you typed shows up in the title, notes or group.
  // Unfinished ones first, then the ones dated nearest today.
  function findTasks(words) {
    const now = today();
    const dist = (t) => (t.due ? Math.abs(new Date(t.due) - new Date(now)) : Infinity);
    return db.tasks
      .filter((t) => {
        const text = [t.title, t.notes, t.group].join(' ').toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .sort((a, b) => a.done - b.done || dist(a) - dist(b))
      .slice(0, 8)
      .map((t) => ({
        label: t.title,
        kind: 'Task',
        hint: t.due ? dayLabel(t.due) + (t.time ? ` ${fmtTime(t.time)}` : '') : 'No date',
        done: t.done,
        run: () => {
          if (t.due) openDay(t.due);
          ui.editingId = t.id;
        }
      }));
  }

  // The tag being typed at the end ("tag:pe"), so it can be completed.
  const tagPart = $derived(/(?:^|\s)tag:(\S*)$/i.exec(query)?.[1] ?? null);
  const tagSuggestions = $derived(
    tagPart === null
      ? []
      : db.tags.filter((t) => compactTag(t.name).toLowerCase().startsWith(tagPart.toLowerCase()))
  );

  const parsed = $derived(parseTask(query, db.tags));

  const results = $derived.by(() => {
    if (tagSuggestions.length) {
      return tagSuggestions.map((t) => ({ kind: 'Tag', label: t.name, color: t.color, complete: t }));
    }
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return places.filter((p) => ['Today', 'Tomorrow', 'Upcoming', 'Calendar', 'Preferences'].includes(p.label));

    const out = places
      .map((p) => ({ p, s: score(p, words) }))
      .filter((x) => x.s)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);

    // A typed date on its own ("oct 25", "next fri") is a day to go to.
    const p = parsed;
    if (p.due && !p.title && !p.tagIds.length && !p.newTags.length && !out.some((x) => x.day === p.due)) {
      out.unshift({ label: longDay(p.due), kind: 'Day', run: () => openDay(p.due) });
    }
    if (query.trim().length >= 2) out.push(...findTasks(words));
    if (p.title) out.push({ kind: 'Add task', add: p });
    return out;
  });

  // Keep the highlight on the first result as you type.
  $effect(() => {
    query;
    sel = 0;
  });
  $effect(() => {
    listEl?.children[sel]?.scrollIntoView({ block: 'nearest' });
  });

  function complete(tag) {
    query = query.replace(/tag:\S*$/i, `tag:${compactTag(tag.name)} `);
    inputEl.focus();
  }

  function run(r) {
    if (!r) return;
    if (r.complete) return complete(r.complete);
    close();
    if (r.add) return add(r.add);
    r.run();
  }

  function add(p) {
    const column = currentBoard()?.columns[0];
    if (!column) return;
    const tagIds = [...p.tagIds, ...p.newTags.map((n) => addTag(n).id)];
    // With no date typed, a task added from a day board goes on that day.
    const due = p.due || (ui.view === 'calendar' && ui.dayBoard) || '';
    addTask({ title: p.title, due, time: due ? p.time : '', columnId: column.id, tagIds });
    ui.toast = `Added “${p.title}”` + (due ? ` · ${dayLabel(due)}` : '') + (p.time ? ` ${fmtTime(p.time)}` : '');
  }

  function onKey(e) {
    const n = results.length;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[sel];
      // Enter on a tag you've already typed in full adds the task instead of completing it again.
      if (r?.complete && compactTag(r.complete.name).toLowerCase() === tagPart?.toLowerCase()) {
        const task = parseTask(query, db.tags);
        if (task.title) run({ add: task });
        else complete(r.complete);
      } else run(r);
    } else if (e.key === 'Tab' && !e.shiftKey && results[sel]?.complete) {
      e.preventDefault();
      complete(results[sel].complete);
    } else if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      if (n) sel = (sel + 1) % n;
    } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      if (n) sel = (sel - 1 + n) % n;
    }
  }

  const focusEl = (node) => node.focus();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop top" onclick={(e) => e.target === e.currentTarget && close()} transition:fade={{ duration: 100 }}>
  <div class="bar" transition:fly={{ y: -10, duration: 140 }}>
    <input
      bind:this={inputEl}
      use:focusEl
      bind:value={query}
      onkeydown={onKey}
      spellcheck="false"
      autocomplete="off"
      aria-label="Go to, find or add a task"
      placeholder="Go to a day or page, find a task, or add one: do laundry thursday 4pm tag:personal" />

    {#if results.length}
      <div class="results" role="listbox" bind:this={listEl}>
        {#each results as r, i (i)}
          <button
            class="ghost result"
            class:active={i === sel}
            role="option"
            aria-selected={i === sel}
            onmousemove={() => (sel = i)}
            onclick={() => run(r)}>
            {#if r.add}
              <span class="main">
                <span class="title">{r.add.title}</span>
                {#if r.add.due}<span class="chip">{dayLabel(r.add.due)}</span>{/if}
                {#if r.add.time}<span class="chip">{fmtTime(r.add.time)}</span>{/if}
                {#each r.add.tagIds as id (id)}
                  {@const t = tagById(id)}
                  <span class="chip" style:--c={t.color}>{t.name}</span>
                {/each}
                {#each r.add.newTags as n (n)}<span class="chip new" title="A new tag will be made">+ {n}</span>{/each}
              </span>
            {:else if r.color}
              <span class="main"><span class="chip" style:--c={r.color}>{r.complete ? r.label : r.label.replace(/^Show only /, '')}</span>{#if !r.complete}<span class="muted">only</span>{/if}</span>
            {:else}
              <span class="main" class:done={r.done}>{r.label}{#if r.hint}<span class="muted">{r.hint}</span>{/if}</span>
            {/if}
            <span class="kind">{r.kind}</span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="keys muted">
      <span><kbd>Enter</kbd> {results[sel]?.complete ? 'complete' : 'go'}</span>
      <span><kbd>Tab</kbd> {tagSuggestions.length ? 'complete tag' : 'next'}</span>
      <span><kbd>tag:</kbd> add a tag</span>
      <span><kbd>Esc</kbd> close</span>
    </div>
  </div>
</div>

<style>
  .backdrop.top { place-items: start center; padding-top: 12vh; }
  .bar {
    width: min(640px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }
  input { font-size: 17px; padding: 14px 16px; border: none; border-bottom: 1px solid var(--border); border-radius: 0; background: transparent; }
  .results { max-height: 50vh; overflow: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
  .result { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; color: var(--text); padding: 8px 10px; }
  .result:active { transform: none; }
  .result.active { background: var(--surface-3); }
  .main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .title { font-weight: 600; }
  .main.done { text-decoration: line-through; color: var(--muted); }
  .kind { font-size: 12px; color: var(--muted); flex: none; }
  .chip.new { border-style: dashed; }
  .keys { display: flex; gap: 16px; padding: 8px 14px; border-top: 1px solid var(--border); font-size: 12px; flex-wrap: wrap; }
  kbd { font: inherit; font-size: 11px; padding: 0 5px; border: 1px solid var(--border-strong); border-radius: 4px; background: var(--surface-2); }
</style>
