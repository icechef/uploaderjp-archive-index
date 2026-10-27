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
    archivedKeys: new Set()
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
    }
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
      [num(s.mine.files), "card.mine"]
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
    byId("delta-filter").addEventListener("input", renderDelta);
    byId("delta-mode").addEventListener("change", renderDelta);
    byId("archived-filter").addEventListener("input", renderArchived);

    if (presetQuery) byId("search-input").value = presetQuery;
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
