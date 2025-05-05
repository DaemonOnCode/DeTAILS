const fs = require('fs');
const path = require('path');
const os = require('os');

function cleanupOldMEIFoldersByCount(
  maxEntries = 10,
  tmpBase = os.tmpdir(),
  prefix = '_MEI',
) {
  console.log(`Scanning ${tmpBase} for "${prefix}*" folders…`);

  const all = fs
    .readdirSync(tmpBase, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
    .map((d) => {
      const fullPath = path.join(tmpBase, d.name);
      const stat = fs.statSync(fullPath);
      return { name: d.name, path: fullPath, mtime: stat.mtimeMs };
    });

  if (all.length <= maxEntries) {
    console.log(`Found ${all.length} <= ${maxEntries}, nothing to do.`);
    return;
  }

  all.sort((a, b) => a.mtime - b.mtime);

  const toRemove = all.slice(0, all.length - maxEntries);
  toRemove.forEach((entry) => {
    try {
      fs.rmSync(entry.path, { recursive: true, force: true });
      console.log(`Removed ${entry.name}`);
    } catch (err) {
      console.error(`Failed to remove ${entry.name}:`, err);
    }
  });
}

module.exports = { cleanupOldMEIFoldersByCount };
