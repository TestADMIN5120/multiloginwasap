// scripts/syntax-check.js
// Lightweight syntax check for every .js file in backend/src.
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(path.join(__dirname, '..', 'src'));
let errors = 0;
for (const file of files) {
  try {
    // eslint-disable-next-line no-new-func
    new Function(fs.readFileSync(file, 'utf8'));
    console.log('OK  ' + file);
  } catch (err) {
    errors += 1;
    console.log('ERR ' + file + ' -> ' + err.message);
  }
}
console.log('---');
console.log('Total: ' + files.length + ', errors: ' + errors);
process.exit(errors > 0 ? 1 : 0);

