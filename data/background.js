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
     * Creates a new connection the GhostText server WebSocket at the given port.
     *
     * @param {*} message
     */
    connect: function(message) {
        console.log('GhostTextBackground.connect');

        if (message.response.status !== 200) {
            console.log('Connect error?');

            return;
        }
        var response = JSON.parse(message.response.responseText);

        if (response.ProtocolVersion != 1) {
            console.log('Wrong version?');

            return;
        }

        var webSocket = new WebSocket('ws://localhost:' + response.WebSocketPort);

        webSocket.onopen = function() {
            console.log('webSocket.onopen');
            webSocket.send(message.originMessage.change);
            console.log('webSocket.onopen.send: ' + message.originMessage.change);
        };

        webSocket.onmessage = function(event) {
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

        GhostTextBackground.webSockets[message.tabId.toString()] = webSocket;
    },

    /**
     * Closes the connection.
     *
     * @param message
     */
    disconnect: function(message) {
        console.log('GhostTextBackground.disconnect');

        self.postMessage({
            tabId: message.tabId,
            type: 'disable-field'
        });

        try {
            GhostTextBackground.webSockets[message.tabId.toString()].close();
        } catch (e) {
            console.log(e)
        }

        delete GhostTextBackground.webSockets[message.tabId.toString()];
    },

    /**
     * Sends a text change to the GhostText server.
     *
     * @param message
     */
    textChange: function(message) {
        console.log('GhostTextBackground.textChange');

        console.log(message);
        console.log(GhostTextBackground.webSockets[message.tabId.toString()]);
        GhostTextBackground.webSockets[message.tabId.toString()].send(message.change);
    },

    /**
     * Init the on message handler, waiting for incoming messages from the main.js script.
     */
    init: function () {
        console.log('GhostTextBackground.init');

        self.on('message', function(message) {
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