import type {
  ChannelAdapter,
  ChannelType,
  ConversationTurn,
  InboundMessage,
  LLMProvider,
  OutboundReply,
} from "./types";

export class OmnichannelRouter {
  private adapters: Map<ChannelType, ChannelAdapter> = new Map();
  private sessions: Map<string, ConversationTurn[]> = new Map();
  private maxHistoryTurns: number;
  private llmProvider: LLMProvider;
  private systemInstruction?: string;

  constructor(options: {
    llmProvider: LLMProvider;
    maxHistoryTurns?: number;
    systemInstruction?: string;
  }) {
    this.llmProvider = options.llmProvider;
    this.maxHistoryTurns = options.maxHistoryTurns ?? 10;
    this.systemInstruction = options.systemInstruction;
  }

  registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }

  getAdapter(channel: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  getSessionKey(tenantId: string, channel: ChannelType, senderId: string): string {
    return `${tenantId}:${channel}:${senderId}`;
  }

  getHistory(tenantId: string, channel: ChannelType, senderId: string): ConversationTurn[] {
    const key = this.getSessionKey(tenantId, channel, senderId);
    return this.sessions.get(key) ?? [];
  }

  clearSession(tenantId: string, channel: ChannelType, senderId: string): void {
    const key = this.getSessionKey(tenantId, channel, senderId);
    this.sessions.delete(key);
  }

  async handleWebhook(
    channel: ChannelType,
    payload: unknown,
    tenantId: string
  ): Promise<{ reply: OutboundReply; rawPayload: Record<string, unknown> } | null> {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      return null;
    }

    const inbound = adapter.parseWebhook(payload, tenantId);
    if (!inbound) {
      return null;
    }

    const key = this.getSessionKey(tenantId, channel, inbound.senderId);
    const history = this.sessions.get(key) ?? [];

    const start = Date.now();
    const answer = await this.llmProvider.generateReply(
      inbound.text,
      history,
      this.systemInstruction
    );
    const latencyMs = Date.now() - start;

    history.push(
      { role: "user", content: inbound.text, timestamp: start },
      { role: "model", content: answer, timestamp: Date.now() }
    );

    const maxItems = this.maxHistoryTurns * 2;
    if (history.length > maxItems) {
      history.splice(0, history.length - maxItems);
    }
    this.sessions.set(key, history);

    const reply: OutboundReply = {
      channel,
      recipientId: inbound.senderId,
      text: answer,
      latencyMs,
    };

    const rawPayload = adapter.formatOutbound(reply);
    return { reply, rawPayload };
  }
}
