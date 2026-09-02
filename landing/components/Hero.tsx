import { ArrowRight, Sparkles, Github } from "lucide-react";
import CodePreview from "./CodePreview";
import Reveal from "./Reveal";
import { GITHUB_URL } from "./data";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="glow-orb left-1/2 top-[-6rem] h-72 w-[36rem] -translate-x-1/2 bg-forge-600/25" />
      <div
        className="glow-orb right-[-4rem] top-24 h-56 w-56 bg-ember-500/20"
        style={{ animationDelay: "3s" }}
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
          {/* left */}
          <div>
            <Reveal variant="fade" delay={1}>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-forge-400" />
                MCP + AI Agent starter kit
              </span>
            </Reveal>

            <Reveal as="h1" variant="up" delay={2} className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ship MCP servers and{" "}
              <span className="text-gradient-forge">AI agents</span> in minutes,
              not days
            </Reveal>

            <Reveal as="p" variant="up" delay={3} className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
              10 production-ready MCP server templates, 5 AI agent patterns, and a
              CLI scaffolding tool. TypeScript + Python. Deploy anywhere.
            </Reveal>

            <Reveal variant="up" delay={4} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-glow inline-flex items-center justify-center gap-2 rounded-xl bg-forge-500 px-6 py-3.5 text-base font-semibold text-white"
              >
                <Github className="h-4.5 w-4.5" />
                Star on GitHub
                <ArrowRight className="h-4.5 w-4.5" />
              </a>
              <a
                href="#templates"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3.5 text-base font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
              >
                View templates
              </a>
            </Reveal>

            <Reveal variant="fade" delay={5} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                MIT licensed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-forge-400" />
                Free forever
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                15 templates
              </span>
            </Reveal>
          </div>

          {/* right - code preview */}
          <Reveal variant="scale" delay={3} className="lg:pl-4">
            <CodePreview />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
