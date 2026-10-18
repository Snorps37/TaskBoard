<script>
  import { accentOf, isCollapsed, toggleGroup, setGroupDone } from './db.svelte.js';
  import TaskRow from './TaskRow.svelte';
  import { fly, slide } from 'svelte/transition';

  // Several tasks that share a group name, shown as one folding card.
  let { name, items, showDate = false, compact = false } = $props();

  const doneCount = $derived(items.filter((t) => t.done).length);
  const allDone = $derived(doneCount === items.length);
  const open = $derived(!isCollapsed(name));
</script>

<div class="group" class:done={allDone} style:--c={accentOf(items[0]) || 'var(--neutral)'} in:fly={{ y: 6, duration: 130 }}>
  <div class="head">
    <input type="checkbox" aria-label="All of {name} done" checked={allDone} onchange={(e) => setGroupDone(items, e.currentTarget.checked)} />
    <button class="toggle" aria-expanded={open} title={open ? 'Fold up' : 'Show tasks'} onclick={() => toggleGroup(name)}>
      <span class="chev" class:open>›</span>
      <span class="name">{name}</span>
      <span class="count">{doneCount}/{items.length}</span>
    </button>
  </div>
  {#if open}
    <div class="members" transition:slide={{ duration: 130 }}>
      {#each items as t (t.id)}<TaskRow {t} {showDate} {compact} />{/each}
    </div>
  {/if}
</div>

<style>
  .group {
    --c: var(--neutral);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: color-mix(in srgb, var(--c) 8%, var(--surface-2));
    border: 1px solid var(--border);
    border-left: 3px solid var(--c);
    border-radius: 10px;
  }
  .head { display: flex; align-items: center; gap: 10px; padding: 1px 4px; }
  .head input[type='checkbox'] { margin-top: 0; }
  .toggle { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 0; text-align: left; background: none; border: 0; border-radius: 0; }
  .toggle:hover { background: none; }
  .toggle:active { transform: none; }
  .chev { color: var(--muted); transition: transform var(--fast); display: inline-block; width: 10px; }
  .chev.open { transform: rotate(90deg); }
  .name { font-weight: 600; overflow-wrap: anywhere; }
  .group.done .name { text-decoration: line-through; color: var(--muted); }
  .count { margin-left: auto; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .members { display: flex; flex-direction: column; gap: 6px; }
</style>
