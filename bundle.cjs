const fs = require('fs');
const path = require('path');

// Paths
const distDir = path.join(__dirname, 'dist');
const htmlPath = path.join(distDir, 'index.html');
const outputPath = path.join(__dirname, '..', 'reFlow.html');

console.log('Starting bundle process...');

if (!fs.existsSync(htmlPath)) {
  console.error('Error: dist/index.html not found. Run "npm run build" first.');
  process.exit(1);
}

let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Regex to find script and style assets
const scriptRegex = /<script\s+type="module"\s+crossorigin\s+src="\/assets\/([^"]+)"><\/script>/g;
const linkRegex = /<link\s+rel="stylesheet"\s+crossorigin\s+href="\/assets\/([^"]+)">/g;

// Inline JS
htmlContent = htmlContent.replace(scriptRegex, (match, fileName) => {
  const filePath = path.join(distDir, 'assets', fileName);
  console.log(`Inlining JS asset: ${fileName}`);
  if (fs.existsSync(filePath)) {
    const jsContent = fs.readFileSync(filePath, 'utf8');
    // We wrap the JS content. Note that we must be careful with closing script tags inside strings if any.
    const escapedJsContent = jsContent.replace(/<\/script>/g, '<\\/script>');
    return `<script type="module">\n${escapedJsContent}\n</script>`;
  } else {
    console.error(`Error: JS file not found at ${filePath}`);
    return match;
  }
});

// Inline CSS
htmlContent = htmlContent.replace(linkRegex, (match, fileName) => {
  const filePath = path.join(distDir, 'assets', fileName);
  console.log(`Inlining CSS asset: ${fileName}`);
  if (fs.existsSync(filePath)) {
    const cssContent = fs.readFileSync(filePath, 'utf8');
    return `<style>\n${cssContent}\n</style>`;
  } else {
    console.error(`Error: CSS file not found at ${filePath}`);
    return match;
  }
});

// Write to final single-file HTML location
fs.writeFileSync(outputPath, htmlContent, 'utf8');
console.log(`Successfully created self-sufficient HTML file at: ${outputPath}`);
console.log(`File size: ${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB`);
