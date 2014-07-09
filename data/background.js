/**
 * Tab id to WebSocket mapping.
 *
 * @type {Array<WebSocket>}
 */
var webSockets = [];

function connect(message) {
    console.log('InBackground.connect');

    if (message.response.status !== 200) {
        console.log("Connect error?");

        return;
    }
    var response = JSON.parse(message.response.responseText);

    if (response.ProtocolVersion != 1) {
        console.log("Wrong version?");

        return;
    }

    var webSocket = new WebSocket('ws://localhost:' + response.WebSocketPort);

    webSocket.onopen = function () {
        console.log('webSocket.onopen');
        webSocket.send(message.originMessage.change);
        console.log('webSocket.onopen.send: ' + message.originMessage.change);
    };

    webSocket.onmessage = function (event) {
        self.postMessage({
            tabId: message.tabId,
            type: 'textChange',
            change: event.data
        });
    };

    webSockets[message.tabId.toString()] = webSocket;
}

function disconnect(message) {
    try {
        webSockets[message.tabId.toString()].close();
    } catch (e) {
        console.log(e)
    }

    delete webSockets[message.tabId.toString()];
}

function textChange(message) {
    console.log(message);
    console.log(webSockets[message.tabId]);
    webSockets[message.tabId].send(message.change);
}

self.on('message', function(message) {
    console.log('InBackgroundOnMessage');
    console.log(message.type);

    switch (message.type) {
        case 'connect':
            connect(message);
            break;

        case 'disconnect':
            disconnect(message);
            break;

        case 'textChange':
            textChange(message);
            break;
    }
});

console.log("Background script injected");