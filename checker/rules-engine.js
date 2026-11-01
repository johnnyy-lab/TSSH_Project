/**
 * rules-engine.js — 瀏覽器／Node 共用規則引擎
 * 依 submission_profiles 篩選規則，對已實作的規則自動檢查，其餘標成 not_checked
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TsshRulesEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** 網站版本。0.1 為通過本機測試的最小 MVP。 */
  var APP_VERSION = "0.1";

  /** 0.1 版已實作的規則編號 */
  var IMPLEMENTED_IDS = {
    R000: true,
    R001: true,
    R002: true,
    R003: true,
    R004: true,
    R005: true,
    R008: true,
    R009: true,
    R010: true,
    R011: true,
    R013: true,
    R015: true,
  };

  var EXPECT = {
    pageWcm: 21.0,
    pageHcm: 29.7,
    marginTopCm: 2.54,
    marginBottomCm: 2.54,
    marginLeftCm: 3.17,
    marginRightCm: 3.17,
    gutterCm: 0,
    // 容差（cm）：docx 常見四捨五入
    marginTolCm: 0.05,
    pageTolCm: 0.1,
    bodyEastAsia: "標楷體",
    bodyAscii: "Times New Roman",
    bodySzPt: 12,
    bodyLineMultiple: 1.5,
    lineTol: 0.05,
    szTol: 0.1,
  };

  function approx(a, b, tol) {
    if (a == null || b == null) return false;
    return Math.abs(a - b) <= tol;
  }

  function fontMatch(actual, expected) {
    if (!actual) return false;
    var a = String(actual).replace(/\s+/g, "").toLowerCase();
    var e = String(expected).replace(/\s+/g, "").toLowerCase();
    return a === e || a.indexOf(e) >= 0 || e.indexOf(a) >= 0;
  }

  function result(id, rule, status, detail) {
    return {
      id: id,
      condition: rule ? rule.condition : "",
      section: rule ? rule.section : "",
      category: rule ? rule.category : "",
      auto_checkable: rule ? rule.auto_checkable : null,
      full_document_only: rule ? !!rule.full_document_only : false,
      status: status, // pass | fail | not_checked | skipped
      message: (detail && detail.message) || "",
      expected: detail && detail.expected != null ? detail.expected : null,
      actual: detail && detail.actual != null ? detail.actual : null,
      locations: (detail && detail.locations) || [],
    };
  }

  function bodyParagraphs(model) {
    return (model.paragraphs || []).filter(function (p) {
      return p.role === "body";
    });
  }

  function checkR000(model, rule) {
    var fails = [];
    var secs = model.sections || [];
    if (!secs.length) {
      return result("R000", rule, "fail", {
        message: "文件沒有節（sectPr）資訊",
        expected: "A4 21.0×29.7 cm、直式",
        actual: "無",
      });
    }
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      var okW = approx(s.page.widthCm, EXPECT.pageWcm, EXPECT.pageTolCm);
      var okH = approx(s.page.heightCm, EXPECT.pageHcm, EXPECT.pageTolCm);
      var okOrient = !s.page.orient || s.page.orient === "portrait";
      // landscape swaps w/h
      if (s.page.orient === "landscape") okOrient = false;
      if (!(okW && okH && okOrient)) {
        fails.push({
          preview: "第 " + (i + 1) + " 節",
          actual:
            (s.page.widthCm != null ? s.page.widthCm : "?") +
            "×" +
            (s.page.heightCm != null ? s.page.heightCm : "?") +
            " cm" +
            (s.page.orient === "landscape" ? "、橫式" : "、直式"),
        });
      }
    }
    if (fails.length) {
      return result("R000", rule, "fail", {
        message: "紙張尺寸或方向不符",
        expected: "A4 21.0×29.7 cm、直式",
        actual: fails[0].actual,
        locations: fails,
      });
    }
    return result("R000", rule, "pass", {
      message: "各節皆為 A4 直式",
      expected: "A4 21.0×29.7 cm、直式",
      actual:
        secs[0].page.widthCm + "×" + secs[0].page.heightCm + " cm、直式",
    });
  }

  function checkMargin(model, rule, id, side, expectedCm) {
    var fails = [];
    var secs = model.sections || [];
    if (!secs.length) {
      return result(id, rule, "fail", {
        message: "沒有節邊界資訊",
        expected: expectedCm + " cm",
        actual: "無",
      });
    }
    for (var i = 0; i < secs.length; i++) {
      var m = secs[i].margin;
      var actual = m[side + "Cm"];
      if (!approx(actual, expectedCm, EXPECT.marginTolCm)) {
        fails.push({
          preview: "第 " + (i + 1) + " 節",
          actual: actual != null ? actual + " cm" : "未設定",
        });
      }
    }
    if (fails.length) {
      return result(id, rule, "fail", {
        message: side + " 邊界不符",
        expected: expectedCm + " cm",
        actual: fails[0].actual,
        locations: fails,
      });
    }
    return result(id, rule, "pass", {
      message: "各節 " + side + " 邊界符合",
      expected: expectedCm + " cm",
      actual: secs[0].margin[side + "Cm"] + " cm",
    });
  }

  function checkR005(model, rule) {
    var fails = [];
    var secs = model.sections || [];
    for (var i = 0; i < secs.length; i++) {
      var g = secs[i].margin.gutterCm;
      if (!approx(g == null ? 0 : g, 0, EXPECT.marginTolCm)) {
        fails.push({
          preview: "第 " + (i + 1) + " 節",
          actual: g + " cm",
        });
      }
    }
    if (fails.length) {
      return result("R005", rule, "fail", {
        message: "裝訂邊 gutter 不為 0",
        expected: "0 cm",
        actual: fails[0].actual,
        locations: fails,
      });
    }
    return result("R005", rule, "pass", {
      message: "gutter = 0",
      expected: "0 cm",
      actual: "0 cm",
    });
  }

  function checkBodyFont(model, rule, id, field, expected) {
    var bodies = bodyParagraphs(model);
    if (!bodies.length) {
      return result(id, rule, "fail", {
        message: "找不到可判斷的正文段落",
        expected: expected,
        actual: "無正文段落",
      });
    }
    var fails = [];
    var passN = 0;
    for (var i = 0; i < bodies.length; i++) {
      var p = bodies[i];
      var actual = field === "eastAsia" ? p.eastAsia : p.ascii;
      // 也看 runs：中文 run 查 eastAsia，英文 run 查 ascii
      var ok = fontMatch(actual, expected);
      if (!ok && p.runs && p.runs.length) {
        // 只要有對應文字的 run 用對字型即可放寬：多數 run 符合
        var good = 0,
          total = 0;
        for (var r = 0; r < p.runs.length; r++) {
          var run = p.runs[r];
          if (!run.text) continue;
          if (field === "eastAsia") {
            // 含中日韓字元才強制
            if (/[\u4e00-\u9fff]/.test(run.text)) {
              total++;
              if (fontMatch(run.eastAsia, expected)) good++;
            }
          } else {
            if (/[A-Za-z0-9]/.test(run.text)) {
              total++;
              if (fontMatch(run.ascii, expected)) good++;
            }
          }
        }
        if (total > 0 && good === total) ok = true;
        if (total === 0 && fontMatch(actual, expected)) ok = true;
        // 若段落完全沒有該類字元，視為不適用此段
        if (total === 0) {
          passN++;
          continue;
        }
      }
      if (ok) passN++;
      else {
        fails.push({
          preview: p.preview || ("段落#" + p.index),
          actual: actual || "未設定／繼承不明",
        });
      }
    }
    if (fails.length) {
      var show = fails.slice(0, 8);
      return result(id, rule, "fail", {
        message:
          "有 " +
          fails.length +
          " 段正文" +
          (field === "eastAsia" ? "中文" : "英文／數字") +
          "字型不符（共 " +
          bodies.length +
          " 段正文）",
        expected: expected,
        actual: show[0].actual,
        locations: show,
      });
    }
    return result(id, rule, "pass", {
      message: "正文" + (field === "eastAsia" ? "中文" : "英文／數字") + "字型符合（" + passN + " 段）",
      expected: expected,
      actual: expected,
    });
  }

  function checkR010(model, rule) {
    var dd = model.docDefaults || {};
    var ea = dd.eastAsia;
    var raw = dd.eastAsiaRaw || "";
    // 若明確是新細明體 → 不合格（應覆寫為標楷體）
    if (fontMatch(ea, "新細明體") || /新細明體/.test(String(raw))) {
      return result("R010", rule, "fail", {
        message: "docDefaults eastAsia 為新細明體，須覆寫為標楷體",
        expected: "標楷體（或非新細明體）",
        actual: ea || raw,
      });
    }
    // theme 空字串常見於中文 Word，實際可能落到新細明體——標成提醒但不硬判 fail
    if (!ea && raw && String(raw).indexOf("theme:") === 0) {
      return result("R010", rule, "pass", {
        message:
          "docDefaults 使用 theme 字型（未明示新細明體）；正文實際字型另由 R008 檢查",
        expected: "勿使用新細明體作為 eastAsia 預設",
        actual: raw + "（解析後：" + (ea || "空／系統預設") + "）",
      });
    }
    return result("R010", rule, "pass", {
      message: "docDefaults eastAsia 不是新細明體",
      expected: "勿使用新細明體",
      actual: ea || raw || "未設定",
    });
  }

  function checkR011(model, rule) {
    var bodies = bodyParagraphs(model);
    if (!bodies.length) {
      return result("R011", rule, "fail", {
        message: "找不到可判斷的正文段落",
        expected: "12 級（pt）",
        actual: "無正文段落",
      });
    }
    var fails = [];
    for (var i = 0; i < bodies.length; i++) {
      var p = bodies[i];
      if (p.szPt == null) {
        fails.push({ preview: p.preview, actual: "未設定字級" });
        continue;
      }
      if (!approx(p.szPt, EXPECT.bodySzPt, EXPECT.szTol)) {
        fails.push({ preview: p.preview, actual: p.szPt + " pt" });
      }
    }
    if (fails.length) {
      return result("R011", rule, "fail", {
        message: "有 " + fails.length + " 段正文字級不符",
        expected: "12 pt",
        actual: fails[0].actual,
        locations: fails.slice(0, 8),
      });
    }
    return result("R011", rule, "pass", {
      message: "正文字級皆為 12 pt",
      expected: "12 pt",
      actual: "12 pt",
    });
  }

  function checkR013(model, rule) {
    var bodies = bodyParagraphs(model);
    if (!bodies.length) {
      return result("R013", rule, "fail", {
        message: "找不到可判斷的正文段落",
        expected: "1.5 倍行距",
        actual: "無正文段落",
      });
    }
    var fails = [];
    for (var i = 0; i < bodies.length; i++) {
      var p = bodies[i];
      if (p.lineMultiple == null) {
        // 沒設行距 → Word 預設單倍，視為不符
        fails.push({
          preview: p.preview,
          actual: p.lineExactPt != null ? "固定 " + p.lineExactPt + " pt" : "未設定（預設單倍）",
        });
        continue;
      }
      if (!approx(p.lineMultiple, EXPECT.bodyLineMultiple, EXPECT.lineTol)) {
        fails.push({
          preview: p.preview,
          actual: p.lineMultiple + " 倍",
        });
      }
    }
    if (fails.length) {
      return result("R013", rule, "fail", {
        message: "有 " + fails.length + " 段正文行距不符",
        expected: "1.5 倍",
        actual: fails[0].actual,
        locations: fails.slice(0, 8),
      });
    }
    return result("R013", rule, "pass", {
      message: "正文行距皆為 1.5 倍",
      expected: "1.5 倍",
      actual: "1.5 倍",
    });
  }

  function checkR015(model, rule) {
    var bodies = bodyParagraphs(model);
    if (!bodies.length) {
      return result("R015", rule, "fail", {
        message: "找不到可判斷的正文段落",
        expected: "左右對齊（both／justify）",
        actual: "無正文段落",
      });
    }
    var fails = [];
    for (var i = 0; i < bodies.length; i++) {
      var p = bodies[i];
      var jc = p.jc;
      // both = Word OOXML for justify; justify sometimes appears
      if (jc === "both" || jc === "justify") continue;
      fails.push({
        preview: p.preview,
        actual: jc == null ? "未設定（預設靠左）" : jc,
      });
    }
    if (fails.length) {
      return result("R015", rule, "fail", {
        message: "有 " + fails.length + " 段正文未左右對齊",
        expected: "both／justify",
        actual: fails[0].actual,
        locations: fails.slice(0, 8),
      });
    }
    return result("R015", rule, "pass", {
      message: "正文皆左右對齊",
      expected: "both／justify",
      actual: "both",
    });
  }

  var CHECKERS = {
    R000: checkR000,
    R001: function (m, r) {
      return checkMargin(m, r, "R001", "top", EXPECT.marginTopCm);
    },
    R002: function (m, r) {
      return checkMargin(m, r, "R002", "bottom", EXPECT.marginBottomCm);
    },
    R003: function (m, r) {
      return checkMargin(m, r, "R003", "left", EXPECT.marginLeftCm);
    },
    R004: function (m, r) {
      return checkMargin(m, r, "R004", "right", EXPECT.marginRightCm);
    },
    R005: checkR005,
    R008: function (m, r) {
      return checkBodyFont(m, r, "R008", "eastAsia", EXPECT.bodyEastAsia);
    },
    R009: function (m, r) {
      return checkBodyFont(m, r, "R009", "ascii", EXPECT.bodyAscii);
    },
    R010: checkR010,
    R011: checkR011,
    R013: checkR013,
    R015: checkR015,
  };

  function indexRules(spec) {
    var map = {};
    var rules = (spec && spec.rules) || [];
    for (var i = 0; i < rules.length; i++) {
      map[rules[i].id] = rules[i];
    }
    return map;
  }

  function resolveProfile(spec, profileKey) {
    var profiles = (spec && spec.submission_profiles) || {};
    var profile = profiles[profileKey];
    if (!profile) {
      throw new Error("未知的繳交範圍：" + profileKey);
    }
    return profile;
  }

  /**
   * @param {object} spec rules.json
   * @param {object} model parseDocx 結果
   * @param {string} profileKey submission_profiles 的 key
   */
  function runChecks(spec, model, profileKey) {
    var profile = resolveProfile(spec, profileKey);
    var byId = indexRules(spec);
    var ruleIds = profile.rule_ids || [];
    var results = [];
    var summary = { pass: 0, fail: 0, not_checked: 0, skipped: 0, total: 0 };

    for (var i = 0; i < ruleIds.length; i++) {
      var id = ruleIds[i];
      var rule = byId[id];
      if (!rule) {
        results.push(
          result(id, null, "not_checked", {
            message: "規則定義缺失",
          })
        );
        summary.not_checked++;
        summary.total++;
        continue;
      }
      if (CHECKERS[id]) {
        var r = CHECKERS[id](model, rule);
        results.push(r);
        summary[r.status] = (summary[r.status] || 0) + 1;
        summary.total++;
      } else {
        results.push(
          result(id, rule, "not_checked", {
            message: "尚未自動檢查（" + APP_VERSION + " 版未實作）",
          })
        );
        summary.not_checked++;
        summary.total++;
      }
    }

    return {
      profileKey: profileKey,
      profileLabel: profile.label || profileKey,
      summary: summary,
      results: results,
      implementedIds: Object.keys(IMPLEMENTED_IDS),
      meta: model.meta || {},
    };
  }

  function listProfiles(spec) {
    var profiles = (spec && spec.submission_profiles) || {};
    var order = [
      "chapter_1",
      "chapter_2",
      "chapter_3",
      "chapter_4",
      "references",
      "front_matter",
      "full_document",
    ];
    var out = [];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (profiles[k]) {
        out.push({
          key: k,
          label: profiles[k].label || k,
          ruleCount: (profiles[k].rule_ids || []).length,
        });
      }
    }
    // any extras
    for (var key in profiles) {
      if (order.indexOf(key) < 0) {
        out.push({
          key: key,
          label: profiles[key].label || key,
          ruleCount: (profiles[key].rule_ids || []).length,
        });
      }
    }
    return out;
  }

  return {
    VERSION: APP_VERSION,
    IMPLEMENTED_IDS: IMPLEMENTED_IDS,
    EXPECT: EXPECT,
    runChecks: runChecks,
    listProfiles: listProfiles,
    indexRules: indexRules,
  };
});
