import { ApiClient } from './api.js';
import { getRunStats, getColor, escapeHtml } from './utils.js';

const api = new ApiClient();

window.loadStabilityTrend = async (scenarioName, currentTestId) => {
    const containerId = `stability-trend-${scenarioName.replace(/\s+/g, '-')}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.85rem;">Loading historical data...</div>`;

    try {
        const response = await fetch('/api/suites');
        if (!response.ok) throw new Error('Could not fetch suite manifest');
        const manifest = await response.json();

        const currentSuite = manifest.suites.find(s => s.id === currentTestId);
        const criteria = currentSuite ? { agent: currentSuite.agent, model: currentSuite.model, serving: currentSuite.serving } : null;

        let currentAssertions = [];
        let currentPromptText = '';
        try {
            const currentRes = await fetch(`${currentTestId}/evals.json`);
            if (currentRes.ok) {
                const currentData = await currentRes.json();
                const guidedKey = `${scenarioName} - guided`;
                const unguidedKey = `${scenarioName} - unguided`;
                const currentRunResults = currentData.results[guidedKey] || currentData.results[unguidedKey];
                if (currentRunResults && currentRunResults[0]) {
                    currentAssertions = currentRunResults[0].results.map(r => r.message).sort();
                }
            }
            
            const runScriptText = await api.getFileText(`${currentTestId}/run.mjs`);
            const match = runScriptText.match(/\.\.\.\[([\s\S]+?)\]/);
            if (match) {
                const arrayStr = `[${match[1]}]`;
                const arr = JSON.parse(arrayStr);
                currentPromptText = arr[1];
            }
        } catch (e) {}

        let history = [];
        for (const suite of manifest.suites) {
            if (criteria) {
                if (suite.agent !== criteria.agent || suite.model !== criteria.model || suite.serving !== criteria.serving) continue;
            }

            const res = await fetch(`${suite.id}/evals.json`);
            if (res.ok) {
                const data = await res.json();
                const guidedKey = `${scenarioName} - guided`;
                const unguidedKey = `${scenarioName} - unguided`;
                
                let gRate = null;
                let uRate = null;

                const guidedRun = data.results[guidedKey];
                const unguidedRun = data.results[unguidedKey];

                if (guidedRun && guidedRun[0]) {
                    const historyAssertions = guidedRun[0].results.map(r => r.message).sort();
                    if (currentAssertions.length > 0 && currentAssertions.join('|') !== historyAssertions.join('|')) {
                         continue; // Skip if checks differ!
                    }
                    gRate = getRunStats(guidedRun[0].results).rate;
                }
                if (unguidedRun && unguidedRun[0]) {
                    uRate = getRunStats(unguidedRun[0].results).rate;
                }

                let historyPromptText = '';
                try {
                    const runText = await api.getFileText(`${suite.id}/run.mjs`);
                    const match = runText.match(/\.\.\.\[([\s\S]+?)\]/);
                    if (match) {
                        const arrayStr = `[${match[1]}]`;
                        const arr = JSON.parse(arrayStr);
                        historyPromptText = arr[1];
                    }
                } catch (e) {}

                if (currentPromptText && historyPromptText && currentPromptText !== historyPromptText) {
                    continue; // Skip if prompt modified!
                }

                if (gRate !== null || uRate !== null) {
                    history.push({
                        testId: suite.id,
                        timestamp: suite.timestamp,
                        guidedRate: gRate,
                        unguidedRate: uRate,
                        isCurrent: suite.id === currentTestId
                    });
                }
            }
        }

        if (history.length === 0) {
            container.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.85rem;">No historical matches found for this task under identical parameters.</div>`;
            return;
        }

        history.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

        function formatShortTime(timestamp) {
            if (!timestamp) return '-';
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            
            if (diffMs < 0) {
                const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
                if (diffDays < 1) return 'today';
                return `+${diffDays}d`;
            }

            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays < 1) return 'today';
            return `${diffDays}d`;
        }

        const width = Math.max(500, history.length * 60);
        const height = 150;
        const paddingX = 40;
        const paddingY = 30;
        const graphHeight = height - 2 * paddingY;
        const graphWidth = width - 2 * paddingX;
        const stepX = history.length > 1 ? graphWidth / (history.length - 1) : 0;

        const gPoints = history.map((h, i) => h.guidedRate !== null ? `${paddingX + i * stepX},${height - paddingY - (h.guidedRate / 100 * graphHeight)}` : '').filter(Boolean).join(' ');
        const uPoints = history.map((h, i) => h.unguidedRate !== null ? `${paddingX + i * stepX},${height - paddingY - (h.unguidedRate / 100 * graphHeight)}` : '').filter(Boolean).join(' ');

        let svgHtml = `
            <div class="stability-title" style="font-size: 0.9rem; font-weight: bold; color: var(--text-secondary); margin-bottom: 8px;">Reliability Trend Analysis</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
                <span>Chronological outcomes across identical trials</span>
                <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background: oklch(65% 0.25 290);"></span> Guided</span>
                <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background: oklch(65% 0.1 200);"></span> Unguided</span>
            </div>
            
            <div style="overflow-x: auto; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 15px; border: 1px solid var(--border-color);">
                <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display: block;">
                    <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4" />
                    <line x1="${paddingX}" y1="${paddingY + graphHeight / 2}" x2="${width - paddingX}" y2="${paddingY + graphHeight / 2}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4" />
                    <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                    
                    <text x="${paddingX - 10}" y="${paddingY + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">100%</text>
                    <text x="${paddingX - 10}" y="${paddingY + graphHeight / 2 + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">50%</text>
                    <text x="${paddingX - 10}" y="${height - paddingY + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">0%</text>

                    ${gPoints ? `<polyline points="${gPoints}" fill="none" stroke="oklch(65% 0.25 290)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
                    ${uPoints ? `<polyline points="${uPoints}" fill="none" stroke="oklch(65% 0.1 200)" stroke-width="1.5" stroke-dasharray="3" stroke-linecap="round" stroke-linejoin="round" />` : ''}

                    ${history.map((h, i) => {
                        const x = paddingX + i * stepX;
                        const displayId = formatShortTime(h.timestamp);
                        
                        let pointsHtml = '';
                        const strokeColor = h.isCurrent ? '#fff' : 'var(--bg-primary)';
                        const strokeWidth = h.isCurrent ? 3 : 2;
                        const rG = h.isCurrent ? 7 : 5;
                        const rU = h.isCurrent ? 6 : 4;

                        if (h.guidedRate !== null) {
                            const yG = height - paddingY - (h.guidedRate / 100 * graphHeight);
                            pointsHtml += `
                                <circle cx="${x}" cy="${yG}" r="${rG}" fill="${getColor(h.guidedRate)}" stroke="${strokeColor}" stroke-width="${strokeWidth}">
                                    <title>Suite: ${h.testId}\nGuided: ${h.guidedRate}%</title>
                                </circle>
                                <text x="${x}" y="${yG - 12}" fill="${getColor(h.guidedRate)}" font-size="0.75rem" font-weight="bold" text-anchor="middle">${h.guidedRate}%</text>
                            `;
                        }
                        if (h.unguidedRate !== null) {
                            const yU = height - paddingY - (h.unguidedRate / 100 * graphHeight);
                            pointsHtml += `
                                <circle cx="${x}" cy="${yU}" r="${rU}" fill="rgba(255,255,255,0.3)" stroke="${strokeColor}" stroke-width="${strokeWidth}">
                                    <title>Suite: ${h.testId}\nUnguided: ${h.unguidedRate}%</title>
                                </circle>
                                <text x="${x}" y="${yU + 14}" fill="rgba(255,255,255,0.5)" font-size="0.7rem" text-anchor="middle">${h.unguidedRate}%</text>
                            `;
                        }

                        return `
                            <g style="cursor: pointer;" onclick="window.location.href='dashboard.html?testId=${h.testId}&source=local'">
                                <line x1="${x}" y1="${paddingY}" x2="${x}" y2="${height - paddingY}" stroke="${h.isCurrent ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}" stroke-width="${h.isCurrent ? 1.5 : 1}" />
                                ${pointsHtml}
                                <text x="${x}" y="${height - paddingY + 18}" fill="${h.isCurrent ? '#fff' : 'var(--text-secondary)'}" font-size="0.7rem" font-weight="${h.isCurrent ? 'bold' : 'normal'}" text-anchor="middle">${displayId}</text>
                            </g>
                        `;
                    }).join('')}
                </svg>
            </div>
        `;
        container.innerHTML = svgHtml;

    } catch (e) {
        container.innerHTML = `<div style="color: var(--accent-failure); font-size: 0.85rem;">Error querying trend: ${e.message}</div>`;
    }
};
