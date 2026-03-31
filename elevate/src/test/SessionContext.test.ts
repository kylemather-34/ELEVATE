import * as assert from 'assert';
import { SessionContext } from '../backend/SessionContext';

suite('SessionContext', () => {
    test('getActiveFile returns undefined by default', () => {
        const session = new SessionContext();
        assert.strictEqual(session.getActiveFile(), undefined);
    });

    test('setActiveFile and getActiveFile round-trip', () => {
        const session = new SessionContext();
        const snapshot = { uri: 'file:///test.py', language: 'python', version: 1, text: 'print()' };
        session.setActiveFile(snapshot);
        assert.strictEqual(session.getActiveFile(), snapshot);
    });

    test('getRecentFeedback returns empty array by default', () => {
        const session = new SessionContext();
        assert.deepStrictEqual(session.getRecentFeedback(), []);
    });

    test('addFeedback stores response with timestamp and filePath', () => {
        const session = new SessionContext();
        const snapshot = { uri: 'file:///test.py', language: 'python', version: 1, text: 'print()' };
        session.setActiveFile(snapshot);
        session.addFeedback('response text');
        const feedback = session.getRecentFeedback();
        assert.strictEqual(feedback.length, 1);
        assert.strictEqual(feedback[0].response, 'response text');
        assert.strictEqual(feedback[0].filePath, 'file:///test.py');
        assert.ok(feedback[0].timestamp);
    });

    test('addFeedback uses unknown filePath when no active file set', () => {
        const session = new SessionContext();
        session.addFeedback('some response');
        assert.strictEqual(session.getRecentFeedback()[0].filePath, 'unknown');
    });

    test('clearFeedback empties the feedback list', () => {
        const session = new SessionContext();
        session.addFeedback('response 1');
        session.addFeedback('response 2');
        session.clearFeedback();
        assert.deepStrictEqual(session.getRecentFeedback(), []);
    });

    test('accumulates multiple feedback entries', () => {
        const session = new SessionContext();
        session.addFeedback('first');
        session.addFeedback('second');
        assert.strictEqual(session.getRecentFeedback().length, 2);
    });

    test('setActiveFile replaces the previous file', () => {
        const session = new SessionContext();
        const snap1 = { uri: 'file:///a.py', language: 'python', version: 1, text: '' };
        const snap2 = { uri: 'file:///b.py', language: 'python', version: 1, text: '' };
        session.setActiveFile(snap1);
        session.setActiveFile(snap2);
        assert.strictEqual(session.getActiveFile()!.uri, 'file:///b.py');
    });

    test('feedback entries are ordered oldest-first', () => {
        const session = new SessionContext();
        session.addFeedback('a');
        session.addFeedback('b');
        session.addFeedback('c');
        const entries = session.getRecentFeedback();
        assert.strictEqual(entries[0].response, 'a');
        assert.strictEqual(entries[2].response, 'c');
    });
});
