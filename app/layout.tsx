import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "空気の裏字幕",
  description: "発話から読み取れる可能性を可視化する字幕ツール"
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
