/* ═══════════════════════════════════════════════════════════════
   view/home.js — Home page DOM bindings.

   Pure view: emits navigation events via the bus.
   No controller imports.
═══════════════════════════════════════════════════════════════ */

import { bus } from '../controller/events.js';

export function bindHome() {
    document.getElementById('btn-new-system')
        .addEventListener('click', () => bus.emit('nav:openEditor', { save: null }));

    document.getElementById('btn-saved-systems')
        .addEventListener('click', () => bus.emit('nav:showView', { viewId: 'view-saves' }));

    document.getElementById('btn-documentation')
        .addEventListener('click', () =>
            window.open('https://ngl321.github.io/java-ca-sandbox/', '_blank', 'noopener,noreferrer'));

    // #btn-github is an <a> — no JS binding needed
}
