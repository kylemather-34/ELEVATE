import * as assert from 'assert';
import { SseHub } from '../backend/SSEHub';

suite('SseHub', () => {
    test('emits events to subscribers', () => {
        const hub = new SseHub();
        const received: any[] = [];
        hub.subscribe('job-1', (evt) => received.push(evt));
        const evt = { id: '1', job_id: 'job-1', ts: 'now', event_type: 'STATUS' as const, payload: { status: 'queued' } };
        hub.emit(evt);
        assert.strictEqual(received.length, 1);
        assert.strictEqual(received[0].payload.status, 'queued');
    });

    test('unsubscribe stops receiving events', () => {
        const hub = new SseHub();
        const received: any[] = [];
        const unsub = hub.subscribe('job-2', (evt) => received.push(evt));
        const evt = (n: string) => ({ id: n, job_id: 'job-2', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        hub.emit(evt('a'));
        unsub();
        hub.emit(evt('b'));
        assert.strictEqual(received.length, 1);
    });

    test('getHistory returns events after given index', () => {
        const hub = new SseHub();
        const evt = (n: string) => ({ id: n, job_id: 'job-3', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        hub.emit(evt('1'));
        hub.emit(evt('2'));
        hub.emit(evt('3'));
        const history = hub.getHistory('job-3', 1);
        assert.strictEqual(history.length, 2);
        assert.strictEqual(history[0].id, '2');
    });

    test('does not emit to other job subscribers', () => {
        const hub = new SseHub();
        const received: any[] = [];
        hub.subscribe('job-A', (evt) => received.push(evt));
        hub.emit({ id: '1', job_id: 'job-B', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        assert.strictEqual(received.length, 0);
    });

    test('multiple subscribers for the same job all receive events', () => {
        const hub = new SseHub();
        const a: any[] = [];
        const b: any[] = [];
        hub.subscribe('job-X', (evt) => a.push(evt));
        hub.subscribe('job-X', (evt) => b.push(evt));
        hub.emit({ id: '1', job_id: 'job-X', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        assert.strictEqual(a.length, 1);
        assert.strictEqual(b.length, 1);
    });

    test('getHistory returns empty array for unknown job', () => {
        const hub = new SseHub();
        assert.deepStrictEqual(hub.getHistory('no-such-job', 0), []);
    });

    test('getHistory with index 0 returns all events', () => {
        const hub = new SseHub();
        const evt = (n: string) => ({ id: n, job_id: 'job-4', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        hub.emit(evt('1'));
        hub.emit(evt('2'));
        const history = hub.getHistory('job-4', 0);
        assert.strictEqual(history.length, 2);
    });

    test('emitting after all subscribers unsubscribed produces no errors', () => {
        const hub = new SseHub();
        const unsub = hub.subscribe('job-Y', () => {});
        unsub();
        assert.doesNotThrow(() => {
            hub.emit({ id: '1', job_id: 'job-Y', ts: 'now', event_type: 'STATUS' as const, payload: {} });
        });
    });
});
