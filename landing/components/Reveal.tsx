"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  variant?: "up" | "fade" | "scale";
  delay?: 1 | 2 | 3 | 4 | 5 | 6;
  once?: boolean;
  threshold?: number;
};

const variantClass: Record<NonNullable<RevealProps["variant"]>, string> = {
  up: "reveal",
  fade: "reveal-fade",
  scale: "reveal-scale",
};

export default function Reveal({
  children,
  as: Tag = "div",
  className = "",
  variant = "up",
  delay,
  once = true,
  threshold = 0.15,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, threshold]);

  const classes = [
    variantClass[variant],
    delay ? `reveal-delay-${delay}` : "",
    visible ? "is-visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag ref={ref as never} className={classes}>
      {children}
    </Tag>
  );
}
