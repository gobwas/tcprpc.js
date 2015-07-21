var assert = require("assert"),
    _ = require("lodash");

function Request(id, topic, params) {
    assert(!_.isUndefined(id), "Id is expected");
    assert(_.isString(topic), "Topic is expected to be a string");
    assert(_.isArray(params), "Params is expected to be an array");

    this.topic = topic;
    this.params = params;
    this.id = id;
}

Request.fromJSON = function(obj) {
    return new Request(obj.id, obj.topic, obj.params);
};

module.exports = { Request: Request };
