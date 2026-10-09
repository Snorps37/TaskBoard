<script>
  import { ui, settings, sync, saveSettings, syncSchoology } from './db.svelte.js';
  import { fade, scale } from 'svelte/transition';

  let link = $state(settings.schoologyUrl);
  const connected = $derived(!!settings.schoologyUrl);
  const lastSync = $derived(
    settings.lastSync
      ? new Date(settings.lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : ''
  );

  const close = () => (ui.showSchoology = false);

  async function connect() {
    settings.schoologyUrl = link.trim();
    await saveSettings();
    await syncSchoology();
  }
  async function disconnect() {
    settings.schoologyUrl = '';
    settings.lastSync = '';
    link = '';
    sync.message = '';
    await saveSettings();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()} transition:fade={{ duration: 120 }}>
  <div class="modal" transition:scale={{ start: 0.96, duration: 140 }}>
    <div class="row">
      <h3>Schoology</h3>
      <span class="spacer"></span>
      <button class="primary" onclick={close}>Done</button>
    </div>

    <p class="muted">
      Assignments with due dates are copied into your board. This is one-way: checking something off here doesn't
      submit it in Schoology. In Schoology, open Settings, find "Share your Schoology Calendar", click Enable, and paste
      the link below.
    </p>

    <div class="field">
      <span class="label">Calendar link</span>
      <input type="password" placeholder="webcal://... or https://..." autocomplete="off" bind:value={link} />
      <small>Anyone with this link can see your calendar. It's stored only on this computer, separate from your tasks.</small>
    </div>

    <label class="check">
      <input type="checkbox" bind:checked={settings.includeEvents} onchange={saveSettings} />
      <span>Also import school events, not just assignments</span>
    </label>

    <div class="row">
      <button class="primary" disabled={!link.trim() || sync.busy} onclick={connect}>
        {connected ? 'Save and sync' : 'Connect and sync'}
      </button>
      {#if connected}
        <button disabled={sync.busy} onclick={syncSchoology}>Sync now</button>
        <button class="ghost danger" onclick={disconnect}>Disconnect</button>
      {/if}
    </div>

    <p class="status" class:bad={sync.message.startsWith('Could not')}>
      {#if sync.busy}Syncing...{:else if sync.message}{sync.message}{#if lastSync && !sync.message.startsWith('Could not')} (last sync {lastSync}){/if}{/if}
    </p>
  </div>
</div>

<style>
  h3 { font-size: 17px; font-weight: 600; }
  .check { display: flex; gap: 10px; align-items: flex-start; }
  small { color: var(--muted); font-size: 11px; }
  .status { min-height: 1.5em; font-size: 13px; color: var(--muted); }
  .status.bad { color: var(--danger); }
</style>
