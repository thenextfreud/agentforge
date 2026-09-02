import { Flame, Github, Twitter } from "lucide-react";
import { GUMROAD_URL } from "./data";

const cols = [
  {
    title: "Project",
    links: [
      { label: "Features", href: "#features" },
      { label: "Templates", href: "#templates" },
      { label: "Get Started", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "GitHub",
    links: [
      { label: "Source Code", href: GUMROAD_URL },
      { label: "Issues", href: "https://github.com/thenextfreud/agentforge/issues" },
      { label: "MIT License", href: "https://github.com/thenextfreud/agentforge/blob/master/LICENSE" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "What is MCP?", href: "#faq" },
      { label: "Model Context Protocol", href: "https://modelcontextprotocol.io" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.07] bg-neutral-950">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <a href="#top" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-forge-500 to-ember-500">
                <Flame className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-white">
                AgentForge
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
              The MCP server & AI agent starter kit. Ship production-ready
              integrations in minutes.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
              >
                <Github className="h-4.5 w-4.5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
              >
                <Twitter className="h-4.5 w-4.5" />
              </a>
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target={l.href.startsWith("http") ? "_blank" : undefined}
                      rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="text-sm text-zinc-400 transition-colors hover:text-white"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-6 sm:flex-row">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} AgentForge. All rights reserved.
          </p>
          <p className="font-mono text-xs text-zinc-600">
            Built with Next.js · Tailwind CSS
          </p>
        </div>
      </div>
    </footer>
  );
}
