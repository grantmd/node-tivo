/*
 *
 * Node-Tivo: An implementation of the Tivo protocol(s) in Node.js
 * By: Myles Grant <myles@mylesgrant.com>
 *
 * Based on: http://tivopod.sourceforge.net/tivoconnect.pdf
 *
*/

//
// Configuration options
//

var web_port = 8080; // Start a web server on this port
var tivo_port = 2190; // You probably don't want to change this

var tcms = {}; // Other machines we've discovered

//
// Start web server
//

var http = require('http');
http.createServer(function(req, res){
	console.log('Request received for '+req.url+' from '+req.connection.remoteAddress);
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end("Hello. Node-Tivo is listening.");
}).listen(web_port, function(){ // 'listening' listener
	console.log('Now listening on web port: '+web_port);
});


//
// Start a tivo server
//

var net = require('net');
net.createServer(function(c){ // 'connection' listener
	console.log('Tivo server connection');
	c.on('end', function(){
		console.log('Tivo server disconnect');
	});
	c.write('hello\r\n');
	c.pipe(c);
}).listen(tivo_port, function(){ // 'listening' listener
	console.log('Now listening on tivo port: '+tivo_port);
});


//
// Begin discovery process/become discoverable
//

var dgram = require('dgram');
var discovery = dgram.createSocket("udp4");
discovery.on("message", function(msg, rinfo){
	//console.log("discovery got: " + msg + " from " + rinfo.address + ":" + rinfo.port);

	// normalize
	var beacon_raw = msg.toString().split("\n");
	var beacon = {};
	for (var i in beacon_raw){
		var parts = beacon_raw[i].split('=', 2);
		beacon[parts[0].toLowerCase()] = parts[1];
	}

	// test validity
	if (beacon.tivoconnect){
		if (!tcms[beacon.identity]){
			console.log("SAY HELLO TO "+beacon.machine+" at "+rinfo.address+":"+rinfo.port);
		}

		beacon.last_seen = new Date().getTime();
		beacon.address = rinfo.address;
		beacon.port = rinfo.port;

		tcms[beacon.identity] = beacon;
	}
});
discovery.on("listening", function(){
	var address = discovery.address();
	console.log("discovery listening " + address.address + ":" + address.port);
});
discovery.bind(tivo_port);

var uuid = require('node-uuid');
var discovery_message = new Buffer("tivoconnect=1\nmethod=broadcast\nplatform=pc/node.js\nmachine=A node.js server\nidentity={"+uuid.v4()+"}\nservices=");
discovery.setBroadcast(true);

// Look for friends every 5s
var discovery_attempts = 0;
var discovery_interval = setInterval(function(){
	discovery.send(discovery_message, 0, discovery_message.length, 41234, "192.168.1.255", function(err, bytes){
		console.log('PING');
		//discovery_client.close();
	});

	if (discovery_attempts == 6){
		// Switch to every minute
		//clearInterval(discovery_interval);
		//discovery_interval = setInterval('look_for_friends', 60*1000);
	}

	discovery_attempts++;
}, 5*1000);