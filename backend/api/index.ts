import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/bootstrap';

/**
 * Vercel serverless entry for the NestJS API.
 * The app is created once per warm instance and reused across invocations.
 * NOTE: serverless has no long-lived connections — Socket.IO realtime is not
 * available here (use Supabase Realtime or a dedicated host for that).
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let handler: Handler | null = null;

async function getHandler(): Promise<Handler> {
  if (!handler) {
    const app = await createApp();
    await app.init();
    handler = app.getHttpAdapter().getInstance() as unknown as Handler;
  }
  return handler;
}

export default async function (req: IncomingMessage, res: ServerResponse) {
  const h = await getHandler();
  h(req, res);
}
