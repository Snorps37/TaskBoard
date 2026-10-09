<script>
  import { db, ui, addTag, removeTag } from './db.svelte.js';
  import ColorPicker from './ColorPicker.svelte';
  import { fade, scale, slide } from 'svelte/transition';

  let selected = $state(db.tags[0]?.id ?? null);
  let name = $state('');

  const close = () => (ui.showTags = false);

  function create() {
    const n = name.trim();
    if (!n) return;
    selected = addTag(n).id;
    name = '';
  }
  function del(t) {
    if (confirm(`Delete the tag "${t.name}"? It will be removed from all tasks.`)) removeTag(t.id);
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()} transition:fade={{ duration: 120 }}>
  <div class="modal" transition:scale={{ start: 0.96, duration: 140 }}>
    <div class="row">
      <h3>Tags</h3>
      <span class="spacer"></span>
      <button class="primary" onclick={close}>Done</button>
    </div>

    <div class="row">
      <input class="grow" placeholder="New tag name" bind:value={name} onkeydown={(e) => e.key === 'Enter' && create()} />
      <button onclick={create}>Add tag</button>
    </div>

    <div class="list">
      {#each db.tags as t (t.id)}
        <div class="tag">
          <button class="chip big" style:--c={t.color} onclick={() => (selected = selected === t.id ? null : t.id)}>{t.name}</button>
          {#if selected === t.id}
            <div class="editor" transition:slide={{ duration: 140 }}>
              <div class="field">
                <span class="label">Name</span>
                <input bind:value={t.name} />
              </div>
              <div class="field">
                <span class="label">Color</span>
                <ColorPicker bind:value={t.color} allowNone={false} />
              </div>
              <div class="row"><button class="danger" onclick={() => del(t)}>Delete tag</button></div>
            </div>
          {/if}
        </div>
      {/each}
      {#if !db.tags.length}<p class="muted">No tags yet. Add one above, like Academics or Games.</p>{/if}
    </div>
  </div>
</div>

<style>
  h3 { font-size: 17px; font-weight: 600; }
  .grow { flex: 1; min-width: 0; }
  .list { display: flex; flex-direction: column; gap: 10px; }
  .tag { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .big { font-size: 13px; padding: 3px 12px; }
  .editor { width: 100%; display: flex; flex-direction: column; gap: 14px; padding: 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; }
</style>
