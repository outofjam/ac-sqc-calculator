# SQC / Points: Aeroplan Calculator

A mobile-friendly, client-side calculator for estimating Air Canada Aeroplan Status Qualifying Credits (SQC), Points, and Lifetime Qualifying Miles (LQM) earned on a flight itinerary.

This is an **unaffiliated, unofficial** tool. It is not built or endorsed by Air Canada or Aeroplan.

Live: https://acsqc.cowtool.com/ (original) — this repo is a different UI on top of the same open-source engine.

## What it does

Given ticket type, elite status, fare, and one or more flight segments (carrier, cabin/fare class, fare brand, origin/destination), it computes:

- **SQC** — Status Qualifying Credits
- **Points** — Aeroplan points
- **LQM** — Lifetime Qualifying Miles

## Credit

The core earning logic in [`calc.js`](calc.js) is ported directly from cowtool's open-source calculation engine (`EarningResult.kt` / `ItineraryImpl.kt` in [cowtool-llc/ac-sqd](https://github.com/cowtool-llc/ac-sqd)) — the fare-brand-to-SQC multiplier table, per-partner-airline distance/fare-class tables, and elite bonus math are copied from the real rules, not reverse-engineered guesses. All credit for that logic and the underlying route/airport data goes to cowtool. This repo is just a different (more mobile-friendly) UI built on top of it.

## How it works

- `index.html` — page structure/markup
- `styles.css` — all styling, including a light/dark theme toggle
- `calc.js` — the ported calculation engine (fare-brand multipliers, partner airline fare-class tables, elite bonus multipliers, LQM rules)
- `app.js` — UI wiring: form state, segment management, live data loading, and rendering totals

Airport and route distance/country data is fetched live from cowtool's public CSVs directly in the browser (via PapaParse) — there's no backend and no build step.

## Running locally

This is a static site with no build step or dependencies to install. Serve the directory with any static file server, e.g.:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

## Summary of the earning rules

- **AC-operated flights** (or codeshares under AC's own codes) earn via the dollar + fare-brand method: `TG`=2× SQC, `FL/CO/LT`=4× if ticketed 014 else 2×, `PL/PF/EL/EF`=4×, `BA/GT`=0×. The fare class letter is used as a fallback when no brand code is given.
- **Points** = eligible dollars × (1 + elite bonus multiplier), where the multiplier is an integer (None=0, 25K=1, 35K=2, 50K=3, 75K=4, SE=5).
- **Fare is split across segments by distance**, not evenly — each segment's eligible dollars is its share of total distance × total fare, rounded up.
- **Partner-ticketed, partner-operated flights** (ticket not 014) earn points from a percentage of distance flown using that airline's own fare-class table, with SQC = points ÷ 5. Non–Star Alliance partners never earn SQC.
- **LQM** only accrues on AC-metal flights, at 1×/1.25×/1.5× distance depending on cabin, with a 250-mile floor once you hold any elite status.

See the "How this is calculated" section in the app itself for the full breakdown.
