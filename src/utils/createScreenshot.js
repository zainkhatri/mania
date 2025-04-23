const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

// Create a mock screenshot of the application
async function createScreenshot() {
  // Canvas dimensions (16:9 ratio for screenshot)
  const WIDTH = 1200;
  const HEIGHT = 675;

  // Create our canvas
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = '#f5f0ff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Add a subtle gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#f5f0ff');
  gradient.addColorStop(1, '#e8e1ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  try {
    // Load the template image 
    const template = await loadImage('./public/templates/lavender-journal-template.jpg');
    
    // Calculate dimensions to maintain aspect ratio
    const templateWidth = 400;
    const templateHeight = (template.height / template.width) * templateWidth;
    
    // Draw the form background on the left side
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(157, 142, 199, 0.2)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;
    ctx.fillRect(50, 100, WIDTH/2 - 100, HEIGHT - 200);
    ctx.shadowColor = 'transparent';
    
    // Draw the form elements
    ctx.fillStyle = '#4a4169';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('New Journal Entry', 80, 140);
    
    ctx.font = '16px Arial';
    ctx.fillStyle = '#9d8ec7';
    ctx.fillText('Fill in the details to create your journal', 80, 170);
    
    // Draw form fields
    const fields = [
      { label: 'Date', y: 220 },
      { label: 'Location', y: 290 },
      { label: 'Journal Entry', y: 360 }
    ];
    
    for (const field of fields) {
      ctx.fillStyle = '#4a4169';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(field.label, 80, field.y);
      
      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#d6c9f0';
      ctx.lineWidth = 1;
      ctx.fillRect(80, field.y + 10, WIDTH/2 - 160, 40);
      ctx.strokeRect(80, field.y + 10, WIDTH/2 - 160, 40);
    }
    
    // Special handling for journal text area
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#d6c9f0';
    ctx.fillRect(80, 390, WIDTH/2 - 160, 100);
    ctx.strokeRect(80, 390, WIDTH/2 - 160, 100);
    
    // Add a create button
    const buttonGradient = ctx.createLinearGradient(80, 520, WIDTH/2 - 80, 520);
    buttonGradient.addColorStop(0, '#9d8ec7');
    buttonGradient.addColorStop(1, '#b49fce');
    ctx.fillStyle = buttonGradient;
    ctx.fillRect(80, 520, WIDTH/2 - 160, 50);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Create Journal', WIDTH/4, 550);
    
    // Draw the journal preview on the right
    ctx.shadowColor = 'rgba(157, 142, 199, 0.3)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(template, WIDTH - templateWidth - 50, (HEIGHT - templateHeight) / 2, templateWidth, templateHeight);
    ctx.shadowColor = 'transparent';
    
    // Add a title to the app
    ctx.fillStyle = '#4a4169';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('mania', WIDTH/2, 50);
    
    const subGradient = ctx.createLinearGradient(WIDTH/2 - 100, 70, WIDTH/2 + 100, 70);
    subGradient.addColorStop(0, '#9d8ec7');
    subGradient.addColorStop(1, '#b49fce');
    ctx.fillStyle = subGradient;
    ctx.font = '18px Arial';
    ctx.fillText('Beautiful journal entries with a lavender aesthetic', WIDTH/2, 80);
    
    // Save the screenshot
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('./public/journal-screenshot.png', buffer);
    
    console.log('Screenshot created successfully!');
  } catch (err) {
    console.error('Error creating screenshot:', err);
  }
}

createScreenshot(); 