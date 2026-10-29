import { ChannelAdapter, ChannelType, InboundMessage, OutboundReply } from "./types.js";

export class ZaloOAAdapter implements ChannelAdapter {
  readonly channel: ChannelType = "zalo";

  parseWebhook(payload: any, tenantId: string): InboundMessage | null {
    if (!payload || payload.event_name !== "user_send_text") {
      return null;
    }
    const senderId = payload.sender?.id ? String(payload.sender.id) : null;
    const text = payload.message?.text;
    if (!senderId || typeof text !== "string" || !text.trim()) {
      return null;
    }
    const id = payload.message?.msg_id ? String(payload.message.msg_id) : String(Date.now());
    return {
      id,
      channel: this.channel,
      tenantId,
      senderId,
      text,
      timestamp: payload.timestamp ? Number(payload.timestamp) : Date.now(),
      rawPayload: payload
    };
  }

  formatOutbound(reply: OutboundReply): Record<string, unknown> {
    return {
      recipient: { user_id: reply.recipientId },
      message: { text: reply.text }
    };
  }
}

export class TelegramAdapter implements ChannelAdapter {
  readonly channel: ChannelType = "telegram";

  parseWebhook(payload: any, tenantId: string): InboundMessage | null {
    if (!payload) return null;
    const msg = payload.message || payload.edited_message;
    if (!msg) return null;
    const chatId = msg.chat?.id ?? msg.from?.id;
    const senderId = chatId !== undefined ? String(chatId) : null;
    const text = msg.text;
    if (!senderId || typeof text !== "string" || !text.trim()) {
      return null;
    }
    const id = String(msg.message_id || payload.update_id || Date.now());
    return {
      id,
      channel: this.channel,
      tenantId,
      senderId,
      text,
      timestamp: msg.date ? Number(msg.date) * 1000 : Date.now(),
      rawPayload: payload
    };
  }

  formatOutbound(reply: OutboundReply): Record<string, unknown> {
    return {
      chat_id: reply.recipientId,
      text: reply.text
    };
  }
}

export class MessengerAdapter implements ChannelAdapter {
  readonly channel: ChannelType = "messenger";

  parseWebhook(payload: any, tenantId: string): InboundMessage | null {
    if (!payload) return null;
    const messaging = payload.entry?.[0]?.messaging?.[0];
    if (!messaging) return null;
    const senderId = messaging.sender?.id ? String(messaging.sender.id) : null;
    const text = messaging.message?.text;
    if (!senderId || typeof text !== "string" || !text.trim()) {
      return null;
    }
    const id = messaging.message?.mid ? String(messaging.message.mid) : String(Date.now());
    return {
      id,
      channel: this.channel,
      tenantId,
      senderId,
      text,
      timestamp: messaging.timestamp ? Number(messaging.timestamp) : Date.now(),
      rawPayload: payload
    };
  }

  formatOutbound(reply: OutboundReply): Record<string, unknown> {
    return {
      recipient: { id: reply.recipientId },
      message: { text: reply.text }
    };
  }
}

export class WebWidgetAdapter implements ChannelAdapter {
  readonly channel: ChannelType = "web-widget";

  parseWebhook(payload: any, tenantId: string): InboundMessage | null {
    if (!payload) return null;
    const senderId = payload.sessionId || payload.userId || "anon";
    const text = payload.text || payload.message;
    if (!senderId || typeof text !== "string" || !text.trim()) {
      return null;
    }
    const id = payload.id ? String(payload.id) : String(Date.now());
    return {
      id,
      channel: this.channel,
      tenantId,
      senderId: String(senderId),
      text,
      timestamp: payload.timestamp ? Number(payload.timestamp) : Date.now(),
      rawPayload: payload
    };
  }

  formatOutbound(reply: OutboundReply): Record<string, unknown> {
    return {
      sessionId: reply.recipientId,
      text: reply.text,
      latencyMs: reply.latencyMs
    };
  }
}
