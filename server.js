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

var Beacon = require('./lib/beacon.js');

console.log("We are: "+config.uuid);
var our_beacon = new Beacon();
our_beacon.identity = config.uuid;
our_beacon.addService('TiVoMediaServer:'+config.web_port+'/http');
//console.log('Our beacon: %s', our_beacon);


//
// Start web server
//

var http = require('http');
var url = require('url');
var header = fs.readFileSync('./templates/inc_head.html');
var footer = fs.readFileSync('./templates/inc_foot.html');
http.createServer(function(req, res){
	console.log('Request received for '+req.url+' from '+req.connection.remoteAddress);

	var parsed_url = url.parse(req.url, true);
	var paths = parsed_url.pathname.split('/');

	var session = parsed_url.query.Session ? parsed_url.query.Session : '';
	if (parsed_url.pathname == '/TiVoConnect'){
		// Run some command
		var rsp = '';
		var code = 200;

		var format = parsed_url.query.Format ? parsed_url.query.Format : 'text/xml';
		switch (parsed_url.query.Command){
			case 'QueryContainer':
				// Process options
				var container = parsed_url.query.Container ? parsed_url.query.Container : '/';
				var recurse = parsed_url.query.Recurse == 'Yes' ? true : false;
				var sorting = parsed_url.query.SortOrder ? parsed_url.query.SortOrder.split(',') : [];
				var maxItems = parsed_url.query.ItemCount ? parsed_url.query.ItemCount : 0;
				var anchor = parsed_url.query.AnchorItem ? parsed_url.query.AnchorItem : null;
				var anchorOffset = parsed_url.query.AnchorOffset ? parsed_url.query.AnchorOffset : null;
				var filterMime = parsed_url.query.Filter ? parsed_url.query.Filter.split(',') : [];

				// Build response
				var data = {
					start: 0,
					title: our_beacon.machine,
					type: 'x-container/tivo-server',
					format: 'x-container/folder',
					items: []
				};

				console.log("Building container for: "+container);
				if (container == '/'){
					data.items.push({
						title: 'Videos',
						type: 'x-container/tivo-videos',
						format: 'x-container/folder',
						path: '/Videos'
					});
				}
				else{
					
				}

				rsp = build_querycontainer_xml(data);
				break;
			case 'QueryServer': // The spec says this does nothing
				rsp = "<TiVoServer>\n<Version>1</Version>\n<InternalName>Node-Tivo</InternalName>\n<InternalVersion>ALL</InternalVersion>\n<Organization>https://github.com/grantmd</Organization>\n<Comment>Back To The Future is a good movie.</Comment>\n</TiVoServer>";
				break;
			case 'ResetServer': // "Reset" internal state. But the docs say this isn't used.
				break;
			case 'QueryItem': // Docs say this isn't used
				var itemUrl = parsed_url.query.Url ? parsed_url.query.Url : null;
				break;
			case 'QueryFormats': // Docs say this isn't used
				var sourceFormat = parsed_url.query.SourceFormat ? parsed_url.query.SourceFormat : null;
				break;
			default:
				code = 404;
				rsp = '404!';
				break;
		}
		res.writeHead(code, {'Content-Type': format});
		res.end(rsp);
	}
	else if (paths[0] == 'TiVoConnect'){
		// Serve a "document" aka media
		var document = parsed_url.pathname.replace('/TiVoConnect', '');

		// Options
		var format = parsed_url.query.Format ? parsed_url.query.Format : null;

		var width = parsed_url.query.Width ? parsed_url.query.Width : null;
		var rotation = parsed_url.query.Rotation ? parsed_url.query.Rotation : null;
		var pixelShape = parsed_url.query.PixelShape ? parsed_url.query.PixelShape.split(':') : [1,1];

		var seek = parsed_url.query.Seek ? parsed_url.query.Seek : null;
		var duration = parsed_url.query.Duration ? parsed_url.query.Duration : null;

		var code = 200;
		res.writeHead(code, {'Content-Type': format});
		res.end();
	}
	else if (parsed_url.pathname == '/'){

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
	}
	else{
		res.writeHead(404, {'Content-Type': 'text/plain'});
		res.end("404!");
	}
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
	var beacon = new Beacon(msg);

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
	var buffer = our_beacon.toBuffer();
	//console.log(buffer.toString());
	//console.log(buffer.length);
	discovery.send(buffer, 0, buffer.length, 2190, "255.255.255.255", function(err, bytes){
		if (err) throw err;
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

function build_querycontainer_xml(data){
	var rsp = "<TiVoContainer>\n";

	rsp += "\t<ItemStart>"+data.start+"</ItemStart>\n";
	rsp += "\t<ItemCount>"+data.items.length+"</ItemCount>\n";

	rsp += "\t<Details>\n";
	rsp += "\t\t<Title>"+data.title+"</Title>\n";
	rsp += "\t\t<ContentType>"+data.type+"</ContentType>\n";
	rsp += "\t\t<SourceFormat>"+data.format+"</SourceFormat>\n";
	rsp += "\t\t<TotalItems>"+data.items.length+"</TotalItems>\n";
	rsp += "\t</Details>\n";

	for (var i in data.items){
		var it = data.items[i];

		rsp += "\t<Item>\n";
		rsp += "\t\t<Details>\n";
		rsp += "\t\t\t<Title>"+it.title+"</Title>\n";
		rsp += "\t\t\t<ContentType>"+it.type+"</ContentType>\n";
		rsp += "\t\t\t<SourceFormat>"+it.format+"</SourceFormat>\n";
		rsp += "\t\t</Details>\n";

		rsp += "\t\t<Links>\n";
		rsp += "\t\t\t<Content>\n";
		rsp += "\t\t\t\t<Url>/TiVoConnect?Command=QueryContainer&amp;Container="+it.path+"</Url>\n";
		rsp += "\t\t\t</Content>\n";
		rsp += "\t\t</Links>\n";
		rsp += "\t</Item>\n";
	}

	rsp += "</TiVoContainer>";

	return rsp;
}