import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentForge — Ship MCP servers & AI agents in minutes",
  description:
    "10 production-ready MCP server templates, 5 AI agent patterns, and a CLI scaffolding tool. TypeScript + Python. Deploy anywhere. One-time $49.",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "AI agents",
    "MCP server templates",
    "Claude",
    "TypeScript",
    "Python",
  ],
  openGraph: {
    title: "AgentForge — Ship MCP servers & AI agents in minutes",
    description:
      "10 production-ready MCP server templates, 5 AI agent patterns, and a CLI scaffolding tool. TypeScript + Python.",
    type: "website",
    url: "https://gumroad.com/l/agentforge",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentForge — Ship MCP servers & AI agents in minutes",
    description:
      "10 production-ready MCP server templates, 5 AI agent patterns, and a CLI scaffolding tool.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
