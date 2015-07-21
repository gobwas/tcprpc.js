var net          = require("net"),
    fs           = require("fs"),
    inherits     = require("inherits-js"),
    EventEmitter = require("events").EventEmitter,
    debug        = require("debug")("daemon"),
    Request      = require("./request").Request,
    async        = require("async"),
    assert       = require("assert"),
    _            = require("lodash"),
    Server;


function done(id, data) {
    assert(!_.isUndefined(id), "Id is expected");

    return {
        id:     id,
        result: data || null
    };
}

function failed(id, err) {
    return {
        id: id || null,
        error: {
            code:    err.code || -1,
            message: err.message || "Unknown error"
        }
    };
}

function sender(connection, config) {
    return function(resp) {
        connection.write(JSON.stringify(resp) + config.message.delimeter);
    };
}

Server = inherits( EventEmitter,
    /**
     * @lends Server.prototype
     */
    {
        constructor: function(config) {
            var self = this,
                server, socketPath, listenArgs;

            self.counter = 0;

            switch (config.listen) {
                case "socket": {
                    socketPath = config.socket.path;
                    listenArgs = [ socketPath ];

                    self.mask = process.umask(0);
                    if (fs.existsSync(socketPath)) {
                        fs.unlinkSync(socketPath);
                    }

                    break;
                }

                case "ip": {
                    listenArgs = [ config.ip.port, config.ip.host ];
                    break;
                }

                default: {
                    throw new Error("Could not determine configuration for server");
                }
            }

            this.config = config;
            this.listenArgs = listenArgs;

            EventEmitter.prototype.constructor.call(this);

            server = this.server = net.createServer(function(connection) {
                var buffer, id, send;

                id = self.counter++;

                self.emit(self.constructor.CONNECTION, id);

                buffer = [];

                send = sender(connection, config);

                connection.on("data", function(chunk) {
                    var parts, requests, obj, joined;

                    parts = chunk.toString().split(config.message.delimeter);

                    // if there are no closing symbols
                    // just wait for them
                    if (parts.length == 1) {
                        buffer.push(chunk);
                        return;
                    }

                    requests = [];

                    while ( (part = parts.shift()) != void 0 ) {
                        // stack part
                        buffer.push(part);

                        // case, when the last part is incompleted yet
                        if ( parts.length == 0 ) {
                            break;
                        }

                        joined = buffer.join('');
                        buffer = [];

                        try {
                            obj = JSON.parse(joined);
                        } catch (err) {
                            continue;
                        }

                        try {
                            requests.push(Request.fromJSON(obj));
                        } catch (err) {
                            self.emit(self.constructor.ERROR, err, id);

                            send(failed((obj && obj.id) || null, {
                                code:    -32600,
                                message: "Invalid request"
                            }));
                        }
                    }

                    requests.forEach(function(request) {
                        var pool;

                        self.emit(self.constructor.REQUEST, request, id);

                        if ( (pool = self.handlers[request.topic]) && pool.length > 0 ) {
                            async.reduce(
                                pool,
                                void 0,
                                function(result, handler, next) {
                                    if ( result != void 0 ) {
                                        return next(null, result);
                                    }

                                    try {
                                        handler.call(null, request.params, function(err, result) {
                                            if (err) {
                                                return next(err);
                                            }

                                            next(null, result);
                                        });
                                    } catch (err) {
                                        next(err);
                                    }
                                },
                                function(err, result) {
                                    if (err) {
                                        return send(failed(request.id, err));
                                    }

                                    send(done(request.id, result));
                                }
                            );
                        } else {
                            send(failed({
                                "code": -32601,
                                "message": "Method not found"
                            }));
                        }
                    });
                });

                connection.on("end", function() {
                    self.emit(self.constructor.END, id);
                })
            });

            server.on("error", function(err) {
                self.emit(self.constructor.ERROR, err);
            });

            this.handlers = [];
        },

        listen: function() {
            var self = this;

            this.server.listen.apply(this.server, this.listenArgs.concat(function() {
                if (self.mask) {
                    process.umask(self.mask);
                    self.mask = null;
                }

                self.emit(self.constructor.LISTENING);
            }));

            return this;
        },

        use: function(topic, handler) {
            var pool;

            if ( !(pool = this.handlers[topic]) ) {
                pool = this.handlers[topic] = [];
            }

            pool.push(handler);

            return this;
        }
    },

    /**
     * @lends Server
     */
    {
        REQUEST: 0,
        ERROR: 1,
        LISTENING: 2,
        CONNECTION: 3,
        END: 4
    }
);

module.exports = Server;
