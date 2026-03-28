import type { PopupPanelId } from "@/types/popup";

export const POPUP_CHANNEL_NAME = "audio-content-analyzer-popups";
export const POPUP_STATE_STORAGE_KEY = "audio-content-analyzer-popup-state";

export const POPUP_PANEL_META: Record<
  PopupPanelId,
  { label: string; width: number; height: number }
> = {
  transcript: {
    label: "リアルタイム字幕",
    width: 520,
    height: 760
  },
  intent: {
    label: "リアルタイム発話分析",
    width: 520,
    height: 760
  },
  verification: {
    label: "検証アシスタント",
    width: 560,
    height: 820
  },
  assistant: {
    label: "分析アシスタント",
    width: 560,
    height: 820
  }
};

export const POPUP_PANEL_ORDER = Object.keys(
  POPUP_PANEL_META
) as PopupPanelId[];

export function buildPopupFeatures(panelId: PopupPanelId) {
  const meta = POPUP_PANEL_META[panelId];
  return [
    "popup=yes",
    "resizable=yes",
    "scrollbars=yes",
    "left=0",
    "top=0",
    `width=${meta.width}`,
    `height=${meta.height}`
  ].join(",");
}
