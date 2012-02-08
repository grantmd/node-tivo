/*
 *
 * Node-Tivo: An implementation of the Tivo protocol(s) in Node.js
 * By: Myles Grant <myles@mylesgrant.com>
 *
 * Based on: http://tivopod.sourceforge.net/tivoconnect.pdf
 *
*/


//
// Read/create config
//

var fs = require('fs');
try{
	var config = JSON.parse(fs.readFileSync('./config.json'));
}
catch(e){
	console.log('Creating config file...');

	var uuid = require('node-uuid');
	var config = {
		web_port: 8080, // Start a web server on this port
		tivo_port: 2190, // You probably don't want to change this

		tcms: {}, // Other machines we've discovered

		uuid: uuid.v4()
	};

	save_config();
}

console.log("We are: "+config.uuid);
var our_beacon = new Buffer("tivoconnect=1\nmethod=broadcast\nplatform=pc/node.js\nmachine=A node.js server\nidentity={"+config.uuid+"}\nservices=");


//
// Start web server
//

var http = require('http');
var header = fs.readFileSync('./templates/inc_head.html');
var footer = fs.readFileSync('./templates/inc_foot.html');
http.createServer(function(req, res){
	console.log('Request received for '+req.url+' from '+req.connection.remoteAddress);
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.write(header);

	res.write('<div class="row"><div class="span12">');
	res.write('<h3>I have seen the following TiVo Connect Machines:</h3>');
	res.write('<table class="table table-condensed table-striped"><thead><tr><th>identity</th><th>machine</th><th>platform</th><th>services</th><th>address</th><th>last seen</th></tr></thead><tbody>');
	for (var i in config.tcms){
		var tcm = config.tcms[i];
		var d = new Date(tcm.last_seen);

		res.write("<tr>");
		res.write("<td>"+tcm.identity+"</td>");
		res.write("<td>"+tcm.machine+"</td>");
		res.write("<td>"+tcm.platform+"</td>");
		res.write("<td>"+tcm.services+"</td>");
		res.write("<td>"+tcm.address+":"+tcm.port+"</td>");
		res.write("<td>"+d.toString()+"</td>");
		res.write("</tr>");
	}
	res.write("</tbody></table>");
	res.write('</div></div>');

	res.end(footer);
}).listen(config.web_port, function(){ // 'listening' listener
	console.log('Now listening on web port: '+config.web_port);
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
}).listen(config.tivo_port, function(){ // 'listening' listener
	console.log('Now listening on tivo port: '+config.tivo_port);
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
		beacon.last_seen = new Date().getTime();
		beacon.address = rinfo.address;
		beacon.port = rinfo.port;

		if (!config.tcms[beacon.identity]){
			console.log("SAY HELLO TO "+beacon.machine+" at "+rinfo.address+":"+rinfo.port);
			config.tcms[beacon.identity] = beacon;
			save_config();
		}
		else{
			config.tcms[beacon.identity] = beacon;
		}
	}
});
discovery.on("listening", function(){
	var address = discovery.address();
	console.log("discovery listening " + address.address + ":" + address.port);
});
discovery.bind(config.tivo_port);
discovery.setBroadcast(true);

// Look for friends every 5s
var discovery_attempts = 0;
send_beacon();

var discovery_interval = setInterval(function(){
	send_beacon();
}, 5*1000);

function send_beacon(){
	discovery.send(our_beacon, 0, our_beacon.length, 2190, "255.255.255.255", function(err, bytes){
		console.log('PING');
		//discovery_client.close();
	});

	if (discovery_attempts == 6){
		// Switch to every minute
		clearInterval(discovery_interval);
		discovery_interval = setInterval(function(){
			send_beacon();
		}, 60*1000);
	}

	discovery_attempts++;
}

function save_config(){
	fs.writeFile('./config.json', JSON.stringify(config), function(err){
		if (err) throw err;
		console.log('Config saved!');
	});
}