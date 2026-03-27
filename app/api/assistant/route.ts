import { NextResponse } from "next/server";
import { extractJsonObject } from "@/lib/validators";
import { getSakuraChatConfig, sakuraFetch } from "@/lib/sakura";
import { ASSISTANT_SYSTEM_PROMPT, buildAssistantUserPrompt } from "@/lib/assistantPrompts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = getSakuraChatConfig();
    if (!config) {
      return NextResponse.json(
        { answer: "", error: "Missing SAKURA_AI_API_KEY or SAKURA_CHAT_MODEL" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const question = typeof body?.question === "string" ? body.question : "";
    if (!question.trim()) {
      return NextResponse.json({ answer: "" }, { status: 400 });
    }

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

    const latestUtterance =
      typeof body?.latestUtterance === "string" ? body.latestUtterance : "";
    const sessionContext = Array.isArray(body?.sessionContext)
      ? body.sessionContext.filter((item: unknown) => typeof item === "string")
      : [];
    const verificationTopics = Array.isArray(body?.verificationTopics)
      ? body.verificationTopics
      : [];
    const suggestedQueries = Array.isArray(body?.suggestedQueries)
      ? body.suggestedQueries
      : [];

    const messages = [
      { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildAssistantUserPrompt({
          question,
          conversation_context: { relationship, situation },
          latest_utterance: latestUtterance,
          session_context: sessionContext,
          verification_topics: verificationTopics,
          suggested_queries: suggestedQueries
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
        { answer: "", error: `Sakura Chat error ${response.status}: ${errorText || "unknown"}` },
        { status: response.status }
      );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json({ answer: "", error: "Empty response from model" });
    }

    const parsed = extractJsonObject(content);
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ answer: content.trim().slice(0, 400) });
    }

    const answer =
      typeof (parsed as { answer?: string }).answer === "string"
        ? (parsed as { answer?: string }).answer
        : "";
    const followups =
      Array.isArray((parsed as { followups?: unknown[] }).followups)
        ? (parsed as { followups?: unknown[] }).followups
            .filter((item) => typeof item === "string")
            .slice(0, 4)
        : [];

    return NextResponse.json({ answer, followups });
  } catch (error) {
    console.error("Assistant error", error);
    return NextResponse.json(
      { answer: "", error: "Server error" },
      { status: 500 }
    );
  }
}
