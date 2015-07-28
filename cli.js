var path = require('path');
var util = require('util');
var format = util.format;

var args = process.argv.slice(1);
var program = path.basename(args.shift());

var PbServer = require('./pb-server');

var log = function() {
  console.log.apply(this, arguments);
}

var config = require('./config');

var pb = new PbServer(config.pb, config.ssh);

var debugCallback = function(err, res, body) {
  if (err) {
    log("ERROR: " + String(err));
  }
  else {
    log(body);
  }
}

switch (args[0]) {
  case 'start':
    pb.startServerTracked();
    break;
  case 'stop':
    pb.stopServerTracked();
    break;
  case 'shutdown':
    pb.shutdownServerTracked();
    break;
  case 'status':
    log("Getting server status...");
    var cb = function(err, res, body) {
      if (err) {
        log(format("ERROR: %s", err));
      }
      else {
        var data = JSON.parse(body);
        var serverState = data.metadata.state;
        var vmState = data.properties.vmState;
        log(format("Power state: %s", serverState));
        log(format("Server state: %s", vmState));
      }
    }
    pb.getServer(cb);
    break;
  case 'check-fs':
    log("Checking FreeSWITCH service...");
    pb.checkCommand("service freeswitch status");
    break;
  case 'datacenters':
    log("Getting datacenter info...");
    pb.listDatacenters(debugCallback);
    break;
  case 'servers':
    log("Listing servers...");
    pb.listServers(debugCallback);
    break;
  default:
    log("Usage: " + program + " <start|stop|status|check-fs|datacenters|servers>");
}
