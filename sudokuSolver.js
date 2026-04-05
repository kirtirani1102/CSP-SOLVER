/**
 * =============================================
 * SUDOKU SOLVER MODULE
 * =============================================
 * 
 * CSP Formulation:
 * - Variables: 81 cells (row, col), each cell is a variable
 * - Domains: {1, 2, 3, 4, 5, 6, 7, 8, 9} for empty cells
 * - Constraints: AllDifferent for each row, column, and 3x3 box
 * 
 * Algorithms:
 * 1. Plain Backtracking: Simple recursive search
 * 2. Forward Checking: Backtracking + domain pruning after each assignment
 * 3. MRV + Forward Checking: MRV variable selection + Forward Checking
 */

const SudokuSolver = (() => {

    /**
     * Check if placing `num` at grid[row][col] is consistent with constraints.
     * Checks row, column, and 3x3 box uniqueness.
     */
    function isValid(grid, row, col, num) {
        // Row constraint
        for (let c = 0; c < 9; c++) {
            if (grid[row][c] === num) return false;
        }
        // Column constraint
        for (let r = 0; r < 9; r++) {
            if (grid[r][col] === num) return false;
        }
        // 3x3 Box constraint
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) {
                if (grid[r][c] === num) return false;
            }
        }
        return true;
    }

    /**
     * Find the next empty cell (left-to-right, top-to-bottom).
     * @returns {[number, number] | null}
     */
    function findEmpty(grid) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0) return [r, c];
            }
        }
        return null;
    }

    // ==============================
    // 1. PLAIN BACKTRACKING
    // ==============================

    /**
     * Solve Sudoku using plain backtracking.
     * Records each step for visualization.
     * @param {number[][]} grid - 9x9 grid (modified in place)
     * @returns {{ solved: boolean, steps: Array, stats: Object }}
     */
    function solveBacktracking(grid) {
        const steps = [];
        const stats = { backtracks: 0, nodes: 0, startTime: performance.now() };

        function backtrack() {
            const empty = findEmpty(grid);
            if (!empty) return true; // All cells filled — solved!

            const [row, col] = empty;
            stats.nodes++;

            for (let num = 1; num <= 9; num++) {
                if (isValid(grid, row, col, num)) {
                    grid[row][col] = num;
                    steps.push({ type: 'assign', row, col, value: num });

                    if (backtrack()) return true;

                    // Backtrack
                    grid[row][col] = 0;
                    stats.backtracks++;
                    steps.push({ type: 'backtrack', row, col, value: num });
                }
            }
            return false;
        }

        const solved = backtrack();
        stats.time = performance.now() - stats.startTime;
        stats.steps = steps.length;
        return { solved, steps, stats };
    }

    // ==============================
    // 2. FORWARD CHECKING
    // ==============================

    /**
     * Solve Sudoku using backtracking with Forward Checking.
     * After each assignment, prune neighbor domains.
     * If any domain becomes empty, backtrack immediately.
     * @param {number[][]} grid - 9x9 grid
     * @returns {{ solved: boolean, steps: Array, stats: Object }}
     */
    function solveForwardChecking(grid) {
        const steps = [];
        const stats = { backtracks: 0, nodes: 0, startTime: performance.now() };

        // Initialize domains
        const domains = Heuristics.initSudokuDomains(grid);

        // Collect unassigned cells
        const unassigned = new Set();
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0) unassigned.add(`${r},${c}`);
            }
        }

        function backtrackFC(domains) {
            if (unassigned.size === 0) return true;

            // Pick first unassigned (ordered)
            let chosen = null;
            for (const key of unassigned) { chosen = key; break; }

            const [row, col] = chosen.split(',').map(Number);
            const values = [...domains.get(chosen)];
            stats.nodes++;

            for (const num of values) {
                if (isValid(grid, row, col, num)) {
                    // Assign
                    grid[row][col] = num;
                    unassigned.delete(chosen);
                    steps.push({ type: 'assign', row, col, value: num });

                    // Forward check — clone domains first
                    const savedDomains = Heuristics.cloneDomains(domains);
                    domains.get(chosen).clear();
                    domains.get(chosen).add(num);

                    const { reductions, wipeout } = Heuristics.forwardCheckSudoku(chosen, num, domains);

                    // Record domain reductions for visualization
                    for (const red of reductions) {
                        const [rr, rc] = red.variable.split(',').map(Number);
                        steps.push({
                            type: 'domain',
                            row: rr, col: rc,
                            removedValue: red.removedValue,
                            remainingDomain: red.remainingDomain
                        });
                    }

                    if (!wipeout && backtrackFC(domains)) return true;

                    // Undo: restore domains
                    for (const [key, val] of savedDomains) domains.set(key, val);
                    grid[row][col] = 0;
                    unassigned.add(chosen);
                    stats.backtracks++;
                    steps.push({ type: 'backtrack', row, col, value: num });
                }
            }
            return false;
        }

        const solved = backtrackFC(domains);
        stats.time = performance.now() - stats.startTime;
        stats.steps = steps.length;
        return { solved, steps, stats };
    }

    // ==============================
    // 3. MRV + FORWARD CHECKING
    // ==============================

    /**
     * Solve Sudoku using MRV heuristic with Forward Checking.
     * Selects the variable with the smallest domain first.
     * @param {number[][]} grid - 9x9 grid
     * @returns {{ solved: boolean, steps: Array, stats: Object }}
     */
    function solveMRV(grid) {
        const steps = [];
        const stats = { backtracks: 0, nodes: 0, startTime: performance.now() };

        const domains = Heuristics.initSudokuDomains(grid);

        const unassigned = new Set();
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (grid[r][c] === 0) unassigned.add(`${r},${c}`);
            }
        }

        function backtrackMRV(domains) {
            if (unassigned.size === 0) return true;

            // MRV: pick variable with fewest remaining values
            const { key: chosen, domainSize } = Heuristics.selectMRV(domains, unassigned);
            if (domainSize === 0) return false; // Wipeout detected

            const [row, col] = chosen.split(',').map(Number);
            const values = [...domains.get(chosen)];
            stats.nodes++;

            // Record MRV selection
            steps.push({ type: 'mrv', row, col, domainSize, domain: values });

            for (const num of values) {
                // Assign
                grid[row][col] = num;
                unassigned.delete(chosen);
                steps.push({ type: 'assign', row, col, value: num });

                // Forward check
                const savedDomains = Heuristics.cloneDomains(domains);
                domains.get(chosen).clear();
                domains.get(chosen).add(num);

                const { reductions, wipeout } = Heuristics.forwardCheckSudoku(chosen, num, domains);

                for (const red of reductions) {
                    const [rr, rc] = red.variable.split(',').map(Number);
                    steps.push({
                        type: 'domain',
                        row: rr, col: rc,
                        removedValue: red.removedValue,
                        remainingDomain: red.remainingDomain
                    });
                }

                if (!wipeout && backtrackMRV(domains)) return true;

                // Undo
                for (const [key, val] of savedDomains) domains.set(key, val);
                grid[row][col] = 0;
                unassigned.add(chosen);
                stats.backtracks++;
                steps.push({ type: 'backtrack', row, col, value: num });
            }
            return false;
        }

        const solved = backtrackMRV(domains);
        stats.time = performance.now() - stats.startTime;
        stats.steps = steps.length;
        return { solved, steps, stats };
    }

    /**
     * Main entry point: solve with specified algorithm.
     * @param {number[][]} grid - 9x9 grid (will be deep-cloned)
     * @param {'backtracking'|'forwardChecking'|'mrv'} algorithm
     * @returns {{ solved: boolean, grid: number[][], steps: Array, stats: Object }}
     */
    function solve(grid, algorithm = 'backtracking') {
        // Deep clone the grid
        const g = grid.map(row => [...row]);

        let result;
        switch (algorithm) {
            case 'forwardChecking':
                result = solveForwardChecking(g);
                break;
            case 'mrv':
                result = solveMRV(g);
                break;
            case 'backtracking':
            default:
                result = solveBacktracking(g);
                break;
        }

        return { ...result, grid: g };
    }

    return { solve, isValid };

})();
