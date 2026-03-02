/* ═══════════════════════════════════════════════════════════════
   view/saves.js — Saves-select page DOM.

   Pure view:
   - Renders #saves-list from a locally held copy of saves.
   - Emits UI-intent events (saves:load, saves:delete, nav:*).
   - Listens for data events (data:savePushed) to re-render.

   No controller imports.
═══════════════════════════════════════════════════════════════ */

import { bus } from '../controller/events.js';

// Local shadow of state.saves — populated via bus events.
let saves = [];
let selectedIndex = -1;

// ── Bindings ──────────────────────────────────────────────────

export function bindSaves() {
    document.getElementById('saves-list')
        .addEventListener('click', e => {
            const row = e.target.closest('.save-row:not(.empty)');
            if (!row) return;
            selectRow(parseInt(row.dataset.saveIndex ?? -1, 10));
        });

    document.getElementById('btn-saves-back')
        .addEventListener('click', () => bus.emit('nav:showView', { viewId: 'view-home' }));

    document.getElementById('btn-delete-save')
        .addEventListener('click', onDelete);

    document.getElementById('btn-load-save')
        .addEventListener('click', onLoad);
}

// ── DOM rendering ─────────────────────────────────────────────

/** Re-render the full #saves-list from the local saves shadow. */
export function renderSavesList(newSaves) {
    if (newSaves !== undefined) saves = newSaves;

    const list = document.getElementById('saves-list');
    if (!list) return;

    list.innerHTML = '';
    const MAX_SLOTS = Math.max(saves.length, 4);

    for (let i = 0; i < MAX_SLOTS; i++) {
        const save = saves[i];
        const row = document.createElement('div');

        if (save) {
            row.className = 'save-row';
            row.dataset.saveIndex = i;
            row.innerHTML = `
                <div class="save-row-info">
                    <div class="save-row-name">${esc(save.title)}</div>
                    <div class="save-row-meta">
                        Rules: ${save.rules.length}&nbsp;·&nbsp;Saved:&nbsp;${save.date ? new Date(save.date).toLocaleDateString() : '—'}
                    </div>
                </div>`;
        } else {
            row.className = 'save-row empty';
            row.innerHTML = `<div class="save-row-info"><div class="save-row-name">— Empty Save —</div></div>`;
        }

        list.appendChild(row);
    }
}

// ── Bus subscriptions ─────────────────────────────────────────

// When a save is pushed (created or updated), re-render.
bus.on('data:savePushed', e => renderSavesList(e.detail.saves));

// ── Private ───────────────────────────────────────────────────

function selectRow(idx) {
    selectedIndex = idx;
    // Compare against data-save-index, not the forEach loop counter,
    // so the correct row is highlighted even if rows are non-contiguous.
    document.querySelectorAll('#saves-list .save-row:not(.empty)')
        .forEach(r => r.classList.toggle('selected', parseInt(r.dataset.saveIndex, 10) === idx));
    document.getElementById('btn-delete-save').disabled = false;
    document.getElementById('btn-load-save').disabled = false;
}

function onLoad() {
    if (selectedIndex < 0) return;
    const save = saves[selectedIndex];
    if (!save) return;
    bus.emit('saves:load', { save });
}

function onDelete() {
    if (selectedIndex < 0) return;
    bus.emit('saves:delete', { index: selectedIndex });
    selectedIndex = -1;
    document.getElementById('btn-delete-save').disabled = true;
    document.getElementById('btn-load-save').disabled = true;
}

function esc(str) {
    return str.replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
