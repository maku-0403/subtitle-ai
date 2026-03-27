import { NextResponse } from "next/server";
import { extractJsonObject } from "@/lib/validators";
import { getSakuraChatConfig, sakuraFetch } from "@/lib/sakura";
import { fallbackVerification, normalizeVerification } from "@/lib/verify";
import { VERIFY_SYSTEM_PROMPT, VERIFY_USER_TEMPLATE } from "@/lib/verifyPrompts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = getSakuraChatConfig();
    if (!config) {
      return NextResponse.json(
        {
          ...fallbackVerification(""),
          error: "Missing SAKURA_AI_API_KEY or SAKURA_CHAT_MODEL"
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const currentUtterance =
      typeof body?.currentUtterance === "string" ? body.currentUtterance : "";
    const sessionContext = Array.isArray(body?.sessionContext)
      ? body.sessionContext.filter((item: unknown) => typeof item === "string")
      : [];
    const conversationContext =
      body?.conversationContext && typeof body.conversationContext === "object"
        ? body.conversationContext
        : {};
    const relationship =
      typeof conversationContext?.relationship === "string"
        ? conversationContext.relationship
        : "不明";
    const situation =
      typeof conversationContext?.situation === "string"
        ? conversationContext.situation
        : "";

    const messages = [
      { role: "system", content: VERIFY_SYSTEM_PROMPT },
      {
        role: "user",
        content: VERIFY_USER_TEMPLATE({
          current_utterance: currentUtterance,
          session_context: sessionContext,
          conversation_context: { relationship, situation }
        })
      }
    ];

    const response = await sakuraFetch("/chat/completions", config, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.chatModel,
        messages,
        temperature: 0.2,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          ...fallbackVerification(currentUtterance),
          error: `Sakura Chat error ${response.status}: ${errorText || "unknown"}`
        },
        { status: response.status }
      );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json({
        ...fallbackVerification(currentUtterance),
        error: "Empty response from model"
      });
    }

    const parsed = extractJsonObject(content);
    if (!parsed) {
      return NextResponse.json({
        ...fallbackVerification(currentUtterance),
        error: "Invalid JSON from model",
        meta: { raw: content.slice(0, 200) }
      });
    }

    const normalized = normalizeVerification(parsed, currentUtterance);
    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Verify error", error);
    return NextResponse.json(
      { ...fallbackVerification(""), error: "Server error" },
      { status: 500 }
    );
  }
}
