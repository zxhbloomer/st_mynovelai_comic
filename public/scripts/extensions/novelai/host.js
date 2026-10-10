import { getContext } from '/scripts/extensions.js';
import { MEDIA_DISPLAY, MEDIA_SOURCE, MEDIA_TYPE } from '/scripts/constants.js';
import { getMessageTimeStamp } from '/scripts/RossAscends-mods.js';

export async function insertNovelAIImage({ base64, mime = 'image/png', caption = 'NovelAI image' } = {}) {
    if (!base64) throw new TypeError('NovelAI image base64 is required');
    const context = getContext();
    if (!context?.chat) throw new Error('SillyTavern chat context is unavailable');
    const message = {
        name: context.name1,
        is_user: true,
        send_date: getMessageTimeStamp(),
        mes: caption,
        extra: {
            media: [{ url: `data:${mime};base64,${base64}`, type: MEDIA_TYPE.getFromMime(mime) || MEDIA_TYPE.IMAGE, source: MEDIA_SOURCE.CAPTIONED, title: caption }],
            media_display: MEDIA_DISPLAY.GALLERY,
            media_index: 0,
            inline_image: true,
        },
    };
    context.chat.push(message);
    const messageId = context.chat.length - 1;
    context.addOneMessage(message);
    await context.saveChat?.();
    return { messageId, message };
}

