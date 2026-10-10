const plugin = require('../../server-plugin/sillytavern-novelai/index.js');
const routes = [];
const router = {};
for (const method of ['get', 'post', 'delete', 'put']) router[method] = (path, ...handlers) => routes.push({ method, path, handlers: handlers.length });
(async () => {
    await plugin.init(router);
    if (!routes.some(route => route.path === '/status')) throw new Error('missing status route');
    if (!routes.some(route => route.path === '/v1/generate-image')) throw new Error('missing generate route');
    if (!routes.some(route => route.path === '/v1/generate-image-stream')) throw new Error('missing V5 stream route');
    console.log(`plugin routes smoke: ${routes.length}`);
    await plugin.exit();
})();

