const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
}

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = '#4285f4';
    ctx.fillRect(0, 0, size, size);
    
    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.1;
    ctx.strokeRect(size * 0.1, size * 0.1, size * 0.8, size * 0.8);
    
    // Draw DOM text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DOM', size/2, size/2);
    
    // Save the icon
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
}

// Generate icons for all sizes
[16, 48, 128].forEach(size => {
    generateIcon(size);
});

console.log('Icons have been generated in the icons directory'); 