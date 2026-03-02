/* ═══════════════════════════════════════════════════════════════
   view/router.js — Shared view utilities.

   Listens for navigation events from the bus; no controller imports.
═══════════════════════════════════════════════════════════════ */

import { bus } from '../controller/events.js';

/**
 * Show one view panel, hide all others.
 * @param {'view-home'|'view-saves'|'view-editor'} id
 */
export function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    resizeCanvases();
}

/** Fit #ca-canvas-editor to its wrapper's current bounding rect. */
export function resizeCanvases() {
    const el = document.getElementById('ca-canvas-editor');
    if (!el) return;
    const rect = el.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        el.width = Math.floor(rect.width);
        el.height = Math.floor(rect.height);
    }
    if (typeof window.caOnResize === 'function') window.caOnResize();
}

// ── Bus subscriptions ─────────────────────────────────────────

bus.on('nav:showView', e => showView(e.detail.viewId));
// TODO: nav:openEditor is handled in editor.js (openEditor) and this empty
// subscription is intentionally a no-op placeholder for future router-level
// pre-navigation hooks (e.g. guard checks, analytics).
bus.on('nav:openEditor', () => { });
