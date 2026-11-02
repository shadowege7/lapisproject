"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { formatUnits, salespersonField } from "@/lib/salespeople";

export interface SalespersonRowProps {
  id: string;
  name: string;
  initials: string;
  /** Removed from the roster, but has numbers on this day — kept so they save. */
  removed: boolean;
  newUnits: number;
  usedUnits: number;
  sprinterUnits: number;
  front: number;
  back: number;
}

type Totals = {
  newUnits: number;
  usedUnits: number;
  sprinterUnits: number;
  front: number;
  back: number;
};

const ZERO: Totals = { newUnits: 0, usedUnits: 0, sprinterUnits: 0, front: 0, back: 0 };

const inputClass =
  "w-full min-w-0 rounded-md border border-zinc-300 bg-transparent px-2 py-2 font-mono text-base tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:py-1.5 sm:text-sm dark:border-zinc-700";

/**
 * The per-salesperson part of the daily entry form.
 *
 * Inputs are uncontrolled and named `sp:<id>:<field>`, so they submit with the
 * rest of the form and the existing Save button. The totals check below reads
 * the whole form on every input, the same way EntrySanityWarnings does, and is
 * advisory only: the numbers do not have to balance to save.
 *
 * Desktop: one row per person, columns aligned. Phone: one card per person,
 * tap the name to open its inputs. Closed cards still submit — `hidden` only
 * hides them.
 */
export function SalespeopleFieldset({
  dealershipId,
  people,
  sprinters,
}: {
  dealershipId: string;
  people: SalespersonRowProps[];
  sprinters: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<Set<string>>(
    () =>
      new Set(
        people
          .filter((p) => p.newUnits || p.usedUnits || p.sprinterUnits || p.front || p.back)
          .map((p) => p.id),
      ),
  );
  const [perPerson, setPerPerson] = useState<Record<string, Totals>>({});
  const [team, setTeam] = useState<Totals>(ZERO);
  const [store, setStore] = useState<Totals>(ZERO);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    const num = (name: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      const n = Number(el?.value || 0);
      return Number.isFinite(n) ? n : 0;
    };

    const compute = () => {
      const each: Record<string, Totals> = {};
      const sum = { ...ZERO };
      for (const p of people) {
        const t: Totals = {
          newUnits: num(salespersonField(p.id, "new_units")),
          usedUnits: num(salespersonField(p.id, "used_units")),
          sprinterUnits: sprinters ? num(salespersonField(p.id, "sprinter_units")) : 0,
          front: num(salespersonField(p.id, "front_end_gross")),
          back: num(salespersonField(p.id, "back_end_gross")),
        };
        each[p.id] = t;
        sum.newUnits += t.newUnits;
        sum.usedUnits += t.usedUnits;
        sum.sprinterUnits += t.sprinterUnits;
        sum.front += t.front;
        sum.back += t.back;
      }
      setPerPerson(each);
      setTeam(sum);
      setStore({
        newUnits: num("new_units"),
        usedUnits: num("used_units"),
        sprinterUnits: sprinters ? num("sprinter_units") : 0,
        front:
          num("new_front_end_gross") +
          num("used_front_end_gross") +
          (sprinters ? num("sprinter_front_end_gross") : 0),
        back:
          num("new_back_end_gross") +
          num("used_back_end_gross") +
          (sprinters ? num("sprinter_back_end_gross") : 0),
      });
    };

    form.addEventListener("input", compute);
    compute();
    return () => form.removeEventListener("input", compute);
  }, [people, sprinters]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const unitDiff =
    store.newUnits - team.newUnits +
    (store.usedUnits - team.usedUnits) +
    (store.sprinterUnits - team.sprinterUnits);
  const unitsMatch =
    Math.abs(store.newUnits - team.newUnits) < 0.001 &&
    Math.abs(store.usedUnits - team.usedUnits) < 0.001 &&
    Math.abs(store.sprinterUnits - team.sprinterUnits) < 0.001;
  const grossDiff = store.front + store.back - (team.front + team.back);
  const flags: string[] = [];
  if (!unitsMatch) {
    flags.push(
      unitDiff >= 0
        ? `${formatUnits(unitDiff)} units unassigned`
        : `${formatUnits(-unitDiff)} units over the store total`,
    );
  }
  if (Math.abs(grossDiff) >= 0.5) {
    flags.push(
      grossDiff > 0
        ? `${formatCurrency(grossDiff)} gross unassigned`
        : `${formatCurrency(-grossDiff)} gross over the store total`,
    );
  }

  const cols = sprinters
    ? "sm:grid-cols-[minmax(10rem,1.6fr)_repeat(3,minmax(0,0.6fr))_repeat(2,minmax(0,1fr))_minmax(0,0.9fr)]"
    : "sm:grid-cols-[minmax(10rem,1.6fr)_repeat(2,minmax(0,0.6fr))_repeat(2,minmax(0,1fr))_minmax(0,0.9fr)]";

  const checkRows: [string, number, number, (n: number) => string][] = [
    ["New units", team.newUnits, store.newUnits, formatUnits],
    ["Used units", team.usedUnits, store.usedUnits, formatUnits],
    ...(sprinters
      ? ([["Sprinter units", team.sprinterUnits, store.sprinterUnits, formatUnits]] as [
          string,
          number,
          number,
          (n: number) => string,
        ][])
      : []),
    ["Front gross", team.front, store.front, formatCurrency],
    ["Back gross", team.back, store.back, formatCurrency],
  ];

  return (
    <section
      ref={ref}
      aria-labelledby="salespeople-heading"
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]"
    >
      {/* Tells the save action this form carried the salesperson section, so
          an absent section is never read as "everyone sold nothing". */}
      <input type="hidden" name="sp_present" value="1" />
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h2 id="salespeople-heading" className="text-sm font-semibold">
            Salespeople
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Who sold what. Split deal? Give each person 0.5.
          </p>
        </div>
        <Link
          href={`/dealerships/${dealershipId}/reports?manage=1#salespeople`}
          className="py-1 text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-white"
        >
          Manage roster
        </Link>
      </div>

      {people.length === 0 ? (
        <p className="px-4 py-4 text-sm text-zinc-500">
          No salespeople on the roster yet.{" "}
          <Link
            href={`/dealerships/${dealershipId}/reports?manage=1#salespeople`}
            className="underline underline-offset-2"
          >
            Add them on Dealership Insights
          </Link>
          .
        </p>
      ) : (
        <div>
          <div
            aria-hidden
            className={`hidden gap-2 border-b border-zinc-200 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 sm:grid dark:border-zinc-800 ${cols}`}
          >
            <span>Salesperson</span>
            <span>New</span>
            <span>Used</span>
            {sprinters ? <span>Sprinter</span> : null}
            <span>Front ($)</span>
            <span>Back ($)</span>
            <span className="text-right">Gross</span>
          </div>

          <ul>
            {people.map((p) => {
              const t = perPerson[p.id] ?? ZERO;
              const gross = t.front + t.back;
              const units = t.newUnits + t.usedUnits + t.sprinterUnits;
              const isOpen = open.has(p.id);
              const summary = units
                ? [
                    `${formatUnits(t.newUnits)} new`,
                    `${formatUnits(t.usedUnits)} used`,
                    ...(sprinters ? [`${formatUnits(t.sprinterUnits)} Sprinter`] : []),
                  ].join(" · ")
                : "Nothing entered";
              return (
                <li
                  key={p.id}
                  className={`border-b border-zinc-100 px-4 py-1.5 last:border-0 sm:grid sm:items-center sm:gap-2 sm:py-2 dark:border-zinc-900 ${cols}`}
                >
                  {/* Phone: the name is a button that opens the inputs. */}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`sp-fields-${p.id}`}
                    onClick={() => toggle(p.id)}
                    className="flex min-h-12 w-full items-center gap-3 text-left sm:hidden"
                  >
                    <Avatar initials={p.initials} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {p.name}
                        {p.removed ? <RemovedChip /> : null}
                      </span>
                      <span className="text-xs text-zinc-500">{summary}</span>
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {gross ? formatCurrency(gross) : "—"}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {/* Desktop: plain name cell. */}
                  <span className="hidden min-w-0 items-center gap-2 sm:flex">
                    <Avatar initials={p.initials} />
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    {p.removed ? <RemovedChip /> : null}
                  </span>

                  <div
                    id={`sp-fields-${p.id}`}
                    className={`${isOpen ? "grid" : "hidden"} grid-cols-2 gap-2 pb-3 pt-1 sm:contents`}
                  >
                    <UnitInput id={p.id} field="new_units" label="New units" name={p.name} value={p.newUnits} />
                    <UnitInput id={p.id} field="used_units" label="Used units" name={p.name} value={p.usedUnits} />
                    {sprinters ? (
                      <UnitInput
                        id={p.id}
                        field="sprinter_units"
                        label="Sprinter units"
                        name={p.name}
                        value={p.sprinterUnits}
                      />
                    ) : null}
                    <MoneyInput id={p.id} field="front_end_gross" label="Front gross ($)" name={p.name} value={p.front} />
                    <MoneyInput id={p.id} field="back_end_gross" label="Back gross ($)" name={p.name} value={p.back} />
                  </div>

                  <span className="hidden text-right font-mono text-sm font-semibold tabular-nums sm:block">
                    {gross ? formatCurrency(gross) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Check against store totals</span>
              {flags.length === 0 ? (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                  Matches
                </span>
              ) : (
                flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    {f}
                  </span>
                ))
              )}
            </div>
            <table className="w-full max-w-md text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="py-1 font-medium">
                    <span className="sr-only">Figure</span>
                  </th>
                  <th className="py-1 text-right font-medium">Salespeople</th>
                  <th className="py-1 text-right font-medium">Store</th>
                  <th className="py-1 text-right font-medium">Unassigned</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {checkRows.map(([label, people, storeValue, fmt]) => {
                  const diff = storeValue - people;
                  const off = Math.abs(diff) >= (fmt === formatCurrency ? 0.5 : 0.001);
                  return (
                    <tr key={label} className="border-t border-zinc-100 dark:border-zinc-900">
                      <th scope="row" className="py-1 text-left font-sans font-normal">
                        {label}
                      </th>
                      <td className="py-1 text-right">{fmt(people)}</td>
                      <td className="py-1 text-right text-zinc-500">{fmt(storeValue)}</td>
                      <td
                        className={`py-1 text-right ${off ? "font-semibold text-amber-700 dark:text-amber-300" : "text-zinc-500"}`}
                      >
                        {off ? fmt(diff) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-500">
              Doesn&apos;t have to balance to save. Anything left over shows as
              Unassigned on Dealership Insights (house deals, fleet, a
              manager&apos;s own deal).
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
    >
      {initials}
    </span>
  );
}

function RemovedChip() {
  return (
    <span className="ml-1.5 rounded-full border border-zinc-300 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
      Removed
    </span>
  );
}

function UnitInput({
  id,
  field,
  label,
  name,
  value,
}: {
  id: string;
  field: string;
  label: string;
  name: string;
  value: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
      <span className="sm:sr-only">
        {label}
        <span className="sr-only">, {name}</span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        name={salespersonField(id, field)}
        min={0}
        step={0.5}
        defaultValue={value}
        className={`${inputClass} text-zinc-900 dark:text-zinc-50`}
      />
    </label>
  );
}

function MoneyInput({
  id,
  field,
  label,
  name,
  value,
}: {
  id: string;
  field: string;
  label: string;
  name: string;
  value: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
      <span className="sm:sr-only">
        {label}
        <span className="sr-only">, {name}</span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        name={salespersonField(id, field)}
        step="0.01"
        defaultValue={value}
        className={`${inputClass} text-zinc-900 dark:text-zinc-50`}
      />
    </label>
  );
}
