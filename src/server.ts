// src/server.ts
import { buildApp } from './app';
import { config } from './config';

const app = buildApp();

const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' }); // Listen on all interfaces for containerization
    app.log.info(`Server listening on port ${config.PORT}`);
    app.log.info(`Google OAuth Initiating URL: /api/auth/google`);
    app.log.info(`Google OAuth Callback URL: ${config.GOOGLE_CALLBACK_URL}`);
    app.log.info(`Frontend URL for Redirects: ${config.FRONTEND_URL}`);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown handling (optional but good practice)
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, closing server...`);
    await app.close();
    app.log.info('Server closed.');
    process.exit(0);
  });
});
