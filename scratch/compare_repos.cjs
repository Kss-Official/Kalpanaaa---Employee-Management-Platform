const fs = require('fs');
const path = require('path');

const dirNew = 'C:\\Users\\HP\\Desktop\\Akash\\(new)Kalpanaaa-Employee-Management-Platform';
const dirOur = 'C:\\Users\\HP\\Desktop\\Akash\\Kalpanaaa---Employee-Management-Platform-main';

function getFiles(dir, base = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.gemini') return;
    const filePath = path.join(dir, file);
    const relPath = path.join(base, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, relPath));
    } else {
      results.push(relPath);
    }
  });
  return results;
}

const filesNew = new Set(getFiles(dirNew));
const filesOur = new Set(getFiles(dirOur));

const allFiles = new Set([...filesNew, ...filesOur]);

const diffs = [];
const missingInOur = [];
const missingInNew = [];

allFiles.forEach(relPath => {
  const pNew = path.join(dirNew, relPath);
  const pOur = path.join(dirOur, relPath);

  const existsNew = fs.existsSync(pNew);
  const existsOur = fs.existsSync(pOur);

  if (!existsNew && existsOur) {
    if (!relPath.startsWith('scratch') && relPath !== 'verify_sequential_workflow.cjs') {
      missingInNew.push(relPath);
    }
  } else if (existsNew && !existsOur) {
    missingInOur.push(relPath);
  } else if (existsNew && existsOur) {
    const contentNew = fs.readFileSync(pNew, 'utf8');
    const contentOur = fs.readFileSync(pOur, 'utf8');
    if (contentNew !== contentOur) {
      diffs.push(relPath);
    }
  }
});

console.log('--- COMPARING REPOS ---');
console.log('Modified Files in Our Workspace:', diffs.length);
diffs.forEach(f => console.log('  - Modified:', f));

console.log('\nFiles Present in GitHub repo but missing in Our Workspace:', missingInOur.length);
missingInOur.forEach(f => console.log('  - Missing in Our:', f));

console.log('\nNew/Added Files in Our Workspace:', missingInNew.length);
missingInNew.forEach(f => console.log('  - Added in Our:', f));
