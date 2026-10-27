// Session-only snapshots; restore in place at the caller so Svelte keeps observing.
export function createHistory(limit = 50) {
  let current;
  const past = [];
  const future = [];
  return {
    record(snapshot) {
      if (snapshot === current) return;
      if (current !== undefined) past.push(current);
      if (past.length > limit) past.shift();
      current = snapshot;
      future.length = 0;
    },
    undo() {
      if (!past.length) return null;
      future.push(current);
      return (current = past.pop());
    },
    redo() {
      if (!future.length) return null;
      past.push(current);
      return (current = future.pop());
    }
  };
}
