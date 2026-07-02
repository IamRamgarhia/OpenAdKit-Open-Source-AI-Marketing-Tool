"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Flame, RotateCcw, Plus, Trash2 } from "lucide-react";
import { ApiKeyGate } from "./ApiKeyGate";
import { PageHeader } from "./PageHeader";
import { CHECKLISTS, type ChecklistScope } from "@/lib/checklists";
import { db, type ChecklistState } from "@/lib/storage";

interface CustomItem {
  key: string;
  scope: ChecklistScope;
  text: string;
  created_at: number;
}

interface Props {
  scope: ChecklistScope;
}

export function ChecklistView(props: Props) {
  return (
    <ApiKeyGate>
      <Inner {...props} />
    </ApiKeyGate>
  );
}

function periodKey(scope: ChecklistScope, when = new Date()): string {
  const y = when.getFullYear();
  if (scope === "daily") {
    return `${y}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  }
  if (scope === "weekly") {
    const onejan = new Date(y, 0, 1);
    const week = Math.ceil(((when.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    return `${y}-W${String(week).padStart(2, "0")}`;
  }
  return `${y}-${String(when.getMonth() + 1).padStart(2, "0")}`;
}

function isStaleForPeriod(scope: ChecklistScope, lastCompleted: number | null): boolean {
  if (lastCompleted == null) return true;
  return periodKey(scope, new Date(lastCompleted)) !== periodKey(scope);
}

function Inner({ scope }: Props) {
  const def = CHECKLISTS[scope];
  const [state, setState] = useState<Record<string, ChecklistState>>({});
  const [customs, setCustoms] = useState<{ id: string; scope: string; text: string; section: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [addingForSection, setAddingForSection] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    const rows = await db().checklist.where("scope").equals(scope).toArray();
    const map: Record<string, ChecklistState> = {};
    for (const r of rows) {
      const checkedCurrentPeriod = r.checked && !isStaleForPeriod(scope, r.last_completed);
      map[r.item_key] = { ...r, checked: checkedCurrentPeriod };
    }
    setState(map);
    const cust = await db().custom_items.where("scope").equals(scope).toArray();
    setCustoms(cust);
    setLoaded(true);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCustom(section: string) {
    if (!draft.trim()) return;
    const item = { id: crypto.randomUUID(), scope, section, text: draft.trim(), created_at: Date.now() };
    await db().custom_items.put(item);
    setDraft("");
    setAddingForSection(null);
    load();
  }

  async function removeCustom(id: string) {
    await db().custom_items.delete(id);
    // Also drop the checklist state row keyed by this custom item — otherwise a
    // checked-then-deleted item leaves an orphan "checked" row that still counts
    // toward progress (which could push it past 100%). (Audit finding.)
    await db().checklist.where("item_key").equals(id).delete();
    load();
  }

  function customsForSection(title: string) {
    return customs.filter((c) => c.section === title);
  }

  const totalItems = useMemo(
    () => def.sections.reduce((sum, s) => sum + s.items.length, 0) + customs.length,
    [def, customs]
  );
  const checkedItems = useMemo(() => Object.values(state).filter((s) => s.checked).length, [state]);
  const progress = totalItems ? Math.round((checkedItems / totalItems) * 100) : 0;
  const maxStreak = useMemo(() => Math.max(0, ...Object.values(state).map((s) => s.streak || 0)), [state]);

  async function toggle(key: string) {
    const now = Date.now();
    const cur = state[key];
    let next: ChecklistState;
    if (cur?.checked) {
      next = { ...cur, checked: false };
    } else {
      const wasStreak = cur?.streak ?? 0;
      const continued = cur?.last_completed
        ? !isStaleForPeriodPrev(scope, cur.last_completed)
        : false;
      next = {
        id: cur?.id ?? crypto.randomUUID(),
        scope,
        item_key: key,
        checked: true,
        last_completed: now,
        streak: continued ? wasStreak + 1 : 1,
      };
    }
    setState((s) => ({ ...s, [key]: next }));
    await db().checklist.put(next);
  }

  async function resetAll() {
    if (!confirm("Reset this period's progress (keeps your streak)?")) return;
    const update: Record<string, ChecklistState> = {};
    for (const [k, v] of Object.entries(state)) {
      update[k] = { ...v, checked: false };
      await db().checklist.put(update[k]);
    }
    setState(update);
  }

  if (!loaded) return null;

  return (
    <div>
      <PageHeader
        scope={`checklist/${scope}`}
        title={`${scope[0].toUpperCase()}${scope.slice(1)} routine`}
        subtitle={`Estimated ${def.duration}. Progress auto-resets each ${scope === "daily" ? "day" : scope === "weekly" ? "week" : "month"}.`}
      />

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Stat label="period progress" value={`${progress}%`} accent />
        <Stat label="checked" value={`${checkedItems} / ${totalItems}`} />
        <Stat label="best streak" value={`${maxStreak}`} icon={<Flame size={14} className="text-live" />} />
      </div>

      <div className="space-y-6">
        {def.sections.map((section) => (
          <div key={section.title} className="border border-base-600 bg-base-900/40 animate-fade-up">
            <div className="flex items-center justify-between border-b border-base-700 px-5 py-2">
              <h3 className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-muted">{section.title}</h3>
              <span className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
                {section.items.filter((i) => state[i.key]?.checked).length} / {section.items.length}
              </span>
            </div>
            <ul className="divide-y divide-base-700">
              {section.items.map((item) => {
                const checked = state[item.key]?.checked;
                const streak = state[item.key]?.streak ?? 0;
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => toggle(item.key)}
                      className={`w-full text-left flex items-center gap-3 px-5 py-2.5 transition group ${
                        checked ? "bg-base-800/40" : "hover:bg-base-800/30"
                      }`}
                    >
                      <span
                        className={`shrink-0 h-4 w-4 border grid place-items-center transition ${
                          checked
                            ? "bg-live border-live text-base-950"
                            : "border-base-500 group-hover:border-ink-muted"
                        }`}
                      >
                        {checked ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <span className={`text-sm flex-1 ${checked ? "text-ink-muted line-through" : "text-ink"}`}>
                        {item.text}
                      </span>
                      {streak >= 3 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-ui-wide text-live">
                          <Flame size={11} /> {streak}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {customsForSection(section.title).map((c) => {
                const checked = state[c.id]?.checked;
                return (
                  <li key={c.id} className="flex items-center gap-2 px-5 py-2.5">
                    <button
                      onClick={() => toggle(c.id)}
                      className={`flex-1 text-left flex items-center gap-3 group ${checked ? "opacity-60" : ""}`}
                    >
                      <span
                        className={`shrink-0 h-4 w-4 border grid place-items-center transition ${
                          checked ? "bg-live border-live text-base-950" : "border-base-500 group-hover:border-ink-muted"
                        }`}
                      >
                        {checked ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <span className={`text-sm flex-1 ${checked ? "text-ink-muted line-through" : "text-ink"}`}>
                        {c.text}
                      </span>
                      <span className="text-[9px] font-mono uppercase tracking-ui-mega text-live">custom</span>
                    </button>
                    <button
                      onClick={() => removeCustom(c.id)}
                      className="text-ink-faint hover:text-neg p-1"
                      aria-label="Delete custom item"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                );
              })}
              {addingForSection === section.title ? (
                <li className="px-5 py-2.5 flex items-center gap-2">
                  <input
                    autoFocus
                    className="input-base flex-1"
                    placeholder="describe your custom task…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCustom(section.title);
                      if (e.key === "Escape") { setAddingForSection(null); setDraft(""); }
                    }}
                  />
                  <button onClick={() => addCustom(section.title)} className="btn-primary">add</button>
                  <button onClick={() => { setAddingForSection(null); setDraft(""); }} className="btn-ghost">cancel</button>
                </li>
              ) : (
                <li className="px-5 py-2">
                  <button
                    onClick={() => setAddingForSection(section.title)}
                    className="text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint hover:text-live flex items-center gap-1.5"
                  >
                    <Plus size={11} /> add custom
                  </button>
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={resetAll} className="btn-ghost">
          <RotateCcw size={11} /> reset period
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="border border-base-600 bg-base-900/40 p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-ui-mega text-ink-faint">
        {icon}
        {label}
      </div>
      <div className={`mt-2 font-display italic text-3xl tabular ${accent ? "text-live" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function isStaleForPeriodPrev(scope: ChecklistScope, lastCompleted: number): boolean {
  const prevDate = (() => {
    const d = new Date();
    if (scope === "daily") d.setDate(d.getDate() - 1);
    else if (scope === "weekly") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    return d;
  })();
  return periodKey(scope, new Date(lastCompleted)) !== periodKey(scope, prevDate);
}
