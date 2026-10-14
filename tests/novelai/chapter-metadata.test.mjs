import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createComicTasks } from '../../modules/draw/shared/comic-planning.js';
import { parseSubmittedScenePlan } from '../../modules/draw/shared/scene-plan-contract.js';
import { buildReaderFloor } from '../../modules/draw/shared/comic-reader-model.js';

const chapter = { title: '重逢', summary: '她推开门，与旧友重逢。' };
const image = '@page\ncomic\n\n@panel P1\nroom\n@character C1\nboy';
test('inline/end extract chapter tags outside image descriptions', () => {
    for (const mode of ['inline', 'end']) {
        const response = `<chapter_title>${chapter.title}</chapter_title><chapter_summary>${chapter.summary}</chapter_summary>${mode === 'inline' ? '<manga_position>1</manga_position>' : ''}<image>${image}</image>`;
        const [task] = createComicTasks({ source: '她推开门。', response, mode });
        assert.deepEqual(task.comic.chapter, chapter);
        assert.equal(task.comic.image, image);
    }
});
test('points tool passes chapter metadata without selecting comic compiler', () => {
    const result = { toolCalls: [{ name: 'submit_scene_plan', arguments: {
        chapter_title: chapter.title, chapter_summary: chapter.summary,
        images: [{ insert_after: 1, scene: 'room', characters: [] }],
    } }] };
    const options = { sceneSource: { points: [{ number: 1, offset: 5 }], sourceHash: 'source' } };
    const { tasks } = parseSubmittedScenePlan(result, options);
    assert.deepEqual(tasks[0].chapter, chapter);
    assert.equal(tasks[0].comic, undefined);
    delete result.toolCalls[0].arguments.chapter_title;
    delete result.toolCalls[0].arguments.chapter_summary;
    assert.equal(parseSubmittedScenePlan(result, options).tasks.length, 1);
});
test('reader prefers current generation metadata over cached chapter', () => {
    const message = { mes: '正文', extra: { xiaobaixDrawSaved: { slot1: { savedUrl: '/image', comic: { chapter } } } } };
    const floor = buildReaderFloor(message, 'points', { title: '旧标题', summary: '暂无简介' });
    assert.equal(floor.chapterTitle, chapter.title);
    assert.equal(floor.summary, chapter.summary);
    message.extra.xiaobaixDrawSaved.slot1 = { savedUrl: '/image', chapter };
    assert.equal(buildReaderFloor(message).chapterTitle, chapter.title);
});
test('placeholder state does not mask chapter tags; metadata is available before image completes', () => {
    assert.equal(buildReaderFloor({ mes: '<chapter_title>新章节</chapter_title>' }, 'points', { title: '暂无标题' }).chapterTitle, '新章节');
    const message = { mes: '正文[image:slot-pending]' };
    const floor = buildReaderFloor(message, 'points', null, [{ slotId: 'slot-pending', chapter, status: 'pending' }]);
    assert.equal(floor.hasComic, false);
    assert.equal(floor.chapterTitle, chapter.title);
    assert.equal(floor.summary, chapter.summary);
});
