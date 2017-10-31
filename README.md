# Export Android VectorDrawable

Exports assets as a VectorDrawable for Android. Say goodbye to a bajillion assets.

![screenshot](img/screenshot1.png)

Supports [VectorDrawable], [VectorDrawableCompat] as well as [vector-compat]

Added in the option to generate a VectorDrawable without the compat options. 

## Installing Plugins
### The conventional way:
1. [Download the ZIP file with the Measure](https://github.com/jacobmoncur/SketchVectorDrawable/archive/master.zip)
2. Copy the contents to the plugin folder (Open up Sketch, and go to `Plugins` › `Reveal Plugins Folder…` to open it.)

### The quickest way:

_NOTE: If your Mac has not installed GitHub client, You need to install [GitHub for mac](https://mac.github.com)_

1. Click on the [Clone in Desktop](github-mac://openRepo/https://github.com/jacobmoncur/SketchVectorDrawable) button on GitHub
2. Press `command` + `shift` + `g` to find plugin folder, then paste plugin folder path

**Plugin Folder Path**

* App Store `~/Library/Containers/com.bohemiancoding.sketch3/Data/Library/Application Support/com.bohemiancoding.sketch3/Plugins`
* Beta `~/Library/Application Support/com.bohemiancoding.sketch3/Plugins`

## Shortcuts

* Export: cmd + shift + ;

## Props to:

* [svg2android]. Svg to VectorDrawable webpage (super cool). A lot of the translation is based off this.
* [sketch-export-assets]. What I based this sketch plugin off of.

[svg2android]:https://github.com/inloop/svg2android
[sketch-export-assets]:https://github.com/geertwille/sketch-export-assets
[VectorDrawable]:https://developer.android.com/reference/android/graphics/drawable/VectorDrawable.html
[VectorDrawableCompat]:https://developer.android.com/guide/topics/graphics/vector-drawable-resources.html#vector-drawables-backward-solution
[vector-compat]:https://github.com/wnafee/vector-compat
