import { ArrowRight, Github } from "lucide-react";
import Reveal from "./Reveal";
import { GUMROAD_URL } from "./data";

export default function CTA() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <Reveal variant="scale">
          <div className="relative overflow-hidden rounded-3xl border border-forge-500/20 bg-gradient-to-b from-forge-500/[0.08] to-transparent px-6 py-16 text-center sm:px-12 sm:py-20">
            {/* glow */}
            <div className="glow-orb left-1/2 top-0 h-48 w-[30rem] -translate-x-1/2 bg-forge-500/25" />
            <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />

            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Stop writing boilerplate.
                <br />
                Start shipping agents.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-zinc-400">
                15 production-ready templates. MIT-licensed. Free on GitHub.
                Clone, scaffold, and start building in 30 seconds.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={GUMROAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-glow inline-flex items-center justify-center gap-2 rounded-xl bg-forge-500 px-7 py-4 text-base font-semibold text-white"
                >
                  <Github className="h-5 w-5" />
                  Star on GitHub
                  <ArrowRight className="h-4.5 w-4.5" />
                </a>
                <a
                  href="#templates"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-7 py-4 text-base font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                >
                  Browse templates
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
