var buttons = require('sdk/ui/button/action');
var pageMod = require('sdk/page-mod');
var tabs = require('sdk/tabs');
var self = require('sdk/self');
var url = require('sdk/url');
var pageWorker = require('sdk/page-worker');
var notifications = require('sdk/notifications');
const {XMLHttpRequest} = require('sdk/net/xhr');

GhostTextMain = {
    /**
     *
     */
    browserTabs: [],

    /**
     *
     */
    tabsWithScriptInjected: [],

    /**
     *
     *  @type Page
     */
    backgroundPage: null,

    /**
     *
     *
     * @type ActionButton
     */
    button: null,

    /*onMessageBackground: function (message) {
        console.log('Main.onMessageBackground');

        switch (message.type) {
            case 'main':
                onMessage(message);
                break;
            case 'background':
            default:
                GhostTextMain.backgroundPage.postMessage(message);
                break;
        }
    },*/

    /**
     * Performs a async GET request on the given URL.
     *
     * @param {string} url
     * @param {*} response
     */
    handleAjax: function(url, response) {
        console.log('Main.handleAjax');

        var xhr = new XMLHttpRequest();
        xhr.onload = function () {
            console.log('Main.handleAjax.xhr.onload');
            response({
                status: this.status,
                responseText: this.responseText
            });
        };
        xhr.open('GET', url, true /*async*/);
        xhr.send();
        console.log('Main.handleAjax.after.xhr.send');
    },

    onMessageContent: function (message) {
        console.log('Main.onMessageContent');

        switch (message.type) {
            case 'connect':
                GhostTextMain.handleAjax('http://localhost:4001', function (response) {
                        GhostTextMain.backgroundPage.postMessage({
                            type: 'connect',
                            tabId: message.tabId,
                            response: response,
                            originMessage: message
                        });
                    });
                break;

            default:
                console.log(['Unknown message of type', message.type, 'given'].join(' '));
        }
    },

    handleClick: function() {
        console.log('Main.handleClick');

        var activeTab = tabs.activeTab;
        if (!GhostTextMain.tabsWithScriptInjected[activeTab.id]) {
            GhostTextMain.tabsWithScriptInjected[activeTab.id] = true;
            GhostTextMain.browserTabs[activeTab.id] = activeTab.attach({
                    contentScriptFile: [
                        self.data.url('vendor/humane-ghosttext.min.js'),
                        self.data.url('input-area.js'),
                        self.data.url('content.js')
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
                                GhostTextMain.onMessageContent(message);
                                break;
                            case 'background':
                            default:
                                GhostTextMain.backgroundPage.postMessage(message);
                                break;
                        }
                    }
                }
            );
        } else {
            //TODO add disable/close behavior…
        }

        GhostTextMain.browserTabs[activeTab.id].postMessage({
            type: 'select-field'
        });
    },

    init: function () {
        GhostTextMain.backgroundPage = pageWorker.Page({
            contentScriptFile: [self.data.url('background.js')],
            contentURL: self.data.url('background.html'),
            contentScriptWhen: 'ready',
            onMessage: function (message) {
                console.log('Main.backgroundPage.onMessage', JSON.stringify(message));

                switch (message.recipient) {
                    case 'main':
                        GhostTextMain.onMessageBackground(message);
                        break;
                    case 'content':
                    default:
                        GhostTextMain.browserTabs[message.tabId].postMessage(message);
                        break;
                }
            }
        });

        GhostTextMain.button = buttons.ActionButton({
            id: 'mozilla-link',
            label: 'Visit Mozilla',
            icon: {
                '16': './icon/19.png',
                '32': './icon/32.png',
                '64': './icon/32.png'
            },
            onClick: GhostTextMain.handleClick
        });

        pageMod.PageMod({
            contentScriptWhen: 'ready',
            include: "*",
            contentStyleFile: self.data.url('vendor/humane-ghosttext.css')
        });
    }
};

GhostTextMain.init();