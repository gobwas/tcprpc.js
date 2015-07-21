var debug = require("debug")("renderer"),
    config = require("../resource/config.json"),
    Client = require("./client.js").Client,
    Hapi = require('hapi'),
    _ = require("lodash"),
    assert = require("assert"),
    path = require("path"),
    client, web;

debug("Booting node.js web server");

client = new Client(config.tcp);

client.on(Client.CONNECT, function() {
    debug("Connected to the socket at %o", client.connectArgs);
});

client.on(Client.ERROR, function(err) {
    debug("Got error: " + err.stack);
    process.exit(1);
});

client.on(Client.END, function() {
    debug("Socket ended");
});

client.on(Client.CLOSE, function() {
    debug("Socket closed");
});

client.on(Client.TIMEOUT, function() {
    debug("Socket timedout");
});

client.on(Client.REQUEST, function(request) {
    debug("Sent request %o", request);
});

client.on(Client.RESPONSE, function(response) {
    debug("Got response %o", response);
});

// Create a server with a host and port
web = new Hapi.Server();
web.connection({
    host: 'localhost',
    port: 3002
});

// Add the route
web.route({
    method: 'GET',
    path: '/render/{template}/{user}',
    handler: function (request, reply) {
        client.request(
            "render",
            [
                encodeURIComponent(request.params.template),
                {
                    name: request.params.user
                }
            ],
            function(err, result) {
                reply(err, result);
            }
        );
    }
});

// Start the server
web.start();
