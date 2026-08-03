import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HazelWhat - Client Panel",
  description: "WhatsApp Automation & CRM Client Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
