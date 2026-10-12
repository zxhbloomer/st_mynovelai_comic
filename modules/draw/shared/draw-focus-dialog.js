let activeDialog = null;

export function withFocusImages(text, images = []) {
    if (!images.length) return text;
    return [{ type: 'text', text }, ...images.map(image => ({
        type: 'image_url', image_url: { url: image.url },
    }))];
}

export function openDrawFocusDialog({ messageId } = {}) {
    if (activeDialog) return Promise.resolve(null);
    return new Promise(resolve => {
        const previousFocus = document.activeElement;
        const dialog = document.createElement('dialog');
        activeDialog = dialog;
        dialog.className = 'nd-focus-dialog';
        dialog.innerHTML = `
            <style>
            .nd-focus-dialog {width:min(720px,calc(100vw - 32px));height:min(600px,calc(100dvh - 32px));max-width:none;max-height:none;box-sizing:border-box;padding:0;border:1px solid #52525a;border-radius:16px;background:#25252b;color:#f1f1f3;box-shadow:0 24px 80px #0008;font:14px/1.5 system-ui,sans-serif;}
            .nd-focus-dialog::backdrop {background:#0009;backdrop-filter:blur(4px);}
            .nd-focus-dialog * {box-sizing:border-box;}
            .nd-focus-shell {height:100%;display:flex;flex-direction:column;}
            .nd-focus-header {padding:22px 24px 16px;border-bottom:1px solid #ffffff12;display:flex;align-items:start;justify-content:space-between;gap:16px;}
            .nd-focus-header h2 {margin:0;font-size:20px;color:#fff;}
            .nd-focus-subtitle {margin:6px 0 0;color:#aaaab8;font-size:13px;}
            .nd-focus-body {padding:20px 24px;overflow:auto;flex:1;min-height:0;}
            .nd-focus-label {display:block;margin-bottom:9px;font-weight:600;}
            .nd-focus-dialog textarea {display:block;width:100%;min-height:200px;resize:vertical;padding:14px;border:1px solid #555560;border-radius:10px;background:#34343d;color:#fff;font:inherit;line-height:1.7;}
            .nd-focus-dialog textarea:focus {outline:2px solid #d4a574;outline-offset:2px;}
            .nd-focus-dialog textarea::placeholder {color:#9999a8;}
            .nd-focus-upload {margin-top:20px;border:1px dashed #666672;border-radius:10px;padding:16px;background:#2d2d35;}
            .nd-focus-upload p {margin:8px 0 0;color:#aaaab8;font-size:12px;}
            .nd-focus-dialog button {border:1px solid #666674;border-radius:8px;padding:9px 16px;background:#42424c;color:#fff;font:inherit;cursor:pointer;}
            .nd-focus-dialog button:hover {background:#50505c;}
            .nd-focus-dialog button:disabled {opacity:.5;cursor:wait;}
            .nd-focus-close {padding:3px 10px!important;font-size:22px!important;}
            .nd-focus-images {display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;}
            .nd-focus-image {width:130px;position:relative;margin:0;}
            .nd-focus-image img {width:130px;height:90px;object-fit:contain;border-radius:8px;background:#18181e;}
            .nd-focus-image figcaption {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#bbb;}
            .nd-focus-image button {position:absolute;right:4px;top:4px;padding:0 7px;background:#25252bee;}
            .nd-focus-error {color:#ffaaaa;margin-top:8px;}
            .nd-focus-footer {padding:16px 24px;border-top:1px solid #ffffff12;display:flex;justify-content:flex-end;gap:12px;}
            .nd-focus-dialog .nd-focus-submit {background:#d4a574;border-color:#d4a574;color:#201b16;font-weight:600;}
            @media(max-width:480px) {.nd-focus-body,.nd-focus-header,.nd-focus-footer {padding:16px;}.nd-focus-dialog textarea {min-height:180px;}}
            </style>
            <div class="nd-focus-shell">
              <header class="nd-focus-header"><div><h2 id="nd-focus-title">花漫画 · 本次生成要求</h2><p class="nd-focus-subtitle"></p></div><button type="button" class="nd-focus-close" aria-label="关闭">×</button></header>
              <div class="nd-focus-body">
                <label class="nd-focus-label" for="nd-focus-text">重点要求</label>
                <textarea id="nd-focus-text" placeholder="例如：重点表现人物表情，多用近景。可填写多行，也可以留空。"></textarea>
                <section class="nd-focus-upload" aria-label="参考图片附件">
                  <button type="button" class="nd-focus-add">添加参考图片</button><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>
                  <p>支持拖入或粘贴图片。图片将交给 LLM 作为视觉参考，需使用支持识图的模型；不会直接作为绘图模型的图生图输入。</p>
                  <div class="nd-focus-images"></div><div class="nd-focus-error" role="status"></div>
                </section>
              </div>
              <footer class="nd-focus-footer"><button type="button" class="nd-focus-cancel">取消</button><button type="button" class="nd-focus-submit">提交</button></footer>
            </div>`;
        dialog.setAttribute('aria-labelledby', 'nd-focus-title');
        dialog.querySelector('.nd-focus-subtitle').textContent = `目标楼层：${messageId} · 仅用于本次生成`;
        const textarea = dialog.querySelector('textarea');
        const submit = dialog.querySelector('.nd-focus-submit');
        const input = dialog.querySelector('input');
        const list = dialog.querySelector('.nd-focus-images');
        const error = dialog.querySelector('.nd-focus-error');
        const images = [];
        let reading = 0;
        function finish(value) {
            if (activeDialog !== dialog) return;
            activeDialog = null;
            dialog.close();
            dialog.remove();
            previousFocus?.focus?.();
            resolve(value);
        }
        async function addFiles(files) {
            reading++;
            submit.disabled = true;
            error.textContent = '';
            try {
                for (const file of files) {
                    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
                        error.textContent = '请选择 PNG、JPEG、WebP 或 GIF 图片。';
                        continue;
                    }
                    const url = await new Promise((yes, no) => {
                        const reader = new FileReader();
                        reader.onload = () => yes(reader.result);
                        reader.onerror = () => no(new Error('图片读取失败，请重新添加。'));
                        reader.readAsDataURL(file);
                    });
                    if (activeDialog !== dialog) return;
                    const image = { name: file.name || '粘贴图片', url };
                    images.push(image);
                    const figure = document.createElement('figure');
                    figure.className = 'nd-focus-image';
                    const preview = document.createElement('img');
                    preview.src = url;
                    preview.alt = image.name;
                    const caption = document.createElement('figcaption');
                    caption.textContent = image.name;
                    caption.title = image.name;
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.textContent = '×';
                    remove.setAttribute('aria-label', `移除 ${image.name}`);
                    remove.onclick = () => { images.splice(images.indexOf(image), 1); figure.remove(); };
                    figure.append(preview, caption, remove);
                    list.append(figure);
                }
            } catch (failure) { error.textContent = failure.message; }
            finally { reading--; submit.disabled = reading > 0; }
        }
        dialog.querySelector('.nd-focus-close').onclick = () => finish(null);
        dialog.querySelector('.nd-focus-cancel').onclick = () => finish(null);
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
        submit.onclick = () => finish({ focusRequirement: textarea.value.trim(), focusImages: images.slice() });
        dialog.querySelector('.nd-focus-add').onclick = () => input.click();
        input.onchange = () => { void addFiles(Array.from(input.files)); input.value = ''; };
        dialog.addEventListener('dragover', event => event.preventDefault());
        dialog.addEventListener('drop', event => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); });
        dialog.addEventListener('paste', event => {
            const files = Array.from(event.clipboardData.files);
            if (files.length) { event.preventDefault(); void addFiles(files); }
        });
        document.body.append(dialog);
        dialog.showModal();
        textarea.focus();
    });
}
