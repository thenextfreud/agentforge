"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle } from "lucide-react";

type Line = {
  text: string;
  type: "cmd" | "out" | "ok" | "muted" | "prompt";
  delay?: number;
};

const script: Line[] = [
  { text: "$ npx @atlasforge/agentforge init my-server", type: "cmd" },
  { text: "✔ Select template › REST API Wrapper (TypeScript)", type: "out", delay: 350 },
  { text: "✔ Transport › stdio", type: "out", delay: 250 },
  { text: "✔ Auth › OAuth 2.1", type: "out", delay: 250 },
  { text: "", type: "out", delay: 120 },
  { text: "Scaffolding project...", type: "muted", delay: 200 },
  { text: "  ✓ src/tools/{search,fetch,create}.ts", type: "ok", delay: 280 },
  { text: "  ✓ src/server.ts", type: "ok", delay: 180 },
  { text: "  ✓ Dockerfile + docker-compose.yml", type: "ok", delay: 180 },
  { text: "  ✓ .mcp/claude-desktop.json", type: "ok", delay: 180 },
  { text: "  ✓ README + deployment guides", type: "ok", delay: 180 },
  { text: "", type: "out", delay: 120 },
  { text: "Done in 2.1s. Next:", type: "out", delay: 200 },
  { text: "  cd my-server && npm run dev", type: "prompt", delay: 200 },
];

const colorFor: Record<Line["type"], string> = {
  cmd: "text-forge-400",
  out: "text-zinc-300",
  ok: "text-emerald-400",
  muted: "text-zinc-500",
  prompt: "text-sky-400",
};

export default function CodePreview() {
  const [count, setCount] = useState(0);
  const [typed, setTyped] = useState("");
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !startedRef.current) {
          startedRef.current = true;
          run();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run() {
    let i = 0;
    let charIdx = 0;
    let lineBuffer = "";

    const typeChar = () => {
      if (i >= script.length) {
        // loop after a pause
        setTimeout(() => {
          startedRef.current = false;
          setCount(0);
          setTyped("");
          run();
        }, 4200);
        return;
      }
      const line = script[i];
      if (charIdx === 0) lineBuffer = "";
      if (charIdx <= line.text.length) {
        lineBuffer = line.text.slice(0, charIdx);
        setTyped(lineBuffer);
        charIdx++;
        const isCmd = line.type === "cmd";
        const speed = isCmd ? 42 : 8;
        setTimeout(typeChar, speed);
      } else {
        // commit line, advance
        setCount(i + 1);
        setTyped("");
        i++;
        charIdx = 0;
        lineBuffer = "";
        setTimeout(typeChar, line.delay ?? 120);
      }
    };
    typeChar();
  }

  return (
    <div ref={sectionRef} className="relative">
      {/* glow */}
      <div
        className="glow-orb -left-10 -top-10 h-40 w-40 bg-forge-500/30"
        style={{ animationDelay: "0s" }}
      />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0e] shadow-2xl shadow-black/60">
        {/* title bar */}
        <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-zinc-500">
            zsh — agentforge
          </span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-500">
            <Circle className="h-2 w-2 fill-forge-400 text-forge-400" />
            live
          </span>
        </div>

        {/* body */}
        <div className="space-y-1 px-5 py-5 font-mono text-[13px] leading-relaxed sm:text-sm">
          {script.slice(0, count).map((line, idx) => (
            <LineRow key={idx} line={line} />
          ))}

          {count < script.length && (
            <div className={colorFor[script[count].type]}>
              <span className="whitespace-pre-wrap">{typed}</span>
              <span className="cursor-blink" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LineRow({ line }: { line: Line }) {
  if (line.text === "") return <div className="h-3" />;
  const icon =
    line.type === "ok" ? (
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
    ) : null;
  return (
    <div className={`flex gap-2 ${colorFor[line.type]}`}>
      {icon}
      <span className="whitespace-pre-wrap">{line.text}</span>
    </div>
  );
}
