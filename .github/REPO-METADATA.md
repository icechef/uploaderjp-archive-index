# Repository metadata (About panel)

Copy-paste values for GitHub's **About** box: *Settings → General → Description / Website / Topics*
(or `gh repo edit`).

## Description (recommended)

```
Searchable index of 239,152 uploader.jp / getuploader.com spaces, plus 1,630 the community crawl missed — file counts, sizes, titles, a word cloud, and which spaces have archived copies. Service ends 2026-11-25.
```

211 characters — GitHub's limit is 350.

Alternatives, if you prefer a different emphasis:

| Emphasis | Text | Chars |
|---|---|---|
| Preservation first | `Preservation index for uploader.jp / getuploader.com before it shuts down on 2026-11-25: 135,545 non-empty spaces, a 9,748-URL WARC of one space, and an explicit list of gaps.` | 175 |
| Technical | `Searchable catalogue of uploader.jp spaces before the 2026-11-25 shutdown: 135,545 non-empty spaces, WARC + CDX captures with offsets, and a documented list of what is missing.` | 176 |
| Minimal | `Index and archive catalogue for uploader.jp / getuploader.com (service ends 2026-11-25).` | 88 |
| 中文 | `uploader.jp / getuploader.com 空间索引与存档目录（服务 2026-11-25 关闭）：23.9 万空间 + 1,630 个社群索引漏掉的，含文件数、容量、已归档副本。` | 98 |

## Website

```
https://icechef.github.io/uploaderjp-archive-index/
```

## Topics

```
web-archiving uploader-jp getuploader warc cdx dataset digital-preservation japanese-web file-host static-site github-pages archive-org web-crawl index
```

14 topics, all valid (lower-case, hyphenated, ≤ 50 chars). GitHub allows 20.

## One-liner (if `gh` is installed)

```bash
gh repo edit icechef/uploaderjp-archive-index \
  --description "Searchable index of 239,152 uploader.jp / getuploader.com spaces, plus 1,630 the community crawl missed — file counts, sizes, titles, a word cloud, and which spaces have archived copies. Service ends 2026-11-25." \
  --homepage "https://icechef.github.io/uploaderjp-archive-index/" \
  --add-topic web-archiving --add-topic uploader-jp --add-topic getuploader --add-topic warc \
  --add-topic cdx --add-topic dataset --add-topic digital-preservation --add-topic japanese-web \
  --add-topic file-host --add-topic static-site --add-topic github-pages --add-topic archive-org \
  --add-topic web-crawl --add-topic index
```

## Notes

- The description is what shows in search results and on the repo card; keep the numbers in it
  (239,152 / 1,630 / 2026-11-25) because they are the searchable hooks.
- Do **not** claim completeness: the "and which spaces have archived copies" wording is deliberately
  narrower than "archived".
