import { Check, ArrowRight, Infinity as InfinityIcon, FileText, Boxes, Terminal } from "lucide-react";
import Reveal from "./Reveal";
import { GUMROAD_URL } from "./data";

const included = [
  "All 15 templates (10 MCP servers + 5 agent patterns)",
  "CLI scaffolding tool (npx agentforge init)",
  "TypeScript + Python implementations",
  "Docker configs + deployment guides",
  "Client integration files (Claude, Cursor, Windsurf, VS Code)",
  "Full documentation & quickstart",
];

const badges = [
  { icon: InfinityIcon, label: "Lifetime updates" },
  { icon: FileText, label: "Commercial license" },
  { icon: Boxes, label: "15 templates" },
  { icon: Terminal, label: "CLI included" },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="glow-orb left-1/2 top-1/3 h-72 w-[40rem] -translate-x-1/2 bg-forge-600/15" />
      <div className="relative mx-auto max-w-5xl px-5 sm:px-6">
        <Reveal variant="fade" className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forge-400">
            Pricing
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            One payment. Yours forever.
          </h2>
          <p className="mt-4 text-zinc-400">
            No subscriptions, no per-seat pricing. Buy once and use it on every
            project you ever build.
          </p>
        </Reveal>

        <Reveal variant="scale" delay={2} className="mt-14">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-8 sm:p-10">
            {/* top accent line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forge-500/60 to-transparent" />

            <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
              {/* left: price + CTA */}
              <div>
                <div className="flex items-end gap-3">
                  <span className="text-6xl font-semibold tracking-tight text-white sm:text-7xl">
                    $49
                  </span>
                  <span className="mb-2 text-sm text-zinc-500">one-time</span>
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  Save 40+ hours of boilerplate. That&apos;s just over $1 per
                  hour saved.
                </p>

                <a
                  href={GUMROAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-glow mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forge-500 px-6 py-4 text-base font-semibold text-white sm:w-auto"
                >
                  Buy on Gumroad
                  <ArrowRight className="h-4.5 w-4.5" />
                </a>
                <p className="mt-3 text-xs text-zinc-500">
                  Instant download · Secure checkout via Gumroad
                </p>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  {badges.map((b) => {
                    const Icon = b.icon;
                    return (
                      <div
                        key={b.label}
                        className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-zinc-300"
                      >
                        <Icon className="h-4 w-4 text-forge-400" />
                        {b.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* right: included list */}
              <div className="lg:border-l lg:border-white/10 lg:pl-12">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                  What&apos;s included
                </h3>
                <ul className="mt-5 space-y-3.5">
                  {included.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forge-500/15 text-forge-400">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
