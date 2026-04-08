import './setup.ts';
import { test } from 'node:test';
import assert from 'node:assert';
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
    assert.strictEqual(result.summary.taskCount, 2);
    assert.strictEqual(result.summary.unguidedPassRate, 100);
    assert.strictEqual(result.summary.guidedPassRate, 100);
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

test('getFilteredData calculates per-task average pass rate', () => {
    const data = {
        results: {
            'task - foo - unguided': [{ results: Array(10).fill({ passed: true }) }],
            'task - bar - unguided': [{ results: Array(2).fill({ passed: false }) }]
        },
        summary: {}
    };
    const result = getFilteredData(data, false);
    
    // Aggregate would be 10/12 = 83%
    // Per-task average is (100% + 0%) / 2 = 50%
    assert.strictEqual(result.summary.unguidedPassRate, 50);
});

test('getFilteredData scrubs early failures from pass rate calculation', () => {
    const data = {
        results: {
            'task - foo - unguided': [
                { results: Array(10).fill({ passed: true }) },
                { results: [{ passed: false, isEarlyFailure: true }] }
            ]
        },
        summary: {}
    };
    const result = getFilteredData(data, false);
    
    // The early failure run should be ignored.
    // So only 1 run of 10 checks is counted.
    assert.strictEqual(result.summary.unguidedTotal, 10);
    assert.strictEqual(result.summary.unguidedPassed, 10);
    assert.strictEqual(result.summary.unguidedPassRate, 100);
});
