import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { applyTheme } from './lib/theme.js';

// Paint the last-used theme right away, before anything loads.
try {
  const cached = JSON.parse(localStorage.getItem('taskboard-theme-cache'));
  if (cached) applyTheme(cached);
} catch {
  // no cached theme yet
}

mount(App, { target: document.getElementById('app') });
