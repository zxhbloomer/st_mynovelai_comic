// Pure protocol copied from 文生图工具v1/src/original-manga.js. Keep its complete grammar.
  function nonEmpty(s) {
    return !!(s && String(s).trim());
  }

  /* 兼容历史竖线分段提示词；不删除正文中的格式声明。 */
  function splitMultiBubbleSegment(seg) {
    return [String(seg || "")];
  }

    function splitPromptSegments(body) {
    var text = String(body || "").trim();
    var parts = [], current = "", escaped = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (escaped) { current += ch; escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === "|") { parts.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    parts.push(current.trim());
    var rawParts = parts.filter(nonEmpty);
    if (rawParts.length <= 1) return rawParts;
    var finalParts = [rawParts[0]];
    for (var j = 1; j < rawParts.length; j++) {
      var subs = splitMultiBubbleSegment(rawParts[j]);
      for (var k = 0; k < subs.length; k++) {
        finalParts.push(subs[k]);
      }
    }
    return finalParts;
  }

  function cleanPromptText(text) {
    return String(text || "").replace(/^[ \t]*(?:Panel\s+\d+|角色|说话人)[ \t]*[:：][ \t]*/gim, "").trim();
  }

  function cleanDialogue(s) {
    var lines = String(s || "").split("\n").map(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return "";
      trimmed = trimmed.replace(/^[ \t]*(?:Panel\s+\d+|[^\n:：]+?(?:（[^）]*）|\([^)]*\))?)[ \t]*[:：][ \t]*/, "");
      trimmed = trimmed.replace(/^[“"「『]([\s\S]*)[”"」』]$/, "$1");
      return trimmed.trim();
    });
    return lines.filter(Boolean).join("\n\n");
  }


  /* 纯机械提取角色母表及本轮外观变化（支持按生效页码平滑换装） */
  function extractCharacterDictionary(rawText, pageNo) {
    var plan = String(rawText || "").match(/<comic_plan>([\s\S]*?)<\/comic_plan>/i);
    if (!plan) return null;
    var lines = plan[1].split(/\r?\n/), dict = {}, rootIndent = -1, cid = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], heading = /^([ \t]*)-?[ \t]*角色母表[ \t]*[:：][ \t]*$/.exec(line);
      if (rootIndent < 0) { if (heading) rootIndent = heading[1].length; continue; }
      if (!line.trim()) continue;
      var indent = /^[ \t]*/.exec(line)[0].length;
      if (indent <= rootIndent) break;
      var entry = /^[ \t]*-[ \t]*(C\d+)[ \t]*[:：][ \t]*$/i.exec(line);
      if (entry) { cid = entry[1].toUpperCase(); dict[cid] = { identity: "", outfit: "" }; continue; }
      if (!cid) continue;
      var identity = /^[ \t]*-[ \t]*固定身份词[ \t]*[:：][ \t]*([^\r\n]*)$/.exec(line);
      var outfit = /^[ \t]*-[ \t]*初始服装词(?:[（(][^）)]*[）)])?[ \t]*[:：][ \t]*([^\r\n]*)$/.exec(line);
      if (identity) dict[cid].identity = identity[1].trim();
      if (outfit) dict[cid].outfit = outfit[1].trim();
    }
    return rootIndent < 0 ? null : dict;
  }

  /* 纯机械变量替换：1 对 1 字符串文本查表替换，零额外清洗 */
  function applyCharacterVariables(promptText, dict) {
    if (!dict || !Object.keys(dict).length) return promptText;
    var text = String(promptText || ""), result = "", start = 0, escaped = false;
    function expandSegment(segment) {
      var marker = /\bText[ \t]*[:：]/i.exec(segment);
      var split = marker ? marker.index : segment.length;
      var visual = segment.slice(0, split).replace(/(^|[^A-Za-z0-9_@])(@([Cc]\d+)(?:_([A-Za-z0-9_]+))?)(?![A-Za-z0-9_])/g, function (match, prefix, token, cid, suffix) {
        var entry = dict[cid.toUpperCase()];
        if (!entry) return match;
        var kind = String(suffix || "").toLowerCase();
        if (kind === "" || kind === "id" || kind === "identity") return prefix + (entry.identity || token);
        if (kind === "outfit" || kind === "costume") return prefix + (entry.outfit || token);
        return match;
      });
      return visual + segment.slice(split);
    }
    for (var i = 0; i < text.length; i++) {
      if (escaped) { escaped = false; continue; }
      if (text[i] === "\\") { escaped = true; continue; }
      if (text[i] === "|") { result += expandSegment(text.slice(start, i)) + "|"; start = i + 1; }
    }
    return result + expandSegment(text.slice(start));
  }

  function parseSegment(segment, index) {
    var body = String(segment || "").trim();
    var typeMatch = /^[ \t]*@text[ \t]*:[ \t]*([^\r\n]*)$/im.exec(body);
    var textType = typeMatch ? typeMatch[1].trim().toLowerCase() : (index === 0 ? "caption" : "dialogue");
    body = body.replace(/^[ \t]*@text[ \t]*:[ \t]*[^\r\n]*$/gim, "").trim();

    var text = "";
    // 仅在属于旧版末尾独占行 Text:（且非段内已有 Text: / 非引号内文本）时兼容分离，其余均原样保留在 prompt 中
    var legacyMatch = /(?:^|\n)[ \t]*Text[ \t]*[:：][ \t]*([^\r\n]+)$/i.exec(body);
    if (legacyMatch && !/with\s+Text\s*[:：]/i.test(body) && !/Text\s*[:：]\s*["“]/i.test(body)) {
      text = legacyMatch[1].trim();
      body = body.slice(0, legacyMatch.index).trim();
    }
    return { prompt: cleanPromptText(body), text: text, textType: textType };
  }

  function clampCenter(center) {
    var x = Number(center && center.x), y = Number(center && center.y);
    return { x: Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5, y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.5 };
  }

  function parseV83ImageProtocol(body) {
    var data;
    try { data = typeof body === "string" ? JSON.parse(body) : body; } catch (e) { return null; }
    if (!data || data.format !== "nai5-comic" || !data.page || typeof data.page !== "object") return null;
    var panels = Array.isArray(data.panels) ? data.panels : [];
    var hasTopCharacters = Object.prototype.hasOwnProperty.call(data, "characters");
    var hasNestedCharacters = panels.some(function (panel) { return panel && Object.prototype.hasOwnProperty.call(panel, "characters"); });
    if (hasTopCharacters && hasNestedCharacters) return { ok: false, reason: "不可混用顶层与画格内人物槽位" };
    if (hasNestedCharacters) {
      if (!panels.length || data.position_mode && data.position_mode !== "auto" && data.position_mode !== "manual") return { ok: false, reason: "无效的画格或定位模式" };
      var seenPanels = {}, characters = [], pieces = [];
      function splitCaption(value) {
        var text = String(value || "").trim(), marker = /\bText[ \t]*[:：]/i.exec(text);
        return marker ? { visual: text.slice(0, marker.index).trim(), text: text.slice(marker.index + marker[0].length).trim() } : { visual: text, text: "" };
      }
      pieces.push(splitCaption(data.page.base));
      pieces.push(splitCaption(data.page.non_character));
      for (var i = 0; i < panels.length; i++) {
        var panel = panels[i], pid = panel && String(panel.id || "").trim();
        if (!pid || seenPanels[pid] || !Array.isArray(panel.characters)) return { ok: false, reason: "第 " + (i + 1) + " 格缺少唯一编号或 characters 数组" };
        seenPanels[pid] = true;
        pieces.push(splitCaption(panel.description));
        pieces.push(splitCaption(panel.non_character));
        var seenCharacters = {};
        for (var j = 0; j < panel.characters.length; j++) {
          var entry = panel.characters[j];
          var cid = entry && String(entry.character_id || "").trim();
          var positive = entry && typeof entry.positive === "string" ? entry.positive.trim() : "";
          if (!cid || seenCharacters[cid] || !positive || typeof entry.negative !== "string") return { ok: false, reason: pid + " 的第 " + (j + 1) + " 个人物槽位不完整或重复" };
          seenCharacters[cid] = true;
          if (data.position_mode === "manual" && (!entry.center || !Number.isFinite(entry.center.x) || !Number.isFinite(entry.center.y) || entry.center.x < 0 || entry.center.x > 1 || entry.center.y < 0 || entry.center.y > 1)) return { ok: false, reason: pid + " / " + cid + " 缺少有效中心点" };
          characters.push({ id: pid + "-" + cid + "-" + (j + 1), characterId: cid, panel: pid, positive: positive, negative: entry.negative.trim(), center: clampCenter(entry.center) });
        }
      }
      var visual = pieces.map(function (piece) { return piece.visual.replace(/[,，]\s*$/, ""); }).filter(nonEmpty).join(", ");
      var texts = pieces.map(function (piece) { return piece.text; }).filter(nonEmpty);
      var basePrompt = visual + (texts.length ? "\nText: " + texts.join("\n\n") : "");
      if (!visual) return { ok: false, reason: "图片协议缺少 page.base 或画格描述" };
      return { ok: true, structured: true, nested: true, raw: data, positionMode: data.position_mode === "manual" ? "manual" : "auto", base: { prompt: basePrompt, text: "", textType: "caption" }, characters: characters, panels: visual, text: basePrompt };
    }
    // Keep the historical flat JSON protocol unchanged for saved pages.
    if (!Array.isArray(data.characters)) return { ok: false, reason: "图片协议缺少画格内或顶层 characters 数组" };
    var panelBits = panels.map(function (panel) { return String(panel && (panel.description || panel.content) || "").trim(); }).filter(nonEmpty);
    var nonCharacter = String(data.page.non_character || "").trim();
    var flatBase = [String(data.page.base || data.page.description || "").trim()].concat(panelBits).concat(nonCharacter ? [nonCharacter] : []).filter(nonEmpty).join(", ");
    if (!flatBase) return { ok: false, reason: "图片协议缺少 page.base 或画格描述" };
    var flatCharacters = (Array.isArray(data.characters) ? data.characters : []).map(function (entry, index) {
      if (!entry || typeof entry !== "object") return null;
      var positive = String(entry.positive || "").trim();
      if (!positive) return null;
      return { id: String(entry.id || "slot-" + (index + 1)), characterId: String(entry.character_id || entry.characterId || ""), panel: String(entry.panel || "未标注画格"), positive: positive, negative: String(entry.negative || "").trim(), center: clampCenter(entry.center) };
    }).filter(function (entry) { return !!entry; });
    return { ok: true, structured: true, nested: false, raw: data, positionMode: data.position_mode === "manual" ? "manual" : "auto", base: { prompt: flatBase, text: "", textType: "caption" }, characters: flatCharacters, panels: flatBase, text: flatBase };
  }

  // v1.2 文本协议只负责分段；按格校验与请求装配复用原有结构。
  function isSectionImageProtocol(body) {
    return /^\s*@(?:page\b|position\b)/i.test(String(body || ""));
  }

  function readSectionImageData(body) {
    var data = { format: "nai5-comic", page: { base: "" }, panels: [] };
    var panel = null, character = null, target = null, buffer = [], hasPage = false;
    function flush() {
      if (target) target.object[target.key] = buffer.join("\n").trim();
      buffer = [];
    }
    function begin(object, key) { target = { object: object, key: key }; }
    var lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], marker = /^\s*@(page|panel|character|negative|non_character|position|center)\b(?:[ \t]+(.*?))?[ \t]*$/i.exec(line);
      if (!marker) {
        if (target) buffer.push(line);
        else if (line.trim()) return { ok: false, reason: "第 " + (i + 1) + " 行正文没有所属段落" };
        continue;
      }
      flush();
      target = null;
      var kind = marker[1].toLowerCase(), value = String(marker[2] || "").trim();
      if (kind === "position") {
        if (hasPage || value !== "manual" && value !== "auto") return { ok: false, reason: "@position 须在 @page 前指定 manual 或 auto" };
        if (value === "manual") data.position_mode = "manual";
        else delete data.position_mode;
      } else if (kind === "page") {
        if (hasPage || value) return { ok: false, reason: "每个图片块只允许一个独占行 @page" };
        hasPage = true;
        begin(data.page, "base");
      } else if (kind === "panel") {
        if (!hasPage || !value || /\s/.test(value)) return { ok: false, reason: "@panel 须在页面之后填写一个画格编号" };
        panel = { id: value, description: "", characters: [] };
        data.panels.push(panel);
        character = null;
        begin(panel, "description");
      } else if (kind === "character") {
        if (!panel || !value || /\s/.test(value)) return { ok: false, reason: "@character 须在画格内填写一个人物编号" };
        character = { character_id: value, positive: "", negative: "" };
        panel.characters.push(character);
        begin(character, "positive");
      } else if (kind === "negative") {
        if (!character || value) return { ok: false, reason: "@negative 须独占一行并归属当前人物" };
        begin(character, "negative");
      } else if (kind === "non_character") {
        if (!hasPage || value) return { ok: false, reason: "@non_character 须独占一行并归属页面或画格" };
        character = null;
        begin(panel || data.page, "non_character");
      } else if (kind === "center") {
        var pair = value.split(/[,，]/);
        if (!character || data.position_mode !== "manual" || pair.length !== 2 || pair.some(function (n) { return !n.trim() || !Number.isFinite(Number(n)) || Number(n) < 0 || Number(n) > 1; })) {
          return { ok: false, reason: "@center 须为手动定位人物填写 0 至 1 的 x,y" };
        }
        character.center = { x: Number(pair[0]), y: Number(pair[1]) };
      }
    }
    flush();
    if (!hasPage || !data.panels.length) return { ok: false, reason: "图片协议缺少 @page 或 @panel" };
    return { ok: true, data: data };
  }

  function parseSectionImageProtocol(body) {
    var draft = readSectionImageData(body);
    if (!draft.ok) return draft;
    var parsed = parseV83ImageProtocol(draft.data);
    if (parsed && parsed.ok) parsed.wireFormat = "sections";
    return parsed;
  }

  function serializeSectionImageProtocol(data) {
    var chunks = [];
    function add(marker, value) {
      var text = String(value == null ? "" : value).trim();
      chunks.push(marker + (text ? "\n" + text : ""));
    }
    if (data.position_mode === "manual") chunks.push("@position manual");
    add("@page", data.page.base);
    if (nonEmpty(data.page.non_character)) add("@non_character", data.page.non_character);
    data.panels.forEach(function (panel) {
      add("@panel " + panel.id, panel.description);
      if (nonEmpty(panel.non_character)) add("@non_character", panel.non_character);
      panel.characters.forEach(function (character) {
        add("@character " + character.character_id, character.positive);
        if (nonEmpty(character.negative)) add("@negative", character.negative);
        if (data.position_mode === "manual" && character.center) chunks.push("@center " + character.center.x + "," + character.center.y);
      });
    });
    return chunks.join("\n\n");
  }

  function parseImageBlock(raw) {
    var body = String(raw || "").trim();
    if (!body) return { ok: false, reason: "图片块内容为空" };
    if (isSectionImageProtocol(body)) return parseSectionImageProtocol(body);
    var structured = parseV83ImageProtocol(body);
    if (structured) return structured;
    if (/^\s*\{/.test(body) && /"(?:format|position_mode|page|panels|characters)"\s*:/.test(body)) {
      return { ok: false, reason: "结构化图片提示词 JSON 无效或 format 不正确" };
    }
    var segments = splitPromptSegments(body).map(parseSegment);
    segments = segments.filter(function (x) { return nonEmpty(x.prompt) || nonEmpty(x.text); });
    if (!segments.length || !segments[0].prompt) return { ok: false, reason: "缺少页面级提示词" };
    return {
      ok: true,
      structured: false,
      base: segments[0],
      characters: segments.slice(1),
      panels: segments[0].prompt,
      text: segments.map(function (x) { return x.text || x.prompt; }).filter(nonEmpty).join("\n")
    };
  }

  function countPanels(panels) {
    var m = String(panels || "").match(/\b(?:one|two|three|four|five)[ -]panel|\b\d+[ -]panel/ig);
    return m ? m.length : 0;
  }


  /* 三个取值口。库里没有对应条目时返回空串，出图照常进行 */
  function parseRerollResponse(responseText, mode) {
    var text = String(responseText || "").trim();
    if (!text) return { ok: false, error: "AI 返回内容为空" };
    var expected = mode === "new" ? "comic_plan" : "thinking";
    var thinking = text.match(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi) || [];
    var comic = text.match(/<comic_plan\b[^>]*>[\s\S]*?<\/comic_plan>/gi) || [];
    var images = text.match(/<image\b[^>]*>[\s\S]*?<\/image>/gi) || [];
    var tag = mode === "legacy" && !thinking.length && comic.length === 1 ? "comic_plan" : expected;
    if (images.length !== 1 || thinking.length + comic.length !== 1 || (tag === "thinking" ? thinking.length !== 1 : comic.length !== 1)) {
      return { ok: false, error: "单页输出必须恰好包含一组页面规划与一组 <image>，不能混入整轮规划或其他页" };
    }
    var plans = tag === "thinking" ? thinking : comic;
    var plan = plans[0].replace(new RegExp("^<" + tag + "\\b[^>]*>|<\\/" + tag + ">$", "gi"), "").trim();
    var pageHeadings = plan.match(/\[Page\s+\d+\s*\]/gi) || [];
    if (/(?:^|\n)\s*-\s*(?:角色母表|角色DNA|戏剧节拍|本轮外观变化|规划总页数|逐页剧情分配契约)\s*[:：]/m.test(plan) || pageHeadings.length > 1) {
      return { ok: false, error: "返回的页面规划含有整轮规划或多个页面，已停止回填" };
    }
    var image = images[0].replace(/^<image\b[^>]*>|<\/image>$/gi, "").trim();
    var parsed = parseImageBlock(image);
    if (!parsed.ok || !parsed.structured || !parsed.nested) return { ok: false, error: parsed.reason || "重roll结果不是有效的按格嵌套人物协议" };
    if (parsed.wireFormat !== "sections") image = serializeSectionImageProtocol(parsed.raw);
    return { ok: true, thinking: plan, planning: plan, image: image };
  }


export { parseImageBlock, readSectionImageData, serializeSectionImageProtocol, parseRerollResponse };
