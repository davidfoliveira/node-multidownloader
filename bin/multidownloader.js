#!/usr/bin/env node

"use strict";

var
	fs		= require('fs'),
	fileIdx		= 0,
	dlCount		= 0,
	dlSucCount	= 0,
	dlFailCount	= 0,
	OPTS;


// Parse command-line options
function getOpts() {

	// Read command-line arguments
	var
		opts = {
			simSockets: 5,
			simDownloads: 10,
			destination: ".",
			downloadPercentage: null,
			retries: 3,
			retryWait: 100,
			urls: []
		},
		nextOpt,
		nextOptFormat;

	// Read each ARGV value
	for ( var x = 2 ; x < process.argv.length ; x++ ) {
		if ( process.argv[x].match(/^\-([\w-]+)/) ) {
			var par = RegExp.$1;
			if ( par == "S" ) {
				nextOpt = "simSockets";
				nextOptFormat = "number";
			}
			if ( par == "s" ) {
				nextOpt = "simDownloads";
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
			else if ( par == "q" ) {
				opts.quiet = true;
				nextOpt = null;
			}
			else if ( par == "p" ) {
				nextOpt = "downloadPercentage";
				nextOptFormat = "number";
			}
			else if ( par == "r" ) {
				nextOpt = "retries";
				nextOptFormat = "number";
			}
			else if ( par == "R" ) {
				nextOpt = "retryIn";
				nextOptFormat = "number";
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
function download(url,targetFile,opts,callback) {

	var
		u	=	require('url').parse(url),
		mod	=	(u.proto == 'https') ? require('https') :
				require('http'),
		req,
		stream,
		pi;

	// Mark the number of attempts
	if ( !opts._attempt )
		opts._attempt = 0;
	opts._attempt++;

	// Get it
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
		process.stderr.write("Error downloading '"+url+"': "+err.toString()+" (attempt "+opts._attempt+")\n");
		// Retry ?
		if ( opts.retries ) {
			var newOpts = clone(opts);
			newOpts.retries--;
			return setTimeout(function(){
				download(url,targetFile,newOpts,callback);
			},opts.retryWait || 100);
		}
		return callback(err,null);
	});

}

function clone(obj) {

	var _new = {};
	for ( var p in obj )
		_new[p] = obj[p];
	return _new;

}

function mapParallelLimit(arr,limit,fn,callback) {

	var
		items = arr.slice(0),
		res = [],
		idx = -1,
		got = 0,
		next = function(){
			if ( items.length == 0 )
				return;

			var item = items.shift();
			(function(idx){
				fn(item,function(err,rv){
					next();
					if ( err )
						return callback(err,null);
					res[idx] = rv;
					got++;
					if ( got == arr.length )
						return callback(null,res);
				});
			})(++idx);		
		};

	for ( var x = 0 ; x < limit ; x++ ) {
		next();
	}

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

// Validate command-line options
if ( OPTS.urls.length == 0 || !OPTS.simSockets ) {
	process.stderr.write("Syntax error: multidownloader.js [-s X] url1 url2 ...\n");
	process.exit(-1);
}

// If the first URL is a -, read the URL's from STDIN
if ( OPTS.urls[0] == "-" ) {
	OPTS.urls = fs.readFileSync("/dev/stdin").toString().split(/\r?\n/);
}

// Get globalAgent max sockets
require('http').globalAgent.maxSockets = OPTS.simSockets;
require('https').globalAgent.maxSockets = OPTS.simSockets;


// Download
dlCount = 0;
mapParallelLimit(OPTS.urls,OPTS.simDownloads,
	function(u,cb){
		return download(u,OPTS.destination+"/"+fileFromURL(u),{retries: OPTS.retries, retryWait: OPTS.retryWait},function(err,status){
			dlCount++;
			if ( !err ) {
				dlSucCount++;
				if ( OPTS.verbose ) process.stdout.write(".");
			}
			else {
				dlFailCount++;
				if ( OPTS.verbose ) process.stdout.write("!");
			}
			cb(null,status);
		});
	},
	function(err,res){
		if ( OPTS.verbose ) process.stdout.write("\n");
		if ( !OPTS.quiet ) {
			process.stdout.write("Successfull downloads: "+dlSucCount+"\n");
			if ( dlFailCount )
				process.stdout.write("Failed downloads: "+dlFailCount+"\n");
		}
		if ( dlFailCount == 0 )
			return process.exit(0);
		else if ( dlFailCount > 0 && dlFailCount == OPTS.urls.length )
			return process.exit(2);
		else if ( dlFailCount > 0 && dlFailCount < OPTS.urls.length )
			return process.exit(1);
	}
);

// Periodically print download percentage
if ( OPTS.downloadPercentage ) {
	var dpint = setInterval(function(){
		var pct = ((dlCount * 100) / OPTS.urls.length).toFixed(2);
		if ( pct == 100 )
			clearTimeout(dpint);
		process.stdout.write(pct+" % ("+dlCount+"/"+OPTS.urls.length+")\n");
	},OPTS.downloadPercentage*1000);
}
