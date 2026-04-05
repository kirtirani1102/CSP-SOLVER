/**
 * =============================================
 * UI MODULE - DOM Manipulation & Visualization
 * =============================================
 * 
 * Handles:
 * - Sudoku grid generation and interaction
 * - Tab switching
 * - Step-by-step visualization with animations
 * - Performance metrics display
 * - Algorithm comparison display
 * - Cryptarithmetic puzzle display and mapping
 * - Solving log
 */

const UI = (() => {

    // ---- SUDOKU GRID ----

    /**
     * Generate the 9x9 Sudoku grid with input cells.
     */
    function generateSudokuGrid() {
        const grid = document.getElementById('sudokuGrid');
        grid.innerHTML = '';

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('input');
                cell.type = 'text';
                cell.maxLength = 1;
                cell.className = 'sudoku-cell';
                cell.id = `cell-${r}-${c}`;
                cell.dataset.row = r;
                cell.dataset.col = c;

                // 3x3 box borders
                if (c % 3 === 2 && c < 8) cell.classList.add('border-right');
                if (r % 3 === 2 && r < 8) cell.classList.add('border-bottom');
                if (c % 3 === 0) cell.classList.add('border-left');
                if (r % 3 === 0) cell.classList.add('border-top');

                // Only allow digits 1-9
                cell.addEventListener('input', (e) => {
                    const val = e.target.value;
                    if (!/^[1-9]$/.test(val)) {
                        e.target.value = '';
                    }
                });

                grid.appendChild(cell);
            }
        }
    }

    /**
     * Read the grid values from the DOM.
     * @returns {number[][]} 9x9 array (0 = empty)
     */
    function readGridFromDOM() {
        const grid = [];
        for (let r = 0; r < 9; r++) {
            const row = [];
            for (let c = 0; c < 9; c++) {
                const cell = document.getElementById(`cell-${r}-${c}`);
                const val = parseInt(cell.value);
                row.push(isNaN(val) ? 0 : val);
            }
            grid.push(row);
        }
        return grid;
    }

    /**
     * Write a grid to the DOM (for loading presets or showing solution).
     * @param {number[][]} grid
     * @param {number[][]} [originalGrid] - to mark given cells
     */
    function writeGridToDOM(grid, originalGrid = null) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.getElementById(`cell-${r}-${c}`);
                cell.value = grid[r][c] !== 0 ? grid[r][c] : '';
                cell.classList.remove('given', 'solved', 'cell-assign', 'cell-backtrack', 'cell-domain', 'cell-mrv');

                if (originalGrid && originalGrid[r][c] !== 0) {
                    cell.classList.add('given');
                    cell.readOnly = true;
                } else if (originalGrid && grid[r][c] !== 0) {
                    cell.classList.add('solved');
                } else {
                    cell.readOnly = false;
                }
            }
        }
    }

    /**
     * Clear all cell classes (animation states).
     */
    function clearCellStates() {
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.classList.remove('cell-assign', 'cell-backtrack', 'cell-domain', 'cell-mrv');
        });
    }

    // ---- SUDOKU DOMAIN TRACKING ----

    // Live domain state for the Sudoku grid during solving
    let sudokuDomains = null;
    let selectedSudokuCell = null;

    /**
     * Set up click handlers on Sudoku cells to show their domain.
     */
    function setupSudokuDomainTracking() {
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const r = parseInt(cell.dataset.row);
                const c = parseInt(cell.dataset.col);
                selectedSudokuCell = `${r},${c}`;

                // Highlight the selected cell
                document.querySelectorAll('.sudoku-cell').forEach(cl => cl.classList.remove('cell-selected'));
                cell.classList.add('cell-selected');

                updateSudokuDomainPanel(r, c);
            });
        });
    }

    /**
     * Initialize the domain state from a grid (call before solving or on reset).
     * @param {number[][]} grid
     */
    function initSudokuDomainState(grid) {
        sudokuDomains = new Map();
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const key = `${r},${c}`;
                if (grid[r][c] !== 0) {
                    sudokuDomains.set(key, new Set([grid[r][c]]));
                } else {
                    const possible = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (let cc = 0; cc < 9; cc++) {
                        if (grid[r][cc] !== 0) possible.delete(grid[r][cc]);
                    }
                    for (let rr = 0; rr < 9; rr++) {
                        if (grid[rr][c] !== 0) possible.delete(grid[rr][c]);
                    }
                    const br = Math.floor(r / 3) * 3;
                    const bc = Math.floor(c / 3) * 3;
                    for (let rr = br; rr < br + 3; rr++) {
                        for (let cc = bc; cc < bc + 3; cc++) {
                            if (grid[rr][cc] !== 0) possible.delete(grid[rr][cc]);
                        }
                    }
                    sudokuDomains.set(key, possible);
                }
            }
        }
        selectedSudokuCell = null;
        const domainInfo = document.getElementById('domainInfo');
        domainInfo.innerHTML = '<p class="domain-placeholder">Select a cell to view its domain</p>';
    }

    /**
     * Update the domain panel to show the domain of cell (r, c).
     */
    function updateSudokuDomainPanel(r, c) {
        const domainInfo = document.getElementById('domainInfo');
        const key = `${r},${c}`;

        if (!sudokuDomains || !sudokuDomains.has(key)) {
            domainInfo.innerHTML = '<p class="domain-placeholder">No domain data available. Use Forward Checking or MRV to see domains.</p>';
            return;
        }

        const domain = sudokuDomains.get(key);
        const cellEl = document.getElementById(`cell-${r}-${c}`);
        const cellVal = cellEl ? parseInt(cellEl.value) : 0;

        let html = `<div class="domain-cell-label">Cell (${r}, ${c})`;
        if (cellVal) {
            html += ` — <span style="color:var(--accent-green);font-weight:600">assigned ${cellVal}</span>`;
        }
        html += `</div><div class="domain-cell-info">`;

        for (let d = 1; d <= 9; d++) {
            const inDomain = domain.has(d);
            const isAssigned = d === cellVal;
            let cls = 'domain-badge';
            if (isAssigned) cls += ' domain-assigned';
            else if (!inDomain) cls += ' eliminated';
            html += `<span class="${cls}">${d}</span>`;
        }
        html += '</div>';
        domainInfo.innerHTML = html;
    }

    /**
     * Process a step during animation to update domain panel state.
     */
    function processDomainStep(step) {
        if (!sudokuDomains) return;

        const key = `${step.row},${step.col}`;
        switch (step.type) {
            case 'assign':
                sudokuDomains.set(key, new Set([step.value]));
                break;
            case 'domain':
                if (step.remainingDomain) {
                    sudokuDomains.set(key, new Set(step.remainingDomain));
                }
                break;
        }

        // If the currently selected cell is affected, refresh the panel
        if (selectedSudokuCell === key) {
            const [r, c] = key.split(',').map(Number);
            updateSudokuDomainPanel(r, c);
        }
    }

    /**
     * Clear domain tracking state.
     */
    function clearSudokuDomainState() {
        sudokuDomains = null;
        selectedSudokuCell = null;
        document.querySelectorAll('.sudoku-cell').forEach(cl => cl.classList.remove('cell-selected'));
        const domainInfo = document.getElementById('domainInfo');
        domainInfo.innerHTML = '<p class="domain-placeholder">Select a cell to view its domain</p>';
    }

    /**
     * Reset the Sudoku grid to empty.
     */
    function resetSudokuGrid() {
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.value = '';
            cell.readOnly = false;
            cell.classList.remove('given', 'solved', 'cell-assign', 'cell-backtrack', 'cell-domain', 'cell-mrv');
        });
    }

    // ---- TAB SWITCHING ----

    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName === 'sudoku' ? 'panelSudoku' : 'panelCrypt').classList.add('active');
    }

    // ---- STEP-BY-STEP VISUALIZATION (SUDOKU) ----

    let animationAbortController = null;

    /**
     * Animate solving steps on the Sudoku grid.
     * @param {Array} steps - Array of step objects
     * @param {number[][]} originalGrid - Original puzzle grid
     * @param {number} speed - Delay in ms between steps
     * @param {Function} onComplete - Callback when animation finishes
     * @param {Object} stats - Stats for metrics
     */
    async function animateSudokuSteps(steps, originalGrid, speed, onComplete, stats) {
        // Cancel any previous animation
        if (animationAbortController) animationAbortController.abort();
        animationAbortController = new AbortController();
        const signal = animationAbortController.signal;

        const container = document.querySelector('.sudoku-container');
        container.classList.add('solving');
        const logContainer = document.getElementById('sudokuLog');
        logContainer.innerHTML = '';

        updateSudokuMetrics({ status: 'Solving...', time: '—', steps: 0, backtracks: 0, nodes: 0 });

        let stepCount = 0;
        let backtrackCount = 0;

        for (let i = 0; i < steps.length; i++) {
            if (signal.aborted) return;

            const step = steps[i];
            const cell = document.getElementById(`cell-${step.row}-${step.col}`);
            if (!cell) continue;

            // Clear previous highlights
            clearCellStates();

            // Update domain tracking state
            processDomainStep(step);

            switch (step.type) {
                case 'assign':
                    cell.value = step.value;
                    cell.classList.add('cell-assign');
                    stepCount++;
                    addLogEntry(logContainer, `Assign ${step.value} to (${step.row},${step.col})`, 'log-assign');
                    // Auto-show domain for assigned cell
                    selectedSudokuCell = `${step.row},${step.col}`;
                    document.querySelectorAll('.sudoku-cell').forEach(cl => cl.classList.remove('cell-selected'));
                    cell.classList.add('cell-selected');
                    updateSudokuDomainPanel(step.row, step.col);
                    break;

                case 'backtrack':
                    cell.value = '';
                    cell.classList.add('cell-backtrack');
                    backtrackCount++;
                    addLogEntry(logContainer, `Backtrack (${step.row},${step.col}), remove ${step.value}`, 'log-backtrack');
                    break;

                case 'domain':
                    cell.classList.add('cell-domain');
                    addLogEntry(logContainer,
                        `Domain (${step.row},${step.col}): removed ${step.removedValue}, left [${step.remainingDomain.join(', ')}]`,
                        'log-domain'
                    );
                    // Auto-show domain for the pruned cell
                    selectedSudokuCell = `${step.row},${step.col}`;
                    document.querySelectorAll('.sudoku-cell').forEach(cl => cl.classList.remove('cell-selected'));
                    cell.classList.add('cell-selected');
                    updateSudokuDomainPanel(step.row, step.col);
                    break;

                case 'mrv':
                    cell.classList.add('cell-mrv');
                    addLogEntry(logContainer,
                        `MRV selected (${step.row},${step.col}), domain size: ${step.domainSize}`,
                        'log-mrv'
                    );
                    // Auto-show domain for MRV-selected cell
                    selectedSudokuCell = `${step.row},${step.col}`;
                    document.querySelectorAll('.sudoku-cell').forEach(cl => cl.classList.remove('cell-selected'));
                    cell.classList.add('cell-selected');
                    updateSudokuDomainPanel(step.row, step.col);
                    break;
            }

            updateSudokuMetrics({
                status: 'Solving...',
                time: ((performance.now() - stats.startTime) / 1000).toFixed(2) + 's',
                steps: stepCount,
                backtracks: backtrackCount,
                nodes: stats.nodes
            });

            await delay(speed, signal);
        }

        container.classList.remove('solving');
        clearCellStates();

        if (onComplete) onComplete();
    }

    function delay(ms, signal) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, ms);
            if (signal) {
                signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); });
            }
        });
    }

    function stopAnimation() {
        if (animationAbortController) {
            animationAbortController.abort();
            animationAbortController = null;
        }
    }

    // ---- METRICS ----

    function updateSudokuMetrics({ status, time, steps, backtracks, nodes }) {
        if (status !== undefined) document.getElementById('metricStatus').textContent = status;
        if (time !== undefined) document.getElementById('metricTime').textContent = time;
        if (steps !== undefined) document.getElementById('metricSteps').textContent = steps;
        if (backtracks !== undefined) document.getElementById('metricBacktracks').textContent = backtracks;
        if (nodes !== undefined) document.getElementById('metricNodes').textContent = nodes;
    }

    function updateCryptMetrics({ status, time, steps, backtracks }) {
        if (status !== undefined) document.getElementById('cryptMetricStatus').textContent = status;
        if (time !== undefined) document.getElementById('cryptMetricTime').textContent = time;
        if (steps !== undefined) document.getElementById('cryptMetricSteps').textContent = steps;
        if (backtracks !== undefined) document.getElementById('cryptMetricBacktracks').textContent = backtracks;
    }

    function resetSudokuMetrics() {
        updateSudokuMetrics({ status: 'Ready', time: '—', steps: '—', backtracks: '—', nodes: '—' });
    }

    function resetCryptMetrics() {
        updateCryptMetrics({ status: 'Ready', time: '—', steps: '—', backtracks: '—' });
    }

    // ---- LOG ----

    function addLogEntry(container, text, className = '') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${className}`;
        entry.textContent = text;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }

    function clearLog(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<div class="log-placeholder">Solving log will appear here...</div>';
    }

    // ---- COMPARE ALGORITHMS ----

    function showCompareResults(results) {
        const panel = document.getElementById('comparePanel');
        panel.classList.remove('hidden');
        const table = document.getElementById('compareTable');

        const metrics = ['Time', 'Steps', 'Backtracks', 'Nodes'];
        const keys = ['time', 'steps', 'backtracks', 'nodes'];
        const algos = Object.keys(results);

        let html = `<div class="compare-row header">
            <div class="compare-cell">Metric</div>
            ${algos.map(a => `<div class="compare-cell">${a}</div>`).join('')}
        </div>`;

        for (let i = 0; i < metrics.length; i++) {
            const vals = algos.map(a => results[a].stats[keys[i]]);
            const best = Math.min(...vals);

            html += `<div class="compare-row">
                <div class="compare-cell">${metrics[i]}</div>
                ${algos.map((a, j) => {
                    const val = keys[i] === 'time' ? vals[j].toFixed(2) + 'ms' : vals[j];
                    const isBest = vals[j] === best ? 'compare-winner' : '';
                    return `<div class="compare-cell ${isBest}">${val}</div>`;
                }).join('')}
            </div>`;
        }

        table.innerHTML = html;
    }

    function hideCompareResults() {
        document.getElementById('comparePanel').classList.add('hidden');
    }

    // ---- CRYPTARITHMETIC UI ----

    /**
     * Display the puzzle equation with styled letters.
     */
    function displayCryptEquation(puzzle) {
        const container = document.getElementById('cryptEquation');
        const { operands, result } = puzzle;

        let html = '';
        for (let i = 0; i < operands.length; i++) {
            if (i > 0) html += ' <span style="color:var(--text-muted)">+</span> ';
            for (const ch of operands[i]) {
                html += `<span class="crypt-letter" data-letter="${ch}">${ch}</span>`;
            }
        }
        html += ' <span style="color:var(--text-muted)">=</span> ';
        for (const ch of result) {
            html += `<span class="crypt-letter" data-letter="${ch}">${ch}</span>`;
        }

        container.innerHTML = html;
    }

    /**
     * Set up the mapping grid for unique letters.
     */
    function setupMappingGrid(letters) {
        const grid = document.getElementById('mappingGrid');
        grid.innerHTML = letters.map(letter =>
            `<div class="mapping-item" id="map-${letter}">
                <span class="mapping-letter">${letter}</span>
                <span class="mapping-arrow">↓</span>
                <span class="mapping-digit" id="mapDigit-${letter}">?</span>
            </div>`
        ).join('');
    }

    /**
     * Update a single letter mapping.
     */
    function updateMapping(letter, digit) {
        const item = document.getElementById(`map-${letter}`);
        const digitEl = document.getElementById(`mapDigit-${letter}`);
        if (item && digitEl) {
            digitEl.textContent = digit !== null ? digit : '?';
            if (digit !== null) {
                item.classList.add('mapped');
            } else {
                item.classList.remove('mapped');
            }
        }
    }

    /**
     * Display the full mapping result.
     */
    function showFullMapping(mapping) {
        for (const [letter, digit] of Object.entries(mapping)) {
            updateMapping(letter, digit);
            // Also update the equation display
            document.querySelectorAll(`.crypt-letter[data-letter="${letter}"]`).forEach(el => {
                el.classList.add('assigned');
                // Remove old sub digits
                const existingSub = el.querySelector('.crypt-digit-sub');
                if (existingSub) existingSub.remove();
                const sub = document.createElement('span');
                sub.className = 'crypt-digit-sub';
                sub.textContent = digit;
                el.appendChild(sub);
            });
        }
    }

    /**
     * Clear all mappings.
     */
    function clearMappings(letters) {
        for (const letter of letters) {
            updateMapping(letter, null);
        }
        document.querySelectorAll('.crypt-letter').forEach(el => {
            el.classList.remove('assigned', 'current', 'conflict');
            const sub = el.querySelector('.crypt-digit-sub');
            if (sub) sub.remove();
        });
    }

    /**
     * Setup domain visualization for cryptarithmetic.
     */
    function setupCryptDomains(letters) {
        const container = document.getElementById('cryptDomains');
        container.innerHTML = letters.map(letter => {
            const digits = Array.from({ length: 10 }, (_, i) => i);
            return `<div class="crypt-domain-row" id="cryptDomRow-${letter}">
                <span class="crypt-domain-letter">${letter}</span>
                <div class="crypt-domain-values" id="cryptDomVals-${letter}">
                    ${digits.map(d => `<span class="crypt-domain-val" id="cryptDom-${letter}-${d}">${d}</span>`).join('')}
                </div>
            </div>`;
        }).join('');
    }

    /**
     * Update domain display for a letter (mark eliminated values).
     */
    function updateCryptDomain(letter, remainingDomain) {
        const remaining = new Set(remainingDomain);
        for (let d = 0; d <= 9; d++) {
            const el = document.getElementById(`cryptDom-${letter}-${d}`);
            if (el) {
                if (remaining.has(d)) {
                    el.classList.remove('eliminated');
                } else {
                    el.classList.add('eliminated');
                }
            }
        }
    }

    /**
     * Animate cryptarithmetic solving steps.
     */
    async function animateCryptSteps(steps, puzzle, speed, onComplete, stats) {
        if (animationAbortController) animationAbortController.abort();
        animationAbortController = new AbortController();
        const signal = animationAbortController.signal;

        const logContainer = document.getElementById('cryptLog');
        logContainer.innerHTML = '';
        updateCryptMetrics({ status: 'Solving...', time: '—', steps: 0, backtracks: 0 });

        let stepCount = 0;
        let backtrackCount = 0;

        for (let i = 0; i < steps.length; i++) {
            if (signal.aborted) return;

            const step = steps[i];

            // Clear current highlights
            document.querySelectorAll('.crypt-letter').forEach(el => el.classList.remove('current', 'conflict'));

            switch (step.type) {
                case 'assign':
                    updateMapping(step.letter, step.digit);
                    document.querySelectorAll(`.crypt-letter[data-letter="${step.letter}"]`).forEach(el => {
                        el.classList.add('current', 'assigned');
                        const existingSub = el.querySelector('.crypt-digit-sub');
                        if (existingSub) existingSub.remove();
                        const sub = document.createElement('span');
                        sub.className = 'crypt-digit-sub';
                        sub.textContent = step.digit;
                        el.appendChild(sub);
                    });
                    stepCount++;
                    addLogEntry(logContainer, `Assign ${step.letter} = ${step.digit}`, 'log-assign');
                    break;

                case 'backtrack':
                    updateMapping(step.letter, null);
                    document.querySelectorAll(`.crypt-letter[data-letter="${step.letter}"]`).forEach(el => {
                        el.classList.remove('assigned', 'current');
                        el.classList.add('conflict');
                        const sub = el.querySelector('.crypt-digit-sub');
                        if (sub) sub.remove();
                    });
                    backtrackCount++;
                    addLogEntry(logContainer, `Backtrack ${step.letter}, remove ${step.digit}`, 'log-backtrack');
                    break;

                case 'domain':
                    updateCryptDomain(step.letter, step.remainingDomain);
                    addLogEntry(logContainer,
                        `Domain ${step.letter}: removed ${step.removedValue}, left [${step.remainingDomain.join(',')}]`,
                        'log-domain'
                    );
                    break;

                case 'mrv':
                    document.querySelectorAll(`.crypt-letter[data-letter="${step.letter}"]`).forEach(el => {
                        el.classList.add('current');
                    });
                    addLogEntry(logContainer,
                        `MRV selected ${step.letter}, domain size: ${step.domainSize}`,
                        'log-mrv'
                    );
                    break;
            }

            updateCryptMetrics({
                status: 'Solving...',
                time: ((performance.now() - stats.startTime) / 1000).toFixed(2) + 's',
                steps: stepCount,
                backtracks: backtrackCount
            });

            await delay(speed, signal);
        }

        if (onComplete) onComplete();
    }

    // ---- SPEED HELPERS ----

    /**
     * Convert slider value (1-100) to delay in ms.
     * 1 = 500ms (slowest), 100 = 5ms (fastest)
     */
    function sliderToDelay(value) {
        return Math.max(5, Math.round(505 - value * 5));
    }

    // Public API
    return {
        generateSudokuGrid,
        readGridFromDOM,
        writeGridToDOM,
        resetSudokuGrid,
        clearCellStates,
        switchTab,
        animateSudokuSteps,
        stopAnimation,
        updateSudokuMetrics,
        updateCryptMetrics,
        resetSudokuMetrics,
        resetCryptMetrics,
        clearLog,
        showCompareResults,
        hideCompareResults,
        displayCryptEquation,
        setupMappingGrid,
        updateMapping,
        showFullMapping,
        clearMappings,
        setupCryptDomains,
        updateCryptDomain,
        animateCryptSteps,
        sliderToDelay,
        setupSudokuDomainTracking,
        initSudokuDomainState,
        clearSudokuDomainState
    };

})();
