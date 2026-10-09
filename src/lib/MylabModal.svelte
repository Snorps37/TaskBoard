<script>
  import { ui, settings, mylab, saveSettings, syncMylabText, syncMylabClipboard } from './db.svelte.js';
  import { fade, scale } from 'svelte/transition';

  let pasted = $state('');
  const close = () => (ui.showMylab = false);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()} transition:fade={{ duration: 120 }}>
  <div class="modal" transition:scale={{ start: 0.96, duration: 140 }}>
    <div class="row">
      <h3>Pearson MyLab</h3>
      <span class="spacer"></span>
      <button class="primary" onclick={close}>Done</button>
    </div>

    <p class="muted">
      MyLab has no calendar feed, so this reads the assignment table you copy from it. On MyLab's assignments page,
      select the table and copy it (Ctrl+C), then click the button below. Run it again whenever the teacher changes
      dates: it adds new assignments, follows date changes, and ticks off ones that now have a score.
    </p>

    <div class="field">
      <span class="label">Class name (used as the tag and title prefix)</span>
      <input bind:value={settings.mylabClass} placeholder="AP Calc" onchange={saveSettings} />
    </div>

    <div class="row">
      <button class="primary" onclick={syncMylabClipboard}>Paste from clipboard and sync</button>
    </div>

    <div class="field">
      <span class="label">Or paste the table here</span>
      <textarea rows="4" bind:value={pasted} placeholder="Paste the copied table"></textarea>
      <div class="row">
        <button disabled={!pasted.trim()} onclick={() => { syncMylabText(pasted); pasted = ''; }}>Sync pasted text</button>
      </div>
    </div>

    <p class="status" class:bad={mylab.message.startsWith("Couldn't")}>{mylab.message}</p>
    <small>Assignments that already have a score, or were due more than two weeks ago, are skipped.</small>
  </div>
</div>

<style>
  h3 { font-size: 17px; font-weight: 600; }
  small { color: var(--muted); font-size: 11px; }
  .status { min-height: 1.5em; font-size: 13px; color: var(--muted); }
  .status.bad { color: var(--danger); }
</style>
