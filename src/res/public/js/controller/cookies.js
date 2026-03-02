const COOKIE_KEY = 'ca_saves';

// ── Default save ──────────────────────────────────────────────
/**
 * Returns a fresh copy of the built-in Conway's Game of Life save,
 * with the creation date set to the moment it is first installed.
 *
 * @returns {import('./state.js').Save}
 */
export function getDefaultSave() {
    return {
        title: "Conway's Game of Life",
        date: new Date().toISOString(),
        rules: [
            'IF (cell.state == alive && cell.neighbors.alive < 2) THEN cell.state = dead',
            'IF (cell.state == alive && (cell.neighbors.alive >= 2 && cell.neighbors.alive <= 3)) THEN cell.state = alive',
            'IF (cell.state == alive && cell.neighbors.alive > 3) THEN cell.state = dead',
            'IF (cell.state == dead && cell.neighbors.alive == 3) THEN cell.state = alive',
        ],
        grid: [],
    };
}

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Persist the given saves array to the cookie. */
export function writeSavesToCookie(saves) {
    document.cookie =
        `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(saves))}; path=/; max-age=${MAX_AGE}`;
}

/** Read and parse the saves cookie. Returns null if absent or malformed. */
export function readSavesFromCookie() {
    const entry = document.cookie.split('; ').find(c => c.startsWith(COOKIE_KEY + '='));
    if (!entry) return null;
    try {
        return JSON.parse(decodeURIComponent(entry.split('=').slice(1).join('=')));
    } catch {
        return null;
    }
}

/**
 * Remove one save by index from the cookie in-place.
 * Mutates and re-persists the provided saves array.
 *
 * @param {Save[]} saves - The live saves array. Mutated in place.
 * @param {number} index
 */
export function removeSaveFromCookie(saves, index) {
    saves.splice(index, 1);
    writeSavesToCookie(saves);
}
