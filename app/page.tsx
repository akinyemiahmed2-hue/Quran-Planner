"use client";

import React, { useEffect, useMemo, useState } from "react";

const QURAN_PAGES = 604;

type Theme = "light" | "dark";
type GoalPreset = 1 | 2 | 3 | "custom";
type DaysPreset = 30 | 29 | "custom";
type SessionsPreset = 1 | 2 | 3 | 5;

type Plan = {
  goalKhatmah: number;
  daysTotal: number;
  sessionsPerDay: SessionsPreset;
};

type ProgressState = {
  pagesCompleted: number;
  lastUpdatedAt: number | null;
};

type HistoryItem = {
  at: number;
  label: string;
  pagesCompleted: number;
};

const LS_KEYS = {
  theme: "qp_theme_v1",
  plan: "qp_plan_v1",
  progress: "qp_progress_v1",
  history: "qp_history_v1",
  ramadanDay: "qp_ramadan_day_v1",
};

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function roundSmart(n: number) {
  return Math.max(0, Math.round(n));
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export default function Page() {
  const [theme, setTheme] = useState<Theme>("light");
  const [tab, setTab] = useState<"plan" | "track">("plan");

  // Plan inputs (default values)
  const [goalPreset, setGoalPreset] = useState<GoalPreset>(1);
  const [customGoal, setCustomGoal] = useState<number>(1);

  const [daysPreset, setDaysPreset] = useState<DaysPreset>(30);
  const [customDays, setCustomDays] = useState<number>(30);

  const [sessions, setSessions] = useState<SessionsPreset>(2);

  // Saved plan
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planSavedToast, setPlanSavedToast] = useState<string>("");

  // Tracking
  const [trackMode, setTrackMode] = useState<"onPage" | "readPages">("onPage");
  const [inputPage, setInputPage] = useState<number>(1);
  const [inputReadPages, setInputReadPages] = useState<number>(0);

  const [ramadanDay, setRamadanDay] = useState<number>(1);
  const [progress, setProgress] = useState<ProgressState>({
    pagesCompleted: 0,
    lastUpdatedAt: null,
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load from localStorage
  useEffect(() => {
    const savedTheme = (localStorage.getItem(LS_KEYS.theme) as Theme | null) ?? null;
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);

    const savedPlan = safeJsonParse<Plan>(localStorage.getItem(LS_KEYS.plan));
    if (savedPlan && savedPlan.goalKhatmah && savedPlan.daysTotal && savedPlan.sessionsPerDay) {
      setPlan(savedPlan);

      if ([1, 2, 3].includes(savedPlan.goalKhatmah)) {
        setGoalPreset(savedPlan.goalKhatmah as 1 | 2 | 3);
      } else {
        setGoalPreset("custom");
        setCustomGoal(savedPlan.goalKhatmah);
      }

      if (savedPlan.daysTotal === 29 || savedPlan.daysTotal === 30) {
        setDaysPreset(savedPlan.daysTotal as 29 | 30);
      } else {
        setDaysPreset("custom");
        setCustomDays(savedPlan.daysTotal);
      }

      setSessions(savedPlan.sessionsPerDay);
    }

    const savedProgress = safeJsonParse<ProgressState>(localStorage.getItem(LS_KEYS.progress));
    if (savedProgress && typeof savedProgress.pagesCompleted === "number") {
      setProgress({
        pagesCompleted: savedProgress.pagesCompleted,
        lastUpdatedAt: savedProgress.lastUpdatedAt ?? null,
      });
    }

    const savedHistory = safeJsonParse<HistoryItem[]>(localStorage.getItem(LS_KEYS.history));
    if (Array.isArray(savedHistory)) setHistory(savedHistory.slice(0, 30));

    const savedRamadanDay = Number(localStorage.getItem(LS_KEYS.ramadanDay));
    if (!Number.isNaN(savedRamadanDay) && savedRamadanDay > 0) setRamadanDay(savedRamadanDay);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(LS_KEYS.theme, theme);
  }, [theme]);

  // Effective values (from UI, not from saved plan)
  const effectiveGoal = goalPreset === "custom" ? customGoal : goalPreset;
  const effectiveDays = daysPreset === "custom" ? customDays : daysPreset;

  const totalPages = useMemo(() => {
    const g = clamp(Number(effectiveGoal), 1, 50);
    return QURAN_PAGES * g;
  }, [effectiveGoal]);

  // Use saved plan for tracking, otherwise UI values
  const daysTotalFromPlan = plan?.daysTotal ?? clamp(Number(effectiveDays), 1, 60);
  const sessionsFromPlan = plan?.sessionsPerDay ?? sessions;

  // Plan results always auto-calc from current inputs
  const planResults = useMemo(() => {
    const g = clamp(Number(effectiveGoal), 1, 50);
    const d = clamp(Number(effectiveDays), 1, 60);
    const s = sessions;

    const total = QURAN_PAGES * g;
    const perDay = total / d;
    const perSession = perDay / s;
    const perSalah = s === 5 ? perDay / 5 : null;

    return { total, perDay, perSession, perSalah, g, d, s };
  }, [effectiveGoal, effectiveDays, sessions]);

  const trackTotals = useMemo(() => {
    const dTotal = clamp(Number(daysTotalFromPlan), 1, 60);
    const dayNow = clamp(Number(ramadanDay), 1, dTotal);

    const completed = clamp(Number(progress.pagesCompleted), 0, totalPages);
    const left = Math.max(0, totalPages - completed);
    const daysLeft = Math.max(0, dTotal - dayNow + 1);

    const neededPerDay = daysLeft > 0 ? left / daysLeft : left;
    const neededPerSession = neededPerDay / sessionsFromPlan;
    const neededPerSalah = sessionsFromPlan === 5 ? neededPerDay / 5 : null;

    const pct = totalPages === 0 ? 0 : (completed / totalPages) * 100;

    const idealCompletedByNow = (totalPages / dTotal) * dayNow;
    const delta = completed - idealCompletedByNow;
    const status = delta >= 10 ? "ontrack" : delta >= -10 ? "slight" : "behind";

    return {
      completed,
      left,
      daysLeft,
      neededPerDay,
      neededPerSession,
      neededPerSalah,
      pct,
      status,
      idealCompletedByNow,
      dayNow,
      dTotal,
    };
  }, [daysTotalFromPlan, ramadanDay, progress.pagesCompleted, totalPages, sessionsFromPlan]);

  function savePlan() {
    const newPlan: Plan = {
      goalKhatmah: clamp(Number(effectiveGoal), 1, 50),
      daysTotal: clamp(Number(effectiveDays), 1, 60),
      sessionsPerDay: sessions,
    };
    setPlan(newPlan);
    localStorage.setItem(LS_KEYS.plan, JSON.stringify(newPlan));

    setPlanSavedToast("Plan saved ✓");
    window.setTimeout(() => setPlanSavedToast(""), 1400);
  }

  function resetAll() {
    // Reset Plan UI
    setGoalPreset(1);
    setCustomGoal(1);
    setDaysPreset(30);
    setCustomDays(30);
    setSessions(2);

    // Reset saved plan
    setPlan(null);

    // Reset Track
    setTrackMode("onPage");
    setInputPage(1);
    setInputReadPages(0);
    setRamadanDay(1);
    setProgress({ pagesCompleted: 0, lastUpdatedAt: null });
    setHistory([]);
    setPlanSavedToast("");

    // Clear storage
    localStorage.removeItem(LS_KEYS.plan);
    localStorage.removeItem(LS_KEYS.progress);
    localStorage.removeItem(LS_KEYS.history);
    localStorage.removeItem(LS_KEYS.ramadanDay);
  }

  function updateProgress() {
    const goal = plan?.goalKhatmah ?? clamp(Number(effectiveGoal), 1, 50);

    let pagesCompleted = 0;

    if (trackMode === "onPage") {
      const page = clamp(Number(inputPage), 1, QURAN_PAGES);
      if (goal === 1) pagesCompleted = page - 1;
      else pagesCompleted = clamp(page - 1, 0, totalPages);
    } else {
      pagesCompleted = clamp(Number(inputReadPages), 0, totalPages);
    }

    const now = Date.now();
    const newProgress: ProgressState = { pagesCompleted, lastUpdatedAt: now };
    setProgress(newProgress);
    localStorage.setItem(LS_KEYS.progress, JSON.stringify(newProgress));

    const label =
      trackMode === "onPage"
        ? `Day ${ramadanDay} — Page ${clamp(Number(inputPage), 1, QURAN_PAGES)}`
        : `Day ${ramadanDay} — ${pagesCompleted} pages read`;

    const newItem: HistoryItem = { at: now, label, pagesCompleted };
    const nextHistory = [newItem, ...history].slice(0, 10);
    setHistory(nextHistory);
    localStorage.setItem(LS_KEYS.history, JSON.stringify(nextHistory));
  }

  function setRamadanDayPersist(n: number) {
    const v = clamp(n, 1, daysTotalFromPlan);
    setRamadanDay(v);
    localStorage.setItem(LS_KEYS.ramadanDay, String(v));
  }

  const khatmahMeaning = "Khatmah = completing the Qur’an once";

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="title">Qur’an Planner</div>
          <div className="subtitle">
            Plan your daily pages and track your completion in Ramadan. ({khatmahMeaning})
          </div>
        </div>

        <div className="headerActions">
          <button
            className="btn ghost"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </header>

      <main className="container">
        <div className="tabs">
          <button className={`tab ${tab === "plan" ? "active" : ""}`} onClick={() => setTab("plan")}>
            Plan
          </button>
          <button className={`tab ${tab === "track" ? "active" : ""}`} onClick={() => setTab("track")}>
            Track
          </button>
          <div className="tabsSpacer" />
          <button className="btn ghost danger" onClick={resetAll}>
            Reset
          </button>
        </div>

        {tab === "plan" ? (
          <section className="grid">
            <div className="card">
              <div className="cardTitle">Set your goal</div>

              <div className="field">
                <label>Goal</label>
                <div className="hint" style={{ marginBottom: 10 }}>
                  {khatmahMeaning}.
                </div>

                <div className="segmented">
                  {[1, 2, 3].map((v) => (
                    <button
                      key={v}
                      className={`seg ${goalPreset === v ? "active" : ""}`}
                      onClick={() => setGoalPreset(v as 1 | 2 | 3)}
                      type="button"
                    >
                      {v} Completion{v > 1 ? "s" : ""}
                    </button>
                  ))}
                  <button
                    className={`seg ${goalPreset === "custom" ? "active" : ""}`}
                    onClick={() => setGoalPreset("custom")}
                    type="button"
                  >
                    Custom
                  </button>
                </div>

                {goalPreset === "custom" && (
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={50}
                    value={customGoal}
                    onChange={(e) => setCustomGoal(Number(e.target.value))}
                    placeholder="How many completions?"
                  />
                )}
              </div>

              <div className="field">
                <label>Days</label>
                <div className="segmented">
                  {[30, 29].map((v) => (
                    <button
                      key={v}
                      className={`seg ${daysPreset === v ? "active" : ""}`}
                      onClick={() => setDaysPreset(v as 29 | 30)}
                      type="button"
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    className={`seg ${daysPreset === "custom" ? "active" : ""}`}
                    onClick={() => setDaysPreset("custom")}
                    type="button"
                  >
                    Custom
                  </button>
                </div>

                {daysPreset === "custom" && (
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={60}
                    value={customDays}
                    onChange={(e) => setCustomDays(Number(e.target.value))}
                    placeholder="How many days?"
                  />
                )}
              </div>

              <div className="field">
                <label>Reading sessions per day</label>
                <div className="segmented">
                  {[1, 2, 3, 5].map((v) => (
                    <button
                      key={v}
                      className={`seg ${sessions === v ? "active" : ""}`}
                      onClick={() => setSessions(v as SessionsPreset)}
                      type="button"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="hint">Tip: pick 5 to spread reading after each salah.</div>
              </div>

              <button className="btn primary" onClick={savePlan}>
                Save plan
              </button>

              {planSavedToast && (
                <div className="hint" style={{ marginTop: 10 }}>
                  <b>{planSavedToast}</b>
                </div>
              )}

              <div className="hint" style={{ marginTop: 10 }}>
                Madani mushaf standard: <b>604 pages</b>.
              </div>
            </div>

            <div className="card">
              <div className="cardTitle">Your daily target</div>

              <div className="stats">
                <div className="stat">
                  <div className="statLabel">Pages / day</div>
                  <div className="statValue">{roundSmart(planResults.perDay)}</div>
                </div>
                <div className="stat">
                  <div className="statLabel">Pages / session</div>
                  <div className="statValue">{roundSmart(planResults.perSession)}</div>
                </div>
                <div className="stat">
                  <div className="statLabel">Pages / salah</div>
                  <div className="statValue">{planResults.perSalah == null ? "—" : roundSmart(planResults.perSalah)}</div>
                </div>
              </div>

              <div className="list">
                <div className="row">
                  <span>Total pages</span>
                  <span>{planResults.total}</span>
                </div>
                <div className="row">
                  <span>Goal</span>
                  <span>{planResults.g} completion{planResults.g > 1 ? "s" : ""}</span>
                </div>
                <div className="row">
                  <span>Days</span>
                  <span>{planResults.d}</span>
                </div>
                <div className="row">
                  <span>Sessions/day</span>
                  <span>{planResults.s}</span>
                </div>
              </div>

              <div className="hint" style={{ marginTop: 12 }}>
                Tip: Save your plan so Track uses the same settings.
              </div>
            </div>
          </section>
        ) : (
          <section className="grid">
            <div className="card">
              <div className="cardTitle">Update your progress</div>

              <div className="field">
                <label>Ramadan day</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={daysTotalFromPlan}
                  value={ramadanDay}
                  onChange={(e) => setRamadanDayPersist(Number(e.target.value))}
                />
                <div className="hint">
                  Based on plan days: <b>{daysTotalFromPlan}</b>
                </div>
              </div>

              <div className="field">
                <label>Input mode</label>
                <div className="segmented">
                  <button className={`seg ${trackMode === "onPage" ? "active" : ""}`} onClick={() => setTrackMode("onPage")} type="button">
                    I’m on page…
                  </button>
                  <button className={`seg ${trackMode === "readPages" ? "active" : ""}`} onClick={() => setTrackMode("readPages")} type="button">
                    I’ve read… pages
                  </button>
                </div>
              </div>

              {trackMode === "onPage" ? (
                <div className="field">
                  <label>Current page (1–604)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={QURAN_PAGES}
                    value={inputPage}
                    onChange={(e) => setInputPage(Number(e.target.value))}
                  />
                  {((plan?.goalKhatmah ?? 1) > 1) && (
                    <div className="hint warn">
                      Multi-completion goal detected. “Page” becomes ambiguous — use “I’ve read… pages” for best accuracy.
                    </div>
                  )}
                </div>
              ) : (
                <div className="field">
                  <label>Pages completed (0–{totalPages})</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={totalPages}
                    value={inputReadPages}
                    onChange={(e) => setInputReadPages(Number(e.target.value))}
                  />
                </div>
              )}

              <button className="btn primary" onClick={updateProgress}>
                Update progress
              </button>

              {progress.lastUpdatedAt && (
                <div className="hint" style={{ marginTop: 10 }}>
                  Last updated: <b>{formatDate(progress.lastUpdatedAt)}</b>
                </div>
              )}
            </div>

            <div className="card">
              <div className="cardTitle">Status</div>

              <div className="progressWrap">
                <div className="progressMeta">
                  <span>{Math.round(trackTotals.pct)}% complete</span>
                  <span>
                    {trackTotals.completed} / {totalPages} pages
                  </span>
                </div>
                <div className="bar">
                  <div className="barFill" style={{ width: `${clamp(trackTotals.pct, 0, 100)}%` }} />
                </div>
              </div>

              <div className="stats">
                <div className="stat">
                  <div className="statLabel">Pages read</div>
                  <div className="statValue">{trackTotals.completed}</div>
                </div>
                <div className="stat">
                  <div className="statLabel">Pages left</div>
                  <div className="statValue">{trackTotals.left}</div>
                </div>
                <div className="stat">
                  <div className="statLabel">Days left</div>
                  <div className="statValue">{trackTotals.daysLeft}</div>
                </div>
              </div>

              <div className="cardTitle" style={{ marginTop: 18 }}>
                What you need from today
              </div>

              <div className="bigLine">
                Read <b>{roundSmart(trackTotals.neededPerDay)}</b> pages/day to finish on time.
              </div>

              <div className="badges">
                {trackTotals.status === "ontrack" && <span className="badge ok">On track</span>}
                {trackTotals.status === "slight" && <span className="badge mid">Slightly behind</span>}
                {trackTotals.status === "behind" && <span className="badge bad">Behind — adjust your plan</span>}
              </div>

              <div className="list" style={{ marginTop: 10 }}>
                <div className="row">
                  <span>Per session ({sessionsFromPlan}/day)</span>
                  <span>{roundSmart(trackTotals.neededPerSession)}</span>
                </div>
                <div className="row">
                  <span>Per salah</span>
                  <span>{trackTotals.neededPerSalah == null ? "—" : roundSmart(trackTotals.neededPerSalah)}</span>
                </div>
                <div className="row">
                  <span>Ideal by today</span>
                  <span>{roundSmart(trackTotals.idealCompletedByNow)} pages</span>
                </div>
              </div>

              {history.length > 0 && (
                <>
                  <div className="cardTitle" style={{ marginTop: 18 }}>
                    Recent updates
                  </div>
                  <div className="history">
                    {history.map((h) => (
                      <div className="historyItem" key={h.at}>
                        <span className="historyLabel">{h.label}</span>
                        <span className="historyTime">{formatDate(h.at)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        <footer className="footer">
          <span>Built for Ramadan focus.</span>
        </footer>
      </main>
    </div>
  );
}
