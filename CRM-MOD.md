# Bases Calendar (CRM Mod)

This CRM build keeps the community plugin id bases-calendar and upstream version 0.2.2. Only the display name in manifest.json gains (CRM Mod), so normal Obsidian update detection remains available.

CRM code is maintained on downstream/crm. Build with npm ci and npm run build, test with node --test test/*.test.mjs. Deploy main.js, manifest.json and styles.css together. A normal community update replaces the CRM modifications and display name; review and integrate upstream changes into downstream/crm before deploying a new build.
