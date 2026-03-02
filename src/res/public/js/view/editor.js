/* ═══════════════════════════════════════════════════════════════
   view/editor.js — Editor page DOM, canvas rendering, and UI state.

   Pure view:
   - Canvas drawing (renderGrid via data:gridUpdate)
   - Rule card creation, validation display, delete delegation
   - Play / pause / speed button state
   - Title sync
   - Emits intent events for all actions; never touches WS or state.
   - Listens to data events to update itself.

   No controller imports.
═══════════════════════════════════════════════════════════════ */

import { bus } from '../controller/events.js';

// ── Local UI state (display only) ────────────────────────────

let isPlaying = false;
let speed = 1;

// ── Bindings ──────────────────────────────────────────────────

export function bindEditor() {
    document.getElementById('btn-editor-back')
        .addEventListener('click', () => bus.emit('nav:showView', { viewId: 'view-home' }));

    document.getElementById('system-title')
        .addEventListener('input', e => syncTitle(e.target.value));

    document.getElementById('btn-play')
        .addEventListener('click', () => onPlayState('play'));

    document.getElementById('btn-pause')
        .addEventListener('click', () => onPlayState('pause'));

    document.getElementById('btn-speed-2')
        .addEventListener('click', () => onSpeed(2));

    document.getElementById('btn-speed-10')
        .addEventListener('click', () => onSpeed(10));

    document.getElementById('btn-add-rule')
        .addEventListener('click', addRule);

    document.getElementById('btn-save-system')
        .addEventListener('click', onSaveSystem);

    // Rule-delete delegation — remove card immediately (optimistic), then notify controller.
    document.getElementById('rules-list')
        .addEventListener('click', e => {
            const deleteBtn = e.target.closest('.rule-delete-btn');
            if (!deleteBtn) return;
            const card = deleteBtn.closest('.rule-card');
            if (!card) return;
            const ruleIndex = [...document.querySelectorAll('#rules-list .rule-card')].indexOf(card);
            card.remove();
            updateRuleCount();
            bus.emit('editor:deleteRule', { ruleIndex });
        });
}

// ── Bus subscriptions ─────────────────────────────────────────

bus.on('nav:openEditor', e => openEditor(e.detail.save));

bus.on('data:gridUpdate', e => renderGrid(e.detail.grid));

// TODO: reserved for future optimistic-revert logic if a delete fails server-side.
bus.on('data:ruleDeleted', () => { });

bus.on('data:ruleInvalid', e => {
    const card = document.querySelectorAll('#rules-list .rule-card')[e.detail.ruleIndex];
    if (card) card.classList.add('rule-invalid');
});

bus.on('data:ruleValid', e => {
    const card = document.querySelectorAll('#rules-list .rule-card')[e.detail.ruleIndex];
    if (card) card.classList.remove('rule-invalid');
});

bus.on('data:savePushed', () => {
    const btn = document.getElementById('btn-save-system');
    flashBtn(btn, true);
});

bus.on('data:saveError', () => {
    const btn = document.getElementById('btn-save-system');
    flashBtn(btn, false);
});

bus.on('data:generationTick', e => {
    const el = document.getElementById('editor-gen-counter');
    if (el) el.textContent = 'Gen: ' + e.detail.gen;
});

// ── Public API ────────────────────────────────────────────────

/**
 * Transition to the editor view, pre-filling title from a save.
 * @param {import('../controller/state.js').Save|null} save
 */
export function openEditor(save) {
    const title = save?.title ?? '';
    document.getElementById('system-title').value = title;
    syncTitle(title || 'New System');

    // Clear any existing rule cards and repopulate from the save.
    const list = document.getElementById('rules-list');
    list.querySelectorAll('.rule-card').forEach(c => c.remove());
    (save?.rules ?? []).forEach(rule => insertRuleCard(rule));
    updateRuleCount();

    bus.emit('nav:showView', { viewId: 'view-editor' });
}

// ── Canvas ────────────────────────────────────────────────────

const DEAD_COLOR = '#0f1117';
const ALIVE_COLOR = '#c8f7b0';

/**
 * Paint a boolean[][] grid onto #ca-canvas-editor.
 * @param {boolean[][]} grid
 */
export function renderGrid(grid) {
    const canvas = document.getElementById('ca-canvas-editor');
    if (!canvas || !grid?.length) return;

    const ctx = canvas.getContext('2d');
    const rows = grid.length;
    const cols = grid[0].length;
    const cw = canvas.width / cols;
    const ch = canvas.height / rows;

    ctx.fillStyle = DEAD_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = ALIVE_COLOR;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c]) ctx.fillRect(c * cw, r * ch, Math.max(cw - 1, 1), Math.max(ch - 1, 1));
        }
    }
}

// ── Rule card DOM ─────────────────────────────────────────────

/** Insert a new blank rule card before the Add-Rule button and focus it. */
export function addRule() {
    const card = insertRuleCard('');
    card.querySelector('code').focus();
}

// ── Private helpers ─────────────────────────────────────────

/**
 * Create and insert a rule card with the given text before the Add-Rule button.
 * @param {string} text  Rule text (empty string for a new blank card).
 * @returns {HTMLElement} The inserted card element.
 */
function insertRuleCard(text) {
    const list = document.getElementById('rules-list');
    const addBtn = document.getElementById('btn-add-rule');

    const card = document.createElement('div');
    card.className = 'rule-card';
    card.innerHTML = `
        <code contenteditable="true" spellcheck="false"></code>
        <div class="rule-actions">
            <button class="btn btn-sm btn-outline-secondary" tabindex="-1"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger rule-delete-btn" tabindex="-1"><i class="bi bi-trash3"></i></button>
        </div>`;

    const code = card.querySelector('code');
    if (text) code.textContent = text;
    code.addEventListener('input', debounce(() => {
        const ruleIndex = [...document.querySelectorAll('#rules-list .rule-card')].indexOf(card);
        bus.emit('editor:updateRule', { ruleIndex, rule: code.textContent.trim() });
    }, 400));

    // Enter key: accept edit and exit contenteditable (no newline).
    code.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            code.blur();
        }
    });

    list.insertBefore(card, addBtn);
    updateRuleCount();
    return card;
}

function onSaveSystem() {
    const save = {
        title: document.getElementById('system-title')?.value.trim() || 'Untitled',
        rules: collectRules(),
        grid: [],
    };
    bus.emit('editor:saveSystem', { save });
}

function syncTitle(val) {
    document.getElementById('top-bar-system-name').textContent = val || 'New System';
}

function onPlayState(newState) {
    if (newState === 'play' && !isPlaying) {
        bus.emit('editor:play');
        isPlaying = true;
    } else if (newState === 'pause' && isPlaying) {
        bus.emit('editor:pause');
        isPlaying = false;
    }
    document.getElementById('btn-play').classList.toggle('active', isPlaying);
    document.getElementById('btn-pause').classList.toggle('active', !isPlaying);
}

function onSpeed(mult) {
    speed = (speed === mult) ? 1 : mult;
    bus.emit('editor:setSpeed', { speed });
    document.getElementById('speed-label').textContent = speed + '×';
    ['2', '10'].forEach(s =>
        document.getElementById('btn-speed-' + s)
            .classList.toggle('active', String(speed) === s));
}

function updateRuleCount() {
    const badge = document.getElementById('rule-count-badge');
    if (badge) badge.textContent = document.querySelectorAll('#rules-list .rule-card').length;
}

function collectRules() {
    return [...document.querySelectorAll('#rules-list .rule-card code')]
        .map(el => el.textContent.trim());
}

function flashBtn(btn, success) {
    if (!btn) return;
    const [icon, label, from, to] = success
        ? ['bi-check-lg', 'Saved', 'btn-primary', 'btn-success']
        : ['bi-x-lg', 'Error', 'btn-primary', 'btn-danger'];
    btn.innerHTML = `<i class="bi ${icon}"></i> ${label}`;
    btn.classList.replace('btn-primary', to);
    setTimeout(() => {
        btn.innerHTML = '<i class="bi bi-floppy"></i> Save';
        btn.classList.replace(to, 'btn-primary');
    }, 1800);
}

function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
