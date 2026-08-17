const { Jimp } = require('jimp');
const path = require('path');

const inputImagePath = path.join(__dirname, 'src/assets/images/kalpana_logo.jpeg');
const publicDir = path.join(__dirname, 'public');

async function generateIcons() {
  try {
    const image = await Jimp.read(inputImagePath);
    
    // Generate 192x192
    image.clone().resize({ w: 192, h: 192 }).write(path.join(publicDir, 'pwa-192x192.png'));
    
    // Generate 512x512
    image.clone().resize({ w: 512, h: 512 }).write(path.join(publicDir, 'pwa-512x512.png'));
    
    // Generate 180x180 (Apple Touch Icon)
    image.clone().resize({ w: 180, h: 180 }).write(path.join(publicDir, 'apple-touch-icon.png'));
    
    // Generate favicon.png
    image.clone().resize({ w: 64, h: 64 }).write(path.join(publicDir, 'favicon.png'));
    
    console.log('Successfully generated PWA icons!');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generateIcons();
