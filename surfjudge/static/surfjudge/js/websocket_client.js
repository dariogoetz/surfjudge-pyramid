var WebSocketClient = function(options){
    var defaults = {
        host: 'localhost',
        port: 6544,
        channels: {},
    };
    this.options = $.extend(defaults, options);

    this.websocket = null;

    this.init();
}

WebSocketClient.prototype = {
    constructor: WebSocketClient,

    init: function(){
        var _this = this;
        // generate websocket
        this.websocket = new WebSocket('ws://' + this.options.host + ':' + this.options.port);

        // register dispatcher with websocket
        this.websocket.onmessage = function(event){
            _this.dispatch(JSON.parse(event.data));
        };

        var deferred = $.Deferred();

        this.websocket.onopen = function(){
            // subscribe to all channels specified in options
            $.each(_this.options.channels, function(key){
                _this.subscribe(key);
            });
            deferred.resolve();
        }
        this.initialized = deferred.promise();
    },

    subscribe: function(channel){
        console.log('Subscribing to websocket channel ' + channel);
        this.websocket.send(JSON.stringify({'action': 'subscribe', 'channel': channel}));
    },

    dispatch: function(data){
        console.log('Received message ' + data);
        var channel = data['channel'];
        var consumer = this.options.channels[channel];
        if (consumer){
            this.initialized.done(function(){
                consumer(data['message']);
            });
        }
    },
}
