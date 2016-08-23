var less, lesscArguments;

if( typeof window !== "undefined" ) {
    // setup for in-browser testing via lessc-test.html
    less = window.less;
    if( !lesscArguments )
        lesscArguments = [];
    
    if( !readFile )
        throw "readFile() is not defined";
    
    if( !writeFile )
        throw "writeFile() is not defined";
    
    function quit(n) {
        console.info("lessc exit: " + n);
    }
}
else {
    less = global.less;
    lesscArguments = arguments; // from command line
    
    var console = {
        log: print,
        info: print,
        warn: print
    };
    
    function writeFile(filename, content) {
        var fstream = new java.io.FileWriter(filename);
        var out = new java.io.BufferedWriter(fstream);
        out.write(content);
        out.close();
    }
}

less.environment.fileManagers = [initRhinoFileManager()];

function initRhinoFileManager() {
    var RhinoFileManager = function () {};
    var rfmApi = RhinoFileManager.prototype = new less.AbstractFileManager();

    rfmApi.supports = function () { return true; };
    
    rfmApi.supportsSync = function () { return true; };
    
    rfmApi.loadFile = function (filename, currentDirectory, options, environment, callback) {
        callback(null, this.loadFileSync(filename, currentDirectory, options, environment));
    };

    rfmApi.loadFileSync = function (filename, currentDirectory, options, environment, encoding) {
        var filePath = currentDirectory + filename;
        var result = {
            filename: filePath,
            contents: readFile(filePath)
        };
        return result;
    };
    
    return new RhinoFileManager();
}


function formatError(ctx, options) {
    options = options || {};

    var message = "";
    var extract = ctx.extract;
    var error = [];

//    var stylize = options.color ? require('./lessc_helper').stylize : function (str) { return str; };
    var stylize = function (str) {
        return str;
    };

    // only output a stack if it isn't a less error
    if( ctx.stack && !ctx.type ) {
        return stylize(ctx.stack, 'red');
    }

    if( !ctx.hasOwnProperty('index') || !extract ) {
        return ctx.stack || ctx.message;
    }

    if( typeof extract[0] === 'string' ) {
        error.push(stylize((ctx.line - 1) + ' ' + extract[0], 'grey'));
    }

    if( typeof extract[1] === 'string' ) {
        var errorTxt = ctx.line + ' ';
        if( extract[1] ) {
            errorTxt += extract[1].slice(0, ctx.column) +
                    stylize(stylize(stylize(extract[1][ctx.column], 'bold') +
                            extract[1].slice(ctx.column + 1), 'red'), 'inverse');
        }
        error.push(errorTxt);
    }

    if( typeof extract[2] === 'string' ) {
        error.push(stylize((ctx.line + 1) + ' ' + extract[2], 'grey'));
    }
    error = error.join('\n') + stylize('', 'reset') + '\n';

    message += stylize(ctx.type + 'Error: ' + ctx.message, 'red');
    if( ctx.filename ) {
        message += stylize(' in ', 'red') + ctx.filename +
                stylize(' on line ' + ctx.line + ', column ' + (ctx.column + 1) + ':', 'grey');
    }

    message += '\n' + error;

    if( ctx.callLine ) {
        message += stylize('from ', 'red') + (ctx.filename || '') + '/n';
        message += stylize(ctx.callLine, 'grey') + ' ' + ctx.callExtract + '/n';
    }

    return message;
}

function writeError(ctx, options) {
    options = options || {};
    if( options.silent ) {
        return;
    }
    var message = formatError(ctx, options);
    throw new Error(message);
}

// Command line integration via Rhino
(function (args) {

    var options = {
        depends: false,
        compress: false,
        cleancss: false,
        max_line_len: -1,
        silent: false,
        verbose: false,
        lint: false,
        paths: [],
        color: true,
        strictImports: false,
        rootpath: '',
        relativeUrls: false,
        ieCompat: true,
        strictMath: false,
        strictUnits: false,
        pluginManager: new less.PluginManager(less, true)
    };
    var continueProcessing = true,
            currentErrorcode;

    var checkArgFunc = function (arg, option) {
        if( !option ) {
            console.error(arg + " option requires a parameter");
            continueProcessing = false;
            return false;
        }
        return true;
    };

    var checkBooleanArg = function (arg) {
        var onOff = /^((on|t|true|y|yes)|(off|f|false|n|no))$/i.exec(arg);
        if( !onOff ) {
            console.error(" unable to parse " + arg + " as a boolean. use one of on/t/true/y/yes/off/f/false/n/no");
            continueProcessing = false;
            return false;
        }
        return Boolean(onOff[2]);
    };

    var warningMessages = "";
    var sourceMapFileInline = false;

    args = args.filter(function (arg) {
        var match = arg.match(/^-I(.+)$/);

        if( match ) {
            options.paths.push(match[1]);
            return false;
        }

        match = arg.match(/^--?([a-z][0-9a-z-]*)(?:=(.*))?$/i);
        if( match ) {
            arg = match[1];
        } else {
            return arg;
        }

        switch( arg ) {
            case 'v':
            case 'version':
                console.log("lessc " + less.version.join('.') + " (Less Compiler) [JavaScript]");
                continueProcessing = false;
                break;
            case 'verbose':
                options.verbose = true;
                break;
            case 's':
            case 'silent':
                options.silent = true;
                break;
            case 'l':
            case 'lint':
                options.lint = true;
                break;
            case 'strict-imports':
                options.strictImports = true;
                break;
            case 'h':
            case 'help':
                //TODO
//                require('../lib/less/lessc_helper').printUsage();
                continueProcessing = false;
                break;
            case 'x':
            case 'compress':
                options.compress = true;
                break;
            case 'M':
            case 'depends':
                options.depends = true;
                break;
            case 'yui-compress':
                warningMessages += "yui-compress option has been removed. assuming clean-css.";
                options.cleancss = true;
                break;
            case 'clean-css':
                options.cleancss = true;
                break;
            case 'max-line-len':
                if( checkArgFunc(arg, match[2]) ) {
                    options.maxLineLen = parseInt(match[2], 10);
                    if( options.maxLineLen <= 0 ) {
                        options.maxLineLen = -1;
                    }
                }
                break;
            case 'no-color':
                options.color = false;
                break;
            case 'no-ie-compat':
                options.ieCompat = false;
                break;
            case 'no-js':
                options.javascriptEnabled = false;
                break;
            case 'include-path':
                if( checkArgFunc(arg, match[2]) ) {
                    // support for both ; and : path separators
                    // even on windows when using absolute paths with drive letters (eg C:\path:D:\path)
                    options.paths = match[2]
                            .split(os.type().match(/Windows/) ? /:(?!\\)|;/ : ':')
                            .map(function (p) {
                                if( p ) {
//                                return path.resolve(process.cwd(), p);
                                    return p;
                                }
                            });
                }
                break;
            case 'line-numbers':
                if( checkArgFunc(arg, match[2]) ) {
                    options.dumpLineNumbers = match[2];
                }
                break;
            case 'source-map':
                if( !match[2] ) {
                    options.sourceMap = true;
                } else {
                    options.sourceMap = match[2];
                }
                break;
            case 'source-map-rootpath':
                if( checkArgFunc(arg, match[2]) ) {
                    options.sourceMapRootpath = match[2];
                }
                break;
            case 'source-map-basepath':
                if( checkArgFunc(arg, match[2]) ) {
                    options.sourceMapBasepath = match[2];
                }
                break;
            case 'source-map-map-inline':
                sourceMapFileInline = true;
                options.sourceMap = true;
                break;
            case 'source-map-less-inline':
                options.outputSourceFiles = true;
                break;
            case 'source-map-url':
                if( checkArgFunc(arg, match[2]) ) {
                    options.sourceMapURL = match[2];
                }
                break;
            case 'source-map-output-map-file':
                if( checkArgFunc(arg, match[2]) ) {
                    options.writeSourceMap = function (sourceMapContent) {
                        writeFile(match[2], sourceMapContent);
                    };
                }
                break;
            case 'rp':
            case 'rootpath':
                if( checkArgFunc(arg, match[2]) ) {
                    options.rootpath = match[2].replace(/\\/g, '/');
                }
                break;
            case "ru":
            case "relative-urls":
                options.relativeUrls = true;
                break;
            case "sm":
            case "strict-math":
                if( checkArgFunc(arg, match[2]) ) {
                    options.strictMath = checkBooleanArg(match[2]);
                }
                break;
            case "su":
            case "strict-units":
                if( checkArgFunc(arg, match[2]) ) {
                    options.strictUnits = checkBooleanArg(match[2]);
                }
                break;
            default:
                console.log('invalid option ' + arg);
                continueProcessing = false;
        }
    });

    if( !continueProcessing ) {
        return;
    }

    var name = args[0];
    if( name && name != '-' ) {
//        name = path.resolve(process.cwd(), name);
    }
    var output = args[1];
    var outputbase = args[1];
    if( output ) {
        options.sourceMapOutputFilename = output;
        if( warningMessages ) {
            console.log(warningMessages);
        }
    }

    if( options.sourceMap === true ) {
        console.log("output: " + output);
        if( !output && !sourceMapFileInline ) {
            console.log("the sourcemap option only has an optional filename if the css filename is given");
            return;
        }
        options.sourceMapFullFilename = options.sourceMapOutputFilename + ".map";
        options.sourceMap = less.modules.path.basename(options.sourceMapFullFilename);
    } else if( options.sourceMap ) {
        options.sourceMapOutputFilename = options.sourceMap;
    }

    if( !name ) {
        console.log("lessc: no input files");
        console.log("");
        currentErrorcode = 1;
        return;
    }

    if( options.depends ) {
        if( !outputbase ) {
            console.log("option --depends requires an output path to be specified");
            return;
        }
        console.log(outputbase + ": ");
    }

    if( !name ) {
        console.log('No files present in the fileset');
        quit(1);
    }

    var input = null;
    try {
        input = readFile(name, 'utf-8');
    } catch( e ) {
        console.log('lesscss: couldn\'t open file ' + name);
        quit(1);
    }

    var result;
    var context = new less.contexts.Parse(options);
    var entryPath = name.replace(/[^\/\\]*$/, "");
    var rootFileInfo = {
        filename: name,
        relativeUrls: context.relativeUrls,
        rootpath: context.rootpath || "",
        currentDirectory: entryPath,
        entryPath: entryPath,
        rootFilename: name
    };

    var imports = new less.ImportManager(less, context, rootFileInfo);
    var parser = new less.Parser(options, imports, rootFileInfo);

    parser.parse(input, function (e, ast) {
        if( e ) {
            writeError(e, options);
            quit(1);
        } else {
            var ctx = {imports: [], level: []};
            _postProcessAst(lesscArguments[0], ast, ctx);
            var parseTree = new less.ParseTree(ast, imports);
            result = parseTree.toCSS(options);

            if( output ) {
                writeFile(output, result.css);
                console.info("Written to " + output);
            } else {
                console.info(result);
            }
            quit(0);
        }
    });
}(lesscArguments));

function _postProcessAst(baseFn, ast, ctx) {
    var i, n, nodes = ast.rules || ast.value;
    
    if( !nodes )
        return;
    
    if( !Array.isArray(nodes) ) {
        _postProcessNode(baseFn, nodes, ctx);
    }
    else {
        // (Ruleset).rules[n]
        // (TreeNode).value.value....value[n].value
        for( var i = 0; i < nodes.length; i++ ) {
            n = nodes[i];
            _postProcessNode(baseFn, n, ctx);
        }
    }
}

function _postProcessNode(baseFn, n, ctx) {
    var p, url;
    
    if( n instanceof less.tree.URL ) {
        url = n.value.value;
        if( url.indexOf(":/") !== -1 ) {
            // URL is an absolute path to external resource
        }
        else {
            var fi = n._fileInfo,
                cd = fi.currentDirectory,
                cf = fi.filename;

            if( !cd.endsWith("/") )
                cd += "/";

            // paths to images in LESS files should be specified relative
            // to the .less file where it is defined (it is not possible to
            // generate rooted names because less files are no dynamic), 
            // but when the file is included into another LESS file 
            // relative path in final LESS->CSS should be recalculated 
            // to the base of main .less file
            if( url.startsWith("!/") ) {
                p = cf.split("/").slice(0, 2).join("/") + url.substr(1);
            }
            else if( url.startsWith("~/") ) {
                p = url.substr(2);
            }
            else {
                p = cd + "/" + url;
            }

            p = _removeFnDots(p.split("/"));
            p = _makeRelFn(baseFn, p);
            n.value.value = p.join("/");
        }
    }
    else if( n instanceof less.tree.Import ) {
        if( n.root ) {
            ctx.imports.push(ctx.level.join("") + n.importedFilename);
            ctx.level.push("> ");
            _postProcessAst(baseFn, n.root, ctx);
            ctx.level.pop();
        }
        else {
            warn("Empty @import'ed resource (double import?): " + (n.path && n.path.value)) + " <- " + baseFn;
        }
    }
    else {
        _postProcessAst(baseFn, n, ctx);
    }
}

function _removeFnDots(path) {
    var i, p, parts = path, asA = Array.isArray(path);

    if( !asA )
        parts = parts.split("/");

    for( i = 0; i < parts.length; ) {
        p = parts[i];
        if( p === '.' || p === "" ) {
            parts.splice(i, 1);
        }
        else if( p === '..' ) {
            if( !i )
                break;
            i--;
            parts.splice(i, 2);
        }
        else {
            i++;
        }
    }

    return asA ? parts : parts.join("/");
}

function _makeRelFn(base, path) {
    var fn = [], i, j;

    for( i = 0; i < base.length - 1; i++ ) {
        if( base[i] !== path[i] )
            break;
    }

    for( j = i; i < base.length - 1; i++ ) {
        fn.push('..');
    }

    fn = fn.concat(path.slice(j));

    return fn;
}
