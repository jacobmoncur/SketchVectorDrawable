@import 'library/helpers.js'
@import 'library/svg_shape_converter.js'
@import 'library/cssjson.js'
@import 'library/htmlparser.js'

var DRAW_LINE = "l"; //used as default parameter when no found in path
var START_PATH = "M";
var END_PATH = "Z";
var INDENT = "    ";

var pathsParsedCount = 0;
var generatedOutput = "";
var lastFileName = "";
var lastFileData;
var warnings = [];
var error = null
var includeVC = true;


Generator = function(){ }

Generator.prototype.generateVectorDrawableAsync = function(filePath, callback){
    var svgAsString = NSString.stringWithContentsOfFile(filePath);
    var parsedVectorDrawable = parseFile(svgAsString);
    callback(error, parsedVectorDrawable);
}

Generator.prototype.generateVectorDrawable = function(filePath, includeVC){
    this.includeVC = includeVC;
    var svgAsString = NSString.stringWithContentsOfFile(filePath);
    var parsedVectorDrawable = parseFile(svgAsString);
    return parsedVectorDrawable
}

//Main parse & convert logic
function recursiveTreeWalk(parent, groupLevel) {
    for ( var i = 0; i < parent.children.length; i++ ) {
        var current = parent.children[i];
        if (current["name"] == "g" && current.children.length > 0) { //Group tag, ignore empty groups
            var group = parseGroup(current);
            var ignoreGroup = group.isSet;
            if (ignoreGroup) printGroupStart(group, groupLevel);

            if (ignoreGroup) groupLevel++;
            recursiveTreeWalk(current, groupLevel);
            if (ignoreGroup) groupLevel--;

            if (ignoreGroup) printGroupEnd(groupLevel);
        } else if (current["name"] == "path") {
            var pathD = parsePathD(current);
            if (pathD != null) {
                printPath(pathD, getStyles(current, parent), groupLevel);
            } else {
                warnings.pushUnique("found path(s) without data (empty or invalid parameter <i>d</i>)");
            }
        } else if (current["name"] == "line") {
            printPath(ShapeConverter.convertLine(current), getStyles(current, parent), groupLevel);
        } else if (current["name"] =="rect") {
            printPath(ShapeConverter.convertRect(current), getStyles(current, parent), groupLevel);
        } else if (current["name"] == "circle") {
            printPath(ShapeConverter.convertCircle(current), getStyles(current, parent), groupLevel);
        } else if (current["name"] == "ellipse") {
            printPath(ShapeConverter.convertEllipse(current), getStyles(current, parent), groupLevel);
        } else if (current["name"] == "polyline") {
            printPath(ShapeConverter.convertPolygon(current, true), getStyles(current, parent), groupLevel);
        } else if (current["name"] == "polygon") {
            printPath(ShapeConverter.convertPolygon(current, false), getStyles(current, parent), groupLevel);
        } else if (current["name"] == "text") {
            warnings.pushUnique("<i>text</i> element is not supported, export all text into path");
        }
    });
}

function getStyles(child, parent) {
    var styles = parseStyles(child);
    var parentStyles = (parent["name"] == "g") ? parseStyles(parent) : null;
    return [styles, parentStyles];
}

function parseGroup(groupTag) {
    var transform = groupTag["attributes"]["transform"]
    var transformId = groupTag["attributes"]["id"]
    var groupTransform = {transformX: 0, transformY: 0, scaleX: 1, scaleY: 1, rotate:0, rotatePivotX:-1, rotatePivotY:-1, id:"", isSet:false};
    if (transform !== null && typeof transform !== "undefined") {
        transform = transform.replace(/[()]/g , "*")
        var regex = /([\w|\s]+)\*([^\*]+)+/mg
        var result;
        while (result = regex.exec(transform)) {
            var split = result[2].split(/[,\s]+/);
            var transformName = result[1].trim();
            if (transformName == "translate") {
                groupTransform.transformX = split[0];
                groupTransform.transformY = split[1] || 0;
                groupTransform.isSet = true;
            } else if (transformName == "scale") {
                groupTransform.scaleX = split[0];
                groupTransform.scaleY = split[1] || 0;
                groupTransform.isSet = true;
            } else if (transformName == "rotate") {
                groupTransform.rotate = split[0];
                groupTransform.rotatePivotX = split[1] || -1;
                groupTransform.rotatePivotY = split[2] || -1;
                groupTransform.isSet = true;
            } else {
                warnings.pushUnique("group transform '<i>" + transformName + "</i>' is not supported, use option <i>Bake transforms into path</i>")
            }
        }
    }
    if (transformId !== null && typeof transformId !== "undefined") {
        groupTransform.id = transformId;
    }
    return groupTransform
}

function parsePathD(pathData) {
    var path = pathData["attributes"]["d"];

    if (typeof path === "undefined") {
        return null;
    }

    path = path.replace(/\s{2,}/g, " "); //replace extra spaces

    if (path.match(/-?\d*\.?\d+e[+-]?\d+/g)) {
        warnings.pushUnique("found some numbers with scientific E notation in pathData which Android probably does not support. " +
        "Please fix It manually by editing your editor precision or manually by editing pathData");
    }

    //Check path If contains draw otherwise use default l
    var pathStart = false, bigM = false, skipMove = false, stop = false;
    var pathRebuild = "";
    path.split(" ").forEach(function (t) {
        if (stop) {
            pathRebuild += t + " ";
            return;
        }

        if (t.toUpperCase() == START_PATH) {
            pathStart = true;
            bigM = t == START_PATH;
        } else if (skipMove && pathStart) {
            if (!(t.indexOf(",") == -1 && isNaN(t))) {
                t = (bigM ? DRAW_LINE.toUpperCase() : DRAW_LINE) + " " + t;
            }
            stop = true;
        } else if (pathStart) {
            skipMove = true;
        }

        pathRebuild += t + " ";
    });

    path = fixPathPositioning(pathRebuild);
    path = fixNumberFormatting(path);

    if (!path.endsWith(" ")) {
        path += " ";
    }

    return wordwrap(path.trim(), 80, "\n");
}


function parseStyles(path) {
    //Convert attributes to style
    var attributes = path["attributes"];
    var stylesArray = {};
    for (var key in attributes) {
        if(attributes.hasOwnProperty(key)){
          var name = key;
          var value = attributes[key];
          if (name == "style") {
              //Fix CSSJSON bug
              if (!value.endsWith(";")) {
                  value += ";"
              }
              var cssAttributes = CSSJSON.toJSON(value).attributes;
              for (var key in cssAttributes) {
                  if (cssAttributes.hasOwnProperty(key)) {
                      stylesArray[key] = cssAttributes[key];

                      if ((key == "fill" || key == "stroke") && cssAttributes[key].startsWith("url")) {
                          warnings.pushUnique("found fill(s) or stroke(s) which uses <i>url()</i> (gradients and patterns are not supported in Android)");
                      }
                  }
              }
          } else {
              stylesArray[name] = value;
          }
        }
    }

    return stylesArray;
}

function printGroupStart(groupTransform, groupLevel) {
    generatedOutput += INDENT.repeat(groupLevel + 1) + '<group\n';
    generatedOutput += generateAttr("name", groupTransform.id, groupLevel + 1, "");
    generatedOutput += generateAttr("translateX", groupTransform.transformX, groupLevel + 1, 0);
    generatedOutput += generateAttr("translateY", groupTransform.transformY, groupLevel + 1, 0);
    if (this.includeVC){
    	generatedOutput += generateCompatAttr("vc_translateX", groupTransform.transformX, groupLevel + 1, 0);
    	generatedOutput += generateCompatAttr("vc_translateY", groupTransform.transformY, groupLevel + 1, 0);
    }
    generatedOutput += generateAttr("scaleX", groupTransform.scaleX, groupLevel + 1, 1);
    generatedOutput += generateAttr("scaleY", groupTransform.scaleY, groupLevel + 1, 1);
    if (generatedOutput.endsWith("\n")) {
        generatedOutput = generatedOutput.substr(0, generatedOutput.length - 1);
    }
    generatedOutput += ">\n";
}

function printGroupEnd(groupLevel) {
    generatedOutput += INDENT.repeat(groupLevel + 1) + '</group>\n';
}

function printPath(pathData, stylesArray, groupLevel) {
    var styles = stylesArray[0];
    var parentGroupStyles = stylesArray[1];

    if (pathData == null) {
        return;
    }

    if (styles.hasOwnProperty("transform")) {
        warnings.pushUnique("transforms on path are not supported, use option <i>Bake transforms into path</i>")
    }

    if (parentGroupStyles != null) {
        //Inherit styles from group first
        for (var styleName in parentGroupStyles) {
            if (typeof styles[styleName] === "undefined") {
                styles[styleName] = parentGroupStyles[styleName];
            }
        }
    }
    //Parent opacity setting - multiply fill-opacity and stroke-opacity
    var opacity = styles["opacity"];
    if (typeof opacity !== "undefined") {
        if (typeof styles["fill-opacity"] !== "undefined") {
            styles["fill-opacity"] *= opacity;
        } else {
            styles["fill-opacity"] = opacity;
        }
        if (typeof styles["stroke-opacity"] !== "undefined") {
            styles["stroke-opacity"] *= opacity;
        } else {
            styles["stroke-opacity"] = opacity;
        }
    }

    //If fill is omitted use default black
    if (typeof styles["fill"] === "undefined") {
        styles["fill"] = "#000000";
    }


    generatedOutput += INDENT.repeat(groupLevel + 1) + '<path\n';
    generatedOutput += generateAttr('name', styles["id"], groupLevel, "");
    generatedOutput += generateAttr('fillColor', parseColorToHex(styles["fill"]), groupLevel, "none");
    generatedOutput += generateAttr('fillAlpha', styles["fill-opacity"], groupLevel, "1");
    generatedOutput += generateAttr('strokeColor', parseColorToHex(styles["stroke"]), groupLevel, "none");
    generatedOutput += generateAttr('strokeAlpha', styles["stroke-opacity"], groupLevel, "1");
    generatedOutput += generateAttr('strokeWidth', removeNonNumeric(styles["stroke-width"]), groupLevel, "0");
    generatedOutput += generateAttr('strokeLineJoin', styles["stroke-linejoin"], groupLevel, "miter");
    generatedOutput += generateAttr('strokeMiterLimit', styles["stroke-miterlimit"], groupLevel, "4");
    generatedOutput += generateAttr('strokeLineCap', styles["stroke-linecap"], groupLevel, "butt");
    
    if (this.includeVC){
    	generatedOutput += generateAttr('pathData', pathData, groupLevel, null, false);
    	generatedOutput += generateCompatAttr('vc_fillColor', parseColorToHex(styles["fill"]), groupLevel, "none");
    	generatedOutput += generateCompatAttr('vc_fillAlpha', styles["fill-opacity"], groupLevel, "1");
    	generatedOutput += generateCompatAttr('vc_strokeColor', parseColorToHex(styles["stroke"]), groupLevel, "none");
    	generatedOutput += generateCompatAttr('vc_strokeAlpha', styles["stroke-opacity"], groupLevel, "1");
    	generatedOutput += generateCompatAttr('vc_strokeWidth', removeNonNumeric(styles["stroke-width"]), groupLevel, "0");
    	generatedOutput += generateCompatAttr('vc_strokeLineJoin', styles["stroke-linejoin"], groupLevel, "miter");
    	generatedOutput += generateCompatAttr('vc_strokeMiterLimit', styles["stroke-miterlimit"], groupLevel, "4");
    	generatedOutput += generateCompatAttr('vc_strokeLineCap', styles["stroke-linecap"], groupLevel, "butt");
    	generatedOutput += generateCompatAttr('vc_pathData', pathData, groupLevel, null, true);
    } else {
    	generatedOutput += generateAttr('pathData', pathData, groupLevel, null, true);
    }
    pathsParsedCount++;
}

function parseFile(inputXml) {
    lastFileData = inputXml;

    var xml;
    try {
      var xmlStripped = inputXml.replace(/^(<\?xml\s*(.*)\s*\?>)/,"");
      var xml = HTMLtoXML(xmlStripped);
    } catch (e) {
        setMessage("<b>Error:</b> not valid SVG file.", "alert-danger");
        return null;
    }

    //Reset previous
    pathsParsedCount = 0;
    warnings = [];

    var svg = xml;

    //Parse dimensions
    var dimensions = getDimensions(svg);
    var width = dimensions.width;
    var height = dimensions.height;

    //XML Vector start
    generatedOutput = '<?xml version="1.0" encoding="utf-8"?>\n';
    generatedOutput += '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n';
    generatedOutput += INDENT + 'xmlns:tools="http://schemas.android.com/tools"\n';
    generatedOutput += INDENT + 'tools:ignore="NewApi"\n';
    generatedOutput += INDENT + 'android:width="{0}dp"\n'.f(width);
    generatedOutput += INDENT + 'android:height="{0}dp"\n'.f(height);
    generatedOutput += INDENT + 'android:viewportWidth="{0}"\n'.f(width);
    generatedOutput += INDENT + 'android:viewportHeight="{0}"\n'.f(height);
    if (this.includeVC){
    	generatedOutput += INDENT + 'app:vc_viewportWidth="{0}"\n'.f(width);
    	generatedOutput += INDENT + 'app:vc_viewportHeight="{0}">\n\n'.f(height);
    } else {
    	generatedOutput += INDENT + '>\n\n';
    }

    //XML Vector content
    //Iterate through groups and paths
    recursiveTreeWalk(svg, 0);

    //XML Vector end
    generatedOutput += '</vector>';

    //SVG must contain path(s)
    if (pathsParsedCount == 0) {
        setMessage("No shape elements found in svg.", "alert-danger");
    }

    if (warnings.length == 1) {
        setMessage("<b>Warning:</b> " + warnings[0], "alert-warning")
    } else if (warnings.length > 1) {
        var warnText = "";
        warnings.forEach(function (w, i) {
            warnText += "<tr><td><b>Warning #" + (i + 1) + ":</b></td><td>" + w + "</td></tr>";
        });
        setMessage("<table class='info-items'>" + warnText + "</table>", "alert-warning")
    }

    return generatedOutput;
}

function fixPathPositioning(path) {
    return path.replace(/^\s*m/, START_PATH).replace(/^\s*z/, END_PATH);
}

function fixNumberFormatting(path) {
    var regex = new RegExp(/([1-9][0-9]*\.?[0-9]*|\.[0-9]+)([e][+-]?[0-9]*[0-9]+?)/g);
    path = path.replace(regex, "0")
    return path.replace(/(\.\d+)(\.\d+)\s?/g, "\$1 \$2 ");
}

function getDimensions(svg) {
    var widthAttr = svg.attributes["width"];
    var heightAttr = svg.attributes["height"];
    var viewBoxAttr = svg.attributes["viewBox"];

    if (typeof viewBoxAttr === "undefined") {
        if (typeof widthAttr === "undefined" || typeof heightAttr === "undefined") {
            warnings.pushUnique("width or height not set for svg (set -1)");
            return {width: -1, height: -1};
        } else {
            return {width: convertDimensionToPx(widthAttr), height: convertDimensionToPx(heightAttr)};
        }
    } else {
        var viewBoxAttrParts = viewBoxAttr.split(/[,\s]+/);
        if (viewBoxAttrParts[0] > 0 || viewBoxAttrParts[1] > 0) {
            warnings.pushUnique("viewbox minx/miny is other than 0 (not supported)");
        }
        return {width: viewBoxAttrParts[2], height: viewBoxAttrParts[3]};
    }

}

function removeNonNumeric(input) {
    if (typeof input === "undefined") return input;
    return input.replace(/[^0-9.]/g, "");
}


function generateAttr(name, val, groupLevel, def, end) {
    if (typeof val === "undefined" || val == def) return "";
    return INDENT.repeat(groupLevel + 2) + 'android:{0}="{1}"{2}\n'.f(name, val, end ? ' />' : '');
}

function wordwrap(str, width, brk, cut) {
    brk = brk || '\n';
    width = width || 75;
    cut = cut || false;

    if (!str) {
        return str;
    }

    var regex = '.{1,' + width + '}(\\s|$)' + (cut ? '|.{' + width + '}|.+$' : '|\\S+?(\\s|$)');

    var matches = str.match(new RegExp(regex, 'g'));
    // trim off leading/trailing spaces from the matched strings
    for (i = 0; i < matches.length; i++) {
        matches[i] = matches[i].trim();
    }

    return matches.join(brk);
}

//Parse rgb, named colors to hex
function parseColorToHex(color) {
    if (typeof color === "undefined") return color;
    color = color.replace(/\s/g, "");

    //Is hex already
    if (color.substr(0, 1) === "#") {
        return color;
    } else {
        if (color.startsWith("rgb(")) {
            var match = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(color);
            return match !== null && match.length >= 4 ? rgb2hex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3])) : color;
        } else {
            var hexClr = name2hex(color);
            return !hexClr.startsWith("Invalid") ? hexClr : color;
        }
    }
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}


function convertDimensionToPx(dimen) {
    var val = removeNonNumeric(dimen);
    var METER_TO_PX = 3543.30709;
    var INCH_TO_PX = 90;
    var PT_TO_PX = 1.25;
    var PC_TO_PX = 15;
    var FT_TO_PX = 1080;

    if (dimen.endsWith("mm")) {
        return val * (METER_TO_PX / 1000);
    } else if (dimen.endsWith("cm")) {
        return val * (METER_TO_PX / 100);
    } else if (dimen.endsWith("m")) {
        return val * METER_TO_PX;
    } else if (dimen.endsWith("in")) {
        return val * INCH_TO_PX;
    } else if (dimen.endsWith("pt")) {
        return val * PT_TO_PX;
    } else if (dimen.endsWith("pc")) {
        return val * PC_TO_PX;
    } else if (dimen.endsWith("ft")) {
        return val * FT_TO_PX;
    } else {
        return val;
    }
}

function setMessage(text, type) {
  error = text + " " + type
}

function name2hex(n) {
        n = n.toLowerCase();
        var nar = {
            "aliceblue": "#f0f8ff",
            "antiquewhite": "#faebd7",
            "aqua": "#00ffff",
            "aquamarine": "#7fffd4",
            "azure": "#f0ffff",
            "beige": "#f5f5dc",
            "bisque": "#ffe4c4",
            "black": "#000000",
            "blanchedalmond": "#ffebcd",
            "blue": "#0000ff",
            "blueviolet": "#8a2be2",
            "brown": "#a52a2a",
            "burlywood": "#deb887",
            "cadetblue": "#5f9ea0",
            "chartreuse": "#7fff00",
            "chocolate": "#d2691e",
            "coral": "#ff7f50",
            "cornflowerblue": "#6495ed",
            "cornsilk": "#fff8dc",
            "crimson": "#dc143c",
            "cyan": "#00ffff",
            "darkblue": "#00008b",
            "darkcyan": "#008b8b",
            "darkgoldenrod": "#b8860b",
            "darkgray": "#a9a9a9",
            "darkgrey": "#a9a9a9",
            "darkgreen": "#006400",
            "darkkhaki": "#bdb76b",
            "darkmagenta": "#8b008b",
            "darkolivegreen": "#556b2f",
            "darkorange": "#ff8c00",
            "darkorchid": "#9932cc",
            "darkred": "#8b0000",
            "darksalmon": "#e9967a",
            "darkseagreen": "#8fbc8f",
            "darkslateblue": "#483d8b",
            "darkslategray": "#2f4f4f",
            "darkslategrey": "#2f4f4f",
            "darkturquoise": "#00ced1",
            "darkviolet": "#9400d3",
            "deeppink": "#ff1493",
            "deepskyblue": "#00bfff",
            "dimgray": "#696969",
            "dimgrey": "#696969",
            "dodgerblue": "#1e90ff",
            "firebrick": "#b22222",
            "floralwhite": "#fffaf0",
            "forestgreen": "#228b22",
            "fuchsia": "#ff00ff",
            "gainsboro": "#dcdcdc",
            "ghostwhite": "#f8f8ff",
            "gold": "#ffd700",
            "goldenrod": "#daa520",
            "gray": "#808080",
            "grey": "#808080",
            "green": "#008000",
            "greenyellow": "#adff2f",
            "honeydew": "#f0fff0",
            "hotpink": "#ff69b4",
            "indianred": "#cd5c5c",
            "indigo": "#4b0082",
            "ivory": "#fffff0",
            "khaki": "#f0e68c",
            "lavender": "#e6e6fa",
            "lavenderblush": "#fff0f5",
            "lawngreen": "#7cfc00",
            "lemonchiffon": "#fffacd",
            "lightblue": "#add8e6",
            "lightcoral": "#f08080",
            "lightcyan": "#e0ffff",
            "lightgoldenrodyellow": "#fafad2",
            "lightgray": "#d3d3d3",
            "lightgrey": "#d3d3d3",
            "lightgreen": "#90ee90",
            "lightpink": "#ffb6c1",
            "lightsalmon": "#ffa07a",
            "lightseagreen": "#20b2aa",
            "lightskyblue": "#87cefa",
            "lightslategray": "#778899",
            "lightslategrey": "#778899",
            "lightsteelblue": "#b0c4de",
            "lightyellow": "#ffffe0",
            "lime": "#00ff00",
            "limegreen": "#32cd32",
            "linen": "#faf0e6",
            "magenta": "#ff00ff",
            "maroon": "#800000",
            "mediumaquamarine": "#66cdaa",
            "mediumblue": "#0000cd",
            "mediumorchid": "#ba55d3",
            "mediumpurple": "#9370d8",
            "mediumseagreen": "#3cb371",
            "mediumslateblue": "#7b68ee",
            "mediumspringgreen": "#00fa9a",
            "mediumturquoise": "#48d1cc",
            "mediumvioletred": "#c71585",
            "midnightblue": "#191970",
            "mintcream": "#f5fffa",
            "mistyrose": "#ffe4e1",
            "moccasin": "#ffe4b5",
            "navajowhite": "#ffdead",
            "navy": "#000080",
            "oldlace": "#fdf5e6",
            "olive": "#808000",
            "olivedrab": "#6b8e23",
            "orange": "#ffa500",
            "orangered": "#ff4500",
            "orchid": "#da70d6",
            "palegoldenrod": "#eee8aa",
            "palegreen": "#98fb98",
            "paleturquoise": "#afeeee",
            "palevioletred": "#d87093",
            "papayawhip": "#ffefd5",
            "peachpuff": "#ffdab9",
            "peru": "#cd853f",
            "pink": "#ffc0cb",
            "plum": "#dda0dd",
            "powderblue": "#b0e0e6",
            "purple": "#800080",
            "red": "#ff0000",
            "rosybrown": "#bc8f8f",
            "royalblue": "#4169e1",
            "saddlebrown": "#8b4513",
            "salmon": "#fa8072",
            "sandybrown": "#f4a460",
            "seagreen": "#2e8b57",
            "seashell": "#fff5ee",
            "sienna": "#a0522d",
            "silver": "#c0c0c0",
            "skyblue": "#87ceeb",
            "slateblue": "#6a5acd",
            "slategray": "#708090",
            "slategrey": "#708090",
            "snow": "#fffafa",
            "springgreen": "#00ff7f",
            "steelblue": "#4682b4",
            "tan": "#d2b48c",
            "teal": "#008080",
            "thistle": "#d8bfd8",
            "tomato": "#ff6347",
            "turquoise": "#40e0d0",
            "violet": "#ee82ee",
            "wheat": "#f5deb3",
            "white": "#ffffff",
            "whitesmoke": "#f5f5f5",
            "yellow": "#ffff00",
            "yellowgreen": "#9acd32"
        };
        r = nar[n];
        if (r === undefined) {
            return "#000000";
        }
        return r;
    };
