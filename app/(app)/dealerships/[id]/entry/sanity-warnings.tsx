"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Non-blocking sanity checks for the entry form. Reads the sibling inputs on
 * every change and surfaces likely mistakes (e.g. units with $0 gross, a typo'd
 * gross-per-unit). Warnings only — saving is never prevented.
 */
export function EntrySanityWarnings() {
  const ref = useRef<HTMLDivElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    const num = (name: string) =>
      Number(
        (form.elements.namedItem(name) as HTMLInputElement | null)?.value || 0,
      );

    const compute = () => {
      const w: string[] = [];
      const newUnits = num("new_units");
      const usedUnits = num("used_units");
      // Absent on stores that do not sell Sprinters — num() reads those as 0,
      // so every check below simply stays quiet there.
      const sprinterUnits = num("sprinter_units");
      const newGross = num("new_front_end_gross") + num("new_back_end_gross");
      const usedGross =
        num("used_front_end_gross") + num("used_back_end_gross");
      const sprinterGross =
        num("sprinter_front_end_gross") + num("sprinter_back_end_gross");
      const appts = num("appointments");
      const confirmed = num("confirmed_appointments");
      const totalUnits = newUnits + usedUnits + sprinterUnits;
      const totalGross = newGross + usedGross + sprinterGross;

      if (newUnits > 0 && newGross === 0)
        w.push("New units entered but new gross is $0.");
      if (newGross !== 0 && newUnits === 0)
        w.push("New gross entered but 0 new units.");
      if (usedUnits > 0 && usedGross === 0)
        w.push("Used units entered but used gross is $0.");
      if (usedGross !== 0 && usedUnits === 0)
        w.push("Used gross entered but 0 used units.");
      if (sprinterUnits > 0 && sprinterGross === 0)
        w.push("Sprinter units entered but Sprinter gross is $0.");
      if (sprinterGross !== 0 && sprinterUnits === 0)
        w.push("Sprinter gross entered but 0 Sprinter units.");
      if (confirmed > appts)
        w.push("Confirmed appointments exceed total appointments.");
      if (totalUnits > 0 && Math.abs(totalGross / totalUnits) > 50000)
        w.push("Gross per unit is unusually high — check for an extra digit.");

      setWarnings(w);
    };

    form.addEventListener("input", compute);
    compute();
    return () => form.removeEventListener("input", compute);
  }, []);

  if (warnings.length === 0) return <div ref={ref} className="hidden" />;

  return (
    <div
      ref={ref}
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <p className="font-medium">Double‑check:</p>
      <ul className="mt-1 list-disc pl-5">
        {warnings.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
