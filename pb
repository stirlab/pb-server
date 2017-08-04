#!/usr/bin/env node

var path = require('path');
var util = require('util');
var format = util.format;

var args = process.argv.slice(1);
var program = path.basename(args.shift());
var isGroup = args[0] === 'group';
if (isGroup) {
  args.shift();
}

var async = require('async');
var hostile = require('hostile')
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

var nonGroupError = function(action) {
  log(format("ERROR: '%s' cannot be called as a group action", action));
};

var executeFuncs = function(groupLabel, serverFunc, method, cb) {
  var funcs = [];
  if (isGroup) {
    if (config.pb.groups[groupLabel] && config.pb.groups[groupLabel].servers) {
      config.pb.groups[groupLabel].servers.forEach(function(serverLabel) {
        var func = serverFunc(serverLabel);
        funcs.push(func);
      });
    }
    else {
      log(format("ERROR: group %s does not exist", groupLabel));
    }
  }
  else {
    var func = serverFunc(groupLabel);
    funcs.push(func);
  }
  if (funcs.length > 0) {
    async[method](funcs, function(err, results) {
      if (err) {
        if (cb) {
          cb(err);
        }
        else {
          log(format("ERROR: %s", err));
        }
      }
      else {
        if (cb) {
          cb(null, results);
        }
        else {
          results.forEach(function(result) {
            log(result);
          });
        }
      }
    });
  }
}

var executeFuncsSeries = function(groupLabel, serverFunc, cb) {
  executeFuncs(groupLabel, serverFunc, 'series', cb);
}

var executeFuncsParallel = function(groupLabel, serverFunc, cb) {
  executeFuncs(groupLabel, serverFunc, 'parallel', cb);
}

var getServerStatus = function(serverLabel, cb) {
  var getCb = function(err, data) {
    if (err) {
      log(format("ERROR: %s, %s", err, data));
      return cb(format("Failed to get server %s", serverLabel));
    }
    else {
      var name = data.properties.name;
      var machineState = data.metadata.state;
      var serverState = data.properties.vmState;
      var cores = data.properties.cores;
      var ram = bytesToSize(data.properties.ram * 1000000);
      var nicId = data.entities.nics.items[0].id;
      var nicCb = function(err, data) {
        if (err) {
          log(format("ERROR: %s, %s", err, data));
          return cb(format("Failed to get server %s NIC info", serverLabel));
        }
        else {
          var status = {
            serverLabel: serverLabel,
            name: name,
            machineState: machineState,
            serverState: serverState,
            cores: cores,
            ram: ram,
            ips: data.properties.ips,
          }
          return cb(null, status);
        }
      }
      pb.getNic(serverLabel, nicId, nicCb);
    }
  }
  pb.getServer(serverLabel, getCb);
}

var getGroupStatus = function(groupLabel, cb) {
  var getServerFunc = function(serverLabel) {
    return function(next) {
      var statusCb = function(err, data) {
        if (err) {
          return next(err);
        }
        else {
          return next(null, data);
        }
      }
      getServerStatus(serverLabel, statusCb);
    }
  }
  executeFuncsParallel(groupLabel, getServerFunc, cb);
}

var managedHostEntry = function(serverLabel) {
  if (config.pb.servers[serverLabel]) {
    var serverEntry = config.pb.servers[serverLabel].manageHostEntry;
    var globalEntry = config.pb.manageHostEntry;
    if (serverEntry !== null && serverEntry !== undefined) {
      log(format("Found host entry config for server %s: %s", serverLabel, serverEntry));
      return serverEntry;
    }
    else if (globalEntry !== null && globalEntry !== undefined) {
      log(format("Using global host entry config: %s", globalEntry));
      return globalEntry;
    }
    else {
      log("Host entry config disabled");
      return false;
    }
  }
  else {
    log(format("ERROR: server %s does not exist", serverLabel));
    return false;
  }
}

var addHost = function(serverLabel, ip, cb) {
  if (managedHostEntry(serverLabel)) {
    hostile.set(ip, serverLabel, function (err) {
      if (err) {
        log(format("ERROR: cannot set hosts entry for server %s, IP %s: %s", serverLabel, ip, err));
      }
      else {
        log(format("Set hosts entry for server %s, IP %s", serverLabel, ip));
      }
      cb && cb();
    });
  }
}

var removeHost = function(serverLabel, ip, cb) {
  if (managedHostEntry(serverLabel)) {
    hostile.remove(ip, serverLabel, function (err) {
      if (err) {
        log(format("ERROR: cannot remove hosts entry for server %s, IP %s: %s", serverLabel, ip, err));
      }
      else {
        log(format("Removed hosts entry for server %s, IP %s", serverLabel, ip));
      }
      cb && cb();
    });
  }
}

switch (args[0]) {
  case 'start':
    var groupLabel = args[1];
    var startServerFunc = function(serverLabel) {
      return function(next) {
        var cb = function(err, data) {
          if (err) {
            log(format("ERROR: %s, %s", err, data));
            return next(format("Failed to start server %s", serverLabel));
          }
          else {
            var statusCb = function(err, data) {
              if (err) {
                log(format("ERROR: %s, %s", err, data));
              }
              else {
                if (data.serverState == 'RUNNING') {
                  addHost(serverLabel, data.ips[0]);
                  return next(null, format("Started server %s", serverLabel));
                }
                else {
                  return next(format("Server %s in invalid state for start: %s", serverLabel, data.serverState));
                }
              }
            }
            getServerStatus(serverLabel, statusCb);
          }
        }
        pb.startServerTracked(serverLabel, cb);
      }
    }
    executeFuncsSeries(groupLabel, startServerFunc);
    break;
  case 'stop':
    var groupLabel = args[1];
    var stopServerFunc = function(serverLabel) {
      return function(next) {
        var statusCb = function(err, statusData) {
          var stopCb = function(err, data) {
            if (err) {
              log(format("ERROR: %s, %s", err, data));
              return next(format("Failed to stop server %s", serverLabel));
            }
            else {
              removeHost(serverLabel, statusData.ips[0]);
              return next(null, format("Stopped server %s", serverLabel));
            }
          }
          if (statusData.serverState == 'RUNNING') {
            var shutdownCb = function(err, data) {
              if (err) {
                log(format("ERROR: %s, %s", err, data));
              }
              // Even if there was a failure in shutdown, we still want to stop, so no
              // need to verify what happened here.
              pb.stopServerTracked(serverLabel, stopCb);
            }
            pb.shutdownServerTracked(serverLabel, shutdownCb);
          }
          else {
            pb.stopServerTracked(serverLabel, stopCb);
          }
        }
        getServerStatus(serverLabel, statusCb);
      }
    }
    executeFuncsSeries(groupLabel, stopServerFunc);
    break;
  case 'shutdown':
    var groupLabel = args[1];
    var shutdownServerFunc = function(serverLabel) {
      return function(next) {
        var statusCb = function(err, statusData) {
          if (statusData.serverState == 'RUNNING') {
            var shutdownCb = function(err, data) {
              if (err) {
                log(format("ERROR: %s, %s", err, data));
                return next(format("Failed to shutdown server %s", serverLabel));
              }
              else {
                return next(null, format("Shutdown server %s", serverLabel));
              }
            }
            pb.shutdownServerTracked(serverLabel, shutdownCb);
          }
          else {
            log(format("WARN: Server %s in invalid state for shutdown: %s", serverLabel, statusData.serverState));
            return next(null);
          }
        }
        getServerStatus(serverLabel, statusCb);
      }
    }
    executeFuncsSeries(groupLabel, shutdownServerFunc);
    break;
  case 'hard-stop':
    var groupLabel = args[1];
    var stopServerFunc = function(serverLabel) {
      return function(next) {
        var statusCb = function(err, statusData) {
          var stopCb = function(err, data) {
            if (err) {
              log(format("ERROR: %s, %s", err, data));
              return next(format("Failed to hard stop server %s", serverLabel));
            }
            else {
              removeHost(serverLabel, statusData.ips[0]);
              return next(null, format("Hard stopped server %s", serverLabel));
            }
          }
          pb.stopServerTracked(serverLabel, stopCb);
        }
        getServerStatus(serverLabel, statusCb);
      }
    }
    executeFuncsSeries(groupLabel, stopServerFunc);
    break;
  case 'status':
    var groupLabel = args[1];
    var statusCb = function(err, results) {
      if (err) {
        log(format("ERROR: %s", err));
      }
      else {
        if (isGroup) {
          log(format("\n\nStatuses for group '%s':\n", groupLabel));
          results.forEach(function(data) {
              var info = format("%s: %s, %s (%d cores, %s RAM)", data.name, data.machineState, data.serverState, data.cores, data.ram);
              log(info);
          });
        }
        else {
          results.forEach(function(data) {
              var info = format("Name: %s\nMachine state: %s\nServer state: %s\nCores: %d\nRAM: %s\nIPs: %s", data.name, data.machineState, data.serverState, data.cores, data.ram, data.ips);
              log(format("\n\nGot info for server %s\n", data.serverLabel) + info);
          });
        }
      }
    }
    getGroupStatus(groupLabel, statusCb);
    break;
  case 'update':
    var groupLabel = args[1];
    var profile = args[2];
    var updateServerFunc = function(serverLabel) {
      return function(next) {
        var updateCb = function(err, data) {
          if (err) {
            log(format("ERROR: %s, %s", err, data));
            return next(format("Failed to update server %s", serverLabel));
          }
          else {
            var name = data.properties.name;
            var cores = data.properties.cores;
            var ram = data.properties.ram;
            var stats = format("Name: %s\nCores: %d\nRAM: %s", name, cores, bytesToSize(ram * 1000000));
            return next(null, format("Updated server %s\n", serverLabel) + stats);
          }
        }
        pb.updateServer(serverLabel, profile, updateCb);
      }
    }
    executeFuncsParallel(groupLabel, updateServerFunc);
    break;
  case 'check-fs':
    if (isGroup) {
      nonGroupError(args[0]);
      return;
    }
    var serverLabel = args[1];
    log("Checking FreeSWITCH service...");
    pb.checkCommand(serverLabel, "service freeswitch status");
    break;
  case 'datacenters':
    if (isGroup) {
      nonGroupError(args[0]);
      return;
    }
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
    if (isGroup) {
      nonGroupError(args[0]);
      return;
    }
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
  case 'groupLabels':
    var labels = [];
    for (label in config.pb.groups) {
      var skip = [
        'manageHostsFile',
      ];
      if(skip.indexOf(label) == -1) {
        labels.push(label);
      }
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
    log("Usage:");
    log("");
    log("  " + program + " datacenters");
    log("  " + program + " servers <datacenter>");
    log("  " + program + " start <server-label>");
    log("  " + program + " stop <server-label>");
    log("  " + program + " shutdown <server-label>");
    log("  " + program + " hard-stop <server-label>");
    log("  " + program + " status <server-label>");
    log("  " + program + " update <server-label> <profile>");
    log("  " + program + " check-fs <server-label>");
    log("");
    log("  " + program + " group start <group-label>");
    log("  " + program + " group stop <group-label>");
    log("  " + program + " group shutdown <group-label>");
    log("  " + program + " group hard-stop <group-label>");
    log("  " + program + " group status <group-label>");
    log("  " + program + " group update <group-label> <profile>");
}

// vi: ft=javascript
