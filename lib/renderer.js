var debug = require("debug")("renderer"),
    config = require("../resource/config.json"),
    Server = require("./server.js"),
    fest = require("fest"),
    _ = require("lodash"),
    assert = require("assert"),
    path = require("path"),
    server, listenArgs, socketPath, mask;

debug("Booting fest daemon");

server = new Server(config.tcp);

server.on(Server.LISTENING, function() {
    debug("Listening, %o", server.listenArgs);
});

server.on(Server.ERROR, function(err, id) {
    debug("Got error" + (id ? " from #" + id : "") + ": " + err.stack);
});

server.on(Server.CONNECTION, function(id) {
    debug("Connection #%d established", id);
});

server.on(Server.END, function(id) {
    debug("Connection #%d closed", id);
});

server.on(Server.REQUEST, function(request, id) {
    debug("Got request \"%s\" from #%d", request.topic, id);
});

server.use("render", function(params, next) {
    var tpl, tplPath, data, template, fn;

    assert(_.isString(tpl = params[0]), "First parameter is expected to be a string");
    assert(_.isObject(data = params[1]), "Second parameter is expected to be an object");

    tplPath = path.resolve(__dirname, "../resource/template/" + tpl + ".xml");

    debug("Compiling template: %s", tplPath);

    // fn = fest.compile(tpl);
    // debug("Compiled", fn);
    // template = (new Function('return ' + fn))();

    next(null, fest.render(tplPath, data));
});

server.listen();
