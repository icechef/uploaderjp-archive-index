/* uploader.jp archive index — page logic
 *
 * Data contracts (see data/README.md):
 *   data/summary.json   { at, mine, archived, delta, sample, items, shutdown, generated }
 *   data/at.json        { source, fields, rows: [[key, status, files, size_mb], …] }
 *   data/delta.json     { source, fields, rows: [{ k, u, f, mb, st, ar }, …] }
 *   data/archived.json  { source, fields, rows: [{ k, u, f, mb, dl, st }, …] }
 *
 * Everything is client-side; no build step, no dependencies, no tracking.
 */
(function () {
  "use strict";

  var ROW_LIMIT = 500;          // rows rendered per table (full data stays in the CSV)
  var SEARCH_LIMIT = 200;       // rows rendered for search results

  var state = {
    lang: "en",
    summary: null,
    delta: [],
    archived: [],
    atRows: [],                 // [key, status, files, mb]
    atMap: null,                // Map<key, row> once the big index is loaded
    archivedKeys: new Set(),
    catalog: [],                // [[key, title, files, mb, downloads], …]
    catalogLoaded: false,
    catalogPage: 0,
    pageSize: 100,
    cloud: []                   // [{ w, n }, …]
  };

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

    if (state.summary) {
      renderLead();
      renderCards();
      renderSample();
      renderProse();
      renderFooter();
      renderDelta();
      renderArchived();
      renderSearch(byId("search-input").value);
      if (state.catalogLoaded) { renderCatalog(); renderCloud(); }
    }
  }

  function setLang(lang) {
    // 目录与云图的文案也会随语言变化，applyI18n() 会自动重绘已加载的部分
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

  function spaceLink(key) {
    var parts = key.split("/");
    var sub = parts.shift();
    var name = parts.join("/");
    return '<a class="mono" href="https://' + sub + '.getuploader.com/' + name +
      '/" target="_blank" rel="noopener noreferrer">' + key + "</a>";
  }

  function pill(text, kind) {
    return '<span class="pill pill--' + (kind || "idle") + '">' + text + "</span>";
  }

  /* ---------------- renderers ---------------- */

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
      [num(s.catalog ? s.catalog.spaces : 0), "card.catalog"]
    ];
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
      return "<b>" + t(r[0]) + "</b><span>" + r[1] + "</span>";
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
    byId("credits").textContent = t("method.credits", {
      at: num(s.at.spaces),
      date: s.shutdown
    });
  }

  function renderFooter() {
    byId("foot-built").textContent = t("foot.built", { gen: state.summary.generated });
  }

  function renderSearch(query) {
    var status = byId("search-status");
    var needle = (query || "").trim().toLowerCase();
    var rows = [];

    if (needle.length >= 2) {
      var terms = needle.split(/\s+/);
      var pool = state.atRows.length ? state.atRows : state.delta.map(function (d) {
        return [d.k, d.st, d.f, d.mb];
      });
      for (var i = 0; i < pool.length && rows.length < SEARCH_LIMIT; i++) {
        var key = pool[i][0];
        if (terms.every(function (term) { return key.indexOf(term) !== -1; })) rows.push(pool[i]);
      }
      // spaces our delta found but the community index lacks
      for (var j = 0; j < state.delta.length && rows.length < SEARCH_LIMIT; j++) {
        var d = state.delta[j];
        if (rows.some(function (r) { return r[0] === d.k; })) continue;
        if (terms.every(function (term) { return d.k.indexOf(term) !== -1; })) {
          rows.push([d.k, d.st, d.f, d.mb]);
        }
      }
    }

    var head = "<tr><th>" + t("th.space") + "</th><th>" + t("th.status") + '</th>' +
      '<th class="num">' + t("th.files") + '</th><th class="num">' + t("th.size") + "</th>" +
      "<th>" + t("th.inat") + "</th><th>" + t("th.arch") + "</th></tr>";

    byId("search-table").innerHTML = head + rows.map(function (row) {
      var key = row[0];
      var inIndex = state.atMap ? state.atMap.has(key) : null;
      var archived = state.archivedKeys.has(key);
      return "<tr><td>" + spaceLink(key) + "</td>" +
        "<td>" + pill(row[1] || "—") + "</td>" +
        '<td class="num">' + num(row[2]) + "</td>" +
        '<td class="num">' + size(row[3]) + "</td>" +
        "<td>" + (inIndex === null ? pill("…", "idle") : pill(inIndex ? t("yes") : t("no"), inIndex ? "ok" : "new")) + "</td>" +
        "<td>" + pill(archived ? t("yes") : t("no"), archived ? "ok" : "idle") + "</td></tr>";
    }).join("");

    if (needle.length < 2) {
      status.textContent = state.atMap
        ? t("search.ready", { n: num(state.atRows.length) })
        : t("search.loading", { n: num(state.summary ? state.summary.at.spaces : 0) });
    } else {
      status.textContent = t("search.hits", { n: num(rows.length) }) +
        (rows.length ? "" : " — " + t("search.none"));
    }
  }

  function renderDelta() {
    var query = (byId("delta-filter").value || "").toLowerCase();
    var mode = byId("delta-mode").value;
    var rows = state.delta.filter(function (d) {
      if (query && d.k.indexOf(query) === -1) return false;
      if (mode === "arch") return d.ar;
      if (mode === "noarch") return !d.ar;
      return true;
    });

    byId("delta-table").innerHTML =
      "<tr><th>" + t("th.space") + '</th><th class="num">' + t("th.files") +
      '</th><th class="num">' + t("th.size") + "</th><th>" + t("th.status") + "</th><th>" + t("th.arch") + "</th></tr>" +
      rows.slice(0, ROW_LIMIT).map(function (d) {
        return "<tr><td>" + spaceLink(d.k) + "</td>" +
          '<td class="num">' + num(d.f) + "</td>" +
          '<td class="num">' + (d.mb === null ? "—" : size(d.mb)) + "</td>" +
          "<td>" + pill(d.st || "—") + "</td>" +
          "<td>" + pill(d.ar ? t("yes") : t("no"), d.ar ? "ok" : "idle") + "</td></tr>";
      }).join("");

    byId("delta-status").textContent =
      t("delta.hint", { shown: num(Math.min(ROW_LIMIT, rows.length)), n: num(rows.length) });
  }

  function renderArchived() {
    var query = (byId("archived-filter").value || "").toLowerCase();
    var rows = state.archived.filter(function (a) {
      return !query || a.k.indexOf(query) !== -1;
    });

    byId("archived-table").innerHTML =
      "<tr><th>" + t("th.space") + '</th><th class="num">' + t("th.files") +
      '</th><th class="num">' + t("th.size") + '</th><th class="num">' + t("th.downloads") + "</th></tr>" +
      rows.slice(0, ROW_LIMIT).map(function (a) {
        return "<tr><td>" + spaceLink(a.k) + "</td>" +
          '<td class="num">' + num(a.f) + "</td>" +
          '<td class="num">' + size(a.mb) + "</td>" +
          '<td class="num">' + num(a.dl) + "</td></tr>";
      }).join("");

    byId("archived-status").textContent =
      t("archived.hint", { shown: num(Math.min(ROW_LIMIT, rows.length)), n: num(rows.length) });
  }

  /* ---------------- catalog ---------------- */

  var CATALOG_PALETTE = ["#6cb6ff", "#7ed3a2", "#e5a54b", "#c792ea", "#ef6b6b", "#59c2d6"];

  function loadCatalog() {
    if (state.catalogLoaded || state.catalogLoading) return;
    state.catalogLoading = true;
    byId("catalog-status").textContent = t("catalog.loading", { n: "133,981" });
    Promise.all([fetchJson("data/catalog.json"), fetchJson("data/cloud.json")])
      .then(function (res) {
        state.catalog = res[0].rows;
        state.cloud = res[1].terms;
        state.catalogLoaded = true;
        state.catalogLoading = false;
        populateSubdomains();
        renderCloud();
        renderCatalog();
      })
      .catch(function (err) {
        state.catalogLoading = false;
        byId("catalog-status").textContent = "catalog failed to load: " + err.message;
      });
  }

  function populateSubdomains() {
    var select = byId("catalog-sub");
    if (select.options.length > 1) return;
    var seen = {};
    state.catalog.forEach(function (r) { seen[r[0].split("/")[0]] = (seen[r[0].split("/")[0]] || 0) + 1; });
    Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a]; }).forEach(function (sub) {
      var opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub + " (" + seen[sub].toLocaleString("en-US") + ")";
      select.appendChild(opt);
    });
  }

  function catalogFiltered() {
    var query = (byId("catalog-query").value || "").trim().toLowerCase();
    var terms = query ? query.split(/\s+/) : [];
    var sub = byId("catalog-sub").value;
    var onlyArchived = byId("catalog-archived").checked;
    var onlyBig = byId("catalog-big").checked;
    var sort = byId("catalog-sort").value;

    var rows = state.catalog.filter(function (r) {
      if (sub && r[0].indexOf(sub + "/") !== 0) return false;
      if (onlyArchived && !state.archivedKeys.has(r[0])) return false;
      if (onlyBig && Number(r[3]) < 100) return false;
      if (terms.length) {
        var haystack = (r[0] + " " + r[1]).toLowerCase();
        for (var i = 0; i < terms.length; i++) if (haystack.indexOf(terms[i]) === -1) return false;
      }
      return true;
    });

    rows.sort(function (a, b) {
      if (sort === "name") return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
      if (sort === "size") return Number(b[3]) - Number(a[3]);
      if (sort === "downloads") return Number(b[4]) - Number(a[4]);
      return Number(b[2]) - Number(a[2]);
    });
    return rows;
  }

  function renderCatalog() {
    var rows = catalogFiltered();
    var pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if (state.catalogPage >= pages) state.catalogPage = 0;
    var start = state.catalogPage * state.pageSize;
    var slice = rows.slice(start, start + state.pageSize);

    byId("catalog-table").innerHTML =
      "<tr><th>" + t("th.space") + "</th><th>" + t("th.title") + '</th><th class="num">' + t("th.files") +
      '</th><th class="num">' + t("th.size") + '</th><th class="num">' + t("th.downloads") + "</th><th>" + t("th.arch") + "</th></tr>" +
      slice.map(function (r) {
        var archived = state.archivedKeys.has(r[0]);
        return "<tr><td>" + spaceLink(r[0]) + "</td>" +
          '<td class="title-cell">' + (r[1] ? escapeHtml(r[1]) : '<span class="pill pill--idle">—</span>') + "</td>" +
          '<td class="num">' + num(r[2]) + "</td>" +
          '<td class="num">' + size(r[3]) + "</td>" +
          '<td class="num">' + num(r[4]) + "</td>" +
          "<td>" + pill(archived ? t("yes") : t("no"), archived ? "ok" : "idle") + "</td></tr>";
      }).join("");

    byId("catalog-status").textContent = rows.length
      ? t("catalog.hint", { n: num(rows.length), a: num(start + 1), b: num(Math.min(start + state.pageSize, rows.length)) })
      : t("catalog.empty");
    byId("catalog-page").textContent = t("catalog.page", { p: num(state.catalogPage + 1), n: num(pages) });
    byId("catalog-prev").disabled = state.catalogPage === 0;
    byId("catalog-next").disabled = state.catalogPage >= pages - 1;
  }

  function renderCloud() {
    var max = state.cloud.length ? state.cloud[0].n : 1;
    byId("cloud-box").innerHTML = state.cloud.map(function (term, i) {
      var scale = Math.sqrt(term.n / max);
      var fontSize = (0.85 + scale * 1.75).toFixed(2);
      var colour = CATALOG_PALETTE[i % CATALOG_PALETTE.length];
      return '<a href="#catalog" class="cloud-term" data-term="' + escapeHtml(term.w) + '"' +
        ' style="font-size:' + fontSize + "em;color:" + colour + ';margin:0 10px 4px 0;display:inline-block"' +
        ' title="' + num(term.n) + '">' + escapeHtml(term.w) + "</a>";
    }).join("");
    byId("cloud-status").textContent = t("cloud.hint", { n: num(state.cloud.length) });
    Array.prototype.forEach.call(document.querySelectorAll(".cloud-term"), function (el) {
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        byId("catalog-query").value = el.dataset.term;
        state.catalogPage = 0;
        renderCatalog();
        document.getElementById("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
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
    var fromUrl = new URLSearchParams(location.search).get("lang");
    var stored = null;
    try { stored = localStorage.getItem("archive-index-lang"); } catch (e) { /* ignore */ }
    var presetQuery = new URLSearchParams(location.search).get("q") || "";
    var guess = (navigator.language || "en").slice(0, 2);
    state.lang = window.I18N[fromUrl] ? fromUrl
      : window.I18N[stored] ? stored
      : window.I18N[guess] ? guess : "en";

    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () { setLang(btn.dataset.lang); });
    });
    byId("search-input").addEventListener("input", function (e) { renderSearch(e.target.value); });
    byId("search-clear").addEventListener("click", function () {
      byId("search-input").value = "";
      renderSearch("");
      byId("search-input").focus();
    });
    // catalog controls (data loads on first interaction)
    byId("catalog-query").addEventListener("focus", loadCatalog);
    byId("catalog-query").addEventListener("input", function () { loadCatalog(); state.catalogPage = 0; renderCatalog(); });
    byId("catalog-sort").addEventListener("change", function () { state.catalogPage = 0; renderCatalog(); });
    byId("catalog-sub").addEventListener("change", function () { state.catalogPage = 0; renderCatalog(); });
    byId("catalog-archived").addEventListener("change", function () { state.catalogPage = 0; renderCatalog(); });
    byId("catalog-big").addEventListener("change", function () { state.catalogPage = 0; renderCatalog(); });
    byId("catalog-prev").addEventListener("click", function () { if (state.catalogPage > 0) { state.catalogPage--; renderCatalog(); } });
    byId("catalog-next").addEventListener("click", function () { state.catalogPage++; renderCatalog(); });
    byId("delta-filter").addEventListener("input", renderDelta);
    byId("delta-mode").addEventListener("change", renderDelta);
    byId("archived-filter").addEventListener("input", renderArchived);

    if (presetQuery) byId("search-input").value = presetQuery;
    var presetCatalog = new URLSearchParams(location.search).get("cat") || "";
    if (location.hash === "#catalog" || location.hash === "#cloud" || presetCatalog) {
      loadCatalog();
      if (presetCatalog) byId("catalog-query").value = presetCatalog;
    }
    applyI18n();

    Promise.all([
      fetchJson("data/summary.json"),
      fetchJson("data/delta.json"),
      fetchJson("data/archived.json")
    ]).then(function (results) {
      state.summary = results[0];
      state.delta = results[1].rows;
      state.archived = results[2].rows;
      state.delta.forEach(function (d) { if (d.ar) state.archivedKeys.add(d.k); });
      state.archived.forEach(function (a) { state.archivedKeys.add(a.k); });
      applyI18n();

      // the community index is ~7 MB → load it in the background
      fetchJson("data/at.json").then(function (payload) {
        state.atRows = payload.rows;
        state.atMap = new Map(payload.rows.map(function (r) { return [r[0], r]; }));
        renderSearch(byId("search-input").value);
      }).catch(function (err) {
        byId("search-status").textContent = "index failed to load: " + err.message;
      });
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
