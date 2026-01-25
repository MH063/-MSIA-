const path = require('path');
const { register } = require('ts-node');

// Change working directory to server to match expected environment
// This ensures .env, prisma, and other relative paths in server work correctly
const serverDir = path.join(__dirname, 'server');
process.chdir(serverDir);

console.log(`[Startup] Working directory changed to: ${process.cwd()}`);

// Register ts-node with the server's tsconfig
register({
  project: path.join(serverDir, 'tsconfig.json'),
  transpileOnly: true, // Speed up startup by skipping type checking
  files: true
});

console.log('[Startup] ts-node registered, starting server...');

// Import the server entry point
// Note: We are now in 'server' directory, so we require './src/index.ts'
try {
  require('./src/index.ts');
} catch (err) {
  console.error('[Startup] Failed to start server:', err);
  process.exit(1);
}
