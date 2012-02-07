/*
 *
 * Node-Tivo: An implementation of the Tivo protocol(s) in Node.js
 * By: Myles Grant <myles@mylesgrant.com>
 *
*/

//
// Configuration options
//

var web_port = 8080; // Start a web server on this port
var tivo_port = 2190; // You probably don't want to change this


//
// Start web server
//

var http = require('http');
http.createServer(function(req, res){
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end("Hello. Node-Tivo is listening.");
}).listen(web_port, function() { //'listening' listener
	console.log('Now listening on web port: '+web_port);
});


//
// Start a tivo server
//

var net = require('net');
net.createServer(function(c) { //'connection' listener
	console.log('Tivo server connection');
	c.on('end', function() {
		console.log('Tivo server disconnect');
	});
	c.write('hello\r\n');
	c.pipe(c);
}).listen(tivo_port, function() { //'listening' listener
	console.log('Now listening on tivo port: '+tivo_port);
});
