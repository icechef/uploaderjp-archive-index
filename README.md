# uploader.jp / getuploader.com — archive index

An index of spaces on `uploader.jp` / `getuploader.com` (a Japanese free file-host network that
**shuts down on 2026-11-25**), combining the community index with 1,630 spaces that index misses,
plus what has actually been archived.

**Live site**: enable GitHub Pages for this repository (see [Deploy](#deploy)) — the page is fully
static, needs no build step and has no tracking.

Maintained by [@icechef](https://github.com/icechef) · corrections and additions are welcome via GitHub Issues.

[简体中文](#中文) · [日本語](#日本語) · [English](#english)

---

## English

### What this repository contains

| Path | What it is |
|---|---|
| `index.html`, `assets/` | The static site: one page, three languages (EN / 中文 / 日本語), client-side search over the whole index |
| `data/at.json` | The community index, reduced to `[space_key, status, files, size_mb]` — 239,152 spaces (~7 MB, loaded in the background) |
| `data/delta.json` | The 1,630 spaces the community index **does not contain**, with file counts / sizes where known and whether an archived copy exists |
| `data/archived.json` | The 506 spaces that have downloaded copies on the Internet Archive (26,922 files / 83.2 GB) |
| `data/catalog.json` | All **135,545 non-empty spaces** (133,981 from the community index + 1,564 that index misses) with their titles — powers the browsable catalog: sortable columns, search by name *or* title, filters, pager |
| `data/cloud.json` | 160 term frequencies from those titles — powers the word cloud, where clicking a term filters the catalog |
| `data/summary.json` | Every aggregate number used on the page |
| `data/at-supplement-*.csv` | The same two lists as CSV, for merging into someone else's seed list |
| `data/README.md` | Field-by-field data dictionary |

### Numbers

| | spaces | files | size |
|---|---|---|---|
| Community index (`uploaderjp-archive.surge.sh`, self-reported) | 239,152 | 2,706,154 | 9.98 TB |
| Missing from it — found here | **1,630** | 35,471 (known) | 159.8 GB |
| Scanned by this project | 2,526 | 102,568 | 367 GB |
| **Archived (files downloaded)** | **506** | **26,922** | **83.2 GB** |
| Page-level archive of the `sample` space | 1 space | 9,748 URLs / 9,905 responses | 83 MB WARC |

A 30-space sample of the delta was verified by hand: 25 alive / 3 → 404 / 2 anomalies ≈ **83% genuinely
alive**, so the gap is real rather than noise.

### Archived artefacts on the Internet Archive

* files + index: <https://archive.org/details/u1-getuploader-sample-archive>
* pages (WARC) + IA-derived CDX: <https://archive.org/details/u1-getuploader-sample-warc-20261026>

### Deploy

The page is plain static files. Either:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions** (the included
   `.github/workflows/pages.yml` publishes the repository root), or
2. **Source: Deploy from a branch → `main` / `(root)`** — `.nojekyll` is present so nothing is filtered.

### Contributing

Missing spaces, wrong file counts and dead links are all worth reporting — open an issue with the
template in `.github/ISSUE_TEMPLATE/`. Corrections that come with a URL and the `統計` numbers are
the easiest to merge.

### Licence

* Code and the site (`index.html`, `assets/`, scripts): MIT — see [LICENSE](LICENSE).
* Data: mixed provenance, **not** relicensed. See [DATA-SOURCES.md](DATA-SOURCES.md).

---

## 中文

### 这个仓库是什么

`uploader.jp` / `getuploader.com`（日本免费上传器网络，**2026-11-25 关闭**）的空间索引：
把社群索引与补充的 1,630 个遗漏空间合并，并标注哪些已有存档副本。

| 路径 | 内容 |
|---|---|
| `index.html` / `assets/` | 静态站点：单页、三语（英/中/日）、可对全量索引做客户端搜索 |
| `data/at.json` | 社群索引精简版 `[空间键, 状态, 文件数, 容量MB]`，239,152 条（约 7 MB，后台加载） |
| `data/delta.json` | 社群索引**没有**的 1,630 个空间（含已知文件数/容量、是否已有存档副本） |
| `data/archived.json` | 已有下载副本的 506 个空间（26,922 文件 / 83.2 GB） |
| `data/summary.json` | 页面用到的全部汇总数字 |
| `data/*.csv` | 上述两份清单的 CSV 版，便于并进别人的 seed list |

**能做什么**：① 按空间名/标题搜索；② **目录**：13.55 万个非空空间，可按文件数/容量/下载数排序、按子域与"只看已存档"筛选、分页浏览；③ **云图**：首屏即显示 160 个词（置き場 / 倉庫 / 素材 / 音源 / 立ち絵 / MUGEN / 東方 / 太鼓 …），点词直接筛目录。

**数字**：社群索引 239,152 空间 / 2,706,154 文件 / 9.98 TB；补充 **1,630 个遗漏空间**
（已知 35,471 文件 / 159.8 GB，抽 30 个验证约 83% 真实存活）；扫描 2,526 个空间；其中有下载副本的是
**506 个空间 / 26,922 文件 / 83.2 GB**；另有 `sample` 空间的整站页面存档（9,748 URL / 9,905 响应 / 83 MB WARC）。

维护者：[@icechef](https://github.com/icechef) · 纠错与补充请提 GitHub Issue。

许可：代码 MIT；**数据不重新授权**，来源与许可逐项见 [DATA-SOURCES.md](DATA-SOURCES.md)。

---

## 日本語

`uploader.jp` / `getuploader.com`（2026-11-25 終了）のスペース索引です。コミュニティ索引に
**収録されていない 1,630 スペース**を追加し、実際に保存できたもの（506 スペース / 26,922 ファイル /
83.2 GB）を明示しています。`sample` スペースはページ単位の WARC としても完全保存済み
（9,748 URL / 9,905 応答）。

**できること**: ① スペース名・タイトルで検索、② **カタログ** 13.55 万の空でないスペースを
ファイル数・容量・ダウンロード数で並べ替え、サブドメインや「保存済みのみ」で絞り込み、ページ送り、
③ **ワードクラウド** タイトルから抽出した 160 語（置き場・倉庫・素材・音源・立ち絵・MUGEN・東方・太鼓 …）
をクリックするとカタログが絞り込まれます。

* 維持・整理: [@icechef](https://github.com/icechef)（訂正・追加は GitHub Issues まで）
* データ項目の説明は [data/README.md](data/README.md)
* 出典・ライセンスは [DATA-SOURCES.md](DATA-SOURCES.md)
* コードは MIT（[LICENSE](LICENSE)）、データは再ライセンスしていません
