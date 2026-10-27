# Contributing

Thanks for helping keep this index accurate. The most valuable contributions are **measured
corrections**, not opinions.

## Report a missing space or a wrong number

Open an issue using the template (`.github/ISSUE_TEMPLATE/report-space.yml`) and include:

1. the space URL, `https://<subdomain>.getuploader.com/<name>/`;
2. the two numbers from the **`統計` block at the bottom of that page** —
   `ファイル N ファイル` and `ディスク X MB / 1500.0 MB (N %)`;
3. when you checked (the site is being shut down on 2026-11-25, so numbers go stale fast).

A space with 0 files is a legitimate answer — please say so explicitly rather than leaving the
numbers blank, because "not scanned" and "empty" are different states in this dataset.

## Sending data instead of a bug report

Pull requests that update files under `data/` are welcome if they come with the method used
(script or query) in the description. Please do not hand-edit `data/at.json`; it is generated from a
third-party index and hand edits are invisible to the next regeneration.

## Style

* The site is dependency-free: plain HTML/CSS/ES5-compatible JavaScript, no build step, no tracking.
* Keep UI strings in `assets/i18n.js`; every key must exist in **all three** languages (en / zh / ja).
* Formatting: 2 spaces, LF line endings (enforced by `.gitattributes`).
* Data files are JSON with `ensure_ascii=false` and no trailing whitespace.

## Licences

By contributing code you agree it is licensed under MIT. By contributing data you agree it is
licensed under CC BY 4.0, and you confirm you did not copy it from a source that forbids
redistribution. See `DATA-SOURCES.md` for the existing third-party material.
