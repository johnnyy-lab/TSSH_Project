/**
 * docx-parser.js — 瀏覽器／Node 共用：把 docx（ArrayBuffer／Buffer／Uint8Array）解成結構化模型
 * 依賴：JSZip（全域 JSZip 或 require/import）
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      typeof JSZip !== "undefined" ? JSZip : require("jszip"),
      typeof DOMParser !== "undefined"
        ? DOMParser
        : require("@xmldom/xmldom").DOMParser
    );
  } else {
    root.TsshDocxParser = factory(root.JSZip, root.DOMParser);
  }
})(typeof self !== "undefined" ? self : this, function (JSZip, DOMParserCtor) {
  "use strict";

  var W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  var A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
  // 1 cm = 1440/2.54 twips
  var TWIPS_PER_CM = 1440 / 2.54;

  function localName(node) {
    if (!node || !node.nodeName) return "";
    var n = node.nodeName;
    var i = n.indexOf(":");
    return i >= 0 ? n.slice(i + 1) : n;
  }

  function attr(el, name) {
    if (!el || !el.getAttribute) return null;
    // try with and without prefix
    var v = el.getAttribute("w:" + name);
    if (v != null && v !== "") return v;
    v = el.getAttribute(name);
    if (v != null && v !== "") return v;
    // namespaced (xmldom / some browsers)
    if (el.getAttributeNS) {
      v = el.getAttributeNS(W_NS, name);
      if (v != null && v !== "") return v;
    }
    return null;
  }

  function childrenByLocal(el, name) {
    var out = [];
    if (!el || !el.childNodes) return out;
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 1 && localName(c) === name) out.push(c);
    }
    return out;
  }

  function firstByLocal(el, name) {
    var list = childrenByLocal(el, name);
    return list.length ? list[0] : null;
  }

  function descendantsByLocal(root, name) {
    var out = [];
    function walk(n) {
      if (!n || !n.childNodes) return;
      for (var i = 0; i < n.childNodes.length; i++) {
        var c = n.childNodes[i];
        if (c.nodeType === 1) {
          if (localName(c) === name) out.push(c);
          walk(c);
        }
      }
    }
    walk(root);
    return out;
  }

  function textOf(el) {
    var parts = [];
    var ts = descendantsByLocal(el, "t");
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i].textContent || ts[i].text || "";
      parts.push(t);
    }
    return parts.join("");
  }

  function twipsToCm(tw) {
    if (tw == null || tw === "") return null;
    var n = parseInt(tw, 10);
    if (isNaN(n)) return null;
    return Math.round((n / TWIPS_PER_CM) * 100) / 100;
  }

  function halfPointsToPt(sz) {
    if (sz == null || sz === "") return null;
    var n = parseInt(sz, 10);
    if (isNaN(n)) return null;
    return n / 2;
  }

  function parseXml(xmlText) {
    var parser = new DOMParserCtor();
    return parser.parseFromString(xmlText, "application/xml");
  }

  function resolveThemeFonts(themeXml) {
    var result = {
      minorEastAsia: null,
      minorAscii: null,
      majorEastAsia: null,
      majorAscii: null,
    };
    if (!themeXml) return result;
    var doc = parseXml(themeXml);
    var fonts = descendantsByLocal(doc, "fontScheme");
    // also look for minorFont / majorFont
    var minors = descendantsByLocal(doc, "minorFont");
    var majors = descendantsByLocal(doc, "majorFont");
    function pick(fontEl) {
      var latin = null,
        ea = null;
      if (!fontEl) return { latin: null, ea: null };
      for (var i = 0; i < fontEl.childNodes.length; i++) {
        var c = fontEl.childNodes[i];
        if (c.nodeType !== 1) continue;
        var ln = localName(c);
        var tf =
          c.getAttribute &&
          (c.getAttribute("typeface") ||
            (c.getAttributeNS && c.getAttributeNS(null, "typeface")));
        if (ln === "latin") latin = tf || "";
        if (ln === "ea") ea = tf || "";
      }
      return { latin: latin, ea: ea };
    }
    if (minors.length) {
      var m = pick(minors[0]);
      result.minorAscii = m.latin || null;
      result.minorEastAsia = m.ea || null;
    }
    if (majors.length) {
      var M = pick(majors[0]);
      result.majorAscii = M.latin || null;
      result.majorEastAsia = M.ea || null;
    }
    return result;
  }

  function parseDocDefaults(stylesXml, themeFonts) {
    var out = {
      eastAsia: null,
      ascii: null,
      hAnsi: null,
      eastAsiaRaw: null,
      asciiRaw: null,
      szPt: null,
    };
    if (!stylesXml) return out;
    var doc = parseXml(stylesXml);
    var rPrDefaults = descendantsByLocal(doc, "rPrDefault");
    if (!rPrDefaults.length) return out;
    var rPr = firstByLocal(rPrDefaults[0], "rPr") || rPrDefaults[0];
    var rFonts = firstByLocal(rPr, "rFonts");
    if (rFonts) {
      var ea = attr(rFonts, "eastAsia");
      var eaTheme = attr(rFonts, "eastAsiaTheme");
      var ascii = attr(rFonts, "ascii");
      var asciiTheme = attr(rFonts, "asciiTheme");
      var hAnsi = attr(rFonts, "hAnsi");
      out.eastAsiaRaw = ea || (eaTheme ? "theme:" + eaTheme : null);
      out.asciiRaw = ascii || (asciiTheme ? "theme:" + asciiTheme : null);
      if (ea) out.eastAsia = ea;
      else if (eaTheme && themeFonts) {
        if (eaTheme.indexOf("minor") >= 0)
          out.eastAsia = themeFonts.minorEastAsia || null;
        else out.eastAsia = themeFonts.majorEastAsia || null;
      }
      if (ascii) out.ascii = ascii;
      else if (asciiTheme && themeFonts) {
        if (asciiTheme.indexOf("minor") >= 0)
          out.ascii = themeFonts.minorAscii || null;
        else out.ascii = themeFonts.majorAscii || null;
      }
      out.hAnsi = hAnsi || out.ascii;
    }
    var sz = firstByLocal(rPr, "sz");
    if (sz) out.szPt = halfPointsToPt(attr(sz, "val"));
    return out;
  }

  function parseStylesMap(stylesXml) {
    var map = {};
    if (!stylesXml) return map;
    var doc = parseXml(stylesXml);
    var styles = descendantsByLocal(doc, "style");
    for (var i = 0; i < styles.length; i++) {
      var s = styles[i];
      var id = attr(s, "styleId");
      if (!id) continue;
      var nameEl = firstByLocal(s, "name");
      var name = nameEl ? attr(nameEl, "val") : id;
      var type = attr(s, "type");
      var basedOnEl = firstByLocal(s, "basedOn");
      var basedOn = basedOnEl ? attr(basedOnEl, "val") : null;
      var pPr = firstByLocal(s, "pPr");
      var rPr = firstByLocal(s, "rPr");
      map[id] = {
        id: id,
        name: name,
        type: type,
        basedOn: basedOn,
        jc: null,
        spacing: null,
        eastAsia: null,
        ascii: null,
        szPt: null,
      };
      if (pPr) {
        var jc = firstByLocal(pPr, "jc");
        if (jc) map[id].jc = attr(jc, "val");
        var sp = firstByLocal(pPr, "spacing");
        if (sp) {
          map[id].spacing = {
            line: attr(sp, "line"),
            lineRule: attr(sp, "lineRule"),
            before: attr(sp, "before"),
            after: attr(sp, "after"),
          };
        }
      }
      if (rPr) {
        var rf = firstByLocal(rPr, "rFonts");
        if (rf) {
          map[id].eastAsia = attr(rf, "eastAsia");
          map[id].ascii = attr(rf, "ascii") || attr(rf, "hAnsi");
        }
        var sz = firstByLocal(rPr, "sz");
        if (sz) map[id].szPt = halfPointsToPt(attr(sz, "val"));
      }
    }
    return map;
  }

  function parseSections(documentXml) {
    var doc = parseXml(documentXml);
    var sectPrs = descendantsByLocal(doc, "sectPr");
    var sections = [];
    for (var i = 0; i < sectPrs.length; i++) {
      var s = sectPrs[i];
      var pgSz = firstByLocal(s, "pgSz");
      var pgMar = firstByLocal(s, "pgMar");
      var w = pgSz ? attr(pgSz, "w") : null;
      var h = pgSz ? attr(pgSz, "h") : null;
      var orient = pgSz ? attr(pgSz, "orient") : null;
      sections.push({
        index: i,
        page: {
          widthTwips: w ? parseInt(w, 10) : null,
          heightTwips: h ? parseInt(h, 10) : null,
          widthCm: twipsToCm(w),
          heightCm: twipsToCm(h),
          orient: orient || "portrait",
        },
        margin: {
          topTwips: pgMar ? parseInt(attr(pgMar, "top") || "0", 10) : null,
          bottomTwips: pgMar
            ? parseInt(attr(pgMar, "bottom") || "0", 10)
            : null,
          leftTwips: pgMar ? parseInt(attr(pgMar, "left") || "0", 10) : null,
          rightTwips: pgMar ? parseInt(attr(pgMar, "right") || "0", 10) : null,
          gutterTwips: pgMar
            ? parseInt(attr(pgMar, "gutter") || "0", 10)
            : 0,
          topCm: pgMar ? twipsToCm(attr(pgMar, "top")) : null,
          bottomCm: pgMar ? twipsToCm(attr(pgMar, "bottom")) : null,
          leftCm: pgMar ? twipsToCm(attr(pgMar, "left")) : null,
          rightCm: pgMar ? twipsToCm(attr(pgMar, "right")) : null,
          gutterCm: pgMar ? twipsToCm(attr(pgMar, "gutter") || "0") : 0,
        },
      });
    }
    return sections;
  }

  function parseLineSpacing(spacing) {
    if (!spacing || !spacing.line) return { multiple: null, exactPt: null, raw: null };
    var line = parseInt(spacing.line, 10);
    var rule = spacing.lineRule || "auto";
    if (isNaN(line)) return { multiple: null, exactPt: null, raw: spacing };
    if (rule === "auto" || rule === null) {
      // line is in 240ths of a line
      return { multiple: Math.round((line / 240) * 100) / 100, exactPt: null, raw: spacing };
    }
    // exact / atLeast: line in twips → points
    return { multiple: null, exactPt: Math.round((line / 20) * 100) / 100, raw: spacing };
  }

  function parseParagraphs(documentXml, stylesMap, docDefaults) {
    var doc = parseXml(documentXml);
    var bodies = descendantsByLocal(doc, "body");
    if (!bodies.length) return [];
    var body = bodies[0];
    var paras = [];
    var pNodes = [];
    for (var i = 0; i < body.childNodes.length; i++) {
      var c = body.childNodes[i];
      if (c.nodeType === 1 && localName(c) === "p") pNodes.push(c);
    }
    for (var pi = 0; pi < pNodes.length; pi++) {
      var p = pNodes[pi];
      var text = textOf(p).replace(/\s+/g, " ").trim();
      var pPr = firstByLocal(p, "pPr");
      var styleId = null;
      var jc = null;
      var spacing = null;
      var ind = null;
      if (pPr) {
        var ps = firstByLocal(pPr, "pStyle");
        if (ps) styleId = attr(ps, "val");
        var jcEl = firstByLocal(pPr, "jc");
        if (jcEl) jc = attr(jcEl, "val");
        var spEl = firstByLocal(pPr, "spacing");
        if (spEl) {
          spacing = {
            line: attr(spEl, "line"),
            lineRule: attr(spEl, "lineRule"),
            before: attr(spEl, "before"),
            after: attr(spEl, "after"),
          };
        }
        var indEl = firstByLocal(pPr, "ind");
        if (indEl) {
          ind = {
            firstLine: attr(indEl, "firstLine"),
            left: attr(indEl, "left"),
            right: attr(indEl, "right"),
            hanging: attr(indEl, "hanging"),
          };
        }
      }
      // inherit from style if missing
      var style = styleId && stylesMap[styleId] ? stylesMap[styleId] : null;
      if (jc == null && style && style.jc) jc = style.jc;
      if (spacing == null && style && style.spacing) spacing = style.spacing;

      var runs = [];
      var rNodes = childrenByLocal(p, "r");
      for (var ri = 0; ri < rNodes.length; ri++) {
        var r = rNodes[ri];
        var rText = textOf(r);
        if (!rText) continue;
        var rPr = firstByLocal(r, "rPr");
        var eastAsia = null,
          ascii = null,
          hAnsi = null,
          szPt = null,
          bold = false;
        if (rPr) {
          var rf = firstByLocal(rPr, "rFonts");
          if (rf) {
            eastAsia = attr(rf, "eastAsia");
            ascii = attr(rf, "ascii");
            hAnsi = attr(rf, "hAnsi");
          }
          var sz = firstByLocal(rPr, "sz");
          if (sz) szPt = halfPointsToPt(attr(sz, "val"));
          if (firstByLocal(rPr, "b")) bold = true;
        }
        if (eastAsia == null && style && style.eastAsia) eastAsia = style.eastAsia;
        if (ascii == null && style && style.ascii) ascii = style.ascii;
        if (szPt == null && style && style.szPt != null) szPt = style.szPt;
        if (eastAsia == null && docDefaults) eastAsia = docDefaults.eastAsia;
        if (ascii == null && docDefaults) ascii = docDefaults.ascii;
        if (szPt == null && docDefaults) szPt = docDefaults.szPt;
        runs.push({
          text: rText,
          eastAsia: eastAsia,
          ascii: ascii || hAnsi,
          szPt: szPt,
          bold: bold,
        });
      }

      // dominant run props for the paragraph
      var domEa = null,
        domAscii = null,
        domSz = null;
      var eaCount = {},
        asciiCount = {},
        szCount = {};
      for (var k = 0; k < runs.length; k++) {
        var run = runs[k];
        var w = run.text.length || 1;
        if (run.eastAsia) eaCount[run.eastAsia] = (eaCount[run.eastAsia] || 0) + w;
        if (run.ascii) asciiCount[run.ascii] = (asciiCount[run.ascii] || 0) + w;
        if (run.szPt != null) szCount[String(run.szPt)] = (szCount[String(run.szPt)] || 0) + w;
      }
      function topKey(obj) {
        var best = null,
          bestN = -1;
        for (var key in obj) {
          if (obj[key] > bestN) {
            bestN = obj[key];
            best = key;
          }
        }
        return best;
      }
      domEa = topKey(eaCount);
      domAscii = topKey(asciiCount);
      var topSz = topKey(szCount);
      domSz = topSz != null ? parseFloat(topSz) : null;

      var lineInfo = parseLineSpacing(spacing);

      paras.push({
        index: pi,
        text: text,
        preview: text.slice(0, 40),
        styleId: styleId,
        jc: jc, // null means inherit — Word default is left, but many zh templates use both via style
        spacing: spacing,
        lineMultiple: lineInfo.multiple,
        lineExactPt: lineInfo.exactPt,
        ind: ind,
        eastAsia: domEa,
        ascii: domAscii,
        szPt: domSz,
        runs: runs,
        isEmpty: !text,
      });
    }
    return paras;
  }

  /**
   * 粗略判斷是否為「正文段落」（非封面置中標題、非明顯圖表標題列）
   */
  function classifyParagraph(p) {
    if (p.isEmpty) return "empty";
    if (/^第[一二三四五六七八九十百零〇0-9]+章/.test(p.text)) return "chapter_title";
    if (/^\d+-\d+/.test(p.text)) return "section_title";
    // 第三層以下標題：一、／（一）／1.／（1）
    if (/^[一二三四五六七八九十]+、/.test(p.text)) return "heading_l3";
    if (/^（[一二三四五六七八九十]+）/.test(p.text)) return "heading_l4";
    if (/^\d+\./.test(p.text) && p.text.length < 80) return "heading_l5";
    if (/^（\d+）/.test(p.text) && p.text.length < 80) return "heading_l6";
    if (/^(表|圖)\s*\d/.test(p.text)) return "caption";
    if (/^[（(]\s*(資料|圖片?|圖表)?來源/.test(p.text)) return "source_note";
    if (/^關鍵字[：:]/.test(p.text)) return "other";
    if (p.jc === "center") return "centered";
    // 正文：夠長，且左右對齊／靠左／未設
    if (p.text.length >= 25 && (p.jc === "both" || p.jc === "justify" || p.jc === "distribute" || p.jc == null || p.jc === "left"))
      return "body";
    if (p.text.length >= 60) return "body";
    return "other";
  }

  async function parseDocx(input) {
    var zip = await JSZip.loadAsync(input);
    async function read(path) {
      var f = zip.file(path);
      if (!f) return null;
      return await f.async("string");
    }
    var documentXml = await read("word/document.xml");
    if (!documentXml) throw new Error("找不到 word/document.xml，不是有效的 docx");
    var stylesXml = await read("word/styles.xml");
    var themeXml = await read("word/theme/theme1.xml");
    var themeFonts = resolveThemeFonts(themeXml);
    var docDefaults = parseDocDefaults(stylesXml, themeFonts);
    var stylesMap = parseStylesMap(stylesXml);
    var sections = parseSections(documentXml);
    var paragraphs = parseParagraphs(documentXml, stylesMap, docDefaults);
    for (var i = 0; i < paragraphs.length; i++) {
      paragraphs[i].role = classifyParagraph(paragraphs[i]);
    }
    return {
      sections: sections,
      paragraphs: paragraphs,
      docDefaults: docDefaults,
      themeFonts: themeFonts,
      styles: stylesMap,
      meta: {
        paragraphCount: paragraphs.length,
        sectionCount: sections.length,
        bodyParagraphCount: paragraphs.filter(function (p) {
          return p.role === "body";
        }).length,
      },
    };
  }

  return {
    parseDocx: parseDocx,
    twipsToCm: twipsToCm,
    TWIPS_PER_CM: TWIPS_PER_CM,
    classifyParagraph: classifyParagraph,
  };
});
