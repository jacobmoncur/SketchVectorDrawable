// Based on
// https://github.com/JFXtras/jfxtras-labs/blob/2.2/src/main/java/jfxtras/labs/util/ShapeConverter.java

var ShapeConverter = new function () {
    var KAPPA = 0.5522847498307935;

    function s(number) {
        return (parseFloat(number.toPrecision(12)));
    }

    this.convertLine = function (lineTag) {
        var x1 = lineTag["attributes"]["x1"];
        var x2 = lineTag["attributes"]["x2"];
        var y1 = lineTag["attributes"]["y1"];
        var y2 = lineTag["attributes"]["y2"];

        return "M " + x1 + " " + y1 + " " + "L " + x2 + " " + y2;
    };

    this.convertRect = function (rectTag) {
        var x = parseFloat(rectTag["attributes"]["x"] || 0);
        var y = parseFloat(rectTag["attributes"]["y"] || 0);
        var w = parseFloat(rectTag["attributes"]["width"] || 0);
        var h = parseFloat(rectTag["attributes"]["height"] || 0);
        var rx = parseFloat(rectTag["attributes"]["rx"] || 0);
        var ry = parseFloat(rectTag["attributes"]["ry"] || 0);
        var r = s(x + w);
        var b = s(y + h);

        if (ry == 0) {
            ry = rx;
        } else if (rx == 0) {
            rx = ry;
        }

        if (rx == 0 && ry == 0) {
            return "M " + x + " " + y + " H " + s(x+w) + " V " + s(y+h) + " H " + x + " V " + y + " Z";
        } else {
            return "M " + s(x + rx) + " " + y + " "
                + "L " + s(r - rx) + " " + y + " "
                + "Q " + r + " " + y + " " + r + " " + s(y + ry) + " "
                + "L " + r + " " + s(y + h - ry) + " "
                + "Q " + r + " " + b + " " + s(r - rx) + " " + b + " "
                + "L " + s(x + rx) + " " + b + " "
                + "Q " + x + " " + b + " " + x + " " + s(b - ry) + " "
                + "L " + x + " " + s(y + ry) + " "
                + "Q " + x + " " + y + " " + s(x + rx) + " " + y + " "
                + "Z";
        }
    };

    this.convertCircle = function (circleTag) {
        var cx = parseFloat(circleTag["attributes"]["cx"] || 0);
        var cy = parseFloat(circleTag["attributes"]["cy"] || 0);
        var r = parseFloat(circleTag["attributes"]["r"] || 0);
        var controlDistance = r * KAPPA;

        // Move to first point
        var output = "M " + cx + " " + s(cy - r) + " ";
        // 1. quadrant
        output += "C " + s(cx + controlDistance) + " " + s(cy - r) + " " + s(cx + r) +
        " " + s(cy - controlDistance) + " " + s(cx + r) + " " + cy + " ";
        // 2. quadrant
        output += "C " + s(cx + r) + " " + s(cy + controlDistance) + " " + s(cx + controlDistance) +
        " " + s(cy + r) + " " + cx + " " + s(cy + r) + " ";
        // 3. quadrant
        output += "C " + s(cx - controlDistance) + " " + s(cy + r) + " " + s(cx - r) + " " +
        s(cy + controlDistance) + " " + s(cx - r) + " " + cy + " ";
        // 4. quadrant
        output += "C " + s(cx - r) + " " + s(cy - controlDistance) + " " + s(cx - controlDistance) + " " + s(cy - r) +
        " " + cx + " " + s(cy - r) + " ";
        // Close path
        output += "Z";

        return output;
    };

    this.convertEllipse = function (ellipseTag) {
        var cx = parseFloat(ellipseTag["attributes"]["cx"] || 0);
        var cy = parseFloat(ellipseTag["attributes"]["cy"] || 0);
        var rx = parseFloat(ellipseTag["attributes"]["rx"] || 0);
        var ry = parseFloat(ellipseTag["attributes"]["ry"] || 0);
        var controlDistanceX = rx * KAPPA;
        var controlDistanceY = ry * KAPPA;

        // Move to first point
        var output = "M " + cx + " " + s(cy - ry) + " ";
        // 1. quadrant
        output += "C " + s(cx + controlDistanceX) + " " + s(cy - ry) + " "
        + s(cx + rx) + " " + s(cy - controlDistanceY) + " " + s(cx + rx) + " " + cy + " ";
        // 2. quadrant
        output += "C " + s(cx + rx) + " " + s(cy + controlDistanceY) + " "
        + s(cx + controlDistanceX) + " " + s(cy + ry) + " "  + cx + " " + s(cy + ry) + " ";
        // 3. quadrant
        output += "C " + s(cx - controlDistanceX) + " " + s(cy + ry) + " "
        + s(cx - rx) + " " + s(cy + controlDistanceY) + " " + s(cx - rx) + " " + cy + " ";
        // 4. quadrant
        output += "C " + s(cx - rx) + " " + s(cy - controlDistanceY) + " "
        + s(cx - controlDistanceX) + " " + s(cy - ry) + " " + cx + " " + s(cy - ry) + " ";
        // Close path
        output += "Z";
        return output;
    };

    this.convertPolygon = function (polylineTag, isPolyline) {
        var points = polylineTag["attributes"]["points"];
        var pointsArrayRaw = typeof points !== "undefined" ? points.split(",") : [];
        var pointsArray = [];
        for (var i = 0; i < pointsArrayRaw.length; i++) {
            var splitted = pointsArrayRaw[i].split(" ");
            for (var j = 0; j < splitted.length; j++) {
                if (splitted[j].length > 0) {
                    pointsArray.push(splitted[j]);
                }
            }
        }

        if (pointsArray.length % 2 == 0) {
            var output = "";
            for (var i = 0 ; i < pointsArray.length ; i += 2) {
                output += (i == 0 ? "M " : "L ");
                output += pointsArray[i] + " "+ pointsArray[i+1] + " ";
            }
            if (!isPolyline) {
                output += "Z";
            }
            return output;
        } else {
            return null;
        }
    };
};
