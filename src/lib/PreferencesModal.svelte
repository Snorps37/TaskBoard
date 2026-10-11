<script>
  import { ui, settings, saveSettings, uid } from './db.svelte.js';
  import { PRESETS, resolveTheme } from './theme.js';
  import { fade, scale } from 'svelte/transition';

  const FIELDS = [
    ['bg', 'Background'],
    ['surface', 'Cards and panels'],
    ['text', 'Text'],
    ['accent', 'Accent']
  ];

  const tiles = $derived([...PRESETS, ...settings.customThemes]);
  const current = $derived(resolveTheme(settings));
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

  const close = () => (ui.showPrefs = false);

  function choose(id) {
    settings.theme = id;
    saveSettings();
  }

  let saveTimer;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettings, 300);
  };

  // Makes a saved theme from a built-in or another saved theme, and switches to it.
  function createTheme(base, name) {
    const { bg, surface, text, accent, danger } = base;
    const t = { id: uid(), name, bg, surface, text, accent, ...(danger ? { danger } : {}) };
    settings.customThemes.push(t);
    settings.theme = t.id;
    saveSettings();
  }
  const newFromCurrent = () => createTheme(current, `Custom ${settings.customThemes.length + 1}`);

  function remove(t) {
    if (!confirm(`Delete the theme "${t.name}"?`)) return;
    const i = settings.customThemes.findIndex((x) => x.id === t.id);
    if (i >= 0) settings.customThemes.splice(i, 1);
    settings.theme = 'midnight';
    saveSettings();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()} transition:fade={{ duration: 120 }}>
  <div class="modal wide" transition:scale={{ start: 0.96, duration: 140 }}>
    <div class="row">
      <h3>Preferences</h3>
      <span class="spacer"></span>
      <button class="primary" onclick={close}>Done</button>
    </div>

    <div class="field">
      <span class="label">Theme</span>
      <div class="grid">
        {#each tiles as p (p.id)}
          <button class="tile" class:active={settings.theme === p.id} onclick={() => choose(p.id)}>
            <span class="preview" style:background={p.bg}>
              <i style:background={p.surface}></i>
              <b style:background={p.accent}></b>
            </span>
            <span class="name">{p.name}</span>
          </button>
        {/each}
        <button class="tile new" onclick={newFromCurrent}>
          <span class="plus">+</span>
          <span class="name">New theme</span>
        </button>
      </div>
    </div>

    <div class="field">
      {#each settings.customThemes.filter((t) => t.id === settings.theme) as t (t.id)}
        <span class="label">Edit this theme</span>
        <div class="editor">
          <input class="themename" aria-label="Theme name" bind:value={t.name} onchange={saveSettings} />
          {#each FIELDS as [key, label] (key)}
            <div class="crow">
              <span>{label}</span>
              <input
                type="color"
                aria-label={label}
                value={t[key]}
                oninput={(e) => {
                  t[key] = e.currentTarget.value;
                  saveSoon();
                }} />
              <input
                class="hex"
                maxlength="7"
                aria-label="{label} hex"
                value={t[key]}
                oninput={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (isHex(v)) {
                    t[key] = v.toLowerCase();
                    saveSoon();
                  }
                }} />
            </div>
          {/each}
          <div class="row">
            <button onclick={() => createTheme(t, `${t.name} copy`)}>Duplicate</button>
            <button class="ghost danger" onclick={() => remove(t)}>Delete theme</button>
          </div>
        </div>
      {:else}
        <p class="muted">
          {current.name} is a built-in theme. Make an editable copy to change its colors, or start a new theme with the + tile.
        </p>
        <div class="row">
          <button onclick={() => createTheme(current, `${current.name} copy`)}>Make an editable copy</button>
        </div>
      {/each}
    </div>

    <div class="field">
      <span class="label">When the app opens</span>
      <select bind:value={settings.startup} onchange={saveSettings}>
        <option value="today">Today's board</option>
        <option value="board">Upcoming</option>
        <option value="calendar">Month calendar</option>
      </select>
    </div>
  </div>
</div>

<style>
  h3 { font-size: 17px; font-weight: 600; }
  .wide { width: min(640px, calc(100vw - 40px)); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
  .tile { display: flex; flex-direction: column; gap: 8px; align-items: stretch; padding: 8px; text-align: left; border-radius: 10px; }
  .tile.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .tile.new { justify-content: center; align-items: center; border-style: dashed; background: transparent; color: var(--muted); }
  .plus { font-size: 22px; line-height: 34px; }
  .preview { display: flex; align-items: center; gap: 5px; height: 34px; padding: 7px; border-radius: 6px; border: 1px solid var(--border); }
  .preview i { flex: 1; height: 100%; border-radius: 3px; }
  .preview b { width: 12px; height: 12px; border-radius: 50%; flex: none; }
  .name { font-size: 12px; }
  .editor { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; }
  .themename { font-weight: 600; }
  .crow { display: grid; grid-template-columns: 1fr 44px 96px; gap: 10px; align-items: center; }
  .crow input[type='color'] { width: 44px; height: 30px; padding: 2px; cursor: pointer; }
  .hex { font-variant-numeric: tabular-nums; }
</style>
