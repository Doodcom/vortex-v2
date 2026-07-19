import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'linter_output.json'), 'utf8'));

data.forEach(fileEntry => {
  const relativePath = path.relative(path.join(__dirname, '../..'), fileEntry.filePath);
  const anyWarnings = fileEntry.messages.filter(msg => msg.ruleId === '@typescript-eslint/no-explicit-any');
  
  if (anyWarnings.length > 0) {
    console.log(`\n========================================`);
    console.log(`FILE: ${relativePath}`);
    console.log(`========================================`);
    
    // Split source code into lines
    const lines = fileEntry.source ? fileEntry.source.split('\n') : [];
    
    anyWarnings.forEach(warn => {
      const lineNum = warn.line;
      const colNum = warn.column;
      const snippet = lines[lineNum - 1] || 'N/A';
      console.log(`Line ${lineNum}:${colNum} - ${warn.message}`);
      console.log(`Code:  ${snippet.trim()}`);
      console.log(`----------------------------------------`);
    });
  }
});
