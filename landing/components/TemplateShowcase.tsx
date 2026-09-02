import { Wrench } from "lucide-react";
import { templateGroups } from "./data";
import Reveal from "./Reveal";

const langBadge: Record<string, string> = {
  TypeScript: "text-blue-300 bg-blue-500/10 border-blue-500/20",
  Python: "text-yellow-300 bg-yellow-500/10 border-yellow-500/20",
  Agent: "text-forge-300 bg-forge-500/10 border-forge-500/20",
};

export default function TemplateShowcase() {
  return (
    <section id="templates" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-50" />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <Reveal variant="fade" className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forge-400">
            15 templates
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Production-ready, not toy examples
          </h2>
          <p className="mt-4 text-zinc-400">
            Every template ships with tests, typed schemas, Docker configs, and
            client integration files. Pick a pattern, scaffold, and deploy.
          </p>
        </Reveal>

        <div className="mt-16 space-y-14">
          {templateGroups.map((group, gi) => (
            <div key={group.category}>
              <Reveal
                variant="fade"
                delay={1}
                className="flex items-center gap-3"
              >
                <span className={`h-2 w-2 rounded-full ${dotColor(group.category)}`} />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                  {group.label}
                </h3>
                <span className="font-mono text-xs text-zinc-600">
                  {group.templates.length} templates
                </span>
                <div className="ml-2 h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </Reveal>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.templates.map((t, i) => (
                  <Reveal
                    key={t.name}
                    variant="up"
                    delay={((i % 3) + 1) as 1 | 2 | 3}
                    className="card-sheen group relative flex flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 transition-all hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-[15px] font-semibold text-white">
                        {t.name}
                      </h4>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium ${langBadge[t.lang]}`}
                      >
                        {t.lang}
                      </span>
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">
                      {t.desc}
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                      <Wrench className="h-3.5 w-3.5 text-zinc-600" />
                      {t.tools} {t.tools === 1 ? "tool" : "tools"}
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function dotColor(cat: string) {
  switch (cat) {
    case "typescript":
      return "bg-blue-400";
    case "python":
      return "bg-yellow-400";
    default:
      return "bg-forge-400";
  }
}
