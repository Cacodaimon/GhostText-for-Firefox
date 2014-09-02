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
    var response = JSON.parse(message.change);
    currentInputArea.setText(response.text);
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
    alert('No text area elements on this page');
} else if (countElementsFound > 1) {
    alert('There are multiple text areas on this page. \n Click on the one you want to use.');
}

//TODO error, onclose, messages…

alert("Content script injected… 2000");