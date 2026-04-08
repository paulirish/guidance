import './setup.ts';
import { test } from 'node:test';
import assert from 'node:assert';
// @ts-expect-error - importing from js file
import { getFilteredData } from '../../eval-view/metrics-utils.js';

test('getFilteredData returns full data when intersectionOnly is false', () => {
    const data = {
        results: {
            'task - foo - unguided': [{ results: [{ passed: true }] }],
            'task - bar - guided': [{ results: [{ passed: true }] }]
        },
        summary: { unguidedPassed: 1, unguidedTotal: 1, guidedPassed: 1, guidedTotal: 1 }
    };
    const result = getFilteredData(data, false);
    assert.deepStrictEqual(result, data);
});

test('getFilteredData returns intersection when intersectionOnly is true', () => {
    const data = {
        results: {
            'task - foo - unguided': [{ results: [{ passed: true }] }],
            'task - foo - guided': [{ results: [{ passed: true }] }],
            'task - bar - unguided': [{ results: [{ passed: true }] }]
        },
        summary: { unguidedPassed: 2, unguidedTotal: 2, guidedPassed: 1, guidedTotal: 1 },
        stats: {
            'task - foo - guided': { runsUsingGuide: 1, runsWithToolActivation: 1 }
        }
    };
    const result = getFilteredData(data, true);
    
    // foo is in intersection
    // bar is excluded
    assert.strictEqual(Object.keys(result.results).length, 2);
    assert.ok(result.results['task - foo - unguided']);
    assert.ok(result.results['task - foo - guided']);
    assert.ok(!result.results['task - bar - unguided']);
    
    // Summary should be updated
    assert.strictEqual(result.summary.unguidedPassed, 1);
    assert.strictEqual(result.summary.unguidedTotal, 1);
    assert.strictEqual(result.summary.guidedPassed, 1);
    assert.strictEqual(result.summary.guidedTotal, 1);
});

test('getFilteredData excludes tasks with only early failures', () => {
    const data = {
        results: {
            'task - foo - unguided': [{ results: [{ passed: true }] }],
            'task - foo - guided': [{ results: [{ passed: true }] }],
            'task - bar - unguided': [{ results: [{ passed: false, isEarlyFailure: true }] }],
            'task - bar - guided': [{ results: [{ passed: true }] }]
        },
        summary: { unguidedPassed: 1, unguidedTotal: 2, guidedPassed: 2, guidedTotal: 2 },
        stats: {
            'task - foo - guided': { runsUsingGuide: 1, runsWithToolActivation: 1 }
        }
    };
    const result = getFilteredData(data, true);
    
    // foo is in intersection
    // bar is excluded because unguided failed early
    assert.strictEqual(Object.keys(result.results).length, 2);
    assert.ok(result.results['task - foo - unguided']);
    assert.ok(result.results['task - foo - guided']);
    assert.ok(!result.results['task - bar - unguided']);
    assert.ok(!result.results['task - bar - guided']);
});
