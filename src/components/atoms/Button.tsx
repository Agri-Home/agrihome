"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#17231a] text-white hover:bg-[#0f170f] disabled:bg-gray-200 disabled:text-gray-400 shadow-[0_10px_22px_rgba(23,35,26,0.18)]",
  secondary:
    "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 disabled:bg-gray-50 disabled:text-gray-400",
  ghost:
    "bg-white/80 text-gray-700 hover:bg-white hover:text-gray-900 disabled:text-gray-400"
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
