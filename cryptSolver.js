/**
 * =============================================
 * CRYPTARITHMETIC SOLVER MODULE
 * =============================================
 * 
 * CSP Formulation:
 * - Variables: Each unique letter in the puzzle (e.g., S, E, N, D, M, O, R, Y)
 * - Domains: {0, 1, 2, ..., 9} for each letter
 * - Constraints:
 *   1. AllDifferent: Each letter maps to a unique digit
 *   2. Arithmetic: The sum equation must hold when letters are replaced
 *   3. No leading zeros: First letter of each word cannot be 0
 * 
 * Algorithm: Backtracking with MRV heuristic and Forward Checking
 */

const CryptSolver = (() => {

    /**
     * Parse a cryptarithmetic expression.
     * Supports format: "WORD1 + WORD2 = RESULT" or "WORD1 + WORD2 + WORD3 = RESULT"
     * @param {string} expression - e.g., "SEND + MORE = MONEY"
     * @returns {{ operands: string[], result: string, letters: string[], leadingLetters: Set }}
     */
    function parseExpression(expression) {
        const cleaned = expression.toUpperCase().replace(/\s+/g, '');
        const [left, result] = cleaned.split('=');
        if (!left || !result) throw new Error('Invalid expression. Use format: WORD + WORD = WORD');

        const operands = left.split('+').map(s => s.trim()).filter(s => s.length > 0);
        if (operands.length < 2) throw new Error('Need at least two operands');

        // Extract unique letters
        const allWords = [...operands, result];
        const letterSet = new Set();
        allWords.forEach(w => [...w].forEach(ch => letterSet.add(ch)));
        const letters = [...letterSet];

        if (letters.length > 10) throw new Error('Too many unique letters (max 10)');

        // Leading letters (cannot be zero)
        const leadingLetters = new Set();
        allWords.forEach(w => { if (w.length > 0) leadingLetters.add(w[0]); });

        return { operands, result, letters, leadingLetters };
    }

    /**
     * Convert a word to its numeric value given a letter-to-digit mapping.
     * @param {string} word
     * @param {Map} mapping - letter -> digit
     * @returns {number}
     */
    function wordToNumber(word, mapping) {
        let num = 0;
        for (const ch of word) {
            num = num * 10 + mapping.get(ch);
        }
        return num;
    }

    /**
     * Check if a complete or partial assignment is consistent.
     * For partial: checks columns from right to left with carry propagation.
     * @param {Map} mapping - current letter -> digit mapping
     * @param {Object} puzzle - parsed puzzle
     * @returns {boolean}
     */
    function checkConstraint(mapping, puzzle) {
        const { operands, result } = puzzle;

        // Check if all letters in the equation are assigned
        const allLetters = new Set();
        [...operands, result].forEach(w => [...w].forEach(ch => allLetters.add(ch)));

        for (const ch of allLetters) {
            if (!mapping.has(ch)) return true; // Partial assignment — can't fully check
        }

        // Full check
        const sum = operands.reduce((acc, word) => acc + wordToNumber(word, mapping), 0);
        return sum === wordToNumber(result, mapping);
    }

    /**
     * Solve cryptarithmetic puzzle using backtracking with MRV and forward checking.
     * Records each step for visualization.
     * @param {string} expression - e.g., "SEND + MORE = MONEY"
     * @returns {{ solved: boolean, mapping: Object, steps: Array, stats: Object, puzzle: Object }}
     */
    function solve(expression) {
        const puzzle = parseExpression(expression);
        const { letters, leadingLetters } = puzzle;
        const steps = [];
        const stats = { backtracks: 0, nodes: 0, startTime: performance.now() };

        // Initialize domains
        const domains = new Map();
        for (const letter of letters) {
            if (leadingLetters.has(letter)) {
                domains.set(letter, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])); // No leading zero
            } else {
                domains.set(letter, new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
            }
        }

        const mapping = new Map(); // letter -> digit
        const usedDigits = new Set();
        const unassigned = new Set(letters);

        function backtrack() {
            if (unassigned.size === 0) {
                return checkConstraint(mapping, puzzle);
            }

            // MRV: pick letter with fewest remaining values
            const { key: chosen } = Heuristics.selectMRV(domains, unassigned);
            const [row, col] = [0, 0]; // Not grid-based
            const values = [...domains.get(chosen)].sort((a, b) => a - b);
            stats.nodes++;

            steps.push({ type: 'mrv', letter: chosen, domain: values, domainSize: values.length });

            for (const digit of values) {
                // Uniqueness constraint: digit not already used
                if (usedDigits.has(digit)) continue;

                // Assign
                mapping.set(chosen, digit);
                usedDigits.add(digit);
                unassigned.delete(chosen);
                steps.push({ type: 'assign', letter: chosen, digit });

                // Forward check: remove digit from other domains
                const savedDomains = Heuristics.cloneDomains(domains);
                const { reductions, wipeout } = Heuristics.forwardCheckCrypt(chosen, digit, domains, letters);

                for (const red of reductions) {
                    steps.push({
                        type: 'domain',
                        letter: red.variable,
                        removedValue: red.removedValue,
                        remainingDomain: red.remainingDomain
                    });
                }

                // Partial constraint check (prune early if possible)
                let partialValid = true;
                if (!wipeout) {
                    partialValid = partialCheck(mapping, puzzle);
                }

                if (!wipeout && partialValid && backtrack()) return true;

                // Undo
                for (const [key, val] of savedDomains) domains.set(key, val);
                mapping.delete(chosen);
                usedDigits.delete(digit);
                unassigned.add(chosen);
                stats.backtracks++;
                steps.push({ type: 'backtrack', letter: chosen, digit });
            }
            return false;
        }

        const solved = backtrack();
        stats.time = performance.now() - stats.startTime;
        stats.steps = steps.length;

        // Convert mapping to plain object
        const mappingObj = {};
        if (solved) {
            for (const [letter, digit] of mapping) {
                mappingObj[letter] = digit;
            }
        }

        return { solved, mapping: mappingObj, steps, stats, puzzle };
    }

    /**
     * Partial constraint check: verify assigned columns from right.
     * This prunes the search when we can detect impossibility early.
     */
    function partialCheck(mapping, puzzle) {
        const { operands, result } = puzzle;
        const maxLen = Math.max(...operands.map(w => w.length), result.length);
        let carry = 0;

        for (let col = 0; col < maxLen; col++) {
            let sum = carry;
            let allAssigned = true;

            for (const word of operands) {
                const idx = word.length - 1 - col;
                if (idx >= 0) {
                    const ch = word[idx];
                    if (mapping.has(ch)) {
                        sum += mapping.get(ch);
                    } else {
                        allAssigned = false;
                    }
                }
            }

            const rIdx = result.length - 1 - col;
            if (rIdx >= 0) {
                const rCh = result[rIdx];
                if (mapping.has(rCh)) {
                    if (allAssigned) {
                        if (sum % 10 !== mapping.get(rCh)) return false;
                        carry = Math.floor(sum / 10);
                    }
                } else {
                    allAssigned = false;
                }
            }

            if (!allAssigned) break;
        }
        return true;
    }

    return { solve, parseExpression };

})();
