<script>
  import { ui, settings, saveSettings } from './db.svelte.js';
  import { PRESETS, resolveTheme } from './theme.js';
  import { fade, scale } from 'svelte/transition';

  const FIELDS = [
    ['bg', 'Background'],
    ['surface', 'Cards and panels'],
    ['text', 'Text'],
    ['accent', 'Accent']
  ];

  const active = $derived(resolveTheme(settings));
  const tiles = $derived([...PRESETS, { id: 'custom', name: 'Custom', ...settings.customTheme }]);
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

  const close = () => (ui.showPrefs = false);

  function choose(id) {
    settings.theme = id;
    saveSettings();
  }

  // Editing any color starts from the theme you're on, then switches to the Custom theme.
  let saveTimer;
  function setColor(key, value) {
    if (settings.theme !== 'custom') {
      const { bg, surface, text, accent, danger } = resolveTheme(settings);
      settings.customTheme = { bg, surface, text, accent, danger };
    }
    settings.customTheme[key] = value;
    settings.theme = 'custom';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettings, 300);
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
      </div>
    </div>

    <div class="field">
      <span class="label">Customize colors (switches to the Custom theme)</span>
      <div class="colors">
        {#each FIELDS as [key, label] (key)}
          <div class="crow">
            <span>{label}</span>
            <input type="color" aria-label={label} value={active[key]} oninput={(e) => setColor(key, e.currentTarget.value)} />
            <input
              class="hex"
              maxlength="7"
              aria-label="{label} hex"
              value={active[key]}
              oninput={(e) => {
                const v = e.currentTarget.value.trim();
                if (isHex(v)) setColor(key, v.toLowerCase());
              }} />
          </div>
        {/each}
      </div>
    </div>

    <div class="field">
      <span class="label">When the app opens</span>
      <select bind:value={settings.startup} onchange={saveSettings}>
        <option value="today">Today's board</option>
        <option value="board">Main board</option>
        <option value="calendar">Month calendar</option>
      </select>
    </div>
  </div>
</div>

<style>
  h3 { font-size: 17px; font-weight: 600; }
  .wide { width: min(620px, calc(100vw - 40px)); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
  .tile { display: flex; flex-direction: column; gap: 8px; align-items: stretch; padding: 8px; text-align: left; border-radius: 10px; }
  .tile.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .preview { display: flex; align-items: center; gap: 5px; height: 34px; padding: 7px; border-radius: 6px; border: 1px solid var(--border); }
  .preview i { flex: 1; height: 100%; border-radius: 3px; }
  .preview b { width: 12px; height: 12px; border-radius: 50%; flex: none; }
  .name { font-size: 12px; }
  .colors { display: flex; flex-direction: column; gap: 8px; }
  .crow { display: grid; grid-template-columns: 1fr 44px 96px; gap: 10px; align-items: center; }
  .crow input[type='color'] { width: 44px; height: 30px; padding: 2px; cursor: pointer; }
  .hex { font-variant-numeric: tabular-nums; }
</style>
