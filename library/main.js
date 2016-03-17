@import 'library/general.js'
@import 'library/messages.js'
@import 'library/sandbox.js'
@import 'library/generator.js'

main = {
    baseDir: '',
    layerVisibility: [],


    export: function(includeVC) {
        this.baseDir = this.getDirFromPrompt();

        if (this.baseDir == null) {
            this.alert("Yikes, you gotta select a directory to export to.");
            return;
        }

        // If nothing is selected tell the user so
        if ([selection count] == 0) {
            this.alert("Whoooa there partner! No layer(s) selected.");
            return;
        }

        // Hide all layers except the ones we are slicing
        for (var i = 0; i < [selection count]; i++) {
            var layer = [selection objectAtIndex:i];
            // Make sure we don't get errors if no artboard exists.
            // currentPage inerits from MSLayerGroup so it's basicly the same as an artboard
            var artboard = [layer parentArtboard] ? [layer parentArtboard] : [doc currentPage];
            this.layerVisibility = [];

            [artboard deselectAllLayers];

            var layerArray = [layer];
            [artboard selectLayers:layerArray];

            var root = artboard;

            this.hideLayers(root, layer);

            // Process the slice
            success = this.processSlice(layer, includeVC);

            // Restore layers visibility
            for (var m = 0; m < this.layerVisibility.length; m++) {
                var dict = this.layerVisibility[m];
                var layer = [dict objectForKey:"layer"];
                var visibility = [dict objectForKey:"visible"];

                if (visibility == 0) {
                    [layer setIsVisible:false];
                } else {
                    [layer setIsVisible:true];
                }
            }

            // Restore selection
            [artboard selectLayers:selection];

            if (success === false)
                return;
        }

        // Open finder window with assets exported
        this.openInFinder(this.baseDir + "/" + "android_assets/res");
    },

    // Return current working directory
    // This works better for the designer's workflow, as they mostly want to
    // save assets in the current directory
    getCwd: function() {
        var fileUrl = [doc fileURL],
        filePath = [fileUrl path],
        baseDir = filePath.split([doc displayName])[0];
        return baseDir;
    },

    // Let the user specify a directory
    getDirFromPrompt: function() {
        var panel = [NSOpenPanel openPanel];
        [panel setMessage:"Where do you want to place your assets?"];
        [panel setCanChooseDirectories: true];
        [panel setCanChooseFiles: false];
        [panel setCanCreateDirectories: true];
        var defaultDir = [[doc fileURL] URLByDeletingLastPathComponent];
        [panel setDirectoryURL:defaultDir];
        if ([panel runModal] == NSOKButton) {
            var message = [panel filename];
            return message;
        }
    },

    processSlice: function(slice, includeVC) {
        var sliceName               = [slice name].trim().toLowerCase().replace(/\s/,'_').replace(/-+/g,'_').replace(/[^0-9a-z_]/,'');
        var version                 = this.copyLayerWithFactor(slice, 1.0);
        var absoluteSVGFileName     = this.baseDir + "/" + "android_assets/res" + "/drawable/." + sliceName + ".svg";
        var absoluteAndroidFileName = this.baseDir + "/" + "android_assets/res" + "/drawable/" + sliceName + ".xml";

        [doc saveArtboardOrSlice:version toFile:absoluteSVGFileName];

        var vectorDrawable = new Generator(includeVC).generateVectorDrawable(absoluteSVGFileName);
        var ok = this.writeTextToFile(vectorDrawable, absoluteAndroidFileName);
        if (ok === false) {
            this.alert("Bummers, something went wrong trying to create the Android VectorDrawable");
            return false;
        } else {
            return true;
        }
        var error = null
        log([[NSFileManager defaultManager] removeItemAtPath:absoluteSVGFileName error:null]);
        log(error)
    },

    copyLayerWithFactor: function(originalSlice, factor) {
        var copy     = [originalSlice duplicate],
            frame    = [copy frame],
            rect     = [[copy absoluteRect] rect];
            slice    = [MSExportRequest requestWithRect:rect scale:factor];

        [copy removeFromParent];

        return slice;
    },

    // I used this code from https://github.com/nickstamas/Sketch-Better-Android-Export
    // and has been written by Nick Stamas
    // Cheers to him :)
    // Addapted it a bit for my plugin
    hideLayers: function(root, target) {
        // Hide all layers except for selected and store visibility
        for (var k = 0; k < [[root layers] count]; k++) {
            var currentLayer = [[root layers] objectAtIndex:k];
            if ([currentLayer containsSelectedItem] && currentLayer != target) {
                this.hideLayers(currentLayer, target);
            } else if (!(currentLayer == target)) {
                var dict = [[NSMutableDictionary alloc] init];
                [dict addObject:currentLayer forKey:"layer"];
                [dict addObject:[currentLayer isVisible] forKey:"visible"];

                this.layerVisibility.push(dict);
                [currentLayer setIsVisible: false];
            }
        }
    },

    writeTextToFile: function(text, path) {
        var result = false;
        if (typeof path !== 'string')
            return result;
        var nsstring = NSString.stringWithUTF8String(text);
        var error = null;
        log(path)
        result = [nsstring writeToFile:path atomically:1 encoding:NSUTF8StringEncoding error:error];
        if (!result) {
            result = false;
        } else {
            result = true;
        }

        return result;
    },

    alert: function(message) {
        var app = [NSApplication sharedApplication];
        [app displayDialog:message];
    },

    openInFinder: function(path) {
        var finderTask = [[NSTask alloc] init],
            openFinderArgs = [NSArray arrayWithObjects:"-R", path, nil];

        [finderTask setLaunchPath:"/usr/bin/open"];
        [finderTask setArguments:openFinderArgs];
        [finderTask launch];
    }

}
