# TaskBoard

Kanban boards with an embedded calendar, built with Electron + Svelte 5. Dark by default.

## Run it (Arch Linux)

```bash
sudo pacman -S nodejs npm git
npm install
npm run dev      # hot reload while you work
npm start        # build once and run the production bundle
```

Your data is a single JSON file at `~/.config/taskboard/data.json`.

## If the window is blank on NVIDIA + Wayland

Try one of these before anything else:

```bash
ELECTRON_OZONE_PLATFORM_HINT=x11 npm run dev      # run through XWayland
npm run dev -- --disable-gpu                      # software rendering (last resort)
```

If Electron complains about the sandbox, `--no-sandbox` works but is a last resort.

## Layout

- `electron/main.cjs` window creation and reading/writing `data.json`
- `electron/preload.cjs` the small bridge the UI uses to load and save
- `src/lib/db.svelte.js` all state and data helpers (boards, tasks, tags, saved colors)
- `src/lib/Board.svelte`, `Calendar.svelte`, `DayPanel.svelte`, `TaskModal.svelte`, `TagManager.svelte`, `ColorPicker.svelte`
- `src/app.css` theme colors and shared styles

`npm run dev:web` runs the UI in a normal browser tab (saves to localStorage) if you want to use browser devtools.
