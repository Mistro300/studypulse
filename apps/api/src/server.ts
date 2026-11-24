import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

async function start(): Promise<void> {
  const env = loadEnv();
  const { fastify } = await buildApp(env);

  try {
    await fastify.listen({ port: env.API_PORT, host: env.API_HOST });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

void start();
