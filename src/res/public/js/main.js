/* ═══════════════════════════════════════════════════════════════
   main.js — Application bootstrap and MVC coordinator.

   This is the ONLY file that imports from both view/ and controller/.
   It is the glue layer of the MVC architecture:

   ┌──────────────────────────────────────────────────────────────┐
   │  View modules (view/*.js)                                    │
   │  • Pure DOM: bind listeners, render, read/write DOM only.   │
   │  • Emit UI-intent events onto the bus.                      │
   │  • Listen to data events from the bus to update themselves. │
   ├──────────────────────────────────────────────────────────────┤
   │                     bus (controller/events.js)               │
   ├──────────────────────────────────────────────────────────────┤
   │  main.js (YOU ARE HERE)                                      │
   │  • Listens to UI-intent events from views.                  │
   │  • Calls controllers (state, ws, cookies).                  │
   │  • Emits data events back to views.                         │
   ├──────────────────────────────────────────────────────────────┤
   │  Controller modules (controller/*.js)                        │
   │  • Pure logic: state, WS, cookies. No DOM. No bus.          │
   └──────────────────────────────────────────────────────────────┘

   Bootstrap sequence (DOMContentLoaded):
   1. Open WebSocket.
   2. Hydrate state.saves from cookie.
   3. Fetch page fragments, inject into #app.
   4. Call bind* in each view module (wires DOM event listeners).
   5. Register WS message → bus.emit pipeline.
   6. Register bus UI-intent → controller call pipeline.
   7. Show home view.
═══════════════════════════════════════════════════════════════ */

// ── Controller imports ────────────────────────────────────────
import { bus } from './controller/events.js';
import { ensureWs, getWs, send, sendAwait } from './controller/ws.js';
import { state } from './controller/state.js';
import {
    readSavesFromCookie, writeSavesToCookie,
    removeSaveFromCookie, getDefaultSave
} from './controller/cookies.js';

// ── View imports (bind only — no logic) ──────────────────────
import { resizeCanvases, showView } from './view/router.js';
import { bindHome } from './view/home.js';
import { bindSaves, renderSavesList } from './view/saves.js';
import { bindEditor } from './view/editor.js';

// ── Page loader ───────────────────────────────────────────────
const PAGES = ['home', 'saves', 'editor'];

async function loadPages() {
    const app = document.getElementById('app');

    const fragments = await Promise.all(
        PAGES.map(name =>
            fetch(`pages/${name}.html`)
                .then(r => { if (!r.ok) throw new Error(`Failed: ${name}.html`); return r.text(); })
        )
    );

    app.innerHTML = fragments.join('\n');

    // Bind view DOM listeners (views know nothing about controllers).
    bindHome();
    bindSaves();
    bindEditor();

    // Seed the saves view with data from state.
    renderSavesList(state.saves);

    showView('view-home');
    window.addEventListener('resize', resizeCanvases);
}

// ── WebSocket → bus pipeline ──────────────────────────────────
// Translates raw server messages into typed data events on the bus.
function attachWsHandlers() {
    const ws = getWs();
    if (!ws) return;

    ws.addEventListener('message', e => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }

        switch (msg.type) {
            case 'GridUpdate':
                bus.emit('data:gridUpdate', { grid: msg.grid });
                break;

            case 'UpdateSave':
                state.activeSave = msg.save;
                break;

            case 'PushSave': {
                const saved = msg.save ?? state.activeSave;
                if (!saved) break;
                upsertSave(saved);
                writeSavesToCookie(state.saves);
                bus.emit('data:savePushed', { save: saved, saves: state.saves });
                break;
            }
        }
    });
}

// ── Bus UI-intent → controller pipeline ──────────────────────
// Translates view intent events into controller calls + data events.
function attachBusHandlers() {

    // ── Navigation ────────────────────────────────────────────
    bus.on('nav:openEditor', e => {
        // Loading a save resets activeSave; opening new does not change it.
        if (e.detail.save) state.activeSave = e.detail.save;
        // The editor view itself handles the nav:openEditor event to fill title.
        // showView is emitted by editor.openEditor → nav:showView.
    });

    // ── Editor actions ────────────────────────────────────────

    bus.on('editor:play', () => {
        if (!state.isPlaying) {
            send('Play');
            state.isPlaying = true;
        }
    });

    bus.on('editor:pause', () => {
        if (state.isPlaying) {
            send('Pause');
            state.isPlaying = false;
        }
    });

    bus.on('editor:setSpeed', e => {
        state.speed = e.detail.speed;
        send('UpdateSpeed', { speed: state.speed });
    });

    bus.on('editor:addRule', () => {
        // Pure DOM action; the view handles this entirely.
        // (No server call needed on add — only on update/delete/save.)
    });

    bus.on('editor:updateRule', async e => {
        const { ruleIndex, rule } = e.detail;
        try {
            const resp = await sendAwait('UpdateRule', { ruleIndex, rule }, ['InvalidRule', 'Success']);
            if (resp.type === 'InvalidRule') {
                bus.emit('data:ruleInvalid', { ruleIndex });
            } else {
                bus.emit('data:ruleValid', { ruleIndex });
            }
        } catch { /* ignore timeout */ }
    });

    bus.on('editor:deleteRule', async e => {
        const { ruleIndex } = e.detail;
        try {
            const resp = await sendAwait('DeleteRule', { ruleIndex }, ['Success', 'Error']);
            if (resp.type === 'Success') bus.emit('data:ruleDeleted', { ruleIndex });
        } catch {
            // Optimistic: remove even on timeout.
            bus.emit('data:ruleDeleted', { ruleIndex });
        }
    });

    bus.on('editor:saveSystem', async e => {
        const save = { ...(state.activeSave ?? {}), ...e.detail.save };
        state.activeSave = save;
        try {
            const resp = await sendAwait('SaveSystem', { save }, ['PushSave', 'Error']);
            if (resp.type === 'PushSave') {
                const saved = resp.save ?? save;
                upsertSave(saved);
                writeSavesToCookie(state.saves);
                bus.emit('data:savePushed', { save: saved, saves: state.saves });
            } else {
                bus.emit('data:saveError');
            }
        } catch (err) {
            console.error('[main] SaveSystem failed', err);
            bus.emit('data:saveError');
        }
    });

    // ── Saves actions ─────────────────────────────────────────

    bus.on('saves:load', e => {
        const { save } = e.detail;
        state.activeSave = save;
        send('LoadSave', { save });
        // Trigger the editor to open via the bus (editor view subscribes to this).
        bus.emit('nav:openEditor', { save });
    });

    bus.on('saves:delete', e => {
        removeSaveFromCookie(state.saves, e.detail.index);
        bus.emit('data:savePushed', { save: null, saves: state.saves });
    });
}

// ── External hook (replaces window.caUpdateGeneration) ───────
window.caUpdateGeneration = gen => bus.emit('data:generationTick', { gen });

// ── Private helpers ───────────────────────────────────────────

function upsertSave(save) {
    const idx = state.saves.findIndex(s => s.title === save.title);
    if (idx >= 0) state.saves[idx] = save;
    else state.saves.push(save);
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    ensureWs();

    // Hydrate state from cookie before rendering.
    // On first visit (no cookie), install the built-in Conway's Game of Life save.
    const cookieSaves = readSavesFromCookie();
    if (cookieSaves?.length) {
        state.saves = cookieSaves;
    } else {
        const defaultSave = getDefaultSave();
        state.saves = [defaultSave];
        writeSavesToCookie(state.saves);
    }

    // Attach bus wiring before pages load (so events are not lost).
    attachBusHandlers();

    // Attach WS handlers once the socket is open.
    // Use the return value of ensureWs() — already called above — for a guaranteed non-null ref.
    const ws = ensureWs();
    if (ws.readyState === WebSocket.OPEN) attachWsHandlers();
    else ws.addEventListener('open', attachWsHandlers, { once: true });

    loadPages();
});
