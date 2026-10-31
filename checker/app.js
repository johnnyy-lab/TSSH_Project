/**
 * app.js — 網頁 UI（繁中、RWD）
 */
(function () {
  "use strict";

  var RULES_URL = "../ref/%E5%B7%A8%E4%BA%BA%E9%AB%98%E4%B8%AD%E5%B0%88%E9%A1%8C%E6%A0%BC%E5%BC%8F.rules.json";
  // 也試相對路徑未編碼檔名（部分伺服器）
  var RULES_URL_ALT = "../ref/巨人高中專題格式.rules.json";

  var els = {
    profile: document.getElementById("profile"),
    file: document.getElementById("file"),
    pickFile: document.getElementById("pickFile"),
    fileName: document.getElementById("fileName"),
    runBtn: document.getElementById("runBtn"),
    clearBtn: document.getElementById("clearBtn"),
    status: document.getElementById("status"),
    summaryCard: document.getElementById("summaryCard"),
    summaryGrid: document.getElementById("summaryGrid"),
    summaryHint: document.getElementById("summaryHint"),
    reportCard: document.getElementById("reportCard"),
    reportList: document.getElementById("reportList"),
    filters: document.getElementById("filters"),
  };

  var state = {
    spec: null,
    fileBuffer: null,
    fileName: "",
    lastReport: null,
    filter: "all",
  };

  function setStatus(msg, isError) {
    els.status.textContent = msg || "";
    els.status.classList.toggle("error", !!isError);
  }

  function statusLabel(s) {
    if (s === "pass") return "通過";
    if (s === "fail") return "不通過";
    if (s === "not_checked") return "尚未檢查";
    if (s === "skipped") return "略過";
    return s;
  }

  async function loadSpec() {
    var urls = [RULES_URL_ALT, RULES_URL];
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i]);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("無法載入規則檔");
  }

  function fillProfiles() {
    var list = TsshRulesEngine.listProfiles(state.spec);
    els.profile.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
      var o = document.createElement("option");
      o.value = list[i].key;
      o.textContent =
        list[i].label + "（" + list[i].ruleCount + " 條規則）";
      if (list[i].key === "full_document") o.selected = true;
      els.profile.appendChild(o);
    }
  }

  function updateRunEnabled() {
    els.runBtn.disabled = !(state.spec && state.fileBuffer);
  }

  function renderSummary(report) {
    var s = report.summary;
    els.summaryGrid.innerHTML =
      '<div class="stat"><span class="n">' +
      s.total +
      '</span><span class="l">套用規則</span></div>' +
      '<div class="stat pass"><span class="n">' +
      (s.pass || 0) +
      '</span><span class="l">通過</span></div>' +
      '<div class="stat fail"><span class="n">' +
      (s.fail || 0) +
      '</span><span class="l">不通過</span></div>' +
      '<div class="stat pending"><span class="n">' +
      (s.not_checked || 0) +
      '</span><span class="l">尚未檢查</span></div>';

    els.summaryHint.textContent =
      "繳交範圍：" +
      report.profileLabel +
      "　·　正文段落約 " +
      (report.meta.bodyParagraphCount || 0) +
      " 段　·　MVP 已實作 " +
      report.implementedIds.length +
      " 條（" +
      report.implementedIds.join("、") +
      "）";

    els.summaryCard.classList.remove("hidden");
  }

  function renderReport(report) {
    var filter = state.filter;
    var html = [];
    for (var i = 0; i < report.results.length; i++) {
      var r = report.results[i];
      if (filter !== "all" && r.status !== filter) continue;
      var locs = "";
      if (r.locations && r.locations.length) {
        locs = '<ul class="locs">';
        for (var j = 0; j < r.locations.length; j++) {
          var loc = r.locations[j];
          locs +=
            "<li><div class=\"preview\">「" +
            escapeHtml(loc.preview || "") +
            "」</div>" +
            (loc.actual
              ? "<div>實際：" + escapeHtml(String(loc.actual)) + "</div>"
              : "") +
            "</li>";
        }
        locs += "</ul>";
      }
      html.push(
        '<li class="rule-card ' +
          r.status +
          '">' +
          '<div class="rule-head">' +
          '<span class="badge ' +
          r.status +
          '">' +
          statusLabel(r.status) +
          "</span>" +
          '<span class="rule-id">' +
          escapeHtml(r.id) +
          "</span>" +
          '<span class="rule-cond">' +
          escapeHtml(r.condition || "") +
          "</span>" +
          "</div>" +
          (r.message
            ? '<div class="rule-meta">' + escapeHtml(r.message) + "</div>"
            : "") +
          (r.expected != null || r.actual != null
            ? '<dl class="rule-meta">' +
              (r.expected != null
                ? "<dt>規定</dt><dd>" +
                  escapeHtml(String(r.expected)) +
                  "</dd>"
                : "") +
              (r.actual != null
                ? "<dt>實際</dt><dd>" + escapeHtml(String(r.actual)) + "</dd>"
                : "") +
              "</dl>"
            : "") +
          locs +
          "</li>"
      );
    }
    if (!html.length) {
      html.push(
        '<li class="rule-card not_checked">此篩選條件下沒有規則。</li>'
      );
    }
    els.reportList.innerHTML = html.join("");
    els.reportCard.classList.remove("hidden");
    els.clearBtn.classList.remove("hidden");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function runCheck() {
    if (!state.fileBuffer || !state.spec) return;
    els.runBtn.disabled = true;
    setStatus("解析 docx 中…");
    try {
      var model = await TsshDocxParser.parseDocx(state.fileBuffer);
      setStatus("套用規則檢查中…");
      var report = TsshRulesEngine.runChecks(
        state.spec,
        model,
        els.profile.value
      );
      state.lastReport = report;
      renderSummary(report);
      renderReport(report);
      setStatus(
        "完成：" +
          (report.summary.pass || 0) +
          " 通過、" +
          (report.summary.fail || 0) +
          " 不通過、" +
          (report.summary.not_checked || 0) +
          " 尚未檢查"
      );
      els.summaryCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      console.error(e);
      setStatus("檢查失敗：" + (e && e.message ? e.message : String(e)), true);
    } finally {
      updateRunEnabled();
    }
  }

  function clearReport() {
    state.lastReport = null;
    els.summaryCard.classList.add("hidden");
    els.reportCard.classList.add("hidden");
    els.clearBtn.classList.add("hidden");
    els.summaryGrid.innerHTML = "";
    els.reportList.innerHTML = "";
    setStatus("");
  }

  // events
  els.pickFile.addEventListener("click", function () {
    els.file.click();
  });

  els.file.addEventListener("change", function () {
    var f = els.file.files && els.file.files[0];
    if (!f) {
      state.fileBuffer = null;
      state.fileName = "";
      els.fileName.textContent = "尚未選擇檔案";
      updateRunEnabled();
      return;
    }
    if (!/\.docx$/i.test(f.name)) {
      setStatus("請選擇 .docx 檔案", true);
      els.file.value = "";
      return;
    }
    els.fileName.textContent = f.name + "（" + Math.round(f.size / 1024) + " KB）";
    setStatus("讀取檔案中…");
    var reader = new FileReader();
    reader.onload = function () {
      state.fileBuffer = reader.result;
      state.fileName = f.name;
      setStatus("檔案已就緒，可按「開始檢查」");
      updateRunEnabled();
    };
    reader.onerror = function () {
      setStatus("讀取檔案失敗", true);
      state.fileBuffer = null;
      updateRunEnabled();
    };
    reader.readAsArrayBuffer(f);
  });

  els.runBtn.addEventListener("click", runCheck);
  els.clearBtn.addEventListener("click", clearReport);

  els.filters.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".chip");
    if (!btn) return;
    var chips = els.filters.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove("active");
    btn.classList.add("active");
    state.filter = btn.getAttribute("data-filter") || "all";
    if (state.lastReport) renderReport(state.lastReport);
  });

  // init
  setStatus("載入規則中…");
  loadSpec()
    .then(function (spec) {
      state.spec = spec;
      fillProfiles();
      setStatus(
        "規則已載入（共 " +
          ((spec.rules && spec.rules.length) || 0) +
          " 條）。請選擇檔案。"
      );
      updateRunEnabled();
    })
    .catch(function (e) {
      console.error(e);
      setStatus(
        "無法載入規則檔，請確認以本機伺服器開啟（例如在專案根目錄執行 python3 -m http.server），且 ref/ 資料夾存在。",
        true
      );
    });
})();
