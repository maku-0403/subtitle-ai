import PopupPanelClient from "@/components/PopupPanelClient";
import { POPUP_PANEL_META } from "@/lib/popup";
import type { PopupPanelId } from "@/types/popup";
import { notFound } from "next/navigation";

function isPopupPanelId(value: string): value is PopupPanelId {
  return value in POPUP_PANEL_META;
}

export default async function PopupPanelPage({
  params
}: {
  params: Promise<{ panel: string }>;
}) {
  const { panel } = await params;

  if (!isPopupPanelId(panel)) {
    notFound();
  }

  return <PopupPanelClient panelId={panel} />;
}
