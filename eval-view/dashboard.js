import { getRunStats, getColor, escapeHtml, formatTestName, initGoogleAuth, calculateRadarData } from './utils.js';
import { ApiClient } from './api.js';
import { DumbbellChart } from './dumbbell-chart.js';

// Keep track of current details state for navigation
let currentDetails = null;
let allTestData = null;
let sortedScenarios = [];
let currentRunTypes = [];
let currentTestID = null;
let api;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize API Client
    api = new ApiClient();

    // Auth Button Handling (only for remote)
    if (api.source === 'remote') {
        initGoogleAuth(async () => {
            // Reload on auth success
            const params = new URLSearchParams(window.location.search);
            const testId = params.get('testId');
            if (testId) {
                await loadDashboardData(testId);
            }
        });
    }

    const initialParams = new URLSearchParams(window.location.search);
    const initialTestID = initialParams.get('testId');

    if (initialTestID) {
        await loadDashboardData(initialTestID);
    } else {
        document.body.innerHTML = `<div style="text-align:center; padding: 50px; color: red;">Error: No testId provided in query string.</div>`;
    }
});

async function loadDashboardData(testId) {
    // Prevent double loading
    if (window.dashboardLoaded) return;
    window.dashboardLoaded = true;

    try {
        const data = await api.getEvals(testId);
        if (!data) {
            document.body.innerHTML = `<div style="text-align:center; padding: 50px; color: red;">Error: Failed to load evaluation data for ${testId}.</div>`;
            return;
        }

        // Capture data for navigation
        allTestData = data;
        currentTestID = testId;

        // Fetch jetski info (optional)
        let jetskiVersion = null;
        let manifestTimestamp = null;
        try {
            const jetskiData = await api.getJetskiInfo(testId);
            if (jetskiData) {
                jetskiVersion = jetskiData['Jetski Version'];
                manifestTimestamp = jetskiData.timestamp;
            }
        } catch (e) {
            console.log('Could not load Jetski info:', e);
        }

        // Fetch timestamp from manifest
        let timestamp = null;
        if (manifestTimestamp) {
            timestamp = manifestTimestamp;
        }

        renderTestHeader(testId, jetskiVersion, timestamp, data);
        renderSummary(data);
        renderGrid(data, testId);
        renderRadarChart(data, testId);

        // Check for deep link to modal
        const params = new URLSearchParams(window.location.search);
        const testName = params.get('testName');
        const checkId = params.get('checkId');

        if (testName) {
            const results = data.results;
            const stats = data.stats;
            const runData = results[testName];
            const testStats = stats[testName];

            if (runData && testStats) {
                const view = params.get('view');
                const runNumber = parseInt(params.get('run'));

                if (view === 'diff' && runNumber) {
                    const run = runData.find(r => r.runNumber === runNumber);
                    if (run) {
                        currentDetails = { testName, runs: runData, stats: testStats, testId };
                        await showDetails(testName, runData, testStats, testId);

                        const { setupPath, resultPath } = await getResultPaths(testId, run, testName);
                        await viewDiff(setupPath, resultPath, testName, run.runNumber);
                    } else {
                        await showDetails(testName, runData, testStats, testId);
                    }
                } else {
                    // Auto-open modal
                    await showDetails(testName, runData, testStats, testId);
                }

                // If checkId is provided, try to scroll to it
                if (checkId) {
                    // Give the modal a moment to render
                    setTimeout(() => {
                        const checkItems = document.querySelectorAll('.check-item');
                        for (const item of checkItems) {
                            if (item.textContent.includes(checkId)) {
                                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                item.style.backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Highlight
                                item.style.transition = 'background-color 0.5s';
                                break;
                            }
                        }
                    }, 100);
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
        window.dashboardLoaded = false;

        let errorHtml = `<div style="text-align:center; padding: 50px; color: red;">
            <h3>Error loading dashboard data</h3>
            <p>${error.message}</p>
        </div>`;
        
        if (api && api.source === 'remote') {
            errorHtml += `<div style="text-align:center; color: var(--text-secondary); margin-top: -20px;">
                <p>If your session has expired, please use the <strong>Sign in with Google</strong> button above to re-authenticate.</p>
            </div>`;
        }
        
        const grid = document.getElementById('dashboard-grid');
        if (grid) {
            grid.innerHTML = errorHtml;
        } else {
            document.body.innerHTML = errorHtml;
        }
    }
}

// Modal control
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal');
    if (!modal) return;

    const closeBtn = document.querySelector('.close-modal');

    // Close function that also cleans up URL
    const closeModal = () => {
        if (modal.open) modal.close();
    };

    if (closeBtn) closeBtn.onclick = closeModal;

    // Close on backdrop click
    modal.addEventListener('click', (event) => event.target === modal && closeModal());

    // Handle Esc key or dialog close API
    modal.addEventListener('close', () => {
        const url = new URL(window.location.href);
        const paramsList = ['testName', 'checkId', 'view', 'run'];
        let changed = false;
        paramsList.forEach(p => {
            if (url.searchParams.has(p)) {
                url.searchParams.delete(p);
                changed = true;
            }
        });
        if (changed) {
            window.history.replaceState({}, '', url);
        }
    });

    // View GCS Artifacts
    const gcsBtn = document.getElementById('view-gcs-artifacts-btn');
    if (gcsBtn) {
        const params = new URLSearchParams(window.location.search);
        const source = params.get('source');
        const testId = params.get('testId');
        if (source === 'remote') {
            gcsBtn.style.display = 'inline-block';
            gcsBtn.onclick = () => window.open(`https://console.cloud.google.com/storage/browser/guidance-evals/${testId}?project=chrome-kiwi-air-force-dev`, '_blank');
        }
    }

    // View Log Handler
    (async () => {
        const viewLogBtn = document.getElementById('view-log-btn');
        if (viewLogBtn) {
            const params = new URLSearchParams(window.location.search);
            const testId = params.get('testId');

            if (testId) {
                try {
                    const hasLog = await api.checkLogExists(testId);
                    if (!hasLog) {
                        viewLogBtn.style.display = 'none';
                    } else {
                        viewLogBtn.onclick = async () => {
                            const modal = document.getElementById('modal');
                            const title = document.getElementById('modal-title');
                            const body = document.getElementById('modal-body');

                            title.textContent = 'Test Suite Run Log';
                            body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading log...</div>';
                            modal.dataset.view = 'log';
                            modal.showModal();

                            try {
                                const text = await api.getFileText(`${testId}/test_suite.log`);
                                body.innerHTML = `<div class="log-content">${escapeHtml(text)}</div>`;
                            } catch (e) {
                                body.innerHTML = `<div style="color: var(--accent-failure); padding: 20px;">Error loading log: ${e.message}</div>`;
                            }
                        };
                    }
                } catch (e) {
                    console.log('Error checking log existence:', e);
                    viewLogBtn.style.display = 'none'; // Hide button on error
                }
            } else {
                viewLogBtn.style.display = 'none'; // Hide button if no testId
            }
        }
    })();

    // Arrow key navigation
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('modal');
        if (!modal || !modal.open || modal.dataset.view !== 'details') return;

        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            if (!currentDetails || !sortedScenarios.length || !currentRunTypes.length) return;

            const parts = currentDetails.testName.split(' - ');
            if (parts.length !== 3) return;
            const [appName, guide, runType] = parts;
            const currentScenario = `${appName} - ${guide}`;

            let sIdx = sortedScenarios.indexOf(currentScenario);
            let rIdx = currentRunTypes.indexOf(runType);

            if (sIdx === -1 || rIdx === -1) return;

            const oldSIdx = sIdx;
            const oldRIdx = rIdx;

            if (e.key === 'ArrowLeft') rIdx--;
            if (e.key === 'ArrowRight') rIdx++;
            if (e.key === 'ArrowUp') sIdx--;
            if (e.key === 'ArrowDown') sIdx++;

            // Circular navigation (wrap around)
            sIdx = (sIdx + sortedScenarios.length) % sortedScenarios.length;
            rIdx = (rIdx + currentRunTypes.length) % currentRunTypes.length;

            if (sIdx === oldSIdx && rIdx === oldRIdx) return;

            const nextScenario = sortedScenarios[sIdx];
            const nextRunType = currentRunTypes[rIdx];
            const nextTestName = `${nextScenario} - ${nextRunType}`;

            if (nextTestName !== currentDetails.testName && allTestData.results[nextTestName]) {
                e.preventDefault();
                showDetails(
                    nextTestName,
                    allTestData.results[nextTestName],
                    allTestData.stats[nextTestName],
                    currentTestID
                );

                // Scroll to top
                const contentDiv = modal.querySelector('.modal-content');
                if (contentDiv) contentDiv.scrollTop = 0;
            }
        }
    });
});

function renderTestHeader(testId, jetskiVersion, timestamp, data) {
    const container = document.getElementById('test-header');
    if (container) {
        let timeStr = '-';
        if (timestamp) {
            try {
                const _date = new Date(timestamp);
                timeStr = _date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                }).replace(' at ', ', ');
            } catch { }
        }

        let agent = 'unknown';
        let model = 'unknown';
        let serving = 'unknown';

        if (data) {
            agent = data.agent || 'unknown';
            if (data.serving !== undefined) {
                serving = data.serving;
            } else if (data.enableSkills !== undefined) {
                serving = data.enableSkills ? 'skills' : 'mcp';
            }
            const servingDisplayNames = {
                'skills': 'Skills',
                'skills_cli': 'Skills (CLI)',
                'mcp': 'MCP'
            };
            serving = servingDisplayNames[serving] || serving;
            model = data.model || 'unknown';
        }

        container.innerHTML = `
            <div class="header-meta-grid">
                <div class="header-meta-item">
                    <span class="meta-label">Test ID</span>
                    <span class="meta-value" title="${escapeHtml(testId)}">${escapeHtml(testId)}</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-label">Action Date</span>
                    <span class="meta-value">${escapeHtml(timeStr)}</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-label">Agent</span>
                    <span class="meta-value">${escapeHtml(agent)}</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-label">Model</span>
                    <span class="meta-value" title="${escapeHtml(model)}">${escapeHtml(model)}</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-label">Serving Mode</span>
                    <span class="meta-value">${escapeHtml(serving)}</span>
                </div>
                ${jetskiVersion ? `
                <div class="header-meta-item">
                    <span class="meta-label">Jetski Version</span>
                    <span class="meta-value">${escapeHtml(jetskiVersion)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
}

function renderSummary(data) {
    const container = document.getElementById('test-header');
    if (!container) return;

    const results = data.results;
    let totalUnguidedPassed = 0;
    let totalUnguidedChecks = 0;
    let totalGuidedPassed = 0;
    let totalGuidedChecks = 0;
    let guidedRunsCount = 0;
    let runsWithTools = 0;
    let runsWithGuides = 0;

    Object.keys(results).forEach(key => {
        const runs = results[key];
        const isGuided = key.endsWith(' - guided');
        if (isGuided) guidedRunsCount += runs.length;

        runs.forEach(run => {
            const stats = getRunStats(run.results);
            if (isGuided) {
                totalGuidedPassed += stats.passed;
                totalGuidedChecks += stats.total;
                if (run.guidanceToolsUsed && run.guidanceToolsUsed.length > 0) runsWithTools++;
                if (run.guidesUsed && run.guidesUsed.length > 0) runsWithGuides++;
                // Handle guideUsed object if present
                if (!run.guidesUsed && run.guideUsed && typeof run.guideUsed === 'object') {
                    if (run.guideUsed.guidesUsed && run.guideUsed.guidesUsed.length > 0) runsWithGuides++;
                }
            } else {
                totalUnguidedPassed += stats.passed;
                totalUnguidedChecks += stats.total;
            }
        });
    });

    const unguidedPassRate = totalUnguidedChecks > 0 ? Math.round((totalUnguidedPassed / totalUnguidedChecks) * 100) : 0;
    const guidedPassRate = totalGuidedChecks > 0 ? Math.round((totalGuidedPassed / totalGuidedChecks) * 100) : 0;
    const toolActivationRate = guidedRunsCount > 0 ? Math.round((runsWithTools / guidedRunsCount) * 100) : 0;
    const guideUsageRate = guidedRunsCount > 0 ? Math.round((runsWithGuides / guidedRunsCount) * 100) : 0;

    const summaryEl = document.createElement('div');
    summaryEl.className = 'header-summary-grid';
    
    summaryEl.innerHTML = `
        <div class="header-meta-item" style="flex: 1;">
            <span class="meta-label">Overall Pass Rate Comparison</span>
            <div style="display: flex; align-items: center; gap: 15px; margin-top: 8px;">
                <span style="font-size: 0.95rem; color: var(--text-secondary);">${unguidedPassRate}%</span>
                <div style="flex: 1; height: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; position: relative; padding: 2px;">
                    <div style="position: absolute; left: calc(${unguidedPassRate}% - 4px); width: 8px; height: 8px; background: #ea4335; border-radius: 50%; top: 2px;" title="Unguided: ${unguidedPassRate}%"></div>
                    <div style="position: absolute; left: calc(${guidedPassRate}% - 4px); width: 8px; height: 8px; background: #34a853; border-radius: 50%; top: 2px;" title="Guided: ${guidedPassRate}%"></div>
                    <div style="position: absolute; left: calc(${Math.min(unguidedPassRate, guidedPassRate)}% + 2px); width: calc(${Math.abs(guidedPassRate - unguidedPassRate)}% - 4px); height: 2px; background: rgba(255,255,255,0.4); top: 5px;"></div>
                </div>
                <span style="font-size: 0.95rem; color: var(--text-primary); font-weight: bold;">${guidedPassRate}%</span>
            </div>
        </div>

        <div class="header-meta-item" style="flex: 1; max-width: 250px;">
            <span class="meta-label">Checks Passed Count Comparison</span>
            <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                <span style="font-size: 0.95rem; color: var(--text-secondary);">${totalUnguidedPassed}</span>
                <div style="flex: 1; height: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; position: relative; padding: 2px;">
                    <div style="position: absolute; left: calc(${(totalUnguidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100}% - 4px); width: 8px; height: 8px; background: #ea4335; border-radius: 50%; top: 2px;" title="Unguided Count: ${totalUnguidedPassed}"></div>
                    <div style="position: absolute; left: calc(${(totalGuidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100}% - 4px); width: 8px; height: 8px; background: #34a853; border-radius: 50%; top: 2px;" title="Guided Count: ${totalGuidedPassed}"></div>
                    <div style="position: absolute; left: calc(${Math.min((totalUnguidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100, (totalGuidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100)}% + 2px); width: calc(${Math.abs((totalGuidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100 - (totalUnguidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100)}% - 4px); height: 2px; background: rgba(255,255,255,0.4); top: 5px;"></div>
                </div>
                <span style="font-size: 0.95rem; color: var(--text-primary); font-weight: bold;">${totalGuidedPassed}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">Out of max <span style="color: var(--text-primary);">${Math.max(totalUnguidedChecks, totalGuidedChecks)}</span> checks</div>
        </div>

        <div class="header-meta-item" style="min-width: 140px;">
            <span class="meta-label">Tool Activation</span>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                <meter value="${toolActivationRate}" min="0" max="100" style="width: 100px; height: 12px;"></meter>
                <span style="font-size: 0.95rem; font-weight: bold; color: var(--text-primary);">${toolActivationRate}%</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">(${runsWithTools}/${guidedRunsCount}) runs</div>
        </div>

        <div class="header-meta-item" style="min-width: 140px;">
            <span class="meta-label">Guide Usage</span>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                <meter value="${guideUsageRate}" min="0" max="100" style="width: 100px; height: 12px;"></meter>
                <span style="font-size: 0.95rem; font-weight: bold; color: var(--text-primary);">${guideUsageRate}%</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">(${runsWithGuides}/${guidedRunsCount}) runs</div>
        </div>
    `;
    container.appendChild(summaryEl);
}

function renderGrid(data, testId) {
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;
    grid.innerHTML = ''; // Clear old content
    const results = data.results;

    sortedScenarios = [];

    // Extract dimensions dynamically from data keys
    const keys = Object.keys(results);
    const partsMap = keys.map(k => k.split(' - '));
    const validParts = partsMap.filter(p => p.length === 3);

    const sortedAppNames = [...new Set(validParts.map(p => p[0]))].sort();
    const sortedGuides = [...new Set(validParts.map(p => p[1]))].sort();

    sortedAppNames.forEach(appName => {
        sortedGuides.forEach(guide => {
            const scenarioName = `${appName} - ${guide}`;
            const unguidedKey = `${scenarioName} - unguided`;
            const guidedKey = `${scenarioName} - guided`;

            const unguidedRuns = results[unguidedKey];
            const guidedRuns = results[guidedKey];

            if (!unguidedRuns && !guidedRuns) return; // Skip if neither exists

            sortedScenarios.push(scenarioName);

            // Calculate averages
            const getAvg = (runs) => {
                if (!runs || runs.length === 0) return 0;
                const totalPassed = runs.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
                const totalChecks = runs.reduce((acc, run) => acc + run.results.length, 0);
                return totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;
            };

            const unguidedAvg = getAvg(unguidedRuns);
            const guidedAvg = getAvg(guidedRuns);
            const uplift = guidedAvg - unguidedAvg;

            const accordion = document.createElement('div');
            accordion.className = 'task-accordion';
            
            // Draw mini dumbbell slider track
            const leftDot = Math.min(unguidedAvg, guidedAvg);
            const rightDot = Math.max(unguidedAvg, guidedAvg);
            const trackWidth = 250; // matches css
            const scale = (val) => (val / 100) * trackWidth;

            accordion.innerHTML = `
                <div class="task-accordion-header">
                    <div class="left-section">
                        <span class="chevron" style="display: inline-block; transition: transform 0.2s; margin-right: 10px;">▶</span>
                        <span class="feature-chip">${escapeHtml(formatTestName(scenarioName).split(': ')[0])}</span>
                        <span class="task-title" style="font-weight: bold; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(formatTestName(scenarioName).split(': ')[1] || '')}</span>
                    </div>
                    <div class="right-section">
                        <div class="mini-dumbbell-track">
                            <div class="connector" style="left: ${scale(leftDot)}px; width: ${scale(rightDot - leftDot)}px;"></div>
                            <div class="dot unguided" style="left: ${scale(unguidedAvg)}px;"></div>
                            <div class="dot guided" style="left: ${scale(guidedAvg)}px;"></div>
                        </div>
                        <div class="uplift-score ${uplift < 0 ? 'negative' : ''}" style="${uplift === 0 ? 'color: var(--text-secondary); background: rgba(255,255,255,0.05);' : ''}">
                            ${uplift >= 0 ? '+' : ''}${uplift}%
                        </div>
                    </div>
                </div>
                <div class="task-accordion-content">
                    <div class="expansion-loading" style="color: var(--text-secondary);">Loading details...</div>
                </div>
            `;

            const header = accordion.querySelector('.task-accordion-header');
            const content = accordion.querySelector('.task-accordion-content');
            const chevron = accordion.querySelector('.chevron');

            header.onclick = async () => {
                const isOpen = accordion.classList.toggle('open');
                chevron.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
                
                if (isOpen && content.querySelector('.expansion-loading')) {
                    await fillAccordionDetails(content, scenarioName, unguidedRuns, guidedRuns, testId);
                }
            };

            grid.appendChild(accordion);
        });
    });
}

async function fillAccordionDetails(container, scenarioName, unguidedRuns, guidedRuns, testId) {
    try {
        let promptHtml = '<div style="color: var(--text-secondary); margin-bottom: 20px;">Prompt fetch deferred or failed.</div>';
        let baseApp = 'n/a';
        
        // Fetch prompt from the first run (unguided or guided)
        const sampleRun = (unguidedRuns && unguidedRuns[0]) || (guidedRuns && guidedRuns[0]);
        if (sampleRun && sampleRun.taskName) {
            try {
                const isNegative = sampleRun.taskName.endsWith('-negative');
                const taskPath = `tasks/${isNegative ? 'negative/' : ''}${sampleRun.taskName}.md`;
                const text = await api.getFileText(taskPath);

                const frontmatterMatch = text.match(/^---([\s\S]+?)---/);
                if (frontmatterMatch) {
                    const yaml = frontmatterMatch[1];
                    const baseAppMatch = yaml.match(/base_app:\s*([^\n\r]+)/);
                    if (baseAppMatch) {
                        baseApp = baseAppMatch[1].trim();
                    }
                }

                const cleanedText = text.replace(/^---[\s\S]+?---\n+/, '');

                promptHtml = `
                    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--text-secondary);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Agent Prompt</div>
                            <div style="background: rgba(255, 255, 255, 0.05); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-color);">
                                <span style="color: var(--text-secondary);">Base App:</span> 
                                <span style="color: var(--text-primary); font-weight: bold;">${escapeHtml(baseApp)}</span>
                            </div>
                        </div>
                        <p style="white-space: pre-wrap; font-family: inherit; margin: 0; color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(cleanedText)}</p>
                    </div>
                `;
            } catch (e) {
                console.log('Task prompt fetch failed:', e);
            }
        }

        // 1. Truth Matrix (Combine all runs side-by-side if multiple)
        const maxUnguided = unguidedRuns ? unguidedRuns.length : 0;
        const maxGuided = guidedRuns ? guidedRuns.length : 0;
        const maxRuns = Math.max(maxUnguided, maxGuided);

        const assertionMap = new Map(); // message -> { unguided: [], guided: [] }
        const processResultsToMap = (runs, type) => {
            if (!runs) return;
            runs.forEach((run, runIndex) => {
                if (run && run.results) {
                    run.results.forEach(check => {
                        const existing = assertionMap.get(check.message) || { unguided: [], guided: [] };
                        existing[type][runIndex] = check.passed;
                        assertionMap.set(check.message, existing);
                    });
                }
            });
        };
        processResultsToMap(unguidedRuns, 'unguided');
        processResultsToMap(guidedRuns, 'guided');

        let truthMatrixHtml = `<div style="margin-bottom: 16px;"><table class="truth-matrix"><thead>`;
        
        if (maxRuns > 1) {
            truthMatrixHtml += `
                <tr>
                    <th class="center" colspan="${maxRuns}">Unguided</th>
                    <th class="center" colspan="${maxRuns}">Guided</th>
                    <th rowspan="2">Assertion Requirement</th>
                </tr>
                <tr>
            `;
            for (let i = 0; i < maxRuns; i++) truthMatrixHtml += `<th class="center">#${i+1}</th>`;
            for (let i = 0; i < maxRuns; i++) truthMatrixHtml += `<th class="center">#${i+1}</th>`;
            truthMatrixHtml += `</tr>`;
        } else {
            truthMatrixHtml += `
                <tr>
                    <th class="center">Unguided</th>
                    <th class="center">Guided</th>
                    <th>Assertion Requirement</th>
                </tr>
            `;
        }
        truthMatrixHtml += `</thead><tbody>`;

        assertionMap.forEach((status, message) => {
            truthMatrixHtml += `<tr>`;
            if (maxRuns > 1) {
                for (let i = 0; i < maxRuns; i++) {
                    const pass = status.unguided[i];
                    truthMatrixHtml += `<td class="center ${pass !== undefined ? (pass ? 'pass' : 'fail') : ''}">${pass !== undefined ? (pass ? '✅' : '❌') : '-'}</td>`;
                }
                for (let i = 0; i < maxRuns; i++) {
                    const pass = status.guided[i];
                    truthMatrixHtml += `<td class="center ${pass !== undefined ? (pass ? 'pass' : 'fail') : ''}">${pass !== undefined ? (pass ? '✅' : '❌') : '-'}</td>`;
                }
            } else {
                const uPass = status.unguided[0];
                const gPass = status.guided[0];
                truthMatrixHtml += `<td class="center ${uPass !== undefined ? (uPass ? 'pass' : 'fail') : ''}">${uPass !== undefined ? (uPass ? '✅' : '❌') : '-'}</td>`;
                truthMatrixHtml += `<td class="center ${gPass !== undefined ? (gPass ? 'pass' : 'fail') : ''}">${gPass !== undefined ? (gPass ? '✅' : '❌') : '-'}</td>`;
            }
            truthMatrixHtml += `<td>${escapeHtml(message)}</td></tr>`;
        });
        truthMatrixHtml += '</tbody></table></div>';

        // Compute run cards for separate horizontal grid
        const getRunCards = async (runs, typeLabel) => {
             let html = '';
             const count = runs ? runs.length : 0;
             for (let i = 0; i < maxRuns; i++) {
                 if (!runs || i >= runs.length) continue;
                 const run = runs[i];
                 const s = getRunStats(run.results);
                 const { setupPath, resultPath, usedBasePath } = await getResultPaths(testId, run, `${scenarioName} - ${typeLabel.toLowerCase()}`);
                 let files = [];
                 try { files = await api.getRunFiles(usedBasePath); } catch (e) {}
                 
                 const sessionFile = files.find(f => f.startsWith('session-') && f.endsWith('.html'));
                 const logFile = files.includes('mcp-server.log') ? 'mcp-server.log' : (files.includes('modern-web.log') ? 'modern-web.log' : null);
                 const hasDiff = files.includes('diff.txt');

                 const toolsUsed = run.guidanceToolsUsed || [];
                 const guidesUsed = run.guidesUsed || (run.guideUsed && run.guideUsed.guidesUsed) || [];

                 html += `
                     <div style="background: rgba(255, 255, 255, 0.02); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); flex: 1; min-width: 200px;">
                         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                             <span style="font-size: 0.85rem; font-weight: bold; color: var(--text-primary);">${typeLabel} Run ${i + 1}</span>
                             <span style="font-size: 0.8rem; color: ${getColor(s.rate)};">${s.rate}%</span>
                         </div>
                         <div style="display: flex; flex-direction: column; gap: 4px;">
                             ${sessionFile ? `<button class="secondary-btn" style="font-size: 0.75rem; padding: 4px 6px;" onclick="openTrajectory('${escapeHtml(usedBasePath)}', '${escapeHtml(sessionFile)}')">Trajectory</button>` : ''}
                             ${hasDiff ? `<button class="secondary-btn" style="font-size: 0.75rem; padding: 4px 6px;" onclick="viewContent('${escapeHtml(`${usedBasePath}/diff.txt`)}', '${escapeHtml(`${usedBasePath}/diff.txt`)}')">Diff</button>` : ''}
                             ${logFile ? `<button class="secondary-btn" style="font-size: 0.75rem; padding: 4px 6px;" onclick="viewContent('${escapeHtml(`${usedBasePath}/${logFile}`)}', '${escapeHtml(`${usedBasePath}/${logFile}`)}')">Log</button>` : ''}
                             <button class="secondary-btn" style="font-size: 0.75rem; padding: 4px 6px;" onclick="viewDiff('${escapeHtml(setupPath)}', '${escapeHtml(resultPath)}', '${escapeHtml(scenarioName)}', ${run.runNumber})">Diff Table</button>
                         </div>
                         
                         ${toolsUsed.length > 0 ? `
                         <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem;">
                             <div style="color: var(--text-secondary); margin-bottom: 4px;">Tools Used:</div>
                             <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                 ${toolsUsed.map(t => `<span style="background: rgba(255,255,255,0.05); padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-primary); font-family: monospace;">${escapeHtml(t)}</span>`).join('')}
                             </div>
                         </div>` : ''}
                         
                         ${guidesUsed.length > 0 ? `
                         <div style="margin-top: 8px; font-size: 0.75rem;">
                             <div style="color: var(--text-secondary); margin-bottom: 4px;">Guides Used:</div>
                             <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                 ${guidesUsed.map(g => `<span style="background: rgba(255,255,255,0.05); padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-primary); font-family: monospace;">${escapeHtml(g)}</span>`).join('')}
                             </div>
                         </div>` : ''}
                     </div>
                 `;
             }
             return html;
        };

        const unguidedCards = await getRunCards(unguidedRuns, 'Unguided');
        const guidedCards = await getRunCards(guidedRuns, 'Guided');

        const runsGridHtml = `<div style="display: flex; flex-direction: row; gap: 12px; margin-top: 16px; flex-wrap: wrap;">${unguidedCards}${guidedCards}</div>`;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr; gap: 16px;">
                ${promptHtml}
                ${truthMatrixHtml}
                ${runsGridHtml}
            </div>
        `;

    } catch (e) {
        container.innerHTML = `<div style="color: var(--accent-failure);">Error loading details: ${e.message}</div>`;
    }
}

// Global helper to open details from task list
window.openDetailsFromTask = (scenarioName, testId) => {
    // Attempt to find runData. We might need to fetch it or pass it.
    // If we assume `allTestData` is available globally (it is), we can find it.
    // Wait, and we need to call showDetails. Let's see if we can find any runType for this scenario to pass to showDetails.
    // showDetails expects testName like "AppName - GuideName - RunType".
    // Let's pass "AppName - GuideName - guided" as a default to showDetails if it exists, or unguided.
    const guidedKey = `${scenarioName} - guided`;
    const unguidedKey = `${scenarioName} - unguided`;
    const finalKey = allTestData.results[guidedKey] ? guidedKey : unguidedKey;
    if (allTestData.results[finalKey]) {
        showDetails(finalKey, allTestData.results[finalKey], allTestData.stats[finalKey], testId);
    } else {
        alert('Could not find run data for this task.');
    }
};

function openTrajectory(usedBasePath, sessionFile) {
    if (api.source === 'remote') {
        const finalPath = api.getAbsoluteUrl(`${usedBasePath}/${sessionFile}`);
        api._fetch(finalPath)
            .then(res => { if (!res.ok) throw new Error(); return res.blob(); })
            .then(blob => {
                const htmlBlob = new Blob([blob], { type: 'text/html' });
                const url = URL.createObjectURL(htmlBlob);
                window.open(url, '_blank');
            })
            .catch(e => {
                console.error('Error loading trajectory:', e);
                alert('Failed to load remote trajectory');
            });
    } else {
        window.open(api.getAbsoluteUrl(`${usedBasePath}/${sessionFile}`), '_blank');
    }
}

// Expose functions to window for onclick handlers
window.openTrajectory = openTrajectory;
window.viewContent = viewContent;
window.viewDiff = viewDiff;

async function showDetails(testName, runs, stats, testId) {
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('testName', testName);
    url.searchParams.delete('view');
    url.searchParams.delete('run');
    window.history.replaceState({ testName }, '', url);

    // Store current details for back navigation
    currentDetails = { testName, runs, stats, testId };

    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const contentDiv = document.querySelector('.modal-content');
    const body = document.getElementById('modal-body');
    const [, guide, runType] = testName.split(' - ');

    // Reset modifier classes
    modal.classList.remove('diff-modal');
    contentDiv.classList.remove('diff-modal');
    modal.dataset.view = 'details';

    title.textContent = formatTestName(testName);

    let promptHtml = ''; // Initialize promptHtml outside the map

    const runDetailsPromises = runs.map(async (run) => {
        const s = getRunStats(run.results);
        // Determine file paths for this run
        const { setupPath, resultPath, usedBasePath } = await getResultPaths(testId, run, testName);

        let sessionFile = null;
        let files = [];
        try {
            files = await api.getRunFiles(usedBasePath);
            if (files && files.length > 0) {
                sessionFile = files.find(f => f.startsWith('session-') && f.endsWith('.html'));
            }
        } catch (e) {
            console.log('Error checking run files:', e);
        }

        // Fetch prompt text from the task definition
        if (run === runs[0]) {
            try {
                const isNegative = run.taskName && run.taskName.endsWith('-negative');
                const taskPath = `tasks/${isNegative ? 'negative/' : ''}${run.taskName}.md`;
                const text = await api.getFileText(taskPath);

                // Extract base_app from YAML frontmatter
                const frontmatterMatch = text.match(/^---([\s\S]+?)---/);
                let baseApp = 'n/a';
                if (frontmatterMatch) {
                    const yaml = frontmatterMatch[1];
                    const baseAppMatch = yaml.match(/base_app:\s*([^\n\r]+)/);
                    if (baseAppMatch) {
                        baseApp = baseAppMatch[1].trim();
                    }
                }

                // Strip YAML frontmatter from the markdown task file
                const cleanedText = text.replace(/^---[\s\S]+?---\n+/, '');

                promptHtml = `
                    <div class="prompt-section" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid var(--text-secondary);">
                        <div style="font-size: 0.9em; color: var(--text-secondary); margin-bottom: 10px;">Base App: <strong style="color: var(--text-primary);">${escapeHtml(baseApp)}</strong></div>
                        <div style="font-size: 0.9em; color: var(--text-secondary); margin-bottom: 5px;">Prompt: <strong style="color: var(--text-primary); white-space: pre-wrap; font-family: inherit;">${escapeHtml(cleanedText)}</strong></div>
                    </div>
                `;
            } catch (e) {
                console.log('Task prompt file not found:', e.message);
            }
        }

        let usageSection = '';
        const toolsUsed = run.guidanceToolsUsed || [];
        const expectedTool = run.expectedGuidanceTool;
        const hasToolData = run.guidanceToolsUsed !== undefined;

        const guidesUsed = run.guidesUsed || 
               (run.guideUsed !== undefined ? 
               (typeof run.guideUsed === 'object' && run.guideUsed !== null ? run.guideUsed.guidesUsed : []) 
               : []);
        const expectedGuide = run.expectedGuide || guide;
        const hasGuideData = run.guidesUsed !== undefined || run.guideUsed !== undefined;

        const logFile = files.includes('mcp-server.log') ? 'mcp-server.log' : 'modern-web.log';
        const shouldUseTrajectory = (allTestData.serving ? (allTestData.serving === 'skills' || allTestData.serving === 'skills_cli') : allTestData.enableSkills) && sessionFile;

        if (runType !== 'unguided' && (hasToolData || hasGuideData)) {
            usageSection = `
                <div class="usage-section" style="margin-top: 15px; padding: 12px 15px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${hasToolData ? `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 0.9em; font-weight: 600; color: var(--text-secondary); min-width: 90px;">Tools Used:</strong>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${toolsUsed.length > 0 ? toolsUsed.map(t => {
                                    const isExpected = t === expectedTool;
                                    return `<code style="background: ${isExpected ? 'rgba(0, 200, 0, 0.1)' : 'rgba(255,255,255,0.05)'}; padding: 3px 6px; border-radius: 4px; font-size: 0.85em; border: 1px solid ${isExpected ? 'var(--accent-success)' : 'var(--border-color)'}; color: ${isExpected ? 'var(--accent-success)' : 'var(--text-primary)'}">${escapeHtml(t)}</code>`;
                                }).join('') : '<span style="color: var(--text-secondary); font-style: italic; font-size: 0.85em;">None</span>'}
                            </div>
                        </div>` : ''}

                        ${hasGuideData ? `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 0.9em; font-weight: 600; color: var(--text-secondary); min-width: 90px;">Guides Used:</strong>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${guidesUsed.length > 0 ? guidesUsed.map(g => {
                                    const isExpected = g === expectedGuide;
                                    return `<code style="background: ${isExpected ? 'rgba(0, 200, 0, 0.1)' : 'rgba(255,255,255,0.05)'}; padding: 3px 6px; border-radius: 4px; font-size: 0.85em; border: 1px solid ${isExpected ? 'var(--accent-success)' : 'var(--border-color)'}; color: ${isExpected ? 'var(--accent-success)' : 'var(--text-primary)'}">${escapeHtml(g)}</code>`;
                                }).join('') : '<span style="color: var(--text-secondary); font-style: italic; font-size: 0.85em;">None</span>'}
                            </div>
                        </div>` : ''}

                        <div style="margin-top: 5px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end;">
                            <a href="#" class="view-resources-link" style="font-size: 0.8em; color: var(--text-secondary); text-decoration: underline; opacity: 0.7;">${shouldUseTrajectory ? 'Agent Trajectory' : logFile}</a>
                        </div>
                    </div>
                </div>
            `;
        }

        const runDetail = document.createElement('div');
        runDetail.className = 'run-detail';
        runDetail.innerHTML = `
            <div class="run-header">
                <strong>Run ${run.runNumber}</strong>
                <span style="color: ${getColor(s.rate)}; margin-left: auto; margin-right: 15px;">${s.rate}% Pass (${s.passed}/${s.total})</span>
                <div class="run-actions">
                </div>
            </div>
            <ul class="check-list">
                ${run.results.map(check => `
                    <li class="check-item">
                        <span class="check-status">${check.passed ? '✅' : '❌'}</span>
                        <span class="check-message">${escapeHtml(check.message)}</span>
                    </li>
                `).join('')}
            </ul>
            ${usageSection}
        `;

        const viewResourcesLink = runDetail.querySelector('.view-resources-link');
        if (viewResourcesLink) {
            viewResourcesLink.onclick = (e) => {
                e.preventDefault();
                if (shouldUseTrajectory) {
                    openTrajectory(usedBasePath, sessionFile);
                } else {
                    const resourcesPath = `${usedBasePath}/${logFile}`;
                    viewContent(resourcesPath, resourcesPath);
                }
            };
        }

        const dropdown = document.createElement('select');
        dropdown.className = 'run-actions-dropdown';
        dropdown.style.cssText = 'padding: 4px; font-size: 0.9em; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer;';
        dropdown.innerHTML = '<option value="" disabled selected>Artifacts</option>';

        const sourceOpt = document.createElement('option');
        sourceOpt.value = 'source';
        sourceOpt.textContent = 'App';
        dropdown.appendChild(sourceOpt);

        const diffOpt = document.createElement('option');
        diffOpt.value = 'diff';
        diffOpt.textContent = 'Diff';
        dropdown.appendChild(diffOpt);

        try {
            if (files && files.length > 0) {
                const rawJson = files.find(f => f === `${guide}_results.json`);
                if (rawJson) {
                    const rawOpt = document.createElement('option');
                    rawOpt.value = 'raw';
                    rawOpt.textContent = 'Raw Test Results';
                    dropdown.appendChild(rawOpt);
                }

                if (sessionFile) {
                    const trajOpt = document.createElement('option');
                    trajOpt.value = 'trajectory';
                    trajOpt.textContent = 'Trajectory';
                    dropdown.appendChild(trajOpt);
                }
            }
        } catch (e) {
            console.log('Error displaying options:', e);
        }

        dropdown.onchange = (e) => {
            const val = e.target.value;
            e.target.value = ''; // reset selection
            if (val === 'source') {
                if (api.source === 'remote') {
                    // Open directly via the mTLS domain which handles auth and serves raw HTML
                    window.open(`https://storage.mtls.cloud.google.com/guidance-evals/${resultPath.split('?')[0]}`, '_blank');
                } else {
                    window.open(api.getAbsoluteUrl(resultPath), '_blank');
                }
            } else if (val === 'diff') {
                viewDiff(setupPath, resultPath, testName, run.runNumber);
            } else if (val === 'trajectory' && sessionFile) {
                openTrajectory(usedBasePath, sessionFile);
            } else if (val === 'raw') {
                const rawPath = `${usedBasePath}/${guide}_results.json`;
                viewContent(rawPath, rawPath);
            }
        };

        runDetail.querySelector('.run-actions').appendChild(dropdown);
        return runDetail;
    });

    const runDetails = await Promise.all(runDetailsPromises);
    body.innerHTML = promptHtml; // Insert promptHtml first
    runDetails.forEach(detail => body.appendChild(detail));
    modal.showModal();
}

function renderBackButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '← Back';
    btn.className = 'secondary-btn';
    btn.style.cssText = 'margin-bottom: 20px; padding: 5px 15px; font-size: 0.9em;';
    btn.onclick = () => {
        if (currentDetails) {
            showDetails(currentDetails.testName, currentDetails.runs, currentDetails.stats, currentDetails.testId);
        }
    };
    return btn;
}

async function viewContent(fileName, filePath) {
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const modal = document.getElementById('modal');

    title.textContent = fileName;
    modal.dataset.view = 'content';
    if (!modal.open) modal.showModal();
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading content...</div>';

    body.innerHTML = '';
    body.appendChild(renderBackButton());

    const pre = document.createElement('pre');
    pre.className = 'log-content';
    body.appendChild(pre);

    try {
        const text = await api.getFileText(filePath);
        const lines = text.split('\n');
        const truncated = lines.length > 5000;
        const content = truncated ? lines.slice(0, 5000).join('\n') + '\n\n...[truncated for display]...' : text;
        pre.textContent = content; // escapeHtml not needed if using textContent on a pre
        pre.className = '';

    } catch (e) {
        body.innerHTML = '';
        body.appendChild(renderBackButton());
        const error = document.createElement('div');
        error.style.color = 'var(--accent-failure)';
        error.style.padding = '20px';
        error.textContent = `Error loading file: ${e.message}`;
        body.appendChild(error);
    }
}

async function viewDiff(setupPath, resultPath, testName, runNumber) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'diff');
    url.searchParams.set('run', runNumber);
    window.history.replaceState({}, '', url);

    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const contentDiv = document.querySelector('.modal-content');

    modal.dataset.runNumber = runNumber;

    title.textContent = `Diff: ${formatTestName(testName)} (Run ${runNumber})`;
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Computing diff...</div>';

    // Optional: Make modal wider for diff
    modal.classList.add('diff-modal');
    contentDiv.classList.add('diff-modal');
    modal.dataset.view = 'diff';
    if (!modal.open) modal.showModal();

    try {
        let setupText = null;
        try {
            setupText = await api.getFileText(setupPath);
        } catch (e) {
            // If setup is missing (404), treat as null to show banner
            // If it's a real error, throw
            if (!e.message.includes('404')) {
                throw new Error(`Failed to load setup file: ${setupPath}`);
            }
        }

        const resultText = await api.getFileText(resultPath);

        let diffHtml = '<div class="diff-container">';

        if (setupText === null) {
            diffHtml += `<div style="background-color: rgba(218, 165, 32, 0.2); border-left: 4px solid #daa520; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <span style="font-weight: bold; color: #daa520;">Original file not found.</span> Displaying current file content below.
            </div>`;
            diffHtml += `<pre style="white-space: pre-wrap; margin: 0; color: var(--text-primary); font-family: monospace;">${escapeHtml(resultText)}</pre>`;
        } else {
            const diff = Diff.diffLines(setupText, resultText);

            diff.forEach((part, index) => {
                const colorClass = part.added ? 'diff-added' :
                    part.removed ? 'diff-removed' : 'diff-unchanged';
    
                if (part.added || part.removed) {
                    diffHtml += `<span class="${colorClass}">${escapeHtml(part.value)}</span>`;
                    return;
                }
    
                // Unchanged part
                let lines = part.value.split('\n');
            // If the last element is empty (common with trailing newline), temporarily remove it for counting
            let trailingNewline = false;
            if (lines.length > 0 && lines[lines.length - 1] === '') {
                lines.pop();
                trailingNewline = true;
            }

            const CONTEXT = 3;
            // Only collapse if we save significant space (e.g. > context*2 lines)
            if (lines.length > CONTEXT * 2) {
                const isFirst = index === 0;
                const isLast = index === diff.length - 1;

                let head = '';
                let tail = '';
                let hiddenCount = 0;

                if (isFirst) {
                    const tailLines = lines.slice(-CONTEXT);
                    hiddenCount = lines.length - CONTEXT;
                    tail = tailLines.join('\n') + (trailingNewline ? '\n' : '');
                } else if (isLast) {
                    const headLines = lines.slice(0, CONTEXT);
                    hiddenCount = lines.length - CONTEXT;
                    head = headLines.join('\n') + '\n';
                } else {
                    const headLines = lines.slice(0, CONTEXT);
                    const tailLines = lines.slice(-CONTEXT);
                    hiddenCount = lines.length - (CONTEXT * 2);
                    head = headLines.join('\n') + '\n';
                    tail = tailLines.join('\n') + (trailingNewline ? '\n' : '');
                }

                if (hiddenCount > 0) {
                    if (head) diffHtml += `<span class="${colorClass}">${escapeHtml(head)}</span>`;
                    diffHtml += `<div class="diff-separator">... ${hiddenCount} unchanged lines ...</div>`;
                    if (tail) diffHtml += `<span class="${colorClass}">${escapeHtml(tail)}</span>`;
                    return;
                }
            }

                diffHtml += `<span class="${colorClass}">${escapeHtml(part.value)}</span>`;
            });
        }

        diffHtml += '</div>';

        body.innerHTML = '';
        body.appendChild(renderBackButton());

        const container = document.createElement('div');
        container.innerHTML = diffHtml;
        body.appendChild(container);

    } catch (e) {
        body.innerHTML = '';
        body.appendChild(renderBackButton());
        const error = document.createElement('div');
        error.style.color = 'var(--accent-failure)';
        error.style.padding = '20px';
        error.textContent = `Error loading diff: ${e.message}`;
        body.appendChild(error);
        contentDiv.classList.remove('diff-modal');
    }
}

function renderRadarChart(data, testId) {
    const { labels, guided, unguided } = calculateRadarData(data.results);
    
    if (labels.length < 3) {
        document.getElementById('chart-section').classList.add('hidden');
        return;
    }
    document.getElementById('chart-section').classList.remove('hidden');

    const handlePointClick = (index, type) => {
        const scenarioName = labels[index]; // e.g. "redfield (vague)"
        const runType = type.toLowerCase(); // "guided" or "unguided"

        // Find the original key in the results
        const originalKey = Object.keys(data.results).find(key => {
            const parts = key.split(' - ');
            return `${parts[0]} (${parts[1]})` === scenarioName && parts[2] === runType;
        });

        if (originalKey) {
            const testName = originalKey;
            const runData = data.results[testName];
            const testStats = data.stats[testName];
            showDetails(testName, runData, testStats, testId);
        }
    };

    const datasets = [
        {
            label: 'Unguided',
            data: unguided,
            onClick: handlePointClick
        },
        {
            label: 'Guided',
            data: guided,
            onClick: handlePointClick
        }
    ];

    // Render the Dumbbell Chart
    if (window.dumbbellChart) window.dumbbellChart.container.innerHTML = '';
    window.dumbbellChart = new DumbbellChart('dumbbell-chart', {
        size: 700,
        rowHeight: 30,
        margin: { top: 20, right: 200, bottom: 20, left: 30 }
    });
    window.dumbbellChart.render({ labels, datasets });
}

async function getResultPaths(testId, run, testName) {
    return await api.getResultInfo(testId, run, testName);
}
