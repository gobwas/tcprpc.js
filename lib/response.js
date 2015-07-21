var assert = require("assert"),
    inherits = require("inherits-js"),
    _ = require("lodash"),
    Success, Error;

function Response(id, result) {
    assert(!_.isUndefined(id), "Id is expected");
    this.id = id;
}

Response.fromJSON = function(obj) {
    return new this(obj.id);
};


Success = inherits(Response,
    {
        constructor: function(id, result) {
            Response.prototype.constructor.call(this, id);
            this.result = result;
        }
    },

    {
        fromJSON: function(obj) {
            return new this(obj.id, obj.result);
        }
    }
);


function ErrorDescription(code, message) {
    assert(_.isNumber(code), "Code is expected to be a number");
    assert(_.isString(message), "Message is expected to be a string");

    this.code = code;
    this.message = message;
}

Error = inherits(Response,
    {
        constructor: function(id, error) {
            assert(error instanceof ErrorDescription, "ErrorDescription is expected");

            Response.prototype.constructor.call(this, id);

            this.error = error;
        }
    },

    {
        fromJSON: function(obj) {
            return new this(obj.id, new ErrorDescription(obj.error.code, obj.error.message));
        }
    }
);

module.exports = {
    Error: Error,
    Success: Success,
    Response: Response,
    ErrorDescription: ErrorDescription
};
