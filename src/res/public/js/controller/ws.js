const WS_URL = (() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
})();

let ws = null;

export function getWs() { return ws; }

/** Open WebSocket if not already open. Safe to call multiple times. Returns the socket. */
export function ensureWs() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return ws;
    ws = new WebSocket(WS_URL);
    ws.addEventListener('open', () => console.log('[ws] open'));
    ws.addEventListener('close', () => console.log('[ws] closed'));
    ws.addEventListener('error', err => console.error('[ws] error', err));
    return ws;
}

/** Fire-and-forget send. Queues behind the open event if needed. */
export function send(type, payload = {}) {
    ensureWs();
    const dispatch = () => ws.send(JSON.stringify({ type, ...payload }));
    if (ws.readyState === WebSocket.OPEN) dispatch();
    else ws.addEventListener('open', dispatch, { once: true });
}

/**
 * Send a message and resolve with the first server reply whose `type`
 * matches one of `expectedTypes`. Rejects after `timeoutMs`.
 *
 * @param {string}   type
 * @param {object}   payload
 * @param {string[]} expectedTypes
 * @param {number}   [timeoutMs=5000]
 * @returns {Promise<object>}
 */
export function sendAwait(type, payload = {}, expectedTypes = [], timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        ensureWs();

        const timer = setTimeout(() => {
            ws.removeEventListener('message', handler);
            reject(new Error(`Timeout: waiting for [${expectedTypes}] after '${type}'`));
        }, timeoutMs);

        function handler(e) {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }
            if (expectedTypes.includes(msg.type)) {
                clearTimeout(timer);
                ws.removeEventListener('message', handler);
                resolve(msg);
            }
        }

        const dispatch = () => {
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ type, ...payload }));
        };

        if (ws.readyState === WebSocket.OPEN) dispatch();
        else ws.addEventListener('open', dispatch, { once: true });
    });
}
