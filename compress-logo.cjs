const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const imagePath = path.join(__dirname, 'src/assets/images/kalpana_logo.jpeg');

async function compressLogo() {
  try {
    const stat = fs.statSync(imagePath);
    console.log(`Original size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

    const image = await Jimp.read(imagePath);
    
    // Resize to max 1024 width/height while maintaining aspect ratio
    image.scaleToFit({ w: 800, h: 800 });
    
    // Write over the same file
    await image.write(imagePath);
    
    const newStat = fs.statSync(imagePath);
    console.log(`Compressed size: ${(newStat.size / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.error('Error compressing image:', err);
  }
}

compressLogo();
