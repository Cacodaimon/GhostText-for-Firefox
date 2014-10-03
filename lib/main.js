'use strict';

var buttons = require('sdk/ui/button/action');
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
                '16': connected ? './icon/18-on.png' : './icon/18.png',
                '18': connected ? './icon/18-on.png' : './icon/18.png',
                '32': connected ? './icon/32-on.png' : './icon/32.png',
                '36': connected ? './icon/36-on.png' : './icon/36.png',
                '64': connected ? './icon/64-on.png' : './icon/64.png',
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
     * Callback for the tab close and reload events.
     *
     * @param {Tab} tab
     */
    onTabClosedOrReloaded: function (tab) {
        console.log('Main.onTabClosedOrReloaded: ' + tab.id);

        if (!GhostTextMain.connectedTabs[tab.id]) {
            return;
        }

        GhostTextMain.connectedTabs[tab.id] = false;
        GhostTextMain.tabsWithScriptInjected[tab.id] = false;
        GhostTextMain.setButtonStateByTab(tab, false);

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
                },
                css: self.data.url('vendor/humane-ghosttext.css')
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
            id: 'ghost-text',
            label: 'GhostText',
            icon: {
                "18": "./icon/18.png", // toolbar icon non HiDPI
                "32": "./icon/32.png", // menu panel icon non HiDPI
                "36": "./icon/36.png", // toolbar icon HiDPI
                "64": "./icon/64.png"  // menu panel icon HiDPI
            },
            onClick: GhostTextMain.handleClick
        });

        tabs.on('close', GhostTextMain.onTabClosedOrReloaded);
        tabs.on('pageshow', GhostTextMain.onTabClosedOrReloaded)
    }
};

GhostTextMain.init();