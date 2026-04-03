"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white shadow-lift hover:bg-moss hover:shadow-glow disabled:bg-mist disabled:text-ink/35",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--surface-strong)] text-ink hover:border-leaf/40 hover:bg-white disabled:bg-mist/80 disabled:text-ink/35",
  ghost:
    "bg-transparent text-ink/75 hover:bg-ink/[0.05] hover:text-ink disabled:text-ink/30"
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 ease-spring focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf active:scale-[0.97] disabled:pointer-events-none disabled:shadow-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
