const fs = require('fs');
const path = require('path');

const dirNew = 'C:\\Users\\HP\\Desktop\\Akash\\(new)Kalpanaaa-Employee-Management-Platform';
const dirOur = 'C:\\Users\\HP\\Desktop\\Akash\\Kalpanaaa---Employee-Management-Platform-main';

const filesToCopy = [
  'bun.lock',
  'Final 1.jpg (1).jpeg',
  'functions/index.js',
  'functions/package-lock.json',
  'functions/package.json',
  'kalpanaaa_master_redesign_prompt.md',
  'src/components/hr/HRRulesView.tsx',
  'src/lib/exportCsv.ts'
];

filesToCopy.forEach(rel => {
  const src = path.join(dirNew, rel);
  const dest = path.join(dirOur, rel);
  if (fs.existsSync(src)) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      console.log('Copied missing GitHub file to Our workspace:', rel);
    }
  }
});
