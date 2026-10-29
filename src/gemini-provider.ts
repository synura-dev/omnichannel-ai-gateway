import { ConversationTurn, LLMProvider } from "./types.js";

export class GeminiProvider implements LLMProvider {
  readonly name = "google-gemini";
  private apiKey?: string;
  private model: string;
  private mockResponder?: (prompt: string, history: ConversationTurn[]) => Promise<string> | string;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    mockResponder?: (prompt: string, history: ConversationTurn[]) => Promise<string> | string;
  }) {
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    this.model = options?.model || "gemini-1.5-flash";
    this.mockResponder = options?.mockResponder;
  }

  async generateReply(
    prompt: string,
    history: ConversationTurn[] = [],
    systemInstruction?: string
  ): Promise<string> {
    if (this.mockResponder) {
      return await this.mockResponder(prompt, history);
    }

    if (this.apiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const contents = [
        ...history.map((turn) => ({
          role: turn.role === "assistant" ? "model" : "user",
          parts: [{ text: turn.content }]
        })),
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ];

      const body: Record<string, unknown> = {
        contents
      };

      if (systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error [${res.status}]: ${errText}`);
      }

      const data = (await res.json()) as any;
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return candidateText;
      }
    }

    return `[Echo Gemini ${this.model}]: Received "${prompt}". (History: ${history.length} turns)`;
  }
}
