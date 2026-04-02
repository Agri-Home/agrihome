"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 shadow-sm",
  secondary:
    "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 disabled:text-gray-400 disabled:bg-gray-50",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-400"
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 disabled:pointer-events-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
