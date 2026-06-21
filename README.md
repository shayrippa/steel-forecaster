# STEELCAST — Structural Steel Installation Forecaster

A clean, dependency-free web app that turns daily site progress into a live completion forecast for steel installation packages — and can pull the roofing scope straight out of a BIM (IFC) model.

**Live site:** _enabled via GitHub Pages_

## What it does

**Forecasting**
- Enter the project scope (m²), start date, and contract deadline.
- Log the area of steel installed each working day in the project journal.
- A least-squares regression on cumulative progress derives the realized fixing rate and projects the completion date after every entry.
- The verdict reads **green (on track)** or **molten-orange (behind)** against the deadline, with the variance in days, drawn on a live installation S-curve (planned baseline · actual · forecast cone).

**IFC import**
- Drop a Tekla IFC model onto the import zone to derive the steel roofing area automatically.
- The model is parsed in a background Web Worker, so a 20 MB file never freezes the UI.
- Roofing area = Σ(purlin length) × purlin spacing, computed from the purlins above an adjustable roof level (purlin elevations come from the IFC placement chain; lengths from the base quantities; spacing from the purlin grid).

## Run locally

It's a static site — open `index.html`, or serve it:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1   # http://localhost:5500
```

```bash
python -m http.server 5500   # if you have Python
```

## Stack

Plain HTML, CSS, and JavaScript — no build step, no dependencies. SVG charting and IFC parsing are hand-rolled. Typography is IBM Plex; the visual language is a dark "cold steel" dashboard built for the construction industry.

---

Built as a demonstration of applying AI to an everyday construction problem: progress capture in, delay forecast out.
