/**
 * @typedef {{ title: string, date: string, rules: string[], grid: boolean[][] }} Save
 */
export const state = {
    /** @type {Save[]} */
    saves: [],

    /** @type {Save|null} */
    activeSave: null,

    // Whether the simulation is currently playing.
    isPlaying: false,

    // Current speed multiplier
    speed: 1,
};
