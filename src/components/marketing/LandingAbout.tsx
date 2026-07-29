"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { DetectionClassGroup } from "@/lib/constants/detection-classes";

type LandingAboutProps = {
  groups: DetectionClassGroup[];
  classCount: number;
  datasetBlurb: string;
};

function diseaseCount(conditions: string[]): number {
  return conditions.filter((c) => c !== "Healthy").length;
}

export function LandingAbout({
  groups,
  classCount,
  datasetBlurb
}: LandingAboutProps) {
  const sectionId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [openPlants, setOpenPlants] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setRevealed(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!filter) return;
    setOpenPlants(new Set([filter]));
  }, [filter]);

  const visibleGroups = filter
    ? groups.filter((g) => g.plant === filter)
    : groups;

  function togglePlant(plant: string) {
    setOpenPlants((prev) => {
      const next = new Set(prev);
      if (next.has(plant)) next.delete(plant);
      else next.add(plant);
      return next;
    });
  }

  return (
    <section
      ref={sectionRef}
      id="about"
      aria-labelledby={`${sectionId}-heading`}
      className={[
        "border-t border-ink/10 pb-20 pt-14 sm:pb-24 sm:pt-16",
        "transition-[opacity,transform] duration-700 ease-out",
        revealed ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      ].join(" ")}
    >
      <h2
        id={`${sectionId}-heading`}
        className="text-2xl font-bold tracking-tight text-ink sm:text-3xl"
      >
        About
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/55 sm:text-base">
        AgriHome reads a leaf photo and names the crop plus common diseases.
        Tap a plant to see the {classCount} conditions we train on today —
        across PlantVillage, PlantDoc, and plant-leaf.
      </p>

      <div
        role="toolbar"
        aria-label="Filter by plant"
        className={[
          "mt-8 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar sm:flex-wrap sm:overflow-visible",
          "transition-[opacity,transform] duration-700 ease-out delay-100",
          revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        ].join(" ")}
      >
        <FilterChip
          label="All plants"
          selected={filter === null}
          onSelect={() => setFilter(null)}
        />
        {groups.map((group) => (
          <FilterChip
            key={group.plant}
            label={group.plant}
            selected={filter === group.plant}
            onSelect={() =>
              setFilter((prev) => (prev === group.plant ? null : group.plant))
            }
          />
        ))}
      </div>

      <ul
        className={[
          "mt-8 divide-y divide-ink/10 border-y border-ink/10",
          "transition-opacity duration-500 ease-out delay-150",
          revealed ? "opacity-100" : "opacity-0"
        ].join(" ")}
      >
        {visibleGroups.map((group, index) => {
          const isOpen = openPlants.has(group.plant);
          const panelId = `${sectionId}-panel-${group.plant.replace(/\s+/g, "-")}`;
          const buttonId = `${sectionId}-btn-${group.plant.replace(/\s+/g, "-")}`;
          const diseases = diseaseCount(group.conditions);
          const hasHealthy = group.conditions.includes("Healthy");

          return (
            <li
              key={group.plant}
              className="transition-[opacity,transform] duration-500 ease-out"
              style={{
                transitionDelay: revealed
                  ? `${Math.min(index, 10) * 40 + 180}ms`
                  : "0ms",
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(10px)"
              }}
            >
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => togglePlant(group.plant)}
                  className="group flex w-full items-center gap-3 py-3.5 text-left transition-colors hover:bg-leaf/10 focus-visible:bg-leaf/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-deep)]"
                >
                  <span
                    aria-hidden
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-white/70 text-ink/50 transition-all duration-300",
                      "group-hover:border-leaf/50 group-hover:text-moss",
                      isOpen
                        ? "rotate-90 border-leaf/40 bg-leaf/25 text-moss"
                        : ""
                    ].join(" ")}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 3.5 10.5 8 6 12.5" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold tracking-tight text-ink">
                      {group.plant}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/45 transition-opacity duration-200 group-hover:text-ink/60">
                      {diseases === 0
                        ? "Healthy class only"
                        : `${diseases} condition${diseases === 1 ? "" : "s"}${
                            hasHealthy ? " · includes healthy" : ""
                          }`}
                    </span>
                  </span>
                </button>
              </h3>

              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                aria-hidden={!isOpen}
                inert={!isOpen ? true : undefined}
                className={[
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                  isOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                ].join(" ")}
              >
                <div className="overflow-hidden">
                  <ul className="flex flex-wrap gap-2 pb-4 pl-10 pr-1">
                    {group.conditions.map((condition, cIdx) => {
                      const healthy = condition === "Healthy";
                      return (
                        <li
                          key={condition}
                          className={[
                            "rounded-xl px-2.5 py-1 text-xs font-medium transition-all duration-300",
                            healthy
                              ? "bg-leaf/30 text-moss"
                              : "bg-ink/[0.04] text-ink/70 ring-1 ring-ink/10",
                            isOpen
                              ? "translate-y-0 opacity-100"
                              : "translate-y-1 opacity-0"
                          ].join(" ")}
                          style={{
                            transitionDelay: isOpen
                              ? `${cIdx * 35 + 40}ms`
                              : "0ms"
                          }}
                        >
                          {condition}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p
        className={[
          "mt-8 text-xs leading-relaxed text-ink/40",
          "transition-opacity duration-700 delay-300",
          revealed ? "opacity-100" : "opacity-0"
        ].join(" ")}
      >
        {datasetBlurb}
      </p>
    </section>
  );
}

function FilterChip({
  label,
  selected,
  onSelect
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        "shrink-0 rounded-2xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.97]",
        selected
          ? "bg-ink text-white shadow-sm"
          : "border border-[var(--border-strong)] bg-white/70 text-ink/65 backdrop-blur-sm hover:border-leaf/40 hover:bg-white hover:text-ink"
      ].join(" ")}
    >
      {label}
    </button>
  );
}
