import * as assert from 'assert';
import { Router } from '../backend/Router';

suite('Router', () => {
    test('returns null for unregistered route', () => {
        const router = new Router();
        assert.strictEqual(router.match('GET', '/unknown'), null);
    });

    test('matches an exact path', () => {
        const router = new Router();
        const handler = async () => {};
        router.add('GET', '/health', handler);
        const result = router.match('GET', '/health');
        assert.ok(result !== null);
        assert.strictEqual(result!.handler, handler);
        assert.deepStrictEqual(result!.params, {});
    });

    test('extracts a single :param from the path', () => {
        const router = new Router();
        const handler = async () => {};
        router.add('GET', '/jobs/:id', handler);
        const result = router.match('GET', '/jobs/abc-123');
        assert.ok(result !== null);
        assert.strictEqual(result!.params.id, 'abc-123');
    });

    test('extracts multiple :params from the path', () => {
        const router = new Router();
        const handler = async () => {};
        router.add('GET', '/users/:userId/posts/:postId', handler);
        const result = router.match('GET', '/users/42/posts/99');
        assert.ok(result !== null);
        assert.strictEqual(result!.params.userId, '42');
        assert.strictEqual(result!.params.postId, '99');
    });

    test('method matching is case-insensitive', () => {
        const router = new Router();
        const handler = async () => {};
        router.add('get', '/ping', handler);
        assert.ok(router.match('GET', '/ping') !== null);
        assert.ok(router.match('get', '/ping') !== null);
    });

    test('returns null for correct path but wrong method', () => {
        const router = new Router();
        router.add('GET', '/resource', async () => {});
        assert.strictEqual(router.match('POST', '/resource'), null);
    });

    test('returns null when path segment count differs', () => {
        const router = new Router();
        router.add('GET', '/a/b', async () => {});
        assert.strictEqual(router.match('GET', '/a'), null);
        assert.strictEqual(router.match('GET', '/a/b/c'), null);
    });

    test('first matching route wins', () => {
        const router = new Router();
        const first = async () => {};
        const second = async () => {};
        router.add('GET', '/v1/jobs', first);
        router.add('GET', '/v1/jobs', second);
        const result = router.match('GET', '/v1/jobs');
        assert.strictEqual(result!.handler, first);
    });

    test('URL-decodes param values', () => {
        const router = new Router();
        router.add('GET', '/files/:name', async () => {});
        const result = router.match('GET', '/files/hello%20world');
        assert.strictEqual(result!.params.name, 'hello world');
    });

    test('different methods on the same path are independent', () => {
        const router = new Router();
        const getHandler = async () => {};
        const postHandler = async () => {};
        router.add('GET', '/resource', getHandler);
        router.add('POST', '/resource', postHandler);
        assert.strictEqual(router.match('GET', '/resource')!.handler, getHandler);
        assert.strictEqual(router.match('POST', '/resource')!.handler, postHandler);
    });
});
