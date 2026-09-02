import { features } from "./data";
import Reveal from "./Reveal";

export default function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal variant="fade" className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forge-400">
            Everything included
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            A complete toolkit for the MCP ecosystem
          </h2>
          <p className="mt-4 text-zinc-400">
            Not just snippets — full, tested templates with deployment configs,
            client integration, and documentation. Open the box and ship.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal
                key={f.title}
                variant="up"
                delay={((i % 3) + 1) as 1 | 2 | 3}
                className="card-sheen group relative rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-6 transition-colors hover:border-forge-500/30"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-forge-400 transition-colors group-hover:border-forge-500/40 group-hover:bg-forge-500/10">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {f.desc}
                </p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
