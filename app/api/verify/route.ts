import { NextResponse } from "next/server";
import { extractJsonObject } from "@/lib/validators";
import { getSakuraChatConfig, sakuraFetch } from "@/lib/sakura";
import { getTavilyConfig, tavilySearch } from "@/lib/tavily";
import {
  buildVerificationQueries,
  fallbackVerification,
  normalizeExternalCheck,
  normalizeVerification,
  unavailableExternalCheck
} from "@/lib/verify";
import {
  EVIDENCE_SYSTEM_PROMPT,
  EVIDENCE_USER_TEMPLATE,
  VERIFY_SYSTEM_PROMPT,
  VERIFY_USER_TEMPLATE
} from "@/lib/verifyPrompts";
import type { VerificationSource } from "@/types/verification";

export const runtime = "nodejs";

async function runEvidenceCheck(params: {
  currentUtterance: string;
  publicTopics: { topic: string; reason: string }[];
  suggestedQueries: string[];
}) {
  const tavilyConfig = getTavilyConfig();
  if (!tavilyConfig) {
    return unavailableExternalCheck(
      "Tavily APIキー未設定のため、外部検索は未実行です。",
      params.suggestedQueries,
      false
    );
  }

  const searchQueries = buildVerificationQueries(
    params.suggestedQueries,
    params.publicTopics
  );
  if (searchQueries.length === 0) {
    return unavailableExternalCheck(
      "公開情報で検索可能なクエリがまだ抽出されていません。",
      [],
      true
    );
  }

  try {
    const searchResponses = await Promise.all(
      searchQueries.map(async (query) => {
        const payload = await tavilySearch(query, tavilyConfig);
        return { query, payload };
      })
    );

    const sourceEntries: Array<[string, VerificationSource]> = searchResponses.flatMap(
      ({ query, payload }) =>
        payload.results.map(
          (result): [string, VerificationSource] => [
            result.url,
            {
              query,
              title: result.title,
              url: result.url,
              snippet: result.content,
              domain: "",
              score: result.score,
              published_date: result.published_date
            }
          ]
        )
    );
    sourceEntries.sort((a, b) => b[1].score - a[1].score);

    const sources = Array.from(
      new Map<string, VerificationSource>(sourceEntries).values()
    ).slice(0, 6);

    if (sources.length === 0) {
      return unavailableExternalCheck(
        "外部検索は実行しましたが、十分な公開ソースを取得できませんでした。",
        searchQueries,
        true
      );
    }

    const sakuraConfig = getSakuraChatConfig();
    if (!sakuraConfig) {
      return unavailableExternalCheck(
        "検索結果は取得しましたが、判定モデル設定が不足しています。",
        searchQueries,
        true
      );
    }

    const response = await sakuraFetch("/chat/completions", sakuraConfig, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: sakuraConfig.chatModel,
        messages: [
          { role: "system", content: EVIDENCE_SYSTEM_PROMPT },
          {
            role: "user",
            content: EVIDENCE_USER_TEMPLATE({
              current_utterance: params.currentUtterance,
              public_topics: params.publicTopics,
              searched_queries: searchQueries,
              sources
            })
          }
        ],
        temperature: 0.1,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return unavailableExternalCheck(
        "検索結果は取得しましたが、外部根拠の評価に失敗しました。",
        searchQueries,
        true,
        `Sakura Chat error ${response.status}: ${errorText || "unknown"}`
      );
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return unavailableExternalCheck(
        "検索結果は取得しましたが、評価レスポンスが空でした。",
        searchQueries,
        true
      );
    }

    const parsed = extractJsonObject(content);
    return normalizeExternalCheck(parsed, searchQueries, sources, true);
  } catch (error) {
    console.error("External verify error", error);
    return unavailableExternalCheck(
      "外部検索の途中でエラーが発生しました。",
      searchQueries,
      true,
      error instanceof Error ? error.message : "unknown"
    );
  }
}

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
    const externalCheck =
      normalized.status === "out_of_scope"
        ? unavailableExternalCheck(
            "非公開情報の可能性があるため、外部検索は行っていません。",
            normalized.suggested_queries,
            false
          )
        : await runEvidenceCheck({
            currentUtterance,
            publicTopics: normalized.public_topics,
            suggestedQueries: normalized.suggested_queries
          });

    return NextResponse.json({
      ...normalized,
      external_check: externalCheck
    });
  } catch (error) {
    console.error("Verify error", error);
    return NextResponse.json(
      { ...fallbackVerification(""), error: "Server error" },
      { status: 500 }
    );
  }
}
