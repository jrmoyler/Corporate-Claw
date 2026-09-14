import { ChatMessage } from '../types';
export class GeminiService {
  async chat(systemInstruction: string, history: ChatMessage[], message: string): Promise<string> {
    const response = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, history: history.slice(-20), message }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Chat is temporarily unavailable. Please try again.');
    }
    return (await response.json()).text;
  }
}
export const geminiService = new GeminiService();
