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
     * Gets how long a message needs to stay on screen
     *
     * @param  {string} message Message to display
     * @return {number} The duration in milliseconds
     */
    getMessageDisplayTime: function (message) {
        var wpm = 100;//180 is the average words read per minute, make it slower

        return message.split(' ').length / wpm * 60000;
    }
};

/** @type InputArea */
var currentInputArea = null;

var reportFieldData = function () {
    console.log('GhostText: reportFieldData()');

    if (currentInputArea === null) {
        throw 'reportFieldData as been called without initializing currentInputArea!';
    }

    /** @type TextChange */
    var textChange = currentInputArea.buildChange();

    self.postMessage({
        tabId: self.options.tab.id,
        change: JSON.stringify(textChange),
        type: 'textChange',
        recipient: 'background'
    });
};

self.on('message', function(message) {
    switch (message.type) {
        case 'textChange':
            var response = JSON.parse(message.change);
            currentInputArea.setText(response.text);
            break;
        case 'close':
            currentInputArea.unbind();
            currentInputArea = null;
            informUser('Disconnected! \n <a href="https://github.com/Cacodaimon/GhostTextForChrome/issues?state=open" target="_blank">Report issues</a> | <a href="https://chrome.google.com/webstore/detail/sublimetextarea/godiecgffnchndlihlpaajjcplehddca/reviews" target="_blank">Leave review</a>');
            break;
        default:
            console.log(['Unknown message of type', message.type, 'given'].join(' '));
    }

});

var detector = new GhostText.InputArea.Detector(GhostText.InputArea.Browser.Firefox);
detector.focusEvent(function (inputArea) {
    console.log('GhostText: detector.focusEvent()');
    currentInputArea = inputArea;

    inputArea.textChangedEvent(function () { reportFieldData();});
    inputArea.removeEvent(function () { alert('TODO remove evt'); });
    inputArea.unloadEvent(function () { alert('TODO remove evt'); });
    inputArea.focusEvent(null); //disable
    inputArea.selectionChangedEvent(null);

    /** @type TextChange */
    var textChange = currentInputArea.buildChange();

    self.postMessage({
        tabId: self.options.tab.id,
        change: JSON.stringify(textChange),
        type: 'connect',
        recipient: 'main'
    });

    reportFieldData(); //Report initial content of field
});

var countElementsFound = detector.detect(document);
if (countElementsFound === 0) {
    GhostTextContent.informUser('No text area elements on this page');
} else if (countElementsFound > 1) {
    GhostTextContent.informUser('There are multiple text areas on this page. \n Click on the one you want to use.');
}

//TODO error, onclose, messages…