import * as assert from 'assert';
import { buildSettings } from '../backend/StorageLayer';

suite('StorageLayer.buildSettings', () => {
    test('returns defaults for empty input', () => {
        const s = buildSettings({});
        assert.strictEqual(s.theme, 'light');
        assert.strictEqual(s.notificationsEnabled, true);
        assert.strictEqual(s.language, 'en');
    });

    test('accepts "dark" theme', () => {
        assert.strictEqual(buildSettings({ theme: 'dark' }).theme, 'dark');
    });

    test('accepts "light" theme explicitly', () => {
        assert.strictEqual(buildSettings({ theme: 'light' }).theme, 'light');
    });

    test('unrecognized theme string defaults to "light"', () => {
        assert.strictEqual(buildSettings({ theme: 'blue' }).theme, 'light');
    });

    test('non-string theme defaults to "light"', () => {
        assert.strictEqual(buildSettings({ theme: 42 }).theme, 'light');
        assert.strictEqual(buildSettings({ theme: null }).theme, 'light');
    });

    test('boolean false for notificationsEnabled', () => {
        assert.strictEqual(buildSettings({ notificationsEnabled: false }).notificationsEnabled, false);
    });

    test('boolean true for notificationsEnabled', () => {
        assert.strictEqual(buildSettings({ notificationsEnabled: true }).notificationsEnabled, true);
    });

    test('string "true" is coerced to true', () => {
        assert.strictEqual(buildSettings({ notificationsEnabled: 'true' }).notificationsEnabled, true);
    });

    test('string "false" is coerced to false', () => {
        assert.strictEqual(buildSettings({ notificationsEnabled: 'false' }).notificationsEnabled, false);
    });

    test('non-boolean/string notificationsEnabled defaults to true', () => {
        assert.strictEqual(buildSettings({ notificationsEnabled: 42 }).notificationsEnabled, true);
        assert.strictEqual(buildSettings({ notificationsEnabled: null }).notificationsEnabled, true);
    });

    test('language string is passed through', () => {
        assert.strictEqual(buildSettings({ language: 'fr' }).language, 'fr');
        assert.strictEqual(buildSettings({ language: 'ja' }).language, 'ja');
    });

    test('empty string language defaults to "en"', () => {
        assert.strictEqual(buildSettings({ language: '' }).language, 'en');
    });

    test('non-string language defaults to "en"', () => {
        assert.strictEqual(buildSettings({ language: 99 }).language, 'en');
        assert.strictEqual(buildSettings({ language: null }).language, 'en');
    });
});
