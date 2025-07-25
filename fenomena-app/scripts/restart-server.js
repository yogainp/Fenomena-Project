#!/usr/bin/env node

const { exec, spawn } = require('child_process');
const os = require('os');

function killNextProcess() {
  return new Promise((resolve) => {
    const isWindows = os.platform() === 'win32';
    const command = isWindows 
      ? 'taskkill /f /im node.exe 2>nul || echo "No processes found"'
      : 'pkill -f "next dev" 2>/dev/null || true';
    
    exec(command, (error, stdout, stderr) => {
      console.log('Stopped existing Next.js processes');
      resolve();
    });
  });
}

function startServer() {
  console.log('Starting server on port 3000...');
  const child = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: '3000' }
  });
  
  process.on('SIGINT', () => {
    child.kill();
    process.exit();
  });
}

async function restartServer() {
  await killNextProcess();
  setTimeout(startServer, 2000);
}

restartServer();