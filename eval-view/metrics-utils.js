// @ts-nocheck
import { getRunStats } from './utils.js';

export function getFilteredData(data, intersectionOnly) {
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

    const targetGuides = intersectionOnly ? intersectionGuides : uniqueGuides;

    const filteredResults = {};
    const filteredStats = {};
    let unguidedPassed = 0;
    let unguidedTotal = 0;
    let guidedPassed = 0;
    let guidedTotal = 0;

    let guideUsageCount = 0;
    let toolActivationCount = 0;
    let unguidedEarlyFailures = 0;
    let guidedEarlyFailures = 0;
    let actualCompletedGuidedRuns = 0;
    let actualAttemptedGuidedRuns = 0;
    let actualAttemptedUnguidedRuns = 0;

    let unguidedPassRateSum = 0;
    let unguidedValidTaskCount = 0;
    let guidedPassRateSum = 0;
    let guidedValidTaskCount = 0;

    targetGuides.forEach(g => {
        const unguidedKey = validParts.find(p => p.guide === g && p.runType === 'unguided')?.raw;
        const guidedKey = validParts.find(p => p.guide === g && p.runType === 'guided')?.raw;

        if (unguidedKey && results[unguidedKey]) {
            filteredResults[unguidedKey] = results[unguidedKey];
            const runData = results[unguidedKey];
            const validRuns = runData.filter(run => !run.results.some(c => c.isEarlyFailure));
            const taskPassed = validRuns.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
            const taskTotal = validRuns.reduce((acc, run) => acc + run.results.length, 0);
            
            unguidedPassed += taskPassed;
            unguidedTotal += taskTotal;
            
            if (taskTotal > 0) {
                unguidedPassRateSum += taskPassed / taskTotal;
                unguidedValidTaskCount++;
            }
            
            const earlyFailures = runData.length - validRuns.length;
            unguidedEarlyFailures += earlyFailures;
            actualAttemptedUnguidedRuns += runData.length;

            if (data.stats && data.stats[unguidedKey]) {
                filteredStats[unguidedKey] = { ...data.stats[unguidedKey], earlyFailures };
            }
        }

        if (guidedKey && results[guidedKey]) {
            filteredResults[guidedKey] = results[guidedKey];
            const runData = results[guidedKey];
            const validRuns = runData.filter(run => !run.results.some(c => c.isEarlyFailure));
            const taskPassed = validRuns.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
            const taskTotal = validRuns.reduce((acc, run) => acc + run.results.length, 0);

            guidedPassed += taskPassed;
            guidedTotal += taskTotal;

            if (taskTotal > 0) {
                guidedPassRateSum += taskPassed / taskTotal;
                guidedValidTaskCount++;
            }

            const earlyFailures = runData.length - validRuns.length;
            guidedEarlyFailures += earlyFailures;
            actualCompletedGuidedRuns += validRuns.length;
            actualAttemptedGuidedRuns += runData.length;

            let taskGuideUsageCount = 0;
            let taskToolActivationCount = 0;

            // Recalculate usage counts manually from ONLY valid runs
            validRuns.forEach(run => {
                const toolsUsed = run.guidanceToolsUsed || [];
                if (toolsUsed.length > 0) taskToolActivationCount++;
                
                const guidesUsed = run.guidesUsed || (run.guideUsed ? run.guideUsed.guidesUsed : []) || [];
                const retrieved = run.fileReadGuides === undefined ? (run.retrievedGuides || guidesUsed) : run.fileReadGuides;
                if (retrieved && retrieved.length > 0) taskGuideUsageCount++;
            });

            guideUsageCount += taskGuideUsageCount;
            toolActivationCount += taskToolActivationCount;

            if (data.stats && data.stats[guidedKey]) {
                filteredStats[guidedKey] = {
                    ...data.stats[guidedKey],
                    earlyFailures,
                    runsUsingGuide: taskGuideUsageCount,
                    runsWithToolActivation: taskToolActivationCount,
                    runCount: validRuns.length
                };
            }
        }
    });

    const taskCount = targetGuides.length;
    const runsPerTest = data.summary.runsPerTest || 3;
    const expectedTotalRuns = taskCount * runsPerTest;

    const unguidedPassRate = unguidedValidTaskCount ? Math.round((unguidedPassRateSum / unguidedValidTaskCount) * 100) : 0;
    const guidedPassRate = guidedValidTaskCount ? Math.round((guidedPassRateSum / guidedValidTaskCount) * 100) : 0;

    const newSummary = {
        ...data.summary,
        taskCount,
        expectedTotalRuns,
        unguidedPassed,
        unguidedTotal,
        guidedPassed,
        guidedTotal,
        unguidedPassRate,
        guidedPassRate,
        unguidedEarlyFailures,
        unguidedEarlyFailureRate: actualAttemptedUnguidedRuns ? Math.round((unguidedEarlyFailures / actualAttemptedUnguidedRuns) * 100) : 0,
        guidedEarlyFailures,
        guidedEarlyFailureRate: actualAttemptedGuidedRuns ? Math.round((guidedEarlyFailures / actualAttemptedGuidedRuns) * 100) : 0,
        totalGuidedRuns: actualAttemptedGuidedRuns,
        guideUsageCount,
        toolActivationCount,
        guideUsageRate: actualCompletedGuidedRuns ? Math.round((guideUsageCount / actualCompletedGuidedRuns) * 100) : 0,
        toolActivationRate: actualCompletedGuidedRuns ? Math.round((toolActivationCount / actualCompletedGuidedRuns) * 100) : 0,
    };

    return {
        ...data,
        summary: newSummary,
        results: filteredResults,
        stats: { ...data.stats, ...filteredStats }
    };
}
