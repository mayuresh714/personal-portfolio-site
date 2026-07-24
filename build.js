#!/usr/bin/env node
/**
 * build.js — assembles index.html from the section partials in partials/.
 *
 * WHY: each section lives in its own file so editing one section can't
 * break another. Run `node build.js` after editing any partial to
 * regenerate index.html. The generated index.html is committed so the
 * static site works without a build step on the host (e.g. GitHub Pages).
 *
 * To add / reorder / remove a section, edit the MAIN_SECTIONS list below.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = (...p) => {
  const file = path.join(ROOT, 'partials', ...p);
  if (!fs.existsSync(file)) {
    console.error(`✗ missing partial: partials/${p.join('/')}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8').trim();
};

// Order of <main> sections, top to bottom. Just edit this list to reorder.
const MAIN_SECTIONS = [
  ['personal', 'hero.html'],
  ['personal', 'about.html'],
  ['experience', 'experience.html'],
  ['case-studies', 'case-studies.html'],
  ['projects', 'projects.html'],
  ['skills', 'skills.html'],
  ['experience', 'education.html'],
  ['personal', 'contact.html'],
];

const head = read('layout', 'head.html');
const nav = read('layout', 'nav.html');
const loader = read('layout', 'loader.html');
const footer = read('layout', 'footer.html');
const main = MAIN_SECTIONS.map(seg => read(...seg)).join('\n\n');

const html = `<!doctype html>
<!-- ============================================================
     GENERATED FILE — do not edit directly.
     Edit the section files in partials/ and run:  node build.js
     ============================================================ -->
<html lang="en">
<head>
${head}
</head>
<body>
${nav}

${loader}

  <main>
${main}
  </main>

${footer}

  <script src="scripts.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('✓ Built index.html from', MAIN_SECTIONS.length, 'sections + layout partials');
