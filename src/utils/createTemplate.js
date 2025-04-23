const fs = require('fs');
const { createCanvas } = require('canvas');

// Canvas dimensions (A6 size at 300dpi)
const WIDTH = 1240;
const HEIGHT = 1748;

// Create our lavender journal template
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Fill the background with soft lavender
ctx.fillStyle = '#f5f0ff';
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Add some page texture
ctx.globalAlpha = 0.04;
for (let i = 0; i < WIDTH; i += 10) {
  for (let j = 0; j < HEIGHT; j += 10) {
    if (Math.random() > 0.5) {
      ctx.fillStyle = '#9d8ec7';
      ctx.fillRect(i, j, 1, 1);
    }
  }
}
ctx.globalAlpha = 1;

// Add subtle gradient overlay
const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
gradient.addColorStop(0, 'rgba(180, 159, 206, 0.05)'); // light lavender
gradient.addColorStop(1, 'rgba(157, 142, 199, 0.08)'); // darker lavender
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// Add decorative border
ctx.strokeStyle = '#d6c9f0';
ctx.lineWidth = 3;
ctx.strokeRect(30, 30, WIDTH - 60, HEIGHT - 60);

// Add a subtle drop shadow to the page
ctx.shadowColor = 'rgba(157, 142, 199, 0.2)';
ctx.shadowBlur = 20;
ctx.shadowOffsetX = 5;
ctx.shadowOffsetY = 5;
ctx.strokeRect(30, 30, WIDTH - 60, HEIGHT - 60);
ctx.shadowColor = 'transparent';

// Draw lines for writing (21 lines total with extra spacing)
ctx.strokeStyle = '#d6c9f0';
ctx.lineWidth = 1;

// Configure the exact coordinates for the notebook lines
const notebookLines = [
  283.2, 356.4, 428.6, 500.8, 575.0, 645.2, 719.4, 792, 865,
  937.0, 1010, 1083.0, 1157.0, 1230.0, 1305.0, 1375.0, 1447.0, 1522.0, 1595.0, 1667.0, 1739.0
];

// Draw each line at its exact position
notebookLines.forEach(lineY => {
  ctx.beginPath();
  ctx.moveTo(60, lineY);
  ctx.lineTo(WIDTH - 60, lineY);
  ctx.stroke();
});

// Add a small decorative element in the corner
ctx.fillStyle = '#9d8ec7';
ctx.beginPath();
ctx.arc(WIDTH - 80, 80, 20, 0, 2 * Math.PI);
ctx.fill();

ctx.fillStyle = 'white';
ctx.font = 'italic 20px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('WJ', WIDTH - 80, 80);

// Save the template
const buffer = canvas.toBuffer('image/jpeg');
fs.writeFileSync('./public/templates/lavender-journal-template.jpg', buffer);

console.log('Lavender journal template created successfully!'); 