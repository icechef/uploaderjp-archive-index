# Data sources, provenance and licences

This repository mixes data from several origins. **Nothing here is relicensed** except the code
(MIT, see `LICENSE`). Each dataset keeps the terms of its origin, listed below.

## 1. `data/at.json` — the community index (third-party)

| | |
|---|---|
| Origin | <https://uploaderjp-archive.surge.sh/meta.json> |
| What it is | A community crawl of `uploader.jp` / `getuploader.com` spaces (239,152 records: space key, status, title, size string, file count, download count, size in MB, description) |
| Retrieved | 2026-10-27 |
| Transform | Reduced to four fields per record — `[space_key, status, files, size_mb]` — and re-serialised as a compact JSON array. No values were invented or corrected; rows were **not** dropped. |
| Credit | The crawl is published by the `uploaderjp-archive` project (ArchiveTeam-adjacent community effort). All rights remain with its authors. |
| Caveat | The original project publishes no explicit licence. It is re-hosted here in reduced form for indexing/interoperability, with attribution and a link back. If the authors object, this file will be removed on request — open an issue. |

`data/at-supplement-delta.csv`, `data/at-supplement-archived.csv`, `data/delta.json`,
`data/archived.json` and `data/summary.json` contain **this project's own measurements** and are
released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): reuse them freely with
attribution to "uploader.jp archive index (this repository)" and a link back. They are derived in
part from the third-party index above (used to decide what counts as "missing"), so downstream users
should keep that attribution too.

## 2. Number semantics — read before quoting

* `files` and `size_mb` for a space come from the **`統計` block** at the bottom of that space's own
  page (`ディスク X MB / 1500 MB (N%)` and `ファイル N ファイル`). List pages carry no totals.
* `null` means **not scanned by us** — it does **not** mean zero files. Do not aggregate nulls as 0.
* `status` is the state observed at scan time: `ok`, `gone` (404), `locked` (password gate),
  `http522`, `redirect`, `unscanned`.
* A space key is `subdomain/name` (lower-cased), e.g. `ux/genryu_sai` — the URL is
  `https://<subdomain>.getuploader.com/<name>/`.

## 3. Archived artefacts (Internet Archive)

| Item | Contents | Licence note |
|---|---|---|
| <https://archive.org/details/u1-getuploader-sample-archive> | 5,533 files in `getuploader-sample-files.zip`, `manifest.csv`/`.json`, WARC CDX index | Uploaded files remain the property of their original uploaders; mirrored for preservation only, no new rights asserted |
| <https://archive.org/details/u1-getuploader-sample-warc-20261026> | 18 `.warc.gz` page captures (9,748 URLs) + IA-derived `.warc.os.cdx.gz` | Same — preservation mirror of third-party content |

## 4. Known gaps in the numbers on the site

* We archived **506 of the 2,526** spaces we scanned; the rest is metadata only.
* Inside the `sample` space: 2,770 of 8,394 files are password-locked and could not be downloaded;
  3 `.php` files return 404 at the source; 84 files are 0 bytes by design.
* Default browser sorting of Wayback coverage: only ~11% of per-file detail pages had any snapshot
  before this project started (sample of 36 CDX lookups, 2026-10-27).
* Everything is a **single snapshot** from October 2026. Uploads made between then and the shutdown
  date (2026-11-25) are not covered.

## 5. Regenerating the site data

`build_site_data.py` (in the upstream project that produced this repo) reads the local crawl
artefacts and writes every file in `data/`. It records `source`, `generated` and `fields` inside each
JSON payload, so any consumer can see where a file came from without reading this document.
