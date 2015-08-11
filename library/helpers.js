/* Helper methods */
String.prototype.f = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

Array.prototype.pushUnique = function (item) {
    if (this.indexOf(item) == -1) {
        this.push(item);
        return true;
    }
    return false;
};

String.prototype.repeat = function (num) {
    return new Array(num + 1).join(this);
};

function toBool(s, defValue) {
    if (typeof s === "undefined") {
        return typeof defValue !== "undefined" ? defValue : false;
    }
    return "false" !== s;
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (str) {
        return this.indexOf(str) == 0;
    };
}
