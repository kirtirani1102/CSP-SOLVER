/**
 * =============================================
 * MAIN MODULE - App Initialization & Wiring
 * =============================================
 * 
 * Connects all modules together:
 * - Event listeners for buttons, tabs, sliders
 * - Difficulty preset puzzles
 * - Solve/Reset/Compare logic
 */

(function () {
    'use strict';

    // ---- DIFFICULTY PRESETS ----
    const PRESETS = {
        easy: [
            [5,3,0,0,7,0,0,0,0],
            [6,0,0,1,9,5,0,0,0],
            [0,9,8,0,0,0,0,6,0],
            [8,0,0,0,6,0,0,0,3],
            [4,0,0,8,0,3,0,0,1],
            [7,0,0,0,2,0,0,0,6],
            [0,6,0,0,0,0,2,8,0],
            [0,0,0,4,1,9,0,0,5],
            [0,0,0,0,8,0,0,7,9]
        ],
        medium: [
            [0,0,0,6,0,0,4,0,0],
            [7,0,0,0,0,3,6,0,0],
            [0,0,0,0,9,1,0,8,0],
            [0,0,0,0,0,0,0,0,0],
            [0,5,0,1,8,0,0,0,3],
            [0,0,0,3,0,6,0,4,5],
            [0,4,0,2,0,0,0,6,0],
            [9,0,3,0,0,0,0,0,0],
            [0,2,0,0,0,0,1,0,0]
        ],
        hard: [
            [0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,3,0,8,5],
            [0,0,1,0,2,0,0,0,0],
            [0,0,0,5,0,7,0,0,0],
            [0,0,4,0,0,0,1,0,0],
            [0,9,0,0,0,0,0,0,0],
            [5,0,0,0,0,0,0,7,3],
            [0,0,2,0,1,0,0,0,0],
            [0,0,0,0,4,0,0,0,9]
        ],
        expert: [
            [8,0,0,0,0,0,0,0,0],
            [0,0,3,6,0,0,0,0,0],
            [0,7,0,0,9,0,2,0,0],
            [0,5,0,0,0,7,0,0,0],
            [0,0,0,0,4,5,7,0,0],
            [0,0,0,1,0,0,0,3,0],
            [0,0,1,0,0,0,0,6,8],
            [0,0,8,5,0,0,0,1,0],
            [0,9,0,0,0,0,4,0,0]
        ]
    };

    // ---- STATE ----
    let currentAlgo = 'backtracking';
    let currentDifficulty = 'easy';
    let currentOriginalGrid = null;
    let isSolving = false;

    // ---- INITIALIZATION ----
    function init() {
        UI.generateSudokuGrid();
        UI.setupSudokuDomainTracking();
        loadPreset('easy');
        setupEventListeners();
        setupCryptDefaults();
    }

    // ---- EVENT LISTENERS ----
    function setupEventListeners() {
        // Tabs
        document.getElementById('tabSudoku').addEventListener('click', () => UI.switchTab('sudoku'));
        document.getElementById('tabCrypt').addEventListener('click', () => UI.switchTab('crypt'));

        // Difficulty presets
        document.querySelectorAll('[data-difficulty]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-difficulty]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentDifficulty = btn.dataset.difficulty;
                loadPreset(currentDifficulty);
            });
        });

        // Algorithm selection
        document.querySelectorAll('[data-algo]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-algo]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentAlgo = btn.dataset.algo;
            });
        });

        // Solve Sudoku
        document.getElementById('btnSolveSudoku').addEventListener('click', solveSudoku);

        // Reset Sudoku
        document.getElementById('btnResetSudoku').addEventListener('click', resetSudoku);

        // Speed slider
        document.getElementById('speedSlider').addEventListener('input', (e) => {
            const delay = UI.sliderToDelay(parseInt(e.target.value));
            document.getElementById('speedValue').textContent = delay + 'ms';
        });

        document.getElementById('speedSliderCrypt').addEventListener('input', (e) => {
            const delay = UI.sliderToDelay(parseInt(e.target.value));
            document.getElementById('speedValueCrypt').textContent = delay + 'ms';
        });

        // Compare toggle
        document.getElementById('toggleCompare').addEventListener('change', (e) => {
            if (!e.target.checked) UI.hideCompareResults();
        });

        // Cryptarithmetic presets
        document.querySelectorAll('[data-puzzle]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-puzzle]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('cryptInput').value = btn.dataset.puzzle;
                setupCryptPuzzle(btn.dataset.puzzle);
            });
        });

        // Solve Crypt
        document.getElementById('btnSolveCrypt').addEventListener('click', solveCrypt);

        // Reset Crypt
        document.getElementById('btnResetCrypt').addEventListener('click', resetCrypt);

        // Crypt input change
        document.getElementById('cryptInput').addEventListener('change', (e) => {
            if (e.target.value.trim()) {
                document.querySelectorAll('[data-puzzle]').forEach(b => b.classList.remove('active'));
                setupCryptPuzzle(e.target.value.trim());
            }
        });
    }

    // ---- SUDOKU LOGIC ----

    function loadPreset(difficulty) {
        // Hide any previous unsolvable toast
        hideUnsolvableToast();

        if (difficulty === 'custom') {
            // Clear the grid for manual input
            UI.resetSudokuGrid();
            currentOriginalGrid = null;
            UI.resetSudokuMetrics();
            UI.updateSudokuMetrics({ status: 'Custom Input' });
            UI.clearLog('sudokuLog');
            UI.hideCompareResults();
            UI.stopAnimation();
            // Show helper message in log
            const logContainer = document.getElementById('sudokuLog');
            logContainer.innerHTML = '<div class="log-entry log-mrv">Enter digits 1-9 in the grid, then press Solve.</div><div class="log-entry">Empty cells will be solved by the AI.</div>';
            return;
        }
        const grid = PRESETS[difficulty].map(row => [...row]);
        currentOriginalGrid = grid.map(row => [...row]);
        UI.writeGridToDOM(grid, currentOriginalGrid);
        UI.initSudokuDomainState(grid);
        UI.resetSudokuMetrics();
        UI.clearLog('sudokuLog');
        UI.hideCompareResults();
        UI.stopAnimation();
    }

    function solveSudoku() {
        if (isSolving) return;
        isSolving = true;

        const grid = UI.readGridFromDOM();
        currentOriginalGrid = grid.map(row => [...row]);

        // Initialize domain state for this solve
        UI.initSudokuDomainState(grid);

        const isStepByStep = document.getElementById('toggleStepSudoku').checked;
        const isCompare = document.getElementById('toggleCompare').checked;
        const speed = UI.sliderToDelay(parseInt(document.getElementById('speedSlider').value));

        // Disable buttons during solving
        document.getElementById('btnSolveSudoku').disabled = true;

        if (isCompare) {
            runComparison(grid);
            return;
        }

        const result = SudokuSolver.solve(grid, currentAlgo);

        if (!result.solved) {
            UI.updateSudokuMetrics({
                status: 'Not Solvable ✗',
                time: result.stats.time.toFixed(2) + 'ms',
                steps: result.stats.steps,
                backtracks: result.stats.backtracks,
                nodes: result.stats.nodes
            });
            showUnsolvableToast();
            // Log details
            const logContainer = document.getElementById('sudokuLog');
            logContainer.innerHTML = '';
            logContainer.innerHTML = `
                <div class="log-entry log-backtrack">❌ This puzzle has no valid solution.</div>
                <div class="log-entry log-backtrack">The given constraints are contradictory.</div>
                <div class="log-entry">Nodes explored: ${result.stats.nodes}</div>
                <div class="log-entry">Backtracks: ${result.stats.backtracks}</div>
                <div class="log-entry">Time: ${result.stats.time.toFixed(2)}ms</div>
            `;
            isSolving = false;
            document.getElementById('btnSolveSudoku').disabled = false;
            return;
        }

        if (isStepByStep) {
            UI.animateSudokuSteps(result.steps, currentOriginalGrid, speed, () => {
                UI.writeGridToDOM(result.grid, currentOriginalGrid);
                UI.updateSudokuMetrics({
                    status: 'Solved ✓',
                    time: result.stats.time.toFixed(2) + 'ms',
                    steps: result.stats.steps,
                    backtracks: result.stats.backtracks,
                    nodes: result.stats.nodes
                });
                isSolving = false;
                document.getElementById('btnSolveSudoku').disabled = false;
            }, result.stats);
        } else {
            UI.writeGridToDOM(result.grid, currentOriginalGrid);
            UI.updateSudokuMetrics({
                status: 'Solved ✓',
                time: result.stats.time.toFixed(2) + 'ms',
                steps: result.stats.steps,
                backtracks: result.stats.backtracks,
                nodes: result.stats.nodes
            });
            // Show log summary
            const logContainer = document.getElementById('sudokuLog');
            logContainer.innerHTML = '';
            const totalAssigns = result.steps.filter(s => s.type === 'assign').length;
            const totalBts = result.steps.filter(s => s.type === 'backtrack').length;
            logContainer.innerHTML = `
                <div class="log-entry log-assign">Total assignments: ${totalAssigns}</div>
                <div class="log-entry log-backtrack">Total backtracks: ${totalBts}</div>
                <div class="log-entry log-mrv">Algorithm: ${currentAlgo}</div>
                <div class="log-entry">Time: ${result.stats.time.toFixed(2)}ms</div>
            `;
            isSolving = false;
            document.getElementById('btnSolveSudoku').disabled = false;
        }
    }

    function runComparison(grid) {
        const algorithms = ['backtracking', 'forwardChecking', 'mrv'];
        const results = {};

        for (const algo of algorithms) {
            const g = grid.map(row => [...row]);
            results[algo] = SudokuSolver.solve(g, algo);
        }

        // Show comparison table
        const algoNames = { backtracking: 'BT', forwardChecking: 'FC', mrv: 'MRV+FC' };
        const namedResults = {};
        for (const algo of algorithms) {
            namedResults[algoNames[algo]] = results[algo];
        }
        UI.showCompareResults(namedResults);

        // Show the MRV solution on the grid
        const best = results['mrv'];
        UI.writeGridToDOM(best.grid, currentOriginalGrid);
        UI.updateSudokuMetrics({
            status: 'Compared ✓',
            time: best.stats.time.toFixed(2) + 'ms',
            steps: best.stats.steps,
            backtracks: best.stats.backtracks,
            nodes: best.stats.nodes
        });

        isSolving = false;
        document.getElementById('btnSolveSudoku').disabled = false;
    }

    function resetSudoku() {
        UI.stopAnimation();
        hideUnsolvableToast();
        UI.clearSudokuDomainState();
        if (currentDifficulty === 'custom') {
            UI.resetSudokuGrid();
            currentOriginalGrid = null;
            UI.resetSudokuMetrics();
            UI.updateSudokuMetrics({ status: 'Custom Input' });
            UI.clearLog('sudokuLog');
            const logContainer = document.getElementById('sudokuLog');
            logContainer.innerHTML = '<div class="log-entry log-mrv">Enter digits 1-9 in the grid, then press Solve.</div><div class="log-entry">Empty cells will be solved by the AI.</div>';
        } else {
            loadPreset(currentDifficulty);
        }
        isSolving = false;
        document.getElementById('btnSolveSudoku').disabled = false;
    }

    // ---- UNSOLVABLE TOAST ----
    function showUnsolvableToast() {
        hideUnsolvableToast();
        const toast = document.createElement('div');
        toast.id = 'unsolvableToast';
        toast.className = 'unsolvable-toast';
        toast.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="10" stroke="#FF5252" stroke-width="2"/>
                <line x1="7" y1="7" x2="15" y2="15" stroke="#FF5252" stroke-width="2" stroke-linecap="round"/>
                <line x1="15" y1="7" x2="7" y2="15" stroke="#FF5252" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <div>
                <strong>Not Solvable</strong>
                <span>This puzzle has no valid solution. Please check your input.</span>
            </div>
        `;
        document.body.appendChild(toast);
        // Trigger animation
        requestAnimationFrame(() => toast.classList.add('show'));
    }

    function hideUnsolvableToast() {
        const existing = document.getElementById('unsolvableToast');
        if (existing) existing.remove();
    }

    // ---- CRYPTARITHMETIC LOGIC ----

    let currentCryptPuzzle = null;

    function setupCryptDefaults() {
        const defaultPuzzle = 'SEND + MORE = MONEY';
        document.getElementById('cryptInput').value = defaultPuzzle;
        setupCryptPuzzle(defaultPuzzle);
    }

    function setupCryptPuzzle(expression) {
        try {
            const puzzle = CryptSolver.parseExpression(expression);
            currentCryptPuzzle = puzzle;
            UI.displayCryptEquation(puzzle);
            UI.setupMappingGrid(puzzle.letters);
            UI.setupCryptDomains(puzzle.letters);
            UI.resetCryptMetrics();
            UI.clearLog('cryptLog');
        } catch (e) {
            document.getElementById('cryptEquation').innerHTML =
                `<span style="color:var(--accent-red);font-size:0.9rem">${e.message}</span>`;
        }
    }

    function solveCrypt() {
        if (isSolving) return;
        isSolving = true;

        const expression = document.getElementById('cryptInput').value.trim();
        if (!expression) return;

        document.getElementById('btnSolveCrypt').disabled = true;

        const isStepByStep = document.getElementById('toggleStepCrypt').checked;
        const speed = UI.sliderToDelay(parseInt(document.getElementById('speedSliderCrypt').value));

        const result = CryptSolver.solve(expression);

        if (!result.solved) {
            UI.updateCryptMetrics({
                status: 'No Solution',
                time: result.stats.time.toFixed(2) + 'ms',
                steps: result.stats.steps,
                backtracks: result.stats.backtracks
            });
            isSolving = false;
            document.getElementById('btnSolveCrypt').disabled = false;
            return;
        }

        if (isStepByStep) {
            UI.animateCryptSteps(result.steps, result.puzzle, speed, () => {
                UI.showFullMapping(result.mapping);
                UI.updateCryptMetrics({
                    status: 'Solved ✓',
                    time: result.stats.time.toFixed(2) + 'ms',
                    steps: result.stats.steps,
                    backtracks: result.stats.backtracks
                });
                isSolving = false;
                document.getElementById('btnSolveCrypt').disabled = false;
            }, result.stats);
        } else {
            UI.showFullMapping(result.mapping);
            UI.updateCryptMetrics({
                status: 'Solved ✓',
                time: result.stats.time.toFixed(2) + 'ms',
                steps: result.stats.steps,
                backtracks: result.stats.backtracks
            });

            const logContainer = document.getElementById('cryptLog');
            logContainer.innerHTML = '';
            const entries = Object.entries(result.mapping);
            for (const [letter, digit] of entries) {
                logContainer.innerHTML += `<div class="log-entry log-assign">${letter} = ${digit}</div>`;
            }
            logContainer.innerHTML += `<div class="log-entry">Time: ${result.stats.time.toFixed(2)}ms</div>`;
            logContainer.innerHTML += `<div class="log-entry log-backtrack">Backtracks: ${result.stats.backtracks}</div>`;

            isSolving = false;
            document.getElementById('btnSolveCrypt').disabled = false;
        }
    }

    function resetCrypt() {
        UI.stopAnimation();
        const expression = document.getElementById('cryptInput').value.trim();
        if (expression) {
            setupCryptPuzzle(expression);
        }
        isSolving = false;
        document.getElementById('btnSolveCrypt').disabled = false;
    }

    // ---- BOOT ----
    document.addEventListener('DOMContentLoaded', init);

})();
