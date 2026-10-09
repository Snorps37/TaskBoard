<script>
  import { db, addColor, removeColor } from './db.svelte.js';

  let { value = $bindable(''), allowNone = true } = $props();

  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);
  const saved = $derived(!!value && db.savedColors.includes(value));
</script>

<div class="picker">
  <div class="row">
    <input
      type="color"
      class="native"
      aria-label="Pick a color"
      value={value || '#8b9cff'}
      oninput={(e) => (value = e.currentTarget.value)} />
    <input
      class="hex"
      placeholder="#rrggbb"
      maxlength="7"
      aria-label="Hex color"
      {value}
      oninput={(e) => {
        const v = e.currentTarget.value.trim();
        if (isHex(v)) value = v.toLowerCase();
      }} />
    <button disabled={!value || saved} onclick={() => addColor(value)}>{saved ? 'Saved' : 'Save color'}</button>
    {#if allowNone && value}
      <button class="ghost" onclick={() => (value = '')}>No color</button>
    {/if}
  </div>

  {#if db.savedColors.length}
    <div class="row saved">
      {#each db.savedColors as c (c)}
        <button
          class="sw"
          class:active={value === c}
          style:background={c}
          title="Use {c}. Right-click to remove."
          aria-label="Use color {c}"
          onclick={() => (value = c)}
          oncontextmenu={(e) => {
            e.preventDefault();
            removeColor(c);
          }}></button>
      {/each}
    </div>
    <small>Right-click a saved color to remove it.</small>
  {/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: 10px; }
  .native { width: 40px; height: 32px; padding: 2px; cursor: pointer; }
  .native::-webkit-color-swatch-wrapper { padding: 0; }
  .native::-webkit-color-swatch { border: none; border-radius: 6px; }
  .hex { width: 96px; font-variant-numeric: tabular-nums; }
  .saved { gap: 8px; }
  .sw { width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 2px solid transparent; }
  .sw:hover { transform: scale(1.15); }
  .sw.active { border-color: var(--text); }
  small { color: var(--muted); font-size: 11px; }
</style>
