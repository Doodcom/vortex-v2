import fs from 'node:fs';
import path from 'node:path';

// Define the exact regexes used in import-check.js
const importRegexes = [
  /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
  /import\s+['"]([^'"]+)['"]/g,
  /export\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
  /import\(['"]([^'"]+)['"]\)/g
];

function checkContent(content) {
  const matches = [];
  for (const regex of importRegexes) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      matches.push({ regex: regex.toString(), match: match[0], captured: match[1] });
    }
  }
  return matches;
}

const testCases = [
  {
    name: 'Commented-out import',
    content: '// import foo from "./non-existent-file";',
    shouldBeIgnored: true
  },
  {
    name: 'Block-commented import',
    content: '/*\n * import bar from "./non-existent-file-2";\n */',
    shouldBeIgnored: true
  },
  {
    name: 'String literal containing import text',
    content: 'const msg = "import baz from \'./non-existent-file-3\'";',
    shouldBeIgnored: true
  },
  {
    name: 'Multi-line import (valid)',
    content: 'import {\n  someFunc\n} from "./valid-file";',
    shouldBeIgnored: false
  }
];

console.log('Testing Tier 4 Import Check Regex Logic:');
let failed = false;

for (const tc of testCases) {
  const matches = checkContent(tc.content);
  console.log(`\nTest Case: "${tc.name}"`);
  console.log(`Content:\n${tc.content}`);
  if (matches.length > 0) {
    console.log(`Matches found:`);
    for (const m of matches) {
      console.log(`  - Regex: ${m.regex}`);
      console.log(`    Matched: ${JSON.stringify(m.match)}`);
      console.log(`    Captured: ${JSON.stringify(m.captured)}`);
    }
    if (tc.shouldBeIgnored) {
      console.log(`❌ VULNERABILITY: This case should be IGNORED, but it matched! (False Positive Risk)`);
      failed = true;
    } else {
      console.log(`✓ Correctly matched valid import.`);
    }
  } else {
    console.log(`No matches found.`);
    if (!tc.shouldBeIgnored) {
      console.log(`❌ VULNERABILITY: This valid import should have matched! (False Negative Risk)`);
      failed = true;
    } else {
      console.log(`✓ Correctly ignored.`);
    }
  }
}

if (failed) {
  console.log('\nVerdict: Regex matching is prone to false positives/negatives.');
  process.exit(1);
} else {
  console.log('\nVerdict: All test cases passed.');
  process.exit(0);
}
