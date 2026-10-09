#!/bin/sh
# Adds TaskBoard to your Linux app launcher, with its icon.
# Run from anywhere:  sh scripts/install-linux.sh
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
APP_DIR="$HOME/.local/share/applications"
mkdir -p "$ICON_DIR" "$APP_DIR"

# 512px copy of the icon, installed under the name "taskboard"
if command -v convert >/dev/null 2>&1; then
  convert "$DIR/build/icon.png" -resize 512x512 "$ICON_DIR/taskboard.png"
else
  cp "$DIR/build/icon.png" "$ICON_DIR/taskboard.png"
fi

# Use the system Electron (Arch: pacman -S electron) when npm's own copy isn't installed.
if [ ! -f "$DIR/node_modules/electron/path.txt" ] && [ -x /usr/bin/electron ]; then
  RUN="npm run start:system"
else
  RUN="npm start"
fi

cat > "$APP_DIR/taskboard.desktop" << DESKTOP
[Desktop Entry]
Type=Application
Name=TaskBoard
Comment=Boards and a calendar in one place
Exec=sh -c 'cd "$DIR" && $RUN'
Icon=taskboard
Terminal=false
Categories=Office;ProjectManagement;
StartupWMClass=taskboard
DESKTOP

update-desktop-database "$APP_DIR" 2>/dev/null || true
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo "Installed. Launch TaskBoard from your app launcher (you may need to log out and back in once)."
echo "If the icon is still missing, run:  hyprctl clients | grep -i -A3 taskboard"
echo "and make sure the 'class' shown matches StartupWMClass in $APP_DIR/taskboard.desktop"
