# Personal Portfolio — Mayuresh Khanaj

Static site (HTML/CSS/JS, no framework). The homepage is **assembled from
section partials** so editing one section can't break another.

## Structure

```
partials/                # source of truth for index.html — edit these
├── layout/              # head, nav, loader, footer (shared chrome)
├── personal/            # hero.html, about.html, contact.html
├── experience/          # experience.html, education.html
├── case-studies/        # case-studies.html
├── projects/            # projects.html (GitHub / open-source)
└── skills/              # skills.html
build.js                 # assembles partials -> index.html
index.html               # GENERATED — do not edit by hand
blog.html                # blog listing
blog/                    # individual blog articles
styles.css               # single dark theme, shared by every page
scripts.js               # all interactions
assets/                  # images, etc.
tests/                   # Playwright interaction + link-integrity tests
```

## Edit → build → test

```bash
# 1. Edit a section, e.g. partials/experience/experience.html
# 2. Regenerate the homepage:
node build.js
# 3. Verify nothing broke:
node tests/interactions.test.cjs
```

To reorder or add a section, edit the `MAIN_SECTIONS` list in `build.js`.

### Adding a blog post
1. Copy an existing file in `blog/` as a starting point (paths use `../` to
   reach `styles.css` and `assets/`).
2. Add a `<article class="post-card">` entry to `blog.html`.

## Notes
- The **Resume** button points to Google Drive. Keep that file shared as
  “Anyone with the link”.
- Tests run against `file://` — no server needed. `npm run serve` starts one
  at `localhost:8000` if you want to browse locally.
