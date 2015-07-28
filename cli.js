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

var debugCallback = function(err, data) {
  if (err) {
    log("ERROR: " + String(err));
  }
  else {
    log(data);
  }
}

switch (args[0]) {
  case 'start':
    pb.startServerTracked();
    break;
  case 'shutdown':
    pb.shutdownServerTracked();
    break;
  case 'stop':
    pb.stopServerTracked();
    break;
  case 'shutdown-stop':
    var cb = function(err, data) {
      // Even if there was a failure in shutdown, we still want to stop, so no
      // need to verify what happened here.
      pb.stopServerTracked();
    }
    pb.shutdownServerTracked(cb);
    break;
  case 'status':
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s", err));
      }
      else {
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
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s", err));
      }
      else {
        var iterator = function (val, idx, array) {
          log(format("%s: %s", val.properties.name, val.id));
        }
        data.items.forEach(iterator);
      }
    }
    pb.listDatacenters(cb);
    break;
  case 'servers':
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s", err));
      }
      else {
        var iterator = function (val, idx, array) {
          log(format("%s: %s", val.properties.name, val.id));
        }
        data.items.forEach(iterator);
      }
    }
    pb.listServers(cb);
    break;
  default:
    log("Usage: " + program + " <start|shutdown|stop|shutdown-stop|status|check-fs|datacenters|servers>");
}
