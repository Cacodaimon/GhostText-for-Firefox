'use strict';

var buttons = require('sdk/ui/button/action');
var pageMod = require('sdk/page-mod');
var tabs = require('sdk/tabs');
var self = require('sdk/self');
var url = require('sdk/url');
var pageWorker = require('sdk/page-worker');
var prefs = require('sdk/simple-prefs').prefs;
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

    /**
     * Sets the button state image for the given tab.
     *
     * @param {Tab} tab
     * @param {boolean} connected
     */
    setButtonStateByTab: function (tab, connected) {
        GhostTextMain.button.state('tab', {
            label: connected ? 'GhostText Connected' : 'GhostText',
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
    handleAjax: function (url, response) {
        console.log('Main.handleAjax');

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true /*async*/);
        xhr.send();
        xhr.onreadystatechange = function () {
            if (this.readyState !== 4) {
                return;
            }

            response({
                status: this.status,
                responseText: this.responseText
            });
        };
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
                GhostTextMain.handleAjax('http://localhost:' + prefs.port, function (response) {
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

        var targetTab = GhostTextMain.tabsWithScriptInjected[message.tabId];
        targetTab.postMessage(message);
        switch (message.type) {
            case 'connected':
                GhostTextMain.setButtonStateByTab(targetTab, true);
                break;
            case 'error':
            case 'disable-field':
                GhostTextMain.setButtonStateByTab(targetTab, false);
                break;
            default:
                //pass
        }
    },

    /**
     * Callback for the tab close event.
     *
     * @param {Tab} tab
     */
    onTabClosed: function (tab) {
        console.log('Main.onTabClose: ' + tab.id);

        if (!GhostTextMain.connectedTabs[tab.id]) {
            return;
        }

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
    handleClick: function () {
        console.log('Main.handleClick');
        var activeTab = tabs.activeTab;

        if (!GhostTextMain.connectedTabs[activeTab.id]) { //connect
            GhostTextMain.connectedTabs[activeTab.id] = true;
            GhostTextMain.injectScript(activeTab);
            GhostTextMain.tabsWithScriptInjected[activeTab.id].postMessage({
                type: 'select-field'
            });
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