import { config } from './config/env.js';
import { buildGateway } from './app.js';

const app = await buildGateway();

await app.listen({ port: config.PORT, host: config.HOST });
app.log.info(`AION Edge Gateway listening on ${config.HOST}:${config.PORT}`);

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  });
}
