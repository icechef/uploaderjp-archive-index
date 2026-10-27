/* uploader.jp archive index — page logic
 *
 * Data contracts (see data/README.md):
 *   data/summary.json   { at, mine, archived, delta, sample, items, shutdown, generated, catalog }
 *   data/at.json        { source, fields, rows: [[key, status, files, size_mb], …] }
 *   data/delta.json     { source, fields, rows: [{ k, u, f, mb, st, ar }, …] }
 *   data/archived.json  { source, fields, rows: [{ k, u, f, mb, dl, st }, …] }
 *   data/catalog.json   { source, fields, rows: [[key, title, files, size_mb, downloads], …] }
 *   data/cloud.json     { source, terms: [{ w, n }, …] }
 *
 * All tables share one renderer: click a header to sort, pager below the table.
 * Everything is client-side; no build step, no dependencies, no tracking.
 */
(function () {
  "use strict";

  /* ---------------- state ---------------- */

  var state = {
    lang: "en",
    summary: null,
    atRows: [],                 // [key, status, files, mb]
    atMap: null,                // Map<key, row>
    delta: [],                  // { k, u, f, mb, st, ar }
    archived: [],               // { k, u, f, mb, dl, st }
    archivedKeys: new Set(),
    credit: "uploaderjp archive index",
    catalog: [],                // [key, title, files, mb, downloads]
    catalogLoaded: false,
    catalogLoading: false,
    cloud: [],
    cloudLoading: false,
    tables: {}                  // name → { page, size, sort, dir }
  };

  var TABLE_DEFAULTS = {
    search:   { page: 0, size: 50,  sort: "files", dir: -1 },
    catalog:  { page: 0, size: 100, sort: "files", dir: -1 },
    delta:    { page: 0, size: 100, sort: "mb",    dir: -1 },
    archived: { page: 0, size: 100, sort: "mb",    dir: -1 }
  };

  var CLOUD_COLOURS = ["#6cb6ff", "#7ed3a2", "#e5a54b", "#c792ea", "#ef6b6b", "#59c2d6"];

  function isNarrow() { return window.innerWidth <= 700; }

  var VIEW_KEY = "archive-index-view";

  function currentView() {
    try { return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards"; }
    catch (e) { return "cards"; }
  }

  function applyView(view) {
    document.body.classList.toggle("table-mode", view === "table");
    document.querySelectorAll(".view-switch button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.view === view));
    });
    // 卡片模式下手机每页 25 条（卡片很高），表格模式恢复 100 条
    state.tables = {};
    if (state.summary) { renderSearch(); renderDelta(); renderArchived(); if (state.catalogLoaded) renderCatalog(); }
  }

  function syncNavArrows() {
    var nav = document.querySelector(".site-nav");
    if (!nav) return;
    var overflow = nav.scrollWidth > nav.clientWidth + 2;
    document.querySelectorAll(".nav-arrow").forEach(function (a) {
      a.style.display = overflow ? "inline-flex" : "none";
    });
  }

  function tableState(name) {
    if (!state.tables[name]) {
      var d = TABLE_DEFAULTS[name];
      // 手机端每页少一些：卡片比表格行高很多，100 条会滚到两万多像素
      var narrow = isNarrow() && !document.body.classList.contains("table-mode");
      state.tables[name] = { page: d.page, size: narrow ? 25 : d.size, sort: d.sort, dir: d.dir };
    }
    return state.tables[name];
  }

  /* ---------------- i18n ---------------- */

  function t(key, vars) {
    var dict = window.I18N[state.lang] || window.I18N.en;
    var value = dict[key] !== undefined ? dict[key] : window.I18N.en[key];
    if (Array.isArray(value)) return value;
    if (value === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        value = value.split("{" + k + "}").join(vars[k]);
      });
    }
    return value;
  }

  function applyI18n() {
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : state.lang;
    document.title = t("meta.title");
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", t("meta.desc"));

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.innerHTML = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.dataset.i18nPh));
    });
    document.querySelectorAll("[data-i18n-list]").forEach(function (el) {
      var items = t(el.dataset.i18nList);
      el.innerHTML = (Array.isArray(items) ? items : [])
        .map(function (line) { return "<li>" + line + "</li>"; }).join("");
    });
    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === state.lang));
    });
    document.querySelectorAll(".view-switch button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.view === currentView()));
    });

    if (state.summary) {
      renderLead();
      renderCards();
      renderSample();
      renderProse();
      renderFooter();
      renderSearch();
      renderDelta();
      renderArchived();
      if (state.cloud.length) renderCloud();
      if (state.catalogLoaded) renderCatalog();
    }
    // 语言切换会改变导航文字长度，箭头显隐要重新判定
    syncNavArrows();
  }

  function setLang(lang) {
    state.lang = window.I18N[lang] ? lang : "en";
    try { localStorage.setItem("archive-index-lang", state.lang); } catch (e) { /* private mode */ }
    applyI18n();
  }

  /* ---------------- helpers ---------------- */

  function byId(id) { return document.getElementById(id); }

  function num(value) {
    return value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("en-US");
  }

  // Sizes are decimal (the site prints "MB"); 1000 MB = 1 GB, 1,000,000 MB = 1 TB.
  function size(mb) {
    mb = Number(mb) || 0;
    if (mb >= 1e6) return (mb / 1e6).toFixed(2) + " TB";
    if (mb >= 1e3) return (mb / 1e3).toFixed(1) + " GB";
    return mb.toFixed(1) + " MB";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function spaceLink(key) {
    var parts = String(key).split("/");
    var sub = parts.shift();
    var name = parts.join("/");
    return '<a class="mono" href="https://' + sub + '.getuploader.com/' + name +
      '/" target="_blank" rel="noopener noreferrer">' + escapeHtml(key) + "</a>";
  }

  function pill(text, kind) {
    return '<span class="pill pill--' + (kind || "idle") + '">' + text + "</span>";
  }

  function statusPill(code) {
    var known = { ok: "ok", gone: "gone", locked: "locked", empty: "empty", unscanned: "unscanned", other: "other" };
    var key = known[code] ? "status." + known[code] : "status.other";
    var kind = code === "ok" ? "ok" : code === "gone" ? "gone" : "idle";
    return pill(t(key), kind);
  }

  function yesNo(flag) {
    return pill(flag ? t("yes") : t("no"), flag ? "ok" : "idle");
  }

  /* ---------------- generic table: sortable header + pager ---------------- */

  function compare(records, key, dir) {
    return records.slice().sort(function (a, b) {
      var av = a[key], bv = b[key];
      // empty values (e.g. titles of spaces the community index does not know) always sort last
      if (key === "title" || key === "status") {
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
      }
      if (key === "k" || key === "title" || key === "status") {
        av = String(av || ""); bv = String(bv || "");
        return dir * (av < bv ? -1 : av > bv ? 1 : 0);
      }
      return dir * ((Number(av) || 0) - (Number(bv) || 0));
    });
  }

  /** columns: [{ key, label, num?, cls?, cell(record) → html }] */
  function renderTable(name, records, columns, emptyText) {
    var st = tableState(name);
    var sorted = compare(records, st.sort, st.dir);
    var pages = Math.max(1, Math.ceil(sorted.length / st.size));
    if (st.page > pages - 1) st.page = pages - 1;
    if (st.page < 0) st.page = 0;
    var start = st.page * st.size;
    var slice = sorted.slice(start, start + st.size);

    var head = "<tr>" + columns.map(function (col) {
      var isSorted = st.sort === col.key;
      var ariaSort = isSorted ? (st.dir === 1 ? "ascending" : "descending") : "none";
      return '<th scope="col" aria-sort="' + ariaSort + '" class="sortable' + (isSorted ? " sorted" : "") +
        (col.num ? " num" : "") +
        '" data-table="' + name + '" data-key="' + col.key + '" title="' + t("pager.sort") + '">' +
        col.label + '<span class="sort-ind">' + (isSorted ? (st.dir === 1 ? "▲" : "▼") : "↕") + "</span></th>";
    }).join("") + "</tr>";

    var body = slice.map(function (rec) {
      return "<tr>" + columns.map(function (col) {
        return '<td data-label="' + escapeHtml(col.label) + '" class="' +
          (col.num ? "num" : "") + (col.cls ? " " + col.cls : "") + '">' +
          col.cell(rec) + "</td>";
      }).join("") + "</tr>";
    }).join("");

    byId(name + "-table").innerHTML = "<thead>" + head + "</thead><tbody>" + (sorted.length ? body :
      '<tr><td colspan="' + columns.length + '"><span class="status">' + emptyText + "</span></td></tr>") + "</tbody>";

    var pager = byId(name + "-pager");
    if (!pager) return;
    if (sorted.length <= st.size) { pager.innerHTML = ""; return; }
    pager.innerHTML =
      '<button type="button" data-pager="' + name + '" data-act="first" ' + (st.page === 0 ? "disabled" : "") + ">«</button>" +
      '<button type="button" data-pager="' + name + '" data-act="prev" ' + (st.page === 0 ? "disabled" : "") + ">‹ " + t("pager.prev") + "</button>" +
      '<span class="pager-info">' + t("pager.info", {
        p: num(st.page + 1), n: num(pages), total: num(sorted.length)
      }) + "</span>" +
      '<button type="button" data-pager="' + name + '" data-act="next" ' + (st.page >= pages - 1 ? "disabled" : "") + ">" + t("pager.next") + " ›</button>" +
      '<button type="button" data-pager="' + name + '" data-act="last" ' + (st.page >= pages - 1 ? "disabled" : "") + ">»</button>";
  }

  function bindTableControls() {
    document.addEventListener("click", function (ev) {
      var th = ev.target.closest("th.sortable");
      if (th) {
        var st = tableState(th.dataset.table);
        if (st.sort === th.dataset.key) st.dir = -st.dir;
        else {
          st.sort = th.dataset.key;
          st.dir = (th.dataset.key === "k" || th.dataset.key === "title" || th.dataset.key === "status") ? 1 : -1;
        }
        st.page = 0;
        rerender(th.dataset.table);
        return;
      }
      var btn = ev.target.closest("button[data-pager]");
      if (!btn) return;
      var ts = tableState(btn.dataset.pager);
      if (btn.dataset.act === "first") ts.page = 0;
      if (btn.dataset.act === "prev") ts.page = Math.max(0, ts.page - 1);
      if (btn.dataset.act === "next") ts.page += 1;
      if (btn.dataset.act === "last") ts.page = 1e9;      // clamped by renderTable
      rerender(btn.dataset.pager);
    });
  }

  function rerender(name) {
    if (name === "search") renderSearch();
    else if (name === "catalog") renderCatalog();
    else if (name === "delta") renderDelta();
    else if (name === "archived") renderArchived();
  }

  /* ---------------- summary sections ---------------- */

  function renderLead() {
    var s = state.summary;
    byId("lead").textContent = t("lead", {
      at: num(s.at.spaces),
      delta: num(s.delta.count),
      mine: num(s.mine.spaces),
      arch: num(s.archived.spaces),
      archfiles: num(s.archived.files),
      archmb: size(s.archived.mb),
      date: s.shutdown
    });
  }

  function renderCards() {
    var s = state.summary;
    var cards = [
      [num(s.at.spaces), "card.at"],
      [size(s.at.mb), "card.atmb"],
      [num(s.delta.count), "card.delta"],
      [size(s.delta.mb), "card.deltamb"],
      [num(s.archived.spaces), "card.arch"],
      [num(s.mine.files), "card.mine"],
      [s.catalog ? num(s.catalog.spaces) : "—", "card.catalog"]
    ];
    var tag = byId("catalog-tag");
    if (tag) tag.textContent = t("catalog.tag", { n: num(s.catalog ? s.catalog.spaces : 0) });
    byId("cards").innerHTML = cards.map(function (c) {
      return '<div class="card"><b>' + c[0] + "</b><span>" + t(c[1]) + "</span></div>";
    }).join("");
  }

  function renderSample() {
    var s = state.summary.sample;
    var rows = [
      ["sample.files", num(s.files)],
      ["sample.locked", num(s.locked)],
      ["sample.unlocked", num(s.unlocked)],
      ["sample.zip", num(s.zip_files)],
      ["sample.warc", num(s.warc_urls)],
      ["sample.resp", num(s.warc_responses)],
      ["sample.mb", s.warc_mb + " MB"],
      ["sample.php", s.php_404],
      ["sample.zero", s.zero_byte]
    ];
    byId("sample-kv").innerHTML = rows.map(function (r) {
      return '<div class="stat"><b>' + r[1] + "</b><span>" + t(r[0]) + "</span></div>";
    }).join("");
    byId("link-warc-item").href = state.summary.items.warc;
    byId("link-files-item").href = state.summary.items.files;
  }

  function renderProse() {
    var s = state.summary;
    byId("archived-lead").textContent = t("archived.lead", {
      n: num(s.archived.spaces),
      files: num(s.archived.files),
      mb: size(s.archived.mb),
      warc: num(s.sample.warc_urls)
    });
    byId("credits").textContent = t("method.credits", { at: num(s.at.spaces), date: s.shutdown });
  }

  function renderFooter() {
    byId("foot-built").textContent = t("foot.built", { gen: state.summary.generated });
    var el = byId("byline");
    var name = state.credit;
    if (el.dataset.creditHref) {
      name = '<a href="' + el.dataset.creditHref + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(state.credit) + "</a>";
    }
    var issuesHref = el.dataset.issuesHref || "https://github.com/icechef/uploaderjp-archive-index/issues";
    var issues = '<a href="' + issuesHref + '" target="_blank" rel="noopener noreferrer">' +
      t("byline.issues") + "</a>";
    el.innerHTML = t("byline.made", { name: name, issues: issues }) + " · " + t("byline.code") +
      ' · <a href="DATA-SOURCES.md">' + t("byline.license") + "</a>";
  }

  /* ---------------- search (community index + delta) ---------------- */

  function searchRecords() {
    var needle = (byId("search-input").value || "").trim().toLowerCase();
    if (needle.length < 2) return [];
    var terms = needle.split(/\s+/);
    var out = [];
    var pool = state.atRows.length ? state.atRows : state.delta.map(function (d) {
      return [d.k, d.st, d.f, d.mb];
    });
    pool.forEach(function (row) {
      var key = String(row[0]);
      if (terms.every(function (term) { return key.indexOf(term) !== -1; })) {
        out.push({ k: key, status: row[1] || "", files: row[2], mb: row[3] });
      }
    });
    state.delta.forEach(function (d) {
      if (out.some(function (r) { return r.k === d.k; })) return;
      if (terms.every(function (term) { return d.k.indexOf(term) !== -1; })) {
        out.push({ k: d.k, status: d.st || "", files: d.f, mb: d.mb });
      }
    });
    return out;
  }

  function renderSearch() {
    var records = searchRecords();
    var columns = [
      { key: "k", label: t("th.space"), cell: function (r) { return spaceLink(r.k); } },
      { key: "status", label: t("th.status"), cell: function (r) { return statusPill(r.status); } },
      { key: "files", label: t("th.files"), num: true, cell: function (r) { return num(r.files); } },
      { key: "mb", label: t("th.size"), num: true, cell: function (r) { return size(r.mb); } },
      {
        key: "inIndex", label: t("th.inindex"), cell: function (r) {
          if (!state.atMap) return pill("…", "idle");
          return yesNo(state.atMap.has(r.k));
        }
      },
      {
        key: "archived", label: t("th.arch"), cell: function (r) {
          return yesNo(state.archivedKeys.has(r.k));
        }
      }
    ];
    renderTable("search", records, columns, t("search.none"));

    var typed = (byId("search-input").value || "").trim();
    byId("search-status").textContent = typed.length < 2
      ? (state.atMap ? t("search.ready", { n: num(state.atRows.length) }) : t("search.idle"))
      : t("search.hits", { n: num(records.length) }) + (state.atMap ? "" : " · " + t("search.idle"));
  }

  /* ---------------- catalog ---------------- */

  function loadCloud() {
    if (state.cloud.length || state.cloudLoading) return;
    state.cloudLoading = true;
    fetchJson("data/cloud.json").then(function (payload) {
      state.cloud = payload.terms;
      state.cloudLoading = false;
      renderCloud();
    }).catch(function (err) {
      state.cloudLoading = false;
      byId("cloud-status").textContent = "cloud failed to load: " + err.message;
    });
  }

  function skeletonRows(cols) {
    var row = '<tr class="skeleton"><td colspan="' + cols + '"><span></span></td></tr>';
    return new Array(8).join(row) + row;
  }

  /** fetch JSON 但把下载进度报出来（catalog.json 有 7 MB，干等 1-2 秒很难受） */
  function fetchJsonProgress(path, onProgress) {
    return fetch(path, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(path + " → HTTP " + res.status);
      var total = Number(res.headers.get("content-length") || 0);
      if (!res.body || !total || !window.TextDecoder) return res.json();
      var reader = res.body.getReader();
      var chunks = [], received = 0;
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) {
            var buf = new Uint8Array(received), offset = 0;
            chunks.forEach(function (c) { buf.set(c, offset); offset += c.length; });
            return JSON.parse(new TextDecoder().decode(buf));
          }
          chunks.push(step.value);
          received += step.value.length;
          onProgress(Math.min(99, Math.round((received / total) * 100)));
          return pump();
        });
      }
      return pump();
    });
  }

  function loadCatalog() {
    if (state.catalogLoaded || state.catalogLoading) return;
    state.catalogLoading = true;
    byId("catalog-table").innerHTML = "<thead><tr><th>" + t("th.space") + "</th></tr></thead><tbody>" +
      skeletonRows(1) + "</tbody>";
    byId("catalog-status").textContent = t("catalog.loading.pct", { pct: 0 });
    fetchJsonProgress("data/catalog.json", function (pct) {
      byId("catalog-status").textContent = t("catalog.loading.pct", { pct: pct });
    }).then(function (payload) {
      state.catalog = payload.rows;
      state.catalogLoaded = true;
      state.catalogLoading = false;
      populateSubdomains();
      renderCatalog();
    }).catch(function (err) {
      state.catalogLoading = false;
      byId("catalog-status").textContent = "catalog failed to load: " + err.message;
    });
  }

  function populateSubdomains() {
    var select = byId("catalog-sub");
    if (select.options.length > 1) return;
    var counts = {};
    state.catalog.forEach(function (r) {
      var sub = r[0].split("/")[0];
      counts[sub] = (counts[sub] || 0) + 1;
    });
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).forEach(function (sub) {
      var opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub + " (" + counts[sub].toLocaleString("en-US") + ")";
      select.appendChild(opt);
    });
  }

  function catalogRecords() {
    var query = (byId("catalog-query").value || "").trim().toLowerCase();
    var terms = query ? query.split(/\s+/) : [];
    var sub = byId("catalog-sub").value;
    var onlyArchived = byId("catalog-archived").checked;
    var onlyBig = byId("catalog-big").checked;

    return state.catalog.filter(function (r) {
      if (sub && r[0].indexOf(sub + "/") !== 0) return false;
      if (onlyArchived && !state.archivedKeys.has(r[0])) return false;
      if (onlyBig && Number(r[3]) < 100) return false;
      if (terms.length) {
        var haystack = (r[0] + " " + r[1]).toLowerCase();
        for (var i = 0; i < terms.length; i++) if (haystack.indexOf(terms[i]) === -1) return false;
      }
      return true;
    }).map(function (r) {
      return { k: r[0], title: r[1], files: r[2], mb: r[3], dl: r[4], inIndex: r[5] !== 0 };
    });
  }

  function renderCatalog() {
    if (!state.catalogLoaded) return;
    var records = catalogRecords();
    var columns = [
      { key: "k", label: t("th.space"), cell: function (r) { return spaceLink(r.k); } },
      {
        key: "title", label: t("th.title"), cls: "title-cell", cell: function (r) {
          return r.title ? escapeHtml(r.title) : '<span class="pill pill--idle">—</span>';
        }
      },
      { key: "files", label: t("th.files"), num: true, cell: function (r) { return num(r.files); } },
      { key: "mb", label: t("th.size"), num: true, cell: function (r) { return size(r.mb); } },
      { key: "dl", label: t("th.downloads"), num: true, cell: function (r) { return num(r.dl); } },
      {
        key: "inIndex", label: t("th.inindex"), cell: function (r) { return yesNo(r.inIndex); }
      },
      {
        key: "archived", label: t("th.arch"), cell: function (r) {
          return yesNo(state.archivedKeys.has(r.k));
        }
      }
    ];
    renderTable("catalog", records, columns, t("catalog.empty"));
    byId("catalog-status").textContent = records.length
      ? t("catalog.hint", { n: num(records.length) })
      : t("catalog.empty");
  }

  function exportCsv() {
    var records = catalogLoadedRecords();
    // 社群索引是懒加载的：还没载入时就不写这一列，避免把 "unknown" 当成数据导出去
    var withIndex = !!state.atMap;
    var head = ["space", "title", "files", "size_mb", "downloads"];
    if (withIndex) head.push("in_community_index");
    head.push("archived_copy");
    var lines = [head.join(",")];
    records.forEach(function (r) {
      var row = [r.k, quote(r.title || ""), r.files, r.mb, r.dl];
      if (withIndex) row.push(state.atMap.has(r.k) ? "yes" : "no");
      row.push(state.archivedKeys.has(r.k) ? "yes" : "no");
      lines.push(row.join(","));
    });
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "uploaderjp-catalog-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);

    function quote(value) {
      var s = String(value);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
  }

  function catalogLoadedRecords() {
    return state.catalogLoaded ? catalogRecords() : [];
  }

  function renderCloud() {
    var max = state.cloud.length ? state.cloud[0].n : 1;
    byId("cloud-box").innerHTML = state.cloud.map(function (term, i) {
      var scale = Math.sqrt(term.n / max);
      var fontSize = (0.85 + scale * 1.75).toFixed(2);
      var colour = CLOUD_COLOURS[i % CLOUD_COLOURS.length];
      return '<a href="#catalog" class="cloud-term" data-term="' + escapeHtml(term.w) + '"' +
        ' style="font-size:' + fontSize + "em;color:" + colour + ';margin:0 10px 4px 0;display:inline-block"' +
        ' title="' + num(term.n) + '">' + escapeHtml(term.w) + "</a>";
    }).join("");
    byId("cloud-status").textContent = t("cloud.hint", { n: num(state.cloud.length) });

    Array.prototype.forEach.call(document.querySelectorAll(".cloud-term"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        byId("catalog-query").value = el.dataset.term;
        tableState("catalog").page = 0;
        if (state.catalogLoaded) renderCatalog(); else loadCatalog();
        byId("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ---------------- delta & archived ---------------- */

  function renderDelta() {
    var query = (byId("delta-filter").value || "").toLowerCase();
    var mode = byId("delta-mode").value;
    var records = state.delta.filter(function (d) {
      if (query && d.k.indexOf(query) === -1) return false;
      if (mode === "arch") return d.ar;
      if (mode === "noarch") return !d.ar;
      return true;
    }).map(function (d) {
      return { k: d.k, files: d.f, mb: d.mb, status: d.st || "", archived: d.ar };
    });

    var columns = [
      { key: "k", label: t("th.space"), cell: function (r) { return spaceLink(r.k); } },
      { key: "files", label: t("th.files"), num: true, cell: function (r) { return num(r.files); } },
      { key: "mb", label: t("th.size"), num: true, cell: function (r) { return r.mb === null ? "—" : size(r.mb); } },
      { key: "status", label: t("th.status"), cell: function (r) { return statusPill(r.status); } },
      { key: "archived", label: t("th.arch"), cell: function (r) { return yesNo(r.archived); } }
    ];
    renderTable("delta", records, columns, t("catalog.empty"));
    byId("delta-status").textContent = t("delta.hint", { n: num(records.length) });
  }

  function renderArchived() {
    var query = (byId("archived-filter").value || "").toLowerCase();
    var records = state.archived.filter(function (a) {
      return !query || a.k.indexOf(query) !== -1;
    }).map(function (a) {
      return { k: a.k, files: a.f, mb: a.mb, dl: a.dl };
    });

    var columns = [
      { key: "k", label: t("th.space"), cell: function (r) { return spaceLink(r.k); } },
      { key: "files", label: t("th.files"), num: true, cell: function (r) { return num(r.files); } },
      { key: "mb", label: t("th.size"), num: true, cell: function (r) { return size(r.mb); } },
      { key: "dl", label: t("th.downloads"), num: true, cell: function (r) { return num(r.dl); } }
    ];
    renderTable("archived", records, columns, t("catalog.empty"));
    byId("archived-status").textContent = t("archived.hint", { n: num(records.length) });
  }

  /* ---------------- community index (7 MB, on demand) ---------------- */

  function ensureIndex() {
    if (state.atMap || state.indexLoading) return;
    state.indexLoading = true;
    byId("search-status").textContent = t("search.loading", {
      n: num(state.summary ? state.summary.at.spaces : 0)
    });
    fetchJson("data/at.json").then(function (payload) {
      state.atRows = payload.rows;
      state.atMap = new Map(payload.rows.map(function (r) { return [r[0], r]; }));
      state.indexLoading = false;
      renderSearch();
      if (state.catalogLoaded) renderCatalog();   // fill the "in community index" column
    }).catch(function (err) {
      state.indexLoading = false;
      byId("search-status").textContent = "index failed to load: " + err.message;
    });
  }

  /* ---------------- boot ---------------- */

  function fetchJson(path) {
    return fetch(path, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error(path + " → HTTP " + res.status);
      return res.json();
    });
  }

  function init() {
    var params = new URLSearchParams(location.search);
    var stored = null;
    try { stored = localStorage.getItem("archive-index-lang"); } catch (e) { /* ignore */ }
    var guess = (navigator.language || "en").slice(0, 2);
    state.lang = window.I18N[params.get("lang")] ? params.get("lang")
      : window.I18N[stored] ? stored
      : window.I18N[guess] ? guess : "en";

    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () { setLang(btn.dataset.lang); });
    });
    bindTableControls();

    // 卡片 / 表格 视图切换（仅手机端显示按钮）
    applyView(currentView());
    document.querySelectorAll(".view-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.dataset.view;
        try { localStorage.setItem(VIEW_KEY, view); } catch (e) { /* ignore */ }
        applyView(view);
      });
    });

    // 导航左右滑动（只有真的溢出时才显示箭头）
    syncNavArrows();
    window.addEventListener("resize", syncNavArrows);
    document.querySelectorAll(".nav-arrow").forEach(function (arrow) {
      arrow.addEventListener("click", function () {
        var nav = document.querySelector(".site-nav");
        var dir = Number(arrow.dataset.nav) || 1;
        nav.scrollBy({ left: dir * Math.max(140, nav.clientWidth * 0.7), behavior: "smooth" });
      });
    });

    byId("search-input").value = params.get("q") || "";
    byId("search-input").addEventListener("focus", ensureIndex);
    byId("search-input").addEventListener("input", function () {
      if (this.value.trim().length >= 2) ensureIndex();
      tableState("search").page = 0;
      renderSearch();
    });
    byId("search-clear").addEventListener("click", function () {
      byId("search-input").value = "";
      tableState("search").page = 0;
      renderSearch();
      byId("search-input").focus();
    });

    byId("delta-filter").addEventListener("input", function () { tableState("delta").page = 0; renderDelta(); });
    byId("delta-mode").addEventListener("change", function () { tableState("delta").page = 0; renderDelta(); });
    byId("archived-filter").addEventListener("input", function () { tableState("archived").page = 0; renderArchived(); });

    // cloud.json is 4 KB → load immediately; catalog.json is 7 MB → only when needed
    loadCloud();
    byId("catalog-query").value = params.get("cat") || "";
    byId("catalog-query").addEventListener("focus", loadCatalog);
    byId("catalog-query").addEventListener("input", function () {
      tableState("catalog").page = 0;
      if (state.catalogLoaded) renderCatalog();
    });
    byId("catalog-sub").addEventListener("change", function () { tableState("catalog").page = 0; renderCatalog(); });
    byId("catalog-archived").addEventListener("change", function () { tableState("catalog").page = 0; renderCatalog(); });
    byId("catalog-big").addEventListener("change", function () { tableState("catalog").page = 0; renderCatalog(); });
    byId("catalog-export").addEventListener("click", exportCsv);

    if ("IntersectionObserver" in window) {
      // 只为云图兜底（云图本身已首屏加载）；目录体积 7 MB，必须由显式操作触发：
      // 输入框聚焦/输入、导航点击、#catalog hash、?cat= 参数
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.target.id === "cloud") loadCloud();
        });
      }, { rootMargin: "0px", threshold: 0.01 });
      var cloudSection = byId("cloud");
      if (cloudSection) io.observe(cloudSection);
    }
    window.addEventListener("hashchange", function () {
      if (location.hash === "#cloud") loadCloud();
      if (location.hash === "#catalog") loadCatalog();
    });
    document.querySelectorAll('a[href="#cloud"], a[href="#catalog"]').forEach(function (a) {
      a.addEventListener("click", function () {
        if (a.getAttribute("href") === "#cloud") loadCloud(); else loadCatalog();
      });
    });

    var creditEl = byId("byline");
    if (creditEl && creditEl.dataset.credit) state.credit = creditEl.dataset.credit;
    applyI18n();
    if (params.get("cat") || location.hash === "#catalog" || location.hash === "#cloud") loadCatalog();

    Promise.all([
      fetchJson("data/summary.json"),
      fetchJson("data/delta.json"),
      fetchJson("data/archived.json"),
    ]).then(function (results) {
      state.summary = results[0];
      state.delta = results[1].rows;
      state.archived = results[2].rows;
      state.delta.forEach(function (d) { if (d.ar) state.archivedKeys.add(d.k); });
      state.archived.forEach(function (a) { state.archivedKeys.add(a.k); });
      applyI18n();

      if ((params.get("q") || "").trim().length >= 2) ensureIndex();
    }).catch(function (err) {
      byId("search-status").textContent = "data failed to load: " + err.message;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
