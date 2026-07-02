const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🤐 Starting project packaging...');

const rootDir = __dirname;
const zipFileName = 'flatsync.zip';
const zipFilePath = path.join(rootDir, zipFileName);

// Remove old zip if exists
if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
  console.log('🗑️ Removed old zip file.');
}

// Windows PowerShell command to compress files, excluding node_modules, build outputs and database files.
const psCommand = `powershell -Command "Compress-Archive -Path '${path.join(rootDir, 'backend')}', '${path.join(rootDir, 'frontend')}', '${path.join(rootDir, 'README.md')}', '${path.join(rootDir, 'system_design.md')}', '${path.join(rootDir, '.env.example')}', '${path.join(rootDir, 'zip-project.js')}' -DestinationPath '${zipFilePath}' -Force"`;

console.log('📦 Bundling source files (excluding node_modules and local dev database)...');

exec(psCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Failed to create zip archive:', error);
    console.error(stderr);
    process.exit(1);
  }
  
  console.log(`\n🎉 Success! Project packaged successfully into:`);
  console.log(`📁 ${zipFilePath}`);
  console.log(`ℹ️ You can now find this zip in the project root directory.`);
});
