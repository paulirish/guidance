import { getRunStats } from './utils.js';

export function getFilteredData(data, intersectionOnly) {
    if (!intersectionOnly) return data;

    const results = data.results;
    const keys = Object.keys(results);
    const validParts = keys.map(k => {
        const parts = k.split(' - ');
        if (parts.length === 3) {
            return { raw: k, taskName: parts[0], guide: parts[1], runType: parts[2] };
        }
        return null;
    }).filter(p => p !== null);

    const uniqueGuides = [...new Set(validParts.map(p => p.guide))];
    const intersectionGuides = uniqueGuides.filter(g => {
        const hasUnguided = validParts.some(p => {
            if (p.guide === g && p.runType === 'unguided') {
                const runData = results[p.raw];
                return runData && runData.some(run => !run.results.some(c => c.isEarlyFailure));
            }
            return false;
        });
        const hasGuided = validParts.some(p => {
            if (p.guide === g && p.runType === 'guided') {
                const runData = results[p.raw];
                return runData && runData.some(run => !run.results.some(c => c.isEarlyFailure));
            }
            return false;
        });
        return hasUnguided && hasGuided;
    });

    const filteredResults = {};
    let unguidedPassed = 0;
    let unguidedTotal = 0;
    let guidedPassed = 0;
    let guidedTotal = 0;

    intersectionGuides.forEach(g => {
        const unguidedKey = validParts.find(p => p.guide === g && p.runType === 'unguided')?.raw;
        const guidedKey = validParts.find(p => p.guide === g && p.runType === 'guided')?.raw;

        if (unguidedKey && results[unguidedKey]) {
            filteredResults[unguidedKey] = results[unguidedKey];
            const runData = results[unguidedKey];
            const validRuns = runData.filter(run => !run.results.some(c => c.isEarlyFailure));
            unguidedPassed += validRuns.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
            unguidedTotal += validRuns.reduce((acc, run) => acc + run.results.length, 0);
        }

        if (guidedKey && results[guidedKey]) {
            filteredResults[guidedKey] = results[guidedKey];
            const runData = results[guidedKey];
            const validRuns = runData.filter(run => !run.results.some(c => c.isEarlyFailure));
            guidedPassed += validRuns.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
            guidedTotal += validRuns.reduce((acc, run) => acc + run.results.length, 0);
        }
    });

    const taskCount = intersectionGuides.length;
    const runsPerTest = data.summary.runsPerTest || 3;
    const expectedTotalRuns = taskCount * runsPerTest;

    let guideUsageCount = 0;
    let toolActivationCount = 0;
    let unguidedEarlyFailures = 0;
    let guidedEarlyFailures = 0;

    intersectionGuides.forEach(g => {
        const unguidedKey = validParts.find(p => p.guide === g && p.runType === 'unguided')?.raw;
        const guidedKey = validParts.find(p => p.guide === g && p.runType === 'guided')?.raw;

        if (unguidedKey && results[unguidedKey]) {
            const runData = results[unguidedKey];
            unguidedEarlyFailures += runData.filter(run => run.results.some(c => c.isEarlyFailure)).length;
        }

        if (guidedKey && results[guidedKey]) {
            const runData = results[guidedKey];
            guidedEarlyFailures += runData.filter(run => run.results.some(c => c.isEarlyFailure)).length;

            if (data.stats && data.stats[guidedKey]) {
                const stats = data.stats[guidedKey];
                guideUsageCount += stats.runsUsingGuide || 0;
                toolActivationCount += stats.runsWithToolActivation || 0;
            }
        }
    });

    const completedGuidedRuns = expectedTotalRuns - guidedEarlyFailures;

    const newSummary = {
        ...data.summary,
        taskCount,
        expectedTotalRuns,
        unguidedPassed,
        unguidedTotal,
        guidedPassed,
        guidedTotal,
        unguidedPassRate: unguidedTotal ? Math.round((unguidedPassed / unguidedTotal) * 100) : 0,
        guidedPassRate: guidedTotal ? Math.round((guidedPassed / guidedTotal) * 100) : 0,
        unguidedEarlyFailures,
        unguidedEarlyFailureRate: expectedTotalRuns ? Math.round((unguidedEarlyFailures / expectedTotalRuns) * 100) : 0,
        guidedEarlyFailures,
        guidedEarlyFailureRate: expectedTotalRuns ? Math.round((guidedEarlyFailures / expectedTotalRuns) * 100) : 0,
        totalGuidedRuns: expectedTotalRuns,
        guideUsageCount,
        toolActivationCount,
        guideUsageRate: completedGuidedRuns ? Math.round((guideUsageCount / completedGuidedRuns) * 100) : 0,
        toolActivationRate: completedGuidedRuns ? Math.round((toolActivationCount / completedGuidedRuns) * 100) : 0,
    };

    return {
        ...data,
        summary: newSummary,
        results: filteredResults
    };
}
