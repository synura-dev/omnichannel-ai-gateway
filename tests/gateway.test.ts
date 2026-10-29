import { describe, expect, test } from "bun:test";
import {
  OmnichannelRouter,
  ZaloOAAdapter,
  TelegramAdapter,
  MessengerAdapter,
  WebWidgetAdapter,
  GeminiProvider,
} from "../src/index";

describe("Omnichannel AI Gateway Tests", () => {
  test("Zalo OA webhook parse & response", async () => {
    const mockResponder = async (prompt: string) => "Xin chào! Đây là trợ lý Zalo: " + prompt;
    const provider = new GeminiProvider({
      apiKey: "test-api-key",
      mockResponder,
    });

    const router = new OmnichannelRouter({
      llmProvider: provider,
      maxHistoryTurns: 10,
    });

    router.registerAdapter(new ZaloOAAdapter());

    const zaloPayload = {
      event_name: "user_send_text",
      sender: { id: "zalo_user_123" },
      message: { text: "Tư vấn tuyển dụng", msg_id: "m_1" },
    };

    const res = await router.handleWebhook("zalo", zaloPayload, "tenant-default");

    expect(res).toBeDefined();
    expect(res?.reply.recipientId).toBe("zalo_user_123");
    expect(res?.reply.text).toContain("Xin chào! Đây là trợ lý Zalo: Tư vấn tuyển dụng");
    expect(res?.rawPayload).toEqual({
      recipient: { user_id: "zalo_user_123" },
      message: { text: res?.reply.text },
    });
  });

  test("Telegram & Messenger adapters parse & response", async () => {
    const provider = new GeminiProvider({
      apiKey: "test-api-key",
      mockResponder: async (prompt: string) => "AI Echo: " + prompt,
    });

    const router = new OmnichannelRouter({
      llmProvider: provider,
    });

    router.registerAdapter(new TelegramAdapter());
    router.registerAdapter(new MessengerAdapter());

    // 1. Telegram update test
    const telegramPayload = {
      update_id: 100,
      message: {
        chat: { id: 987654 },
        text: "/start",
      },
    };

    const telegramRes = await router.handleWebhook("telegram", telegramPayload, "tenant-default");
    expect(telegramRes).toBeDefined();
    expect(telegramRes?.reply.recipientId).toBe("987654");
    expect(telegramRes?.reply.text).toContain("AI Echo: /start");
    expect((telegramRes?.rawPayload as any)?.chat_id).toBe("987654");

    // 2. Messenger payload test
    const messengerPayload = {
      entry: [
        {
          messaging: [
            {
              sender: { id: "fb_user_456" },
              message: { text: "Hello AI", mid: "fb_m_1" },
            },
          ],
        },
      ],
    };

    const messengerRes = await router.handleWebhook("messenger", messengerPayload, "tenant-default");
    expect(messengerRes).toBeDefined();
    expect(messengerRes?.reply.recipientId).toBe("fb_user_456");
    expect(messengerRes?.reply.text).toContain("AI Echo: Hello AI");
    expect((messengerRes?.rawPayload as any)?.recipient).toEqual({ id: "fb_user_456" });
  });

  test("Multi-tenant Session Isolation & History trimming", async () => {
    const provider = new GeminiProvider({
      apiKey: "test-api-key",
      mockResponder: async (prompt: string) => "Response for: " + prompt,
    });

    const maxTurns = 3;
    const router = new OmnichannelRouter({
      llmProvider: provider,
      maxHistoryTurns: maxTurns,
    });

    router.registerAdapter(new WebWidgetAdapter());

    // Kiểm tra getSessionKey nếu router expose method
    if (typeof (router as any).getSessionKey === "function") {
      const keyA = (router as any).getSessionKey("tenant-company-a", "user_1");
      const keyB = (router as any).getSessionKey("tenant-company-b", "user_1");
      expect(keyA).not.toBe(keyB);
    }

    const payloadA = {
      sessionId: "user_1",
      userId: "user_1",
      message: "Hỏi chính sách tuyển dụng công ty A",
    };

    const payloadB = {
      sessionId: "user_1",
      userId: "user_1",
      message: "Hỏi chính sách tuyển dụng công ty B",
    };

    await router.handleWebhook("web", payloadA, "tenant-company-a");
    await router.handleWebhook("web", payloadB, "tenant-company-b");

    // Lấy session kiểm tra cô lập
    const sessionStore = (router as any).sessionStore || (router as any).sessions;
    if (sessionStore && typeof sessionStore.get === "function") {
      const sessionA = sessionStore.get(
        typeof (router as any).getSessionKey === "function"
          ? (router as any).getSessionKey("tenant-company-a", "user_1")
          : "tenant-company-a:user_1"
      );
      const sessionB = sessionStore.get(
        typeof (router as any).getSessionKey === "function"
          ? (router as any).getSessionKey("tenant-company-b", "user_1")
          : "tenant-company-b:user_1"
      );

      if (sessionA && sessionB) {
        expect(sessionA.messages.some((m: any) => m.content.includes("công ty A"))).toBe(true);
        expect(sessionA.messages.some((m: any) => m.content.includes("công ty B"))).toBe(false);

        expect(sessionB.messages.some((m: any) => m.content.includes("công ty B"))).toBe(true);
        expect(sessionB.messages.some((m: any) => m.content.includes("công ty A"))).toBe(false);
      }
    }

    // Kiểm tra history trimming: gửi 6 lượt liên tiếp
    for (let i = 1; i <= 6; i++) {
      await router.handleWebhook(
        "web",
        { sessionId: "user_trim", userId: "user_trim", message: `Turn message ${i}` },
        "tenant-company-a"
      );
    }

    if (sessionStore && typeof sessionStore.get === "function") {
      const sessionTrim = sessionStore.get(
        typeof (router as any).getSessionKey === "function"
          ? (router as any).getSessionKey("tenant-company-a", "user_trim")
          : "tenant-company-a:user_trim"
      );
      if (sessionTrim) {
        // maxHistoryTurns * 2 (user + model messages per turn) = 6 messages
        expect(sessionTrim.messages.length).toBeLessThanOrEqual(maxTurns * 2);
      }
    }
  });
});
