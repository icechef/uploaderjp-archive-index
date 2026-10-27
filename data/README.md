# `data/` — data dictionary

Every JSON file carries `source`, `generated` and (where relevant) `fields` inside the payload, so a
consumer never has to guess where a number came from. All files are UTF-8, no BOM, LF endings.

---

## `summary.json`

Aggregates used on the page. Shape:

```jsonc
{
  "generated": "2026-10-27 08:14",
  "at":       { "spaces": 239152, "files": 2706154, "mb": 9982089, "source": "uploaderjp-archive.surge.sh" },
  "mine":     { "spaces": 2526, "files": 102568, "mb": 367576 },     // spaces we scanned
  "archived": { "spaces": 506, "files": 26922, "mb": 83206 },        // spaces we downloaded
  "delta":    { "count": 1630, "files": 35471, "mb": 156100,
                "archived": 136, "sample_size": 30,
                "sample_alive": 25, "sample_404": 3, "sample_odd": 2 },
  "sample":   { "files": 8394, "locked": 2770, "unlocked": 5624,
                "warc_urls": 9748, "warc_responses": 9905, "warc_mb": 83,
                "zip_files": 5533, "php_404": 3, "zero_byte": 84 },
  "items":    { "files": "https://archive.org/details/…", "warc": "https://archive.org/details/…" },
  "shutdown": "2026-11-25"
}
```

`mb` is megabytes as reported by the source (the site prints `ディスク X MB`), not MiB.

---

## `at.json` — community index (third-party, reduced)

```jsonc
{ "v": 1, "generated": "2026-10-27",
  "source": "uploaderjp-archive.surge.sh/meta.json (community crawl, re-hosted as a derived subset)",
  "fields": ["space_key", "status", "files", "size_mb"],
  "rows": [["u1/0101213", "ok", 0, 0.0], …] }
```

* `space_key` — `subdomain/name`, lower-cased. URL = `https://<subdomain>.getuploader.com/<name>/`.
* `status` — as recorded by the upstream crawl: `ok`, `gone`, `locked`, `http522`, `http200`,
  `http525`, `redirect`.
* `files`, `size_mb` — numbers from the space's own `統計` block at crawl time.
* Rows are **not** filtered: whatever the upstream crawl had, minus unused fields.
* ~7 MB. The page loads it in the background; the site is usable before it arrives.

---

## `delta.json` — spaces the community index does not contain

```jsonc
{ "source": "this project (surge遗漏空间清单_全量.txt + 我方全量空间统计清单.csv)",
  "fields": { "k": "space key", "u": "space URL", "f": "files (null = unscanned)",
              "mb": "size in MB (null = unscanned)", "st": "site status when scanned",
              "ar": "archived by us" },
  "rows": [{ "k": "ux/genryu_sai", "u": "https://ux.getuploader.com/genryu_sai/",
             "f": 175, "mb": 1564.6, "st": "可访问", "ar": false }, …] }
```

`null` means **we did not scan that space** — it does not mean "0 files". Sorted by `mb` descending.

---

## `archived.json` — spaces we actually downloaded

```jsonc
{ "source": "this project (空间存档清单.csv)",
  "fields": { "k": "space key", "u": "URL", "f": "files downloaded", "mb": "MB downloaded",
              "dl": "download counter on the site", "st": "status when crawled" },
  "rows": [{ "k": "uu/lras", "u": "https://uu.getuploader.com/lras/", "f": 212,
             "mb": 1607.9, "dl": 8506, "st": "可访问" }, …] }
```

`f`/`mb` here count what was **actually transferred**, which can be lower than the site's own `統計`
numbers (password-locked files, dead links, zero-byte entries).

---

## CSV variants

| File | Same as | Notes |
|---|---|---|
| `at-supplement-delta.csv` | `delta.json` | columns: `url, subdomain, files, mb, our_status, archived, archived_files, archived_mb`; UTF-8 **with BOM** so Excel opens it correctly |
| `at-supplement-archived.csv` | `archived.json` | columns: `key, url, files, mb, downloads, status` |

Both are intended to be merged into someone else's seed list; blank cells mean "unknown", never zero.
