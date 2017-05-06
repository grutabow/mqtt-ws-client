/*!
 * 
 * dashboard.js v1.0 
 * Copyright (c) 2016-2017 EMQ Enterprise, Inc. (http://emqtt.io).
 * 
 */

(function(dashboard, $) {

    'use strict';

    dashboard.version = '1.0';

    var WebAPI = function(options) {
        this.options = $.extend(
                {},
                WebAPI.DEFAULTS,
                options || {});
    };

    WebAPI.DEFAULTS = {
        apiPath  : '/',
        method   : 'POST',
        cache    : false,
        dataType : 'json',
        callback : null
    };

    /** Instantiation WebAPI */
    WebAPI._instance = null;
    /**
     * Get the Instantiation WebAPI
     */
    WebAPI.getInstance = function() {
        if (!WebAPI._instance) {
            throw new Error('WebAPI is not initialized.');
        }
        return WebAPI._instance;
    };

    // WebAPI initialized
    WebAPI.init = function(options) {
        if (!WebAPI._instance) {
            WebAPI._instance = new WebAPI(options);
        }
        return WebAPI.getInstance();
    };

    // var callback = function(ret, err) {};
    WebAPI.prototype._ajax = function(path, params, callback, ajaxInfo) {
        var _this = this, options = _this.options;
        var info = {
            type     : options.method,
            url      : options.apiPath + path,
            data     : params,
            dataType : options.dataType,
            cache    : options.cache,
            success  : function(ret) {
                if (!callback) {
                    return;
                }
                
                callback(ret, undefined);

                // Do "options.callback" after
                // the request is successful
                if (typeof options.callback === 'function') {
                    options.callback();
                }
            },
            error : function(err) {
                if (typeof callback === 'function') {
                    callback(undefined, err);
                }
            }
        };
        $.extend(info, ajaxInfo || {});
        $.ajax(info);
    };



    // Modules save container.
    var modules = {};
    dashboard.modules = modules;


    // Websocket----------------------------------------

    var Websocket = function() {
        this.modName = 'websocket';
        this.$html = $('#dashboard_websocket',
                sog.mainCenter.$html);
        this.client = null;
        this._init();
    };
    Websocket.prototype._init = function() {
        var _this = this;
            _this.vmWS = new Vue({
                el  : '#dashboard_websocket',
                data: {
                    connState : false,
                    cInfo : {
                        host : 'q.emqtt.com',
                        port : 8083,
                        clientId : 'EMQ_WS_OFFLINE_CLIENT_' + new Date().getTime(),
                        userName : null,
                        password : null,
                        keepAlive: 120,
                        cleanSession : true,
                        useSSL : false 
                    },
                    subInfo : {
                        topic : 'world',
                        qos : 0
                    },
                    subscriptions : [],
                    sendInfo : {
                        topic : 'world',
                        text : 'Hello world!',
                        qos : 0,
                        retained : true
                    },
                    sendMsgs : [],
                    receiveMsgs : []
                },
                methods : {
                    connect : function() {
                        _this.connect();
                    },
                    disconnect : function() {
                        _this.disconnect();
                    },
                    sub : function() {
                        _this.subscribe();
                    },
                    send : function() {
                        _this.sendMessage();
                    },
                    sslPort :function() {
                        _this.sslPort();
                    }
                }
            });
    };
    Websocket.prototype.show = function() {
        if (this.client && !this.client.isConnected()) {
            this.disconnect();
        }
        this.$html.show();
    };
    Websocket.prototype.hide = function() {
        this.$html.hide();
    };
    Websocket.prototype.newClient = function() {
        this.client = new Paho.MQTT.Client(
                this.vmWS.cInfo.host,
                Number(this.vmWS.cInfo.port),
                this.vmWS.cInfo.clientId);
    };
    Websocket.prototype.sslPort = function() {
        var useSSL = this.vmWS.cInfo.useSSL;
        if (useSSL) {
            this.vmWS.cInfo.port = 8084
        } else {
            this.vmWS.cInfo.port = 8083
        }
    };
    Websocket.prototype.connect = function() {
        var _this = this;
        _this.newClient();

        if (!_this.client) {
            return;
        }
        // called when the client loses its connection
        _this.client.onConnectionLost = function(responseObject) {
            if (responseObject.errorCode !== 0) {
                console.log("onConnectionLost: " + responseObject.errorMessage);
            }
            _this.disconnect();
        }
        // called when a message arrives
        _this.client.onMessageArrived = function(message) {
            // console.log("onMessageArrived: " + message.payloadString);
            message.arrived_at = (new Date()).format("yyyy-MM-dd hh:mm:ss");
            try {
                message.msgString = message.payloadString;
            } catch (e) {
                message.msgString = "Binary message(" +  message.payloadBytes.length + ")";
            }
            _this.vmWS.receiveMsgs.push(message);
        }
        
        var options = {
            onSuccess : function() {
                console.log("The client connect success.");
                _this.vmWS.connState = true;
            },
            onFailure : function(err) {
                alert("The client connect failure " + err.errorMessage);  
               // console.log("==========." + err.errorMessage);
               // console.log("==========." + JSON.stringify(err));
               //console.log("The client connect failure.");
                _this.vmWS.connState = false;
            }
        };
        var userName = _this.vmWS.cInfo.userName;
        var password = _this.vmWS.cInfo.password;
        var keepAlive = _this.vmWS.cInfo.keepAlive;
        var cleanSession = _this.vmWS.cInfo.cleanSession;
        var useSSL = _this.vmWS.cInfo.useSSL;
        if (userName) {
            options.userName = userName;
        }
        if (password) {
            options.password = password;
        }
        if (keepAlive) {
            options.keepAliveInterval = Number(keepAlive);
        }
        options.cleanSession = cleanSession;
        options.useSSL= useSSL;
        _this.client.connect(options);
    };
    Websocket.prototype.disconnect = function() {
        var _this = this;
        if (_this.client && _this.client.isConnected()) {
            _this.client.disconnect();
            _this.client = null;
        }
        console.log("The client disconnect success.");
        _this.vmWS.connState = false;
    };
    Websocket.prototype.subscribe = function() {
        var _this = this;
        if (!_this.client || !_this.client.isConnected()) {
            alert('The client does not connect to the broker');
            return;
        }
        if (!_this.vmWS.subInfo.topic) {
            alert('Please subscribe to the topic.');
            return;
        }
        this.client.subscribe(_this.vmWS.subInfo.topic, {
            qos : Number(_this.vmWS.subInfo.qos),
            onSuccess : function(msg) {
                console.log(JSON.stringify(msg));
                _this.vmWS.subInfo.time = (new Date()).format("yyyy-MM-dd hh:mm:ss");
                _this.vmWS.subscriptions.push(_this.vmWS.subInfo);
                _this.vmWS.subInfo = {qos : _this.vmWS.subInfo.qos};
            },
            onFailure : function(err) {
                if (err.errorCode[0] == 128) {
                    alert('The topic cannot SUBSCRIBE for ACL Deny');
                    console.log(JSON.stringify(err));
                }
            }
        });
           };
    Websocket.prototype.sendMessage = function() {
        var _this = this;
        var text = _this.vmWS.sendInfo.text;
        if (!_this.client || !_this.client.isConnected()) {
            alert('The client does not connect to the broker');
            return;
        }
        if (!_this.vmWS.sendInfo.topic) {
            alert('Please fill in the message topic.');
            return;
        }
        if (!text) {
            alert('Please fill in the message content.');
            return;
        }
        var message = new Paho.MQTT.Message(text);
        message.destinationName = _this.vmWS.sendInfo.topic;
        message.qos = Number(_this.vmWS.sendInfo.qos);
        message.retained = _this.vmWS.sendInfo.retained;
        _this.client.send(message);
        _this.vmWS.sendInfo.time = (new Date()).format("yyyy-MM-dd hh:mm:ss");
        _this.vmWS.sendMsgs.push(this.vmWS.sendInfo);
        _this.vmWS.sendInfo = {
                topic : _this.vmWS.sendInfo.topic,
                qos : _this.vmWS.sendInfo.qos,
                retained : _this.vmWS.sendInfo.retained};
    };


    // Functions----------------------------------------

    var openModule = function() {
        modules.websocket = new Websocket();
        modules.websocket.show();
    };


    dashboard.init = function() {
        var _this = this;

        _this.webapi = WebAPI.init({
            callback : function() {
                sog.mainFooter.toBottom();
            }
        });

        openModule();
    };

})((function() {
    if (!window.dashboard) {
        window.dashboard = {}
    }
    return window.dashboard;
})(), jQuery);
