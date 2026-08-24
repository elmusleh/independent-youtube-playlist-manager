const fs = require('fs');

let errors = 0;

function validate(path, shouldHaveKey, shouldHaveScripts) {
  const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
  
  if (shouldHaveKey && !manifest.key) {
    console.warn(`WARN: ${path} missing "key" (extension ID will be dynamic)`);
  }
  if (!shouldHaveKey && manifest.key) {
    console.error(`FAIL: ${path} should NOT have "key"`);
    errors++;
  }
  
  const hasScripts = manifest.background?.scripts !== undefined;
  if (shouldHaveScripts && !hasScripts) {
    console.error(`FAIL: ${path} missing "background.scripts"`);
    errors++;
  }
  if (!shouldHaveScripts && hasScripts) {
    console.error(`FAIL: ${path} should NOT have "background.scripts"`);
    errors++;
  }
}

try {
  validate('dist/chrome/manifest.json', true, false);
  validate('dist/firefox/manifest.json', false, true);
} catch (e) {
  console.error('Validation error:', e instanceof Error ? e.message : String(e));
  process.exit(1);
}

if (errors) {
  console.error(`\n${errors} validation error(s) found.`);
  process.exit(1);
}

console.log('OK: Both manifests are correct.');
