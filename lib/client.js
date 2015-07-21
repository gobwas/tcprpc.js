var net              = require("net"),
    fs               = require("fs"),
    inherits         = require("inherits-js"),
    EventEmitter     = require("events").EventEmitter,
    debug            = require("debug")("daemon"),
    Request          = require("./request").Request,
    Success          = require("./response").Success,
    Error            = require("./response").Error,
    ErrorDescription = require("./response").ErrorDescription,
    async            = require("async"),
    assert           = require("assert"),
    _                = require("lodash"),
    uuid             = require("uuid"),
    Client;

Client = inherits(EventEmitter,
    /**
     *  @lends Client.prototype
     */
    {
        constructor: function(config) {
            var self = this,
                server, connectArgs, socket,
                buffer;

            this.requests = [];
            this.pending = {};

            switch (config.listen) {
                case "socket": {
                    connectArgs = [ config.socket.path ];
                    break;
                }

                case "ip": {
                    connectArgs = [ config.ip.port, config.ip.host ];
                    break;
                }

                default: {
                    throw new Error("Could not determine configuration for client");
                }
            }

            this.config = config;
            this.connectArgs = connectArgs;

            this.socket = socket = new net.Socket();

            socket.on("connect", function() {
                self.emit(self.constructor.CONNECT);
            });

            // buffer of not delimeted chunks
            buffer = [];

            socket.on('data', function(chunk) {
                var parts, part, response, joined;

                parts = chunk.toString().split(config.message.delimeter);

                parsing: while (parts.length > 0) {
                    part = parts.shift();

                    buffer.push(part);

                    // just break if it was the last part,
                    // cause it is not full yet
                    if (parts.length == 0) {
                        break parsing;
                    }

                    // join & clear buffer
                    joined = buffer.join("");
                    buffer = [];

                    try {
                        response = JSON.parse(joined);
                    } catch (err) {
                        self.emit(self.constructor.ERROR, err);

                        // just try to parse the other parts
                        continue parsing;
                    }

                    try {
                        if (response.error) {
                            response = Error.fromJSON(response);
                        } else {
                            response = Success.fromJSON(response);
                        }
                    } catch (err) {
                        self.emit(self.constructor.ERROR, err);
                        continue parsing;
                    }

                    self.emit(self.constructor.RESPONSE, response);

                    if (!(pending = self.pending[response.id])) {
                        // unknown id
                        continue parsing;
                    }

                    try {
                        response instanceof Error ? pending.reject(response.error) : pending.resolve(response.result);
                    } catch (err) {
                        self.emit(self.constructor.ERROR, err);
                    }

                    delete self.pending[response.id];
                }
            });

            socket.on('error', function(err) {
                self.emit(self.constructor.ERROR, err);
            });

            socket.on('end', function() {
                self.emit(self.constructor.END);
            });

            socket.on('close', function() {
                self.emit(self.constructor.CLOSE);
            });

            socket.on('timeout', function() {
                self.emit(self.constructor.TIMEOUT);
            });

            socket.connect.apply(socket, connectArgs);
        },

        request: function(topic, params, callback) {
            var self = this,
                id, request;

            id = uuid.v4();
            request = new Request(id, topic, params);

            this.pending[id] = {
                resolve: function(result) {
                    callback(null, result);
                },
                reject: function(err) {
                    callback(err);
                }
            };

            this.socket.write(JSON.stringify(request) + this.config.message.delimeter);

            this.emit(this.constructor.REQUEST, request);
        }
    },
    {
        REQUEST: 0,
        RESPONSE: 1,
        ERROR: 2,
        CONNECT: 3,
        END: 4,
        CLOSE: 5,
        TIMEOUT: 6
    }
);

module.exports = { Client: Client };
