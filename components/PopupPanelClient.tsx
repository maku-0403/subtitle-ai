"use client";

import { useEffect, useState } from "react";
import AnalysisAssistantPanel from "@/components/AnalysisAssistantPanel";
import LatestIntentPanel from "@/components/LatestIntentPanel";
import LatestTranscriptPanel from "@/components/LatestTranscriptPanel";
import VerificationAssistantPanel from "@/components/VerificationAssistantPanel";
import {
  POPUP_CHANNEL_NAME,
  POPUP_PANEL_META,
  POPUP_STATE_STORAGE_KEY
} from "@/lib/popup";
import type { PopupChannelMessage, PopupPanelId, PopupStateSnapshot } from "@/types/popup";

const EMPTY_SNAPSHOT: PopupStateSnapshot = {
  updatedAt: 0,
  status: "Idle",
  contentType: "",
  analysisNote: "",
  transcriptItems: [],
  liveUtterance: "",
  inferenceItems: [],
  latestVerification: null,
  assistantMessages: [],
  assistantLoading: false
};

interface PopupPanelClientProps {
  panelId: PopupPanelId;
}

export default function PopupPanelClient({ panelId }: PopupPanelClientProps) {
  const [snapshot, setSnapshot] = useState<PopupStateSnapshot>(EMPTY_SNAPSHOT);
  const [assistantInput, setAssistantInput] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POPUP_STATE_STORAGE_KEY);
      if (raw) {
        setSnapshot(JSON.parse(raw) as PopupStateSnapshot);
      }
    } catch (error) {
      console.error(error);
    }

    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(POPUP_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<PopupChannelMessage>) => {
      if (event.data?.type === "snapshot") {
        setSnapshot(event.data.snapshot);
      }
    };
    channel.postMessage({ type: "request_snapshot" } satisfies PopupChannelMessage);

    return () => {
      channel.close();
    };
  }, []);

  useEffect(() => {
    document.title = `${POPUP_PANEL_META[panelId].label} | IMPACT IN FACT`;
  }, [panelId]);

  const assistantHints = [
    ...(snapshot.latestVerification?.public_topics?.map((topic) => topic.topic) ?? []),
    ...(snapshot.latestVerification?.suggested_queries ?? [])
  ].filter(Boolean);
  const latestInference = snapshot.inferenceItems[snapshot.inferenceItems.length - 1];
  const latestTranscript = snapshot.transcriptItems[snapshot.transcriptItems.length - 1];
  const latestText =
    latestInference?.utterance || snapshot.liveUtterance || latestTranscript?.text || "";
  const isLive = snapshot.liveUtterance.trim().length > 0;

  const requestAssistant = () => {
    const question = assistantInput.trim();
    if (!question || snapshot.assistantLoading || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(POPUP_CHANNEL_NAME);
    channel.postMessage({
      type: "assistant_request",
      question
    } satisfies PopupChannelMessage);
    channel.close();
    setAssistantInput("");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-amber-50 p-3">
      {panelId === "transcript" ? (
        <LatestTranscriptPanel latestText={latestText} isLive={isLive} />
      ) : null}
      {panelId === "intent" ? (
        <LatestIntentPanel latestInference={latestInference} isLive={isLive} />
      ) : null}
      {panelId === "verification" ? (
        <VerificationAssistantPanel latestVerification={snapshot.latestVerification} />
      ) : null}
      {panelId === "assistant" ? (
        <AnalysisAssistantPanel
          assistantHints={assistantHints}
          assistantInput={assistantInput}
          assistantLoading={snapshot.assistantLoading}
          assistantMessages={snapshot.assistantMessages}
          onAssistantInputChange={setAssistantInput}
          onSelectHint={setAssistantInput}
          onSubmit={requestAssistant}
        />
      ) : null}
    </main>
  );
}
