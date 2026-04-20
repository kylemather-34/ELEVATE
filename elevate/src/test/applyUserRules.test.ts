import * as assert from 'assert';
import { applyUserRules, UserRulesOptions } from '../pipeline/Stage';
import { Logger } from '../util/Logger';

suite('applyUserRules', () => {
    const logger = new Logger('test', false);

    // A minimal prompt that contains the output format marker
    const BASE_PROMPT = "Role:\nYou are an instructor.\n\nOutput Format (STRICT — follow this):\nReturn JSON only.\n";

    function opts(overrides: Partial<UserRulesOptions> = {}): UserRulesOptions {
        return {
            verbosity: 'balanced',
            teachingStyle: 'direct',
            customRules: '',
            ...overrides,
        };
    }

    // --- No-op cases ---

    test('returns prompt unchanged when all settings are defaults', () => {
        const result = applyUserRules(BASE_PROMPT, opts(), logger);
        assert.strictEqual(result, BASE_PROMPT);
    });

    test('returns prompt unchanged when verbosity=balanced, teachingStyle=direct, no customRules', () => {
        const result = applyUserRules(BASE_PROMPT, opts({ verbosity: 'balanced', teachingStyle: 'direct' }), logger);
        assert.strictEqual(result, BASE_PROMPT);
    });

    // --- Teaching style ---

    test('injects socratic instruction when teachingStyle=socratic', () => {
        const result = applyUserRules(BASE_PROMPT, opts({ teachingStyle: 'socratic' }), logger);
        assert.ok(result.includes('Socratic'), 'should include Socratic instruction');
    });

    test('injects step-by-step instruction when teachingStyle=step-by-step', () => {
        const result = applyUserRules(BASE_PROMPT, opts({ teachingStyle: 'step-by-step' }), logger);
        assert.ok(result.includes('numbered steps'), 'should include step-by-step instruction');
    });

    // --- Custom rules ---

    test('appends customRules as a bullet when provided', () => {
        const result = applyUserRules(BASE_PROMPT, opts({ customRules: 'Always mention time complexity.' }), logger);
        assert.ok(result.includes('- Always mention time complexity.'), 'should include custom rule as bullet');
    });

    test('splits multi-line customRules into separate bullets', () => {
        const result = applyUserRules(BASE_PROMPT, opts({ customRules: 'Always mention time complexity.\nFocus on readability over cleverness.' }), logger);
        assert.ok(result.includes('- Always mention time complexity.'), 'should include first rule');
        assert.ok(result.includes('- Focus on readability over cleverness.'), 'should include second rule');
    });

    test('ignores blank lines in customRules', () => {
        const result = applyUserRules(BASE_PROMPT, opts({ customRules: 'First rule.\n\n\nSecond rule.' }), logger);
        assert.ok(result.includes('- First rule.'), 'should include first rule');
        assert.ok(result.includes('- Second rule.'), 'should include second rule');
        assert.ok(!result.includes('- \n'), 'should not include blank bullet');
    });

    test('ignores customRules when empty string', () => {
        // run() trims customRules before passing to applyUserRules, so we pass already-trimmed input
        const result = applyUserRules(BASE_PROMPT, opts({ customRules: '' }), logger);
        assert.strictEqual(result, BASE_PROMPT);
    });

    // --- Insertion position ---

    test('inserts User Preferences section before the output format marker', () => {
        const result = applyUserRules(BASE_PROMPT, opts({ teachingStyle: 'socratic' }), logger);
        const prefIdx = result.indexOf('User Preferences:');
        const markerIdx = result.indexOf('Output Format (STRICT');
        assert.ok(prefIdx !== -1, 'User Preferences section should be present');
        assert.ok(prefIdx < markerIdx, 'User Preferences should appear before the output format section');
    });

    test('falls back to appending when marker is absent', () => {
        const noMarkerPrompt = "Role:\nYou are an instructor.\n";
        const result = applyUserRules(noMarkerPrompt, opts({ teachingStyle: 'socratic' }), logger);
        assert.ok(result.startsWith(noMarkerPrompt), 'original prompt should be preserved at the start');
        assert.ok(result.includes('User Preferences:'), 'User Preferences section should still be present');
    });

    // --- Combined options ---

    test('combines teachingStyle and customRules instructions', () => {
        const result = applyUserRules(BASE_PROMPT, opts({ teachingStyle: 'socratic', customRules: 'Focus on readability.' }), logger);
        assert.ok(result.includes('Socratic'), 'should include socratic instruction');
        assert.ok(result.includes('Focus on readability.'), 'should include custom rule');
    });

    test('combines all three options', () => {
        const result = applyUserRules(BASE_PROMPT, opts({
            verbosity: 'concise',
            teachingStyle: 'step-by-step',
            customRules: 'Focus on readability.',
        }), logger);
        assert.ok(result.includes('numbered steps'), 'should include teaching style instruction');
        assert.ok(result.includes('Focus on readability.'), 'should include custom rule');
    });
});
