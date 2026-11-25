# Resume Forge

A free, private resume builder. Write your resume once, set it in one of five typeset templates, and download a pixel-perfect PDF. Everything runs in the browser: there is no server, no account, and no tracking.

## Features

- **Five templates** (Classic, Modern, Executive, Technical, Minimal), each a single column of real text that applicant tracking systems read reliably.
- **Live, click-to-edit preview.** Click any line on the page to jump to its field.
- **Fit to one page.** Tightens text by up to 15% to fit one page; longer resumes break cleanly between entries onto more pages.
- **Design controls:** 6 accent colors, 6 typefaces, 3 spacing settings, US Letter or A4, 3 margin presets.
- **Import** from a LinkedIn profile PDF, any resume PDF, LinkedIn's data export (ZIP or CSV), or a Resume Forge backup (including backups from the original version).
- **Drag to reorder** sections, entries and skill groups, with keyboard support on the handles.
- **Undo and redo**, autosave to the browser, and downloadable JSON backups.
- **Download PDF** through the browser's print dialog, with page size and margins preset.

## Project layout

```
index.html        Landing page
app.html          The editor
404.html          Not-found page
css/base.css      Design tokens and shared components
css/landing.css   Landing page styles
css/app.css       Editor styles (and print rules)
css/resume.css    The resume page and the five templates
js/model.js       Data model, templates, defaults, normalizing old saves
js/render.js      Resume HTML, pagination and fit-to-one-page
js/app.js         Editor: state, history, panels, preview, import, export, PDF
js/importers.js   JSON, PDF, LinkedIn PDF and LinkedIn export readers
js/landing.js     Landing page rendering and motion
js/icons.js       Inline icons
vendor/pdfjs/     pdf.js 3.11.174 (Apache-2.0), loaded only when importing a PDF
netlify.toml      Netlify settings and security headers
```

There is no build step. Any static host works.

## Run locally

The site uses ES modules, so open it through a local server rather than as a file:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Deploy on Netlify

1. In Netlify, choose **Add new project › Import an existing project › GitHub**, and pick this repository (or, for an existing site, **Project configuration › Build & deploy › Link repository**).
2. Leave the build command empty and the publish directory as `.`. `netlify.toml` already sets both.
3. Deploy. Every push to the default branch redeploys automatically.

## Data and privacy

Resumes are stored in the browser's `localStorage` under `resumeforge:v2`. A resume saved by the original version (`resumeforge:v1`) is picked up automatically the first time the new editor opens on the same domain.
