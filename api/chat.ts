import { GoogleGenAI } from '@google/genai';
import type { IncomingMessage, ServerResponse } from 'node:http';
type Request = IncomingMessage & { body?: unknown };
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status: number, body: object) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return reply(405, { error: 'Method not allowed' }); }
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return reply(403, { error: 'Origin not allowed' });
  const body = req.body as any;
  if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000 || typeof body.systemInstruction !== 'string' || body.systemInstruction.length > 4000 || !Array.isArray(body.history) || body.history.length > 20 || body.history.some((m: any) => !m || !['user', 'model'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 4000)) return reply(400, { error: 'Invalid chat request' });
  if (!process.env.GEMINI_API_KEY) return reply(503, { error: 'Agent chat is not configured yet. The office simulation and training remain available.' });
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: [...body.history.map((m: any) => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: body.message }] }],
      config: { systemInstruction: body.systemInstruction, maxOutputTokens: 300, httpOptions: { timeout: 20000 } },
    });
    return reply(200, { text: result.text || 'Please rephrase your question.' });
  } catch { return reply(502, { error: 'The agent service is unavailable. Please try again shortly.' }); }
}
