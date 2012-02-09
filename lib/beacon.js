exports = module.exports = Beacon;
function Beacon(from){
	var self = this;

	this.keys = ['tivoconnect', 'method', 'platform', 'machine', 'identity', 'services'];

	this.tivoconnect = 1;
	this.method = 'broadcast';
	this.platform = 'pc/node.js';
	this.machine = 'A node.js server';
	this.identity = '';
	this.services = [];

	this.addService = function(service){
		self.services.push(service);
	};

	this.toString = function(){
		var parts = [];
		for (var i in self.keys){
			var k = self.keys[i];

			if (k == 'services'){
				parts.push(k+'='+self[k].join(','));
			}
			else{
				parts.push(k+'='+self[k]);
			}
		}

		return parts.join("\n");
	};

	this.toBuffer = function(){
		return new Buffer(self.toString(), 'utf8');
	};

	// Init from string/buffer
	if (from){
		if (Buffer.isBuffer(from)) from = from.toString();
		var raw = from.split("\n");
		for (var i in raw){
			var kv = raw[i].split('=', 2);

			var k = kv[0].toLowerCase();
			if (k == 'services'){
				var services = kv[1].split(',');
				for (var j in services){
					self.addService(services[j]);
				}
			}
			else{
				self[k] = kv[1];
			}
		}
	}
}