export function createGenerationOverlay(doc = globalThis.document) {
    let node = null;
    return {
        show(message = '正在生成中，请勿关闭页面') {
            if (!doc?.body) return;
            if (!node || !node.isConnected) {
                node = doc.createElement('div');
                node.id = 'xb-generation-overlay';
                node.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;pointer-events:auto;cursor:wait;';
                node.setAttribute?.('role', 'alert');
                doc.body.append(node);
            }
            node.textContent = message;
        },
        hide() { node?.remove(); node = null; },
        get active() { return Boolean(node?.isConnected); },
    };
}
const defaultOverlay = createGenerationOverlay();
export const showGenerationOverlay = message => defaultOverlay.show(message);
export const hideGenerationOverlay = () => defaultOverlay.hide();

