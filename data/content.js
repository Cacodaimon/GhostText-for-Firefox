/*var textChange = function (title, textArea, tabUrl) {
    var textAreaDom = $(this).get(0);

    return JSON.stringify({
        title: title,
        text: textArea.val(),
        selections: [
            {
                start: textAreaDom.selectionStart,
                end: textAreaDom.selectionEnd
            }
        ],
        url: tabUrl.host || 'unknown',
        syntax: 'plaintext'
    });
};


var getMinMaxSelection = function (selection) {
    var minMaxSelection = {start: Number.MAX_VALUE, end: Number.MIN_VALUE};

    for (var i = selection.length - 1; i >= 0; i--) {
        minMaxSelection.start = Math.min(minMaxSelection.start, selection[i].start);
        minMaxSelection.end = Math.max(minMaxSelection.end, selection[i].end);
    }

    return minMaxSelection;
};

var $textAreas = $('textarea');
$textAreas.off('.ghost-text'); //remove all event listeners
var $focusedTextarea = $textAreas.filter(':focus');

if ($focusedTextarea.length == 1) {
    $textAreas.on('input.ghost-text propertychange.ghost-text onmouseup.ghost-text', function () {
        self.postMessage({
            tabId: self.options.tab.id,
            change: textChange(self.options.tab.title, $textAreas, self.options.tab.url.host),
            type: 'textChange',
            recipient: 'background'
        });
    });

    self.postMessage({
        tabId: self.options.tab.id,
        change: textChange(self.options.tab.title, $textAreas, self.options.tab.url.host),
        type: 'connect',
        recipient: 'main'
    });

    self.on('message', function(message) {
        var response = JSON.parse(message.change);
        $textAreas.val(response.text);

        var textArea = $($textAreas).get(0);
        // @type {{start: {number}, end: {number}}}
        //var minMaxSelection = getMinMaxSelection(response.selections);
        //textArea.selectionStart = minMaxSelection.start;
        //textArea.selectionEnd   = minMaxSelection.end;
        textArea.focus();
    });
}*/

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

var detector = new GhostText.InputArea.Detector();
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