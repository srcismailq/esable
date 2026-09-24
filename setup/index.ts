import { createStatusServer } from './infrasetup_server'; 

const PORT = 8080;
const server = createStatusServer();

server.listen(PORT, () => {
  console.log(`🚀 Docker status monitoring server is running on http://localhost:${PORT}`);
  console.log(`📡 SSE endpoint available at http://localhost:${PORT}/status`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.close(() => {
    process.exit(0);
  });
});
