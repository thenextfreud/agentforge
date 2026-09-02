"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { faqs } from "./data";
import Reveal from "./Reveal";

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <Reveal variant="fade" className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forge-400">
            FAQ
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Questions, answered
          </h2>
        </Reveal>

        <div className="mt-12 divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} variant="fade" delay={((i % 3) + 1) as 1 | 2 | 3}>
                <div>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-white/[0.02] sm:px-6"
                    aria-expanded={isOpen}
                  >
                    <span className="text-[15px] font-medium text-white">
                      {item.q}
                    </span>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isOpen
                          ? "border-forge-500/40 bg-forge-500/10 text-forge-400"
                          : "border-white/10 text-zinc-400"
                      }`}
                    >
                      {isOpen ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-400 sm:px-6">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
