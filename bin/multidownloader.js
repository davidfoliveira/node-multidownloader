#!/usr/bin/env node

"use strict";

var
	fs		= require('fs'),
	fileIdx = 0,
	dlCount	= 0,
	OPTS;


// Parse command-line options
function getOpts() {

	// Read command-line arguments
	var
		opts = {
			simSockets: 5,
			destination: ".",
			urls: []
		},
		nextOpt,
		nextOptFormat;

	// Read each ARGV value
	for ( var x = 2 ; x < process.argv.length ; x++ ) {
		if ( process.argv[x].match(/^\-([\w-]+)/) ) {
			var par = RegExp.$1;
			if ( par == "s" ) {
				nextOpt = "simSockets";
				nextOptFormat = "number";
			}
			else if ( par == "d" || par == "-target" || par == "-destination" ) {
				nextOpt = "destination";
				nextOptFormat = "string";
			}
			else if ( par == "v" ) {
				opts.verbose = true;
				nextOpt = null;
			}
		}
		else if ( nextOpt ) {
			opts[nextOpt] = process.argv[x];
			if ( nextOptFormat == "number" )
				opts[nextOpt] = parseFloat(opts[nextOpt]);
			nextOpt = null;
		}
		else
			opts.urls.push(process.argv[x]);
	}

	return opts;

}

// Download a file to a target directory
function download(url,targetFile,callback) {

	var
		u	=	require('url').parse(url),
		mod =	(u.proto == 'https') ? require('https') :
				require('http'),
		req,
		stream,
		pi;

	req = mod.get(u,function(res){
		if ( res.statusCode >= 400 ) {
			process.stderr.write("Got status "+res.statusCode+" on '"+url+"'.\n");
			return callback(new Error("Got status "+res.statusCode),null);
		}
		else if ( res.statusCode >= 300 ) {
			process.stderr.write("Got status "+res.statusCode+" on '"+url+"' and redirects are not implemented\n");
			return callback(new Error("Got status 3xx and redirects are not implemented"),null);
		}

		// Create a writable stream
		stream = fs.createWriteStream(targetFile);

		// Pipe response to the file
		pi = res.pipe(stream);
		pi.on('close',function(){
			callback(null,res.statusCode);
		});
	});
	req.on('error',function(err){
		process.stderr.write("Error downloading '"+url+"': "+err.toString()+"\n");
		return callback(err,null);
	});

}

function mapParallel(arr,fn,callback) {

	var
		res = [],
		idx = -1,
		got = 0;

	return arr.forEach(function(item){
		(function(idx){
			fn(item,function(err,rv){
				if ( err )
					return callback(err,null);
				res[idx] = rv;
				got++;
				if ( got == arr.length )
					return callback(null,res);
			});
		})(++idx);
	});

}

function fileFromURL(url) {

	var
		f = url.replace(/.*\//,"").replace(/\?.*$/,"");

	fileIdx++;
	if ( f.match(/\.\w+$/) )
		return f;

	return fileIdx+".html";

}


// Starts here
OPTS = getOpts();
//console.log(OPTS);

// Validate command-line options
if ( OPTS.urls.length == 0 || !OPTS.simSockets ) {
	process.stderr.write("Syntax error: multidownloader.js [-s X] url1 url2 ...\n");
	process.exit(-1);
}

// Get globalAgent max sockets
require('http').globalAgent.maxSockets = OPTS.simSockets;
require('https').globalAgent.maxSockets = OPTS.simSockets;


// Download
dlCount = 0;
mapParallel(OPTS.urls,
	function(u,cb){
		return download(u,OPTS.destination+"/"+fileFromURL(u),function(err,status){
			if ( !err ) {
				if ( OPTS.verbose ) process.stdout.write(".");
				dlCount++;
			}
			else
				if ( OPTS.verbose ) process.stdout.write("!");
			cb(null,status);
		});
	},
	function(err,res){
		if ( OPTS.verbose ) process.stdout.write("\n");
		process.stderr.write("Successfully downloaded "+dlCount+" files\n");
		console.log("res: ",res);
		return process.exit(0);
	}
);
