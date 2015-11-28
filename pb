#!/usr/bin/env node

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
// Uncomment this to use the mock handlers, with success responses.
// Actions not included in the array will mock a failure state.
//pb.useMockHandlers(['start', 'stop', 'update', 'service']);

var debugCallback = function(err, data) {
  if (err) {
    log("ERROR: " + String(err));
  }
  else {
    log(data);
  }
}

function bytesToSize(bytes) {
   var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
   if (bytes == 0) return '0 Byte';
   var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
   return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

switch (args[0]) {
  case 'start':
    var serverLabel = args[1];
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s, %s", err, data));
      }
    }
    pb.startServerTracked(serverLabel, cb);
    break;
  case 'stop':
    var serverLabel = args[1];
    var shutdownCb = function(err, data) {
      if (err) {
        log(format("ERROR: %s, %s", err, data));
      }
      // Even if there was a failure in shutdown, we still want to stop, so no
      // need to verify what happened here.
      var stopCb = function(err, data) {
        if (err) {
          log(format("ERROR: %s, %s", err, data));
        }
      }
      pb.stopServerTracked(serverLabel, stopCb);
    }
    pb.shutdownServerTracked(serverLabel, shutdownCb);
    break;
  case 'shutdown':
    var serverLabel = args[1];
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s, %s", err, data));
      }
    }
    pb.shutdownServerTracked(serverLabel, cb);
    break;
  case 'hard-stop':
    var serverLabel = args[1];
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s, %s", err, data));
      }
    }
    pb.stopServerTracked(serverLabel, cb);
    break;
  case 'status':
    var serverLabel = args[1];
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s, %s", err, data));
      }
      else {
        var name = data.properties.name;
        var machineState = data.metadata.state;
        var serverState = data.properties.vmState;
        var cores = data.properties.cores;
        var ram = data.properties.ram;
        var nicId = data.entities.nics.items[0].id;
        var nicCb = function(err, data) {
          if (err) {
            log(format("ERROR: %s, %s", err, data));
          }
          else {
            log(format("Name: %s", name));
            log(format("Machine state: %s", machineState));
            log(format("Server state: %s", serverState));
            log(format("Cores: %d", cores));
            log(format("RAM: %s", bytesToSize(ram * 1000000)));
            log(format("IPs: %s", data.properties.ips));
          }
        }
        pb.getNic(serverLabel, nicId, nicCb);
      }
    }
    pb.getServer(serverLabel, cb);
    break;
  case 'update':
    var serverLabel = args[1];
    var profile = args[2];
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s, %s", err, data));
      }
      else {
        log("Server updated!");
        var name = data.properties.name;
        var cores = data.properties.cores;
        var ram = data.properties.ram;
        log(format("Name: %s", name));
        log(format("Cores: %d", cores));
        log(format("RAM: %s", bytesToSize(ram * 1000000)));
      }
    }
    pb.updateServer(serverLabel, profile, cb);
    break;
  case 'check-fs':
    var serverLabel = args[1];
    log("Checking FreeSWITCH service...");
    pb.checkCommand(serverLabel, "service freeswitch status");
    break;
  case 'datacenters':
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s, %s", err, data));
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
    var datacenterLabel = args[1];
    var cb = function(err, data) {
      if (err) {
        log(format("ERROR: %s, %s", err, data));
      }
      else {
        var iterator = function (val, idx, array) {
          log(format("%s: %s", val.properties.name, val.id));
        }
        data.items.forEach(iterator);
      }
    }
    pb.listServers(datacenterLabel, cb);
    break;
  case 'datacenterLabels':
    var labels = [];
    for (label in config.pb.datacenters) {
      labels.push(label);
    }
    process.stdout.write(labels.join(" "));
    break;
  case 'serverLabels':
    var labels = [];
    for (label in config.pb.servers) {
      labels.push(label);
    }
    process.stdout.write(labels.join(" "));
    break;
  case 'profiles':
    var profiles = [];
    for (profile in config.pb.profiles) {
      profiles.push(profile);
    }
    process.stdout.write(profiles.join(" "));
    break;
  default:
    log("Usage: " + program + " <start <server-label>|stop <server-label>|shutdown <server-label>|hard-stop <server-label>|status <server-label>|update <server-label> <profile>|check-fs <server-label>|datacenters|servers>");
}

// vi: ft=javascript
