'use strict';

/**
 * GhostText for FireFox background script.
 *
 * @licence The MIT License (MIT)
 * @author Guido Krömer <mail 64 cacodaemon 46 de>
 * @author Federico Brigante
 */
var GhostTextBackground = {
    /**
     * Tab id to WebSocket mapping.
     *
     * @type {Array<WebSocket>}
     */
    webSockets: [],

    /**
     * Post a message of type error to the target tab's content script.
     *
     * @param {string} tabId The target tab's id.
     * @param {string} detail The detail key.
     */
    postErrorMessage: function (tabId, detail) {
        console.error(['Post error', detail, 'to tab', tabId, '!'].join(' '));

        self.postMessage({
            tabId: tabId,
            type: 'error',
            detail: detail
        });
    },

    /**
     * Creates a new connection the GhostText server WebSocket at the given port.
     *
     * @param {*} message
     */
    connect: function (message) {
        console.log('GhostTextBackground.connect ' + JSON.stringify(message));

        if (message.response.status !== 200) {
            GhostTextBackground.postErrorMessage(message.tabId, 'server-not-found');

            return;
        }
        var response = JSON.parse(message.response.responseText);

        if (response.ProtocolVersion != 1) {
            GhostTextBackground.postErrorMessage(message.tabId, 'version');

            return;
        }

        var webSocket = new WebSocket('ws://localhost:' + response.WebSocketPort);

        webSocket.onopen = function () {
            console.log('webSocket.onopen');
            webSocket.send(message.originMessage.change);

            self.postMessage({
                tabId: message.tabId,
                type: 'connected'
            });
        };

        webSocket.onmessage = function (event) {
            self.postMessage({
                tabId: message.tabId,
                type: 'text-change',
                change: event.data
            });
        };

        webSocket.onclose = function () {
            delete GhostTextBackground.webSockets[message.tabId.toString()];

            self.postMessage({
                tabId: message.tabId,
                type: 'disable-field'
            });
        };

        webSocket.onerror = function () {
            GhostTextBackground.postErrorMessage(message.tabId, 'web-socket');
        };

        GhostTextBackground.webSockets[message.tabId.toString()] = webSocket;
    },

    /**
     * Closes the connection.
     *
     * @param message
     */
    disconnect: function (message) {
        console.log('GhostTextBackground.disconnect');

        self.postMessage({
            tabId: message.tabId,
            type: 'disable-field'
        });

        try {
            GhostTextBackground.webSockets[message.tabId.toString()].close();
        } catch (e) {
            GhostTextBackground.postErrorMessage(message.tabId, 'web-socket');
        }

        delete GhostTextBackground.webSockets[message.tabId.toString()];
    },

    /**
     * Sends a text change to the GhostText server.
     *
     * @param message
     */
    textChange: function (message) {
        console.log('GhostTextBackground.textChange');

        GhostTextBackground.webSockets[message.tabId.toString()].send(message.change);
    },

    /**
     * Init the on message handler, waiting for incoming messages from the main.js script.
     */
    init: function () {
        console.log('GhostTextBackground.init');

        self.on('message', function (message) {
            console.log('GhostTextBackground, on message: ' + JSON.stringify(message));

            switch (message.type) {
                case 'connect':
                    GhostTextBackground.connect(message);
                    break;

                case 'close-connection':
                    GhostTextBackground.disconnect(message);
                    break;

                case 'text-change':
                    GhostTextBackground.textChange(message);
                    break;

                default:
                    console.log(['Unknown message of type', message.type, 'given'].join(' '));
            }
        });
    }
};

GhostTextBackground.init();