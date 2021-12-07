#!/usr/bin/env node
'use strict';
module.exports = function (context) {
    var fs = require('fs');
    var path = require('path');
    

    var rootdir = process.cwd(),
        android_www = rootdir + "/platforms/android/app/src/main/assets/www/pdfjs/",
        plugin_www = path.join(context.opts.plugin.dir, 'content');

    if (context.opts.platforms.indexOf('android') == 0) {
        console.log('############# Build android-pdf-js and copy to /www/pdfjs/ #############');
        runMake();
        fs.mkdirSync(android_www);
        copyFolderRecursiveSync(plugin_www, android_www, true);
    }

    function runMake(){
        var execSync = require('child_process').execSync;
        execSync("make -C " + context.opts.plugin.dir)
    }

    function copyFileSync(source, target) {
        var targetFile = target;
        //if target is a directory a new file with the same name will be created
        if (fs.existsSync(target)) {
            if (fs.lstatSync(target).isDirectory()) {
                targetFile = path.join(target, path.basename(source));
            }
        }
        fs.writeFileSync(targetFile, fs.readFileSync(source));
    }

    function copyFolderRecursiveSync(source, target, isRoot) {
        var files = [];
        //check if folder needs to be created or integrated
        if (!isRoot) {
            var targetFolder = path.join(target, path.basename(source));
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder);
            }
        } else {
            var targetFolder = target;
        }

        //copy
        if (fs.lstatSync(source).isDirectory()) {
            files = fs.readdirSync(source);
            files.forEach(function (file) {
                var curSource = path.join(source, file);
                if (fs.lstatSync(curSource).isDirectory()) {
                    copyFolderRecursiveSync(curSource, targetFolder, false);
                } else {
                    copyFileSync(curSource, targetFolder);
                }
            });
        }
    }
}; 
