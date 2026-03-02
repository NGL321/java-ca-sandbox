/* ═══════════════════════════════════════════════════════════════
   controller/events.js — Lightweight application event bus.

   A thin wrapper around a single EventTarget so every module can
   publish and subscribe to named events without knowing about each
   other.  All application events flow through this singleton.

   Usage:
     import { bus } from '../controller/events.js';

     // publish
     bus.emit('nav:showView', { viewId: 'view-home' });

     // subscribe (returns the handler so you can removeEventListener)
     bus.on('data:gridUpdate', e => renderGrid(e.detail.grid));
═══════════════════════════════════════════════════════════════ */

const target = new EventTarget();

export const bus = {
    /**
     * Subscribe to an application event.
     * @template T
     * @param {string} name
     * @param {(e: CustomEvent<T>) => void} handler
     */
    on(name, handler) {
        target.addEventListener(name, handler);
        return handler; // convenient for later removal
    },

    /**
     * Unsubscribe a previously registered handler.
     * @param {string} name
     * @param {Function} handler
     */
    off(name, handler) {
        target.removeEventListener(name, handler);
    },

    /**
     * Publish an application event with an optional detail payload.
     * @param {string} name
     * @param {*} [detail]
     */
    emit(name, detail) {
        target.dispatchEvent(new CustomEvent(name, { detail }));
    },
};

/* ── Catalogue of all application event names ────────────────────
   Keep this in sync as new events are introduced.

   NAVIGATION (view → main)
   ─────────────────────────
   'nav:showView'        { viewId: string }
   'nav:openEditor'      { save: Save | null }

   UI INTENT (view → main — user triggered an action)
   ─────────────────────────────────────────────────
   'editor:play'         {}
   'editor:pause'        {}
   'editor:setSpeed'     { speed: number }
   'editor:addRule'      {}
   'editor:deleteRule'   { ruleIndex: number }
   'editor:updateRule'   { ruleIndex: number, rule: string }
   'editor:saveSystem'   { save: Save }
   'saves:load'          { save: Save }
   'saves:delete'        { index: number }

   DATA (main → view — state changed / server replied)
   ────────────────────────────────────────────────────
   'data:gridUpdate'     { grid: boolean[][] }
   'data:saveLoaded'     { save: Save }
   'data:savePushed'     { save: Save }
   'data:ruleDeleted'    { ruleIndex: number }
   'data:ruleInvalid'    { ruleIndex: number }
   'data:ruleValid'      { ruleIndex: number }
   'data:saveError'      {}
   'data:generationTick' { gen: number }
─────────────────────────────────────────────────────────────── */
