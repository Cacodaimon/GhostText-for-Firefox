'use strict';

/**
 * GhostText for FireFox content script.
 *
 * @licence The MIT License (MIT)
 * @author Guido Krömer <mail 64 cacodaemon 46 de>
 * @author Federico Brigante
 */
var GhostTextContent = {
    /**
     * The field we or the user selected.
     *
     * @type IInputArea
     */
    currentInputArea: null,

    /**
     * Displays the passed message to the user.
     *
     * @param  {string}  message Message to display
     * @param  {boolean} stay    Whether the message will stay on indefinitely
     * @private
     * @static
     */
    informUser: function (message, stay) {
        console.info('GhostText:', message);
        GThumane.remove();

        message = message.replace(/\n/g,'<br>');
        var timeout = stay ? 0 : GhostTextContent.getMessageDisplayTime(message);
        GThumane.log(message, {
            timeout: timeout,
            clickToClose: true
        });
    },

    /**
     * Displays the passed message to the user as an error
     *
     * @param  {string} message Message to display
     * @param  {boolean} stay    Whether the message will stay on indefinitely
     * @private
     * @static
     */
    alertUser: function (message, stay) {
        console.warn('GhostText:', message);
        GThumane.remove();

        message = message.replace(/\n/g,'<br>');
        var timeout = stay ? 0 : GhostTextContent.getMessageDisplayTime(message);
        GThumane.log(message, {
            timeout: timeout,
            clickToClose: true,
            addnCls: 'ghost-text-message-error'
        });
    },

    /**
     * Gets how long a message needs to stay on screen
     *
     * @param  {string} message Message to display
     * @return {number} The duration in milliseconds
     */
    getMessageDisplayTime: function (message) {
        var wpm = 100;//180 is the average words read per minute, make it slower

        return message.split(' ').length / wpm * 60000;
    },

    /**
     * Handles messages sent from other parts of the extension
     *
     * @param  {object} message The request object passed by Chrome
     * @public
     * @static
     */
    messageHandler: function(message) {
        console.log('Got message:', message);

        switch (message.type) {
            case 'select-field':
                GhostTextContent.selectField();
                break;
            case 'disable-field':
                GhostTextContent.disableField();
                break;
            case 'text-change':
                var response = JSON.parse(message.change);
                GhostTextContent.currentInputArea.setText(response.text);
                break;
            case 'close-connection':
                GhostTextContent.currentInputArea.unbind();
                GhostTextContent.currentInputArea = null;
                GhostTextContent.informUser('Disconnected! \n <a href="https://github.com/Cacodaimon/GhostTextForChrome/issues?state=open" target="_blank">Report issues</a> | <a href="https://chrome.google.com/webstore/detail/sublimetextarea/godiecgffnchndlihlpaajjcplehddca/reviews" target="_blank">Leave review</a>');
                break;
            default:
                console.warn(['Unknown message of type', message.type, 'given'].join(' '));
        }
    },

    /**
     * Look for text areas in document and connect to is as soon as possible.
     *
     * @private
     * @static
     */
    selectField: function () {
        console.log('GhostText: selectField()');

        var detector = new GhostText.InputArea.Detector(GhostText.InputArea.Browser.Firefox);
        detector.focusEvent(function (inputArea) {
            GhostTextContent.currentInputArea = inputArea;
            GhostTextContent.enableField();
        });

        var countElementsFound = detector.detect(document);
        if (countElementsFound === 0) {
            GhostTextContent.informUser('No text area elements on this page');
        } else if (countElementsFound > 1) {
            GhostTextContent.informUser('There are multiple text areas on this page. \n Click on the one you want to use.');
        }
    },

    /**
     * Connects a HTML text area to a GhostText server by messaging through the background script.
     *
     * @public
     * @static
     */
    enableField: function () {
        console.log('GhostText: enableField()');

        var inputArea = GhostTextContent.currentInputArea;

        GhostTextContent.informUser('Connected! You can switch to your editor');

        inputArea.textChangedEvent(function () { GhostTextContent.reportFieldData();});
        inputArea.removeEvent(function () { alert('TODO remove evt'); });
        inputArea.unloadEvent(function () { alert('TODO remove evt'); });
        inputArea.focusEvent(null); //disable
        inputArea.selectionChangedEvent(null);

        /** @type TextChange */
        var textChange = inputArea.buildChange();

        self.postMessage({
            tabId: self.options.tab.id,
            change: JSON.stringify(textChange),
            type: 'connect',
            recipient: 'main'
        });

        GhostTextContent.reportFieldData(); //Report initial content of field
    },

    /**
     * Ask the background script to close the connection
     *
     * @private
     * @static
     */
    requestServerDisconnection: function () {
        console.log('GhostText: requestServerDisconnection()');

        self.postMessage({
            tabId: self.options.tab.id,
            type: 'close-connection',
            recipient: 'background'
        });
    },

    /**
     * Remove listeners from field and shows disconnection message
     * @private
     * @static
     */
    disableField: function () {
        console.log('GhostText: disableField()');

        if (GhostTextContent.currentInputArea === null) {
            return;
        }

        GhostTextContent.currentInputArea.unbind();
        GhostTextContent.currentInputArea = null;
        GhostTextContent.informUser('Disconnected! \n <a href="https://github.com/Cacodaimon/GhostTextForChrome/issues?state=open" target="_blank">Report issues</a> | <a href="https://chrome.google.com/webstore/detail/sublimetextarea/godiecgffnchndlihlpaajjcplehddca/reviews" target="_blank">Leave review</a>');
    },

    /**
     * Sends a text change to the server.
     *
     * @private
     * @static
     */
    reportFieldData: function () {
        console.log('GhostText: reportFieldData()');

        if (GhostTextContent.currentInputArea === null) {
            throw 'reportFieldData as been called without initializing currentInputArea!';
        }

        /** @type TextChange */
        var textChange = GhostTextContent.currentInputArea.buildChange();

        self.postMessage({
            tabId: self.options.tab.id,
            change: JSON.stringify(textChange),
            type: 'text-change',
            recipient: 'background'
        });
    }

};

self.on('message', GhostTextContent.messageHandler);
GhostTextContent.selectField();

console.log('Injected');