import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "音声コンテンツ分析",
  description: "動画、会議、セミナーの音声を要約・分析・検証するツール"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 text-ink">
        {children}
      </body>
    </html>
  );
}
