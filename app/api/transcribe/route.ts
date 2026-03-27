import { NextResponse } from "next/server";
import { getSakuraConfig, sakuraFetch } from "@/lib/sakura";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = getSakuraConfig();
    if (!config) {
      return NextResponse.json(
        { text: "", error: "Missing SAKURA_AI_API_KEY" },
        { status: 500, statusText: "Missing Sakura config" }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const language = formData.get("language");

    if (!(file instanceof File)) {
      return NextResponse.json({ text: "", error: "Missing file" }, { status: 400 });
    }

    const forwardForm = new FormData();
    forwardForm.append("file", file, file.name || "chunk.webm");
    forwardForm.append("model", config.sttModel);
    if (typeof language === "string" && language !== "auto") {
      forwardForm.append("language", language);
    }

    const response = await sakuraFetch("/audio/transcriptions", config, {
      method: "POST",
      body: forwardForm
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          text: "",
          error: `Sakura STT error ${response.status}: ${errorText || "unknown"}`
        },
        { status: response.status }
      );
    }

    const payload = await response.json();
    console.log("Transcribe payload keys:", Object.keys(payload ?? {}));
    console.log("Transcribe payload:", payload);
    const textCandidates: Array<string | undefined | null> = [
      typeof payload?.text === "string" ? payload.text : null,
      typeof payload?.transcription === "string" ? payload.transcription : null,
      typeof payload?.result === "string" ? payload.result : null,
      typeof payload?.data?.text === "string" ? payload.data.text : null,
      typeof payload?.results?.[0]?.text === "string"
        ? payload.results[0].text
        : null,
      Array.isArray(payload?.segments)
        ? payload.segments.map((segment: { text?: string }) => segment.text ?? "").join("")
        : null
    ];
    const text = (textCandidates.find((item) => typeof item === "string") || "")
      .toString()
      .trim();

    return NextResponse.json({
      text,
      meta: {
        payloadKeys: Object.keys(payload ?? {}),
        segmentCount: Array.isArray(payload?.segments) ? payload.segments.length : 0
      }
    });
  } catch (error) {
    console.error("Transcribe error", error);
    return NextResponse.json({ text: "", error: "Server error" }, { status: 500 });
  }
}
