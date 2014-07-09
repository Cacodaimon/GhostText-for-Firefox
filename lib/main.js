var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var self = require("sdk/self");
var url = require("sdk/url");
var pageWorker = require("sdk/page-worker");
const {XMLHttpRequest} = require("sdk/net/xhr");

/** @type Array */
var browserTabs = [];

var backgroundPage = pageWorker.Page({
    contentScriptFile: [self.data.url("vendor/jquery.min.js"), self.data.url("background.js")],
    contentURL: self.data.url("background.html"),
    contentScriptWhen: "ready",
    onMessage: function (message) {
        console.log('Main.backgroundPage.onMessage');

        switch (message.recipient) {
            case 'main':
                onMessageBackground(message);
                break;
            case 'content':
            default:
                browserTabs[message.tabId].postMessage(message);
                break;
        }
    }
});

var onMessageBackground = function (message) {
    console.log('Main.onMessageBackground');

    switch (message.type) {
        case 'main':
            onMessage(message);
            break;
        case 'background':
        default:
            backgroundPage.postMessage(message);
            break;
    }
};

var handleAjax = function(request, response) {
    console.log('Main.handleAjax');

    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        console.log('Main.handleAjax.xhr.onload');
        response({
            status: this.status,
            responseText: this.responseText
        });
    };
    xhr.open(request.type, request.url, request.async);
    xhr.send();
    console.log('Main.handleAjax.after.xhr.send');
};

var onMessageContent = function (message) {
    console.log('Main.onMessageContent');

    switch (message.type) {
        case 'connect':
            handleAjax({
                    type: 'GET',
                    url: 'http://localhost:4001',
                    async: true
                },
                function (response) {
                backgroundPage.postMessage({
                    type: 'connect',
                    tabId: message.tabId,
                    response: response,
                    originMessage: message
                });
            });
            break;
    }
};

var handleClick = function() {
    console.log('Main.handleClick');

    var activeTab = tabs.activeTab;
    browserTabs[activeTab.id] = activeTab.attach({
            contentScriptFile: [
                self.data.url("vendor/jquery.min.js"),
                self.data.url("content.js")
            ],
            contentScriptOptions: {
                tab: {
                    id: activeTab.id,
                    title: activeTab.title,
                    url: url.URL(activeTab.url)
                }
            },
            onMessage: function (message) {
                console.log('Main.contentTab.onMessage');

                switch (message.recipient) {
                    case 'main':
                        onMessageContent(message);
                        break;
                    case 'background':
                    default:
                        backgroundPage.postMessage(message);
                        break;
                }
            }
        }
    );
};

var button = buttons.ActionButton({
    id: "mozilla-link",
    label: "Visit Mozilla",
    icon: {
        "16": "./icon/16.png",
        "32": "./icon/32.png",
        "64": "./icon/32.png"
    },
    onClick: handleClick
});