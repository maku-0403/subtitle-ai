import { NextResponse } from "next/server";
import { extractJsonObject } from "@/lib/validators";
import { getSakuraChatConfig, sakuraFetch } from "@/lib/sakura";
import { ASSISTANT_SYSTEM_PROMPT, buildAssistantUserPrompt } from "@/lib/assistantPrompts";
import { getTavilyConfig, tavilySearch } from "@/lib/tavily";

export const runtime = "nodejs";

async function runAssistantSearch(question: string) {
  const tavilyConfig = getTavilyConfig();
  if (!tavilyConfig) {
    return null;
  }

  try {
    const response = await tavilySearch(question, tavilyConfig);
    const results = response.results.slice(0, 4).map((item) => {
      let domain = "";
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, "");
      } catch {
        domain = "";
      }

      return {
        title: item.title,
        url: item.url,
        domain,
        snippet: item.content,
        published_date: item.published_date
      };
    });

    if (!response.answer && results.length === 0) {
      return null;
    }

    return {
      query: question,
      answer: response.answer,
      results
    };
  } catch (error) {
    console.error("Assistant search error", error);
    return null;
  }
}

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

    const contentContext =
      body?.contentContext && typeof body.contentContext === "object"
        ? body.contentContext
        : {};
    const contentType =
      typeof contentContext?.contentType === "string"
        ? contentContext.contentType
        : "YouTube動画";
    const analysisNote =
      typeof contentContext?.analysisNote === "string"
        ? contentContext.analysisNote
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
    const externalCheck =
      body?.externalCheck && typeof body.externalCheck === "object"
        ? body.externalCheck
        : null;
    const externalSearch = await runAssistantSearch(question);

    const messages = [
      { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildAssistantUserPrompt({
          question,
          content_context: {
            content_type: contentType,
            analysis_note: analysisNote
          },
          latest_utterance: latestUtterance,
          session_context: sessionContext,
          verification_topics: verificationTopics,
          suggested_queries: suggestedQueries,
          external_check: externalCheck,
          external_search: externalSearch
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
    const followupsValue = (parsed as { followups?: unknown[] }).followups;
    const rawFollowups: unknown[] = Array.isArray(followupsValue) ? followupsValue : [];
    const followups =
      rawFollowups.filter((item): item is string => typeof item === "string").slice(0, 4);

    return NextResponse.json({ answer, followups });
  } catch (error) {
    console.error("Assistant error", error);
    return NextResponse.json(
      { answer: "", error: "Server error" },
      { status: 500 }
    );
  }
}
