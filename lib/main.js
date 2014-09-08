'use strict';

var buttons = require('sdk/ui/button/action');
var pageMod = require('sdk/page-mod');
var tabs = require('sdk/tabs');
var self = require('sdk/self');
var url = require('sdk/url');
var pageWorker = require('sdk/page-worker');
const {XMLHttpRequest} = require('sdk/net/xhr');

/**
 * GhostText for Firefox main script.
 *
 * @licence The MIT License (MIT)
 * @author Guido Krömer <mail 64 cacodaemon 46 de>
 */
var GhostTextMain = {
    /**
     * Lookup table for connected tabs.
     */
    connectedTabs: [],

    /**
     * Tabs which have already the content script injected.
     */
    tabsWithScriptInjected: [],

    /**
     * The background page/tab used for the WebSocket magic.
     *
     *  @type {Page}
     */
    backgroundPage: null,

    /**
     * The addon's button.
     *
     * @type {ActionButton}
     */
    button: null,

    setButtonStateByTab: function(tab, connected) {
        GhostTextMain.button.state('tab', {
            label: 'tab-specific label' + tab.id,
            icon: {
                '16': connected ? './icon/19-on.png' : './icon/19.png'
            }
        });
    },

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

    /**
     * Callback for messages sends from a connected tab.
     *
     * @param {*} message
     */
    onMessageTab: function (message) {
        console.log('Main.onMessageTab: ', JSON.stringify(message));

        switch (message.type) {
            case 'connect':
                GhostTextMain.handleAjax('http://localhost:4001', function (response) {
                        console.log('AJAX ' + JSON.stringify(response));

                        GhostTextMain.backgroundPage.postMessage({
                            type: 'connect',
                            tabId: message.tabId,
                            response: response,
                            originMessage: message
                        });
                    });
                break;

            default:
                GhostTextMain.backgroundPage.postMessage(message);
        }
    },

    /**
     * Callback for messages sends from the background tab.
     *
     * @param {*} message
     */
    onMessageBackground: function (message) {
        console.log('Main.onMessageBackground: ', JSON.stringify(message));

        if (!GhostTextMain.tabsWithScriptInjected[message.tabId]) {
            return;
        }

        switch (message.type) {
            case 'disable-field':
                var targetTab = GhostTextMain.tabsWithScriptInjected[message.tabId];
                GhostTextMain.setButtonStateByTab(targetTab, false);
                targetTab.postMessage(message);
                break;

            default:
                GhostTextMain.tabsWithScriptInjected[message.tabId].postMessage(message);
        }
    },


    /**
     * Callback for the tab close event.
     *
     * @param {Tab} tab
     */
    onTabClosed: function (tab) {
        if (!GhostTextMain.connectedTabs[tab.id]) {
            return;
        }

        console.log('Main.onTabClose: ' + tab.id);

        GhostTextMain.connectedTabs[tab.id] = false;
        GhostTextMain.tabsWithScriptInjected[tab.id] = false;

        GhostTextMain.backgroundPage.postMessage({
            type: 'close-connection',
            tabId: tab.id
        });
    },

    /**
     * Injects the script into the given tab.
     *
     * @param {Tab} activeTab
     * @return {boolean} True on success and false if the script has already been injected.
     */
    injectScript: function (activeTab) {
        console.log('Main.injectScript ' + activeTab.id);

        if (GhostTextMain.tabsWithScriptInjected[activeTab.id]) {
            return false;
        }

        GhostTextMain.tabsWithScriptInjected[activeTab.id] = activeTab.attach({
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
            onMessage: GhostTextMain.onMessageTab
        });

        return true;
    },

    /**
     * Action button on click callback.
     */
    handleClick: function() {
        console.log('Main.handleClick');
        var activeTab = tabs.activeTab;

        if (!GhostTextMain.connectedTabs[activeTab.id]) { //connect
            GhostTextMain.setButtonStateByTab(activeTab, true);

            GhostTextMain.injectScript(activeTab);
            GhostTextMain.tabsWithScriptInjected[activeTab.id].postMessage({
                type: 'select-field'
            });
            GhostTextMain.connectedTabs[activeTab.id] = true;
        } else { //disconnect
            GhostTextMain.backgroundPage.postMessage({
                type: 'close-connection',
                tabId: activeTab.id
            });
            GhostTextMain.connectedTabs[activeTab.id] = false;
        }
    },

    /**
     * Init the main script.
     */
    init: function () {
        GhostTextMain.backgroundPage = pageWorker.Page({
            contentScriptFile: [self.data.url('background.js')],
            contentURL: self.data.url('background.html'),
            contentScriptWhen: 'ready',
            onMessage: GhostTextMain.onMessageBackground
        });

        GhostTextMain.button = buttons.ActionButton({
            id: 'mozilla-link',
            label: 'Visit Mozilla',
            icon: {
                '16': './icon/19.png'
            },
            onClick: GhostTextMain.handleClick
        });

        pageMod.PageMod({
            contentScriptWhen: 'ready',
            include: "*",
            contentStyleFile: self.data.url('vendor/humane-ghosttext.css')
        });

        tabs.on('close', GhostTextMain.onTabClosed);
    }
};

GhostTextMain.init();