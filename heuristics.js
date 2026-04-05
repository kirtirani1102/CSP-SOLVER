/**
 * =============================================
 * HEURISTICS MODULE - MRV & Forward Checking
 * =============================================
 * 
 * CSP Heuristics:
 * - MRV (Minimum Remaining Values): Select the unassigned variable
 *   with the fewest legal values in its domain. This "fail-first"
 *   strategy prunes the search tree early.
 * 
 * - Forward Checking: After assigning a value to a variable,
 *   immediately remove inconsistent values from the domains
 *   of all neighboring (constrained) variables. If any domain
 *   becomes empty, backtrack immediately.
 */

const Heuristics = (() => {

    // ---- DOMAIN MANAGEMENT ----

    /**
     * Initialize domains for a Sudoku grid.
     * For each empty cell, domain = {1..9} minus values already in its row/col/box.
     * For given cells, domain = {given value}.
     * @param {number[][]} grid - 9x9 Sudoku grid (0 = empty)
     * @returns {Map} Map of "row,col" -> Set of possible values
     */
    function initSudokuDomains(grid) {
        const domains = new Map();
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const key = `${r},${c}`;
                if (grid[r][c] !== 0) {
                    domains.set(key, new Set([grid[r][c]]));
                } else {
                    const possible = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    // Remove values in same row
                    for (let cc = 0; cc < 9; cc++) {
                        if (grid[r][cc] !== 0) possible.delete(grid[r][cc]);
                    }
                    // Remove values in same column
                    for (let rr = 0; rr < 9; rr++) {
                        if (grid[rr][c] !== 0) possible.delete(grid[rr][c]);
                    }
                    // Remove values in same 3x3 box
                    const br = Math.floor(r / 3) * 3;
                    const bc = Math.floor(c / 3) * 3;
                    for (let rr = br; rr < br + 3; rr++) {
                        for (let cc = bc; cc < bc + 3; cc++) {
                            if (grid[rr][cc] !== 0) possible.delete(grid[rr][cc]);
                        }
                    }
                    domains.set(key, possible);
                }
            }
        }
        return domains;
    }

    /**
     * Deep clone a domains Map (Map of string -> Set).
     */
    function cloneDomains(domains) {
        const clone = new Map();
        for (const [key, vals] of domains) {
            clone.set(key, new Set(vals));
        }
        return clone;
    }

    // ---- MRV HEURISTIC ----

    /**
     * MRV: Select the unassigned variable with the smallest domain.
     * @param {Map} domains - Current domains
     * @param {Set} unassigned - Set of unassigned variable keys
     * @returns {{ key: string, domainSize: number }} The chosen variable
     */
    function selectMRV(domains, unassigned) {
        let best = null;
        let bestSize = Infinity;
        for (const key of unassigned) {
            const size = domains.get(key).size;
            if (size < bestSize) {
                bestSize = size;
                best = key;
            }
        }
        return { key: best, domainSize: bestSize };
    }

    // ---- FORWARD CHECKING (Sudoku) ----

    /**
     * Get all neighbors (peers) of a Sudoku cell — cells sharing row, col, or box.
     * @param {string} key - "row,col" format
     * @returns {string[]} Array of neighbor keys
     */
    function getSudokuNeighbors(key) {
        const [r, c] = key.split(',').map(Number);
        const neighbors = new Set();
        // Same row
        for (let cc = 0; cc < 9; cc++) if (cc !== c) neighbors.add(`${r},${cc}`);
        // Same column
        for (let rr = 0; rr < 9; rr++) if (rr !== r) neighbors.add(`${rr},${c}`);
        // Same box
        const br = Math.floor(r / 3) * 3;
        const bc = Math.floor(c / 3) * 3;
        for (let rr = br; rr < br + 3; rr++) {
            for (let cc = bc; cc < bc + 3; cc++) {
                if (rr !== r || cc !== c) neighbors.add(`${rr},${cc}`);
            }
        }
        return [...neighbors];
    }

    /**
     * Forward Checking for Sudoku: After assigning `value` to `key`,
     * remove `value` from all neighbor domains.
     * Returns the list of domain reductions (for visualization), or null if wipeout.
     * @param {string} key - The assigned variable
     * @param {number} value - The assigned value
     * @param {Map} domains - Current domains (MODIFIED in place)
     * @returns {{ reductions: Array, wipeout: boolean }}
     */
    function forwardCheckSudoku(key, value, domains) {
        const neighbors = getSudokuNeighbors(key);
        const reductions = [];
        for (const nKey of neighbors) {
            const nDomain = domains.get(nKey);
            if (nDomain && nDomain.has(value)) {
                nDomain.delete(value);
                reductions.push({
                    variable: nKey,
                    removedValue: value,
                    remainingDomain: [...nDomain]
                });
                if (nDomain.size === 0) {
                    return { reductions, wipeout: true };
                }
            }
        }
        return { reductions, wipeout: false };
    }

    // ---- FORWARD CHECKING (Cryptarithmetic) ----

    /**
     * Forward Checking for Cryptarithmetic: After assigning `digit` to `letter`,
     * remove `digit` from all other unassigned letter domains (uniqueness constraint).
     * @param {string} letter - The assigned letter
     * @param {number} digit - The assigned digit
     * @param {Map} domains - Map of letter -> Set of possible digits (MODIFIED in place)
     * @param {string[]} allLetters - All letters in the puzzle
     * @returns {{ reductions: Array, wipeout: boolean }}
     */
    function forwardCheckCrypt(letter, digit, domains, allLetters) {
        const reductions = [];
        for (const otherLetter of allLetters) {
            if (otherLetter === letter) continue;
            const dom = domains.get(otherLetter);
            if (dom && dom.has(digit)) {
                dom.delete(digit);
                reductions.push({
                    variable: otherLetter,
                    removedValue: digit,
                    remainingDomain: [...dom]
                });
                if (dom.size === 0) {
                    return { reductions, wipeout: true };
                }
            }
        }
        return { reductions, wipeout: false };
    }

    // Public API
    return {
        initSudokuDomains,
        cloneDomains,
        selectMRV,
        getSudokuNeighbors,
        forwardCheckSudoku,
        forwardCheckCrypt
    };

})();
