const fs = require('fs');
const path = require('path');

function saveData(file, json) {
  JSON.parse(json);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Keep the previous valid save beside the live file. Never replace a good
  // backup with unreadable data from the live file.
  if (fs.existsSync(file)) {
    const previous = fs.readFileSync(file, 'utf8');
    try {
      JSON.parse(previous);
      fs.writeFileSync(file + '.bak.tmp', previous);
      fs.renameSync(file + '.bak.tmp', file + '.bak');
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  fs.writeFileSync(file + '.tmp', json);
  fs.renameSync(file + '.tmp', file);
}
module.exports = { saveData };
