// Reference paragraph and plan validation from 文生图工具v1/src/generation.js.
export function createMangaGeneration() {
    function cleanText(text) {
        return text.replace(/<!--manga-page:[\w:-]+-->[\s\S]*?<!--\/manga-page-->/g, '')
            .replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, '')
            .replace(/<(?:comic_plan|thinking|char_list)\b[^>]*>[\s\S]*?<\/(?:comic_plan|thinking|char_list)>/gi, '')
            .replace(/<div\b[^>]*\b(?:custom-)?n5c-page\b[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<!--manga-task:[\s\S]*?-->/g, '')
            .replace(/<img\b[^>]*>/gi, '').trim();
    }
    function paragraphs(text) {
        const result = [];
        let start = 0, fenced = false, offset = 0;
        for (const line of text.match(/[^\n]*(?:\n|$)/g) || []) {
            if (!line) continue;
            if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
            if (!fenced && !line.trim()) {
                if (text.slice(start, offset).trim()) result.push({ start, end: offset, content: text.slice(start, offset).trim() });
                start = offset + line.length;
            }
            offset += line.length;
        }
        if (text.slice(start).trim()) result.push({ start, end: text.length, content: text.slice(start).trim() });
        return result.map((value, index) => ({ ...value, id: index + 1 }));
    }
    function snapshotTarget(messages, targetId, historyCount) {
        if (!Number.isSafeInteger(historyCount) || historyCount < 0) throw new Error('历史层数必须为非负整数');
        const index = messages.findIndex(message => message.id === targetId);
        const target = messages[index];
        if (!target || target.role !== 'assistant' || target.hidden) throw new Error('请选择可见的 AI 楼层');
        const body = cleanText(target.text);
        if (!body) throw new Error('目标正文为空');
        const previous = messages.slice(0, index).filter(message => !message.hidden && ['user', 'assistant'].includes(message.role));
        const history = (historyCount ? previous.slice(-historyCount) : []).map(message => ({ role: message.role, content: cleanText(message.text) }));
        return {
            targetId, originalText: target.text, swipeId: target.swipeId ?? 0, body, history,
            paragraphs: paragraphs(body),
            inlineSafe: body === target.text.trim() && !/<\/?[a-z][^>]*>/i.test(body),
        };
    }
    function validateComicPlan(text, contract) {
        if (typeof text !== 'string') throw new Error('LLM 未返回文本');
        const hadPlanning = /<(?:thinking|think|comic_plan)\b/i.test(text);
        let source = text.trim().replace(/<(thinking|think|comic_plan)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
        if (/<\/?(?:thinking|think|comic_plan)\b/i.test(source)) throw new Error('LLM 返回的规划标签未闭合，未开始绘图');
        const pages = [];
        let cursor = 0;
        for (const match of source.matchAll(/<image>([\s\S]*?)<\/image>/gi)) {
            const between = source.slice(cursor, match.index);
            let afterParagraph = null;
            if (contract.placement === 'inline') {
                const position = between.match(/<manga_position>\s*(\d+)\s*<\/manga_position>\s*$/i);
                if (!position || (between.match(/<\/?manga_position\b/gi) || []).length !== 2) throw new Error('漫画插入位置缺失或无效，每页 image 前必须有 manga_position');
                afterParagraph = Number(position[1]);
            } else if (/<\/?manga_position\b/i.test(between)) throw new Error('文章最后不应包含漫画插入位置');
            pages.push({ page: pages.length + 1, afterParagraph, image: '<image>' + match[1] + '</image>' });
            cursor = match.index + match[0].length;
        }
        if (/<\/?image\b/i.test(source.replace(/<image>[\s\S]*?<\/image>/gi, ''))) throw new Error('LLM 返回的 image 标签不完整，未开始绘图');
        if (/<\/?manga_position\b/i.test(source.slice(cursor))) throw new Error('漫画插入位置没有对应图片');
        if (!pages.length) throw new Error(hadPlanning ? 'LLM 只返回了规划，未返回完整 image 图片描述' : 'LLM 未返回完整 image 图片描述，可能返回了拒绝说明或普通正文');
        const plan = { version: 1, pages };
        if (!plan || plan.version !== 1 || !Array.isArray(plan.pages) || !plan.pages.length) throw new Error('漫画协议版本或页数无效');
        if (contract.expectedPages != null && plan.pages.length !== contract.expectedPages) throw new Error('返回页数与现有漫画规则不符');
        let lastPosition = 0;
        plan.pages.forEach((page, index) => {
            if (!page || page.page !== index + 1) throw new Error('漫画页码必须从 1 连续排列');
            const image = typeof page.image === 'string' ? page.image.trim() : '';
            if (!/^<image>[\s\S]*<\/image>$/.test(image) || !image.slice(7, -8).trim()
                || /<\/?[a-z][^>]*>|<!--/i.test(image.slice(7, -8))) throw new Error('漫画描述必须是完整且非空的 image 块，内部不能包含 HTML');
            if (contract.placement === 'inline') {
                if (!Number.isSafeInteger(page.afterParagraph) || page.afterParagraph < 1 || page.afterParagraph > contract.paragraphCount || page.afterParagraph < lastPosition) throw new Error('漫画插入位置无效');
                lastPosition = page.afterParagraph;
            } else if (page.afterParagraph !== null) throw new Error('文章最后的插入位置必须为 null');
        });
        return plan;
    }
    function placePlan(snapshot, plan, taskId, placement) {
        if (!/^[\w-]+$/.test(taskId)) throw new Error('任务标识无效');
        const grouped = new Map();
        for (const page of plan.pages) {
            const offset = placement === 'inline' ? snapshot.paragraphs[page.afterParagraph - 1].end : snapshot.originalText.length;
            const block = '<!--manga-page:' + taskId + ':' + page.page + '-->\n' + page.image.trim() + '\n<!--/manga-page-->';
            grouped.set(offset, (grouped.get(offset) || '') + block);
        }
        let result = snapshot.originalText;
        const trimOffset = snapshot.originalText.indexOf(snapshot.body);
        if (placement === 'inline' && (!snapshot.inlineSafe || trimOffset < 0)) throw new Error('正文无法安全按段落定位，请选择文章最后');
        for (const [offset, content] of Array.from(grouped).sort((a, b) => b[0] - a[0])) {
            const position = offset + (placement === 'inline' ? trimOffset : 0);
            result = result.slice(0, position) + content + result.slice(position);
        }
        return result;
    }
    function removeGeneratedImages(text) {
        let count = 0, descriptions = 0, markers = 0;
        function strip(source) {
            source = source.replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, () => { descriptions++; return ''; });
            const starts = /<div\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
            let match, result = '', cursor = 0;
            while ((match = starts.exec(source))) {
                const attributes = Array.from(match[0].slice(4, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g));
                const classes = attributes.find(attribute => attribute[1].toLowerCase() === 'class');
                if (!classes || !(classes[2] ?? classes[3] ?? classes[4] ?? '').split(/\s+/).some(name => name === 'n5c-page' || name === 'custom-n5c-page')) continue;
                const tags = /<\/?div\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi; tags.lastIndex = starts.lastIndex;
                let depth = 1, tag;
                while (depth && (tag = tags.exec(source))) depth += /^<\//.test(tag[0]) ? -1 : 1;
                // Incomplete HTML is not safe to delete: do not consume the remaining prose.
                if (depth) continue;
                result += source.slice(cursor, match.index); cursor = tags.lastIndex; starts.lastIndex = cursor; count++;
            }
            return result + source.slice(cursor);
        }
        function clean(source) {
            return strip(source.replace(/<!--manga-page:[\w:-]+-->([\s\S]*?)<!--\/manga-page-->/g, (match, body) => {
                markers += 2;
                const cleaned = strip(body);
                return cleaned.trim() ? cleaned : '';
            })).replace(/<!--(?:manga-page:[\w:-]+|\/manga-page|manga-task:[\w:-]+)-->/g, () => { markers++; return ''; });
        }
        let result = '', start = 0, fence = null;
        for (const line of text.matchAll(/[^\n]*(?:\n|$)/g)) {
            const marker = line[0].match(/^ {0,3}(`{3,}|~{3,})(.*)/);
            if (!marker) continue;
            if (!fence) {
                result += clean(text.slice(start, line.index)); start = line.index;
                fence = { symbol: marker[1][0], length: marker[1].length };
            } else if (marker[1][0] === fence.symbol && marker[1].length >= fence.length && !marker[2].trim()) {
                const end = line.index + line[0].length;
                result += text.slice(start, end); start = end; fence = null;
            }
        }
        result += fence ? text.slice(start) : clean(text.slice(start));
        return { text: result, count, descriptions, markers };
    }
    return { cleanText, paragraphs, snapshotTarget, validateComicPlan, placePlan, removeGeneratedImages };
}
