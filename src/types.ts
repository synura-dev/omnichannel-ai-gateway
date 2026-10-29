export type ChannelType = "zalo" | "telegram" | "messenger" | "web-widget";

export interface InboundMessage {
  id: string;
  channel: ChannelType;
  tenantId: string;
  senderId: string;
  text: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface OutboundReply {
  channel: ChannelType;
  recipientId: string;
  text: string;
  quickReplies?: string[];
  latencyMs?: number;
}

export interface ChannelAdapter {
  readonly channel: ChannelType;
  parseWebhook(payload: unknown, tenantId: string): InboundMessage | null;
  formatOutbound(reply: OutboundReply): Record<string, unknown>;
}

export interface ConversationTurn {
  role: "user" | "model";
  content: string;
  timestamp: number;
}

export interface LLMProvider {
  readonly name: string;
  generateReply(
    prompt: string,
    history: ConversationTurn[],
    systemInstruction?: string
  ): Promise<string>;
}
