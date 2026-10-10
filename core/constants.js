/**
 * HuaManhua 共享常量
 */

export const EXT_ID = "HuaManhua";
export const EXT_NAME = "花漫画";
export const EXT_FOLDER_ID = (() => {
    try {
        const url = new URL(import.meta.url);
        const match = url.pathname.match(/\/scripts\/extensions\/third-party\/([^/]+)\//);
        return match?.[1] ? decodeURIComponent(match[1]) : EXT_ID;
    } catch {
        return EXT_ID;
    }
})();
export const extensionFolderPath = `scripts/extensions/third-party/${EXT_FOLDER_ID}`;

