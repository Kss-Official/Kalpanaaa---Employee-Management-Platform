const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/components/employee');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

console.log('🔍 Auditing employee component files for leftover emojis...');

files.forEach(file => {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const matches = line.match(emojiRegex);
    if (matches) {
      console.log(`  📌 [${file}:${index + 1}] Found Emojis: ${matches.join(' ')} | Line: ${line.trim()}`);
    }
  });
});
