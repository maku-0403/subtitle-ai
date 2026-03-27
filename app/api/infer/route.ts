import { NextResponse } from "next/server";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/prompts";
import { extractJsonObject, fallbackInference, normalizeInference } from "@/lib/validators";
import { getSakuraChatConfig, sakuraFetch } from "@/lib/sakura";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = getSakuraChatConfig();
    if (!config) {
      return NextResponse.json(
        { ...fallbackInference(""), error: "Missing SAKURA_AI_API_KEY or SAKURA_CHAT_MODEL" },
        {
          status: 500,
          statusText: "Missing Sakura config"
        }
      );
    }

    const body = await request.json();
    const currentUtterance =
      typeof body?.currentUtterance === "string" ? body.currentUtterance : "";
    const recentContext = Array.isArray(body?.recentContext)
      ? body.recentContext.filter((item: unknown) => typeof item === "string")
      : [];
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
    const toneFeatures =
      body?.toneFeatures && typeof body.toneFeatures === "object"
        ? body.toneFeatures
        : null;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildUserPrompt(
          currentUtterance,
          recentContext,
          sessionContext,
          { relationship, situation },
          toneFeatures
        )
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
          ...fallbackInference(currentUtterance),
          error: `Sakura Chat error ${response.status}: ${errorText || "unknown"}`
        },
        { status: response.status }
      );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    console.log("Infer payload keys:", Object.keys(payload ?? {}));
    console.log("Infer raw content:", content);
    if (typeof content !== "string") {
      return NextResponse.json({
        ...fallbackInference(currentUtterance),
        error: "Empty response from model"
      });
    }
    const parsed = extractJsonObject(content);
    if (!parsed) {
      return NextResponse.json({
        ...fallbackInference(currentUtterance),
        error: "Invalid JSON from model",
        meta: { raw: content.slice(0, 200) }
      });
    }
    const normalized = normalizeInference(parsed, currentUtterance);

    if (process.env.NODE_ENV !== "production" && normalized.intent_label === "判断困難") {
      return NextResponse.json({
        ...normalized,
        meta: { raw: content.slice(0, 200) }
      });
    }

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Infer error", error);
    return NextResponse.json(
      { ...fallbackInference(""), error: "Server error" },
      { status: 500 }
    );
  }
}
