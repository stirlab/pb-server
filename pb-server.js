var fs = require('fs');
var util = require('util');
var libpb = require('libprofitbricks');
var SSH = require('simple-ssh');
var format = util.format;
var mockHandlers = require('./mock-handlers');

var dummyCb = function() {};
// 5 seconds.
var SERVER_QUERY_INTERVAL = 5000;
// 3 minutes total.
var MAX_QUERY_ATTEMPTS = 36;

var PbServer = function(pb, ssh, logger) {
  this.pbHandler = libpb;
  this.sshHandler = SSH;
  this.pb = pb;
  this.ssh = ssh;

  if (logger) {
    this.logger = logger;
  }
  else {
    this.logger = console;
    this.logger.debug = this.logger.log;
  }
  this.mockHandlers = mockHandlers(this.logger);

  this.stateChangeQueryInterval = pb.stateChangeQueryInterval ? pb.stateChangeQueryInterval : SERVER_QUERY_INTERVAL;
  this.maxStateChangeQueryAttempts = pb.maxStateChangeQueryAttempts ? pb.maxStateChangeQueryAttempts : MAX_QUERY_ATTEMPTS;
  this.sshKey = ssh.key ? fs.readFileSync(ssh.key) : null;

  this.pbHandler.setauth(this.pb.username, this.pb.password);
  this.pbHandler.setdepth(this.pb.depth);

  var self = this;
  var _tracked = function(serverLabel, command, machineToState, serverToState, message, cb) {
    cb = cb ? cb : dummyCb;
    var postCommand = function(err, resp, body) {
      if (err) {
        self.logger.error(format('%s command returned error: %s, %s', command, err, body));
        cb(err, body);
      }
      else {
        var stateChangeCallback = function(err, data) {
          if (err) {
            self.logger.error(format('State change returned error: %s, %s', err, data));
            cb(err, data);
          }
          else {
            self.logger.info(message);
            cb(null, data);
          }
        }
        self.serverStateChange(serverLabel, machineToState, serverToState, stateChangeCallback);
      }
    }
    self[command](serverLabel, postCommand);
  }

  this.startServerTracked = function(serverLabel, cb) {
    _tracked(serverLabel, 'startServer', 'AVAILABLE', 'RUNNING', format("Server '%s' started!", serverLabel), cb);
  }

  this.shutdownServerTracked = function(serverLabel, cb) {
    _tracked(serverLabel, 'shutdownServer', 'AVAILABLE', 'SHUTOFF', format("Server '%s' shut down!", serverLabel), cb);
  }

  this.stopServerTracked = function(serverLabel, cb) {
    _tracked(serverLabel, 'stopServer', 'INACTIVE', 'SHUTOFF', format("Server '%s' stopped!", serverLabel), cb);
  }

  var parseBody = function(body) {
    try {
      var data = JSON.parse(body);
      return [null, data];
    }
    catch(err) {
      return [err, body];
    }
  }

  this.parseBody = function(body) {
    return parseBody(body);
  }

  var labelError = function(label, cb) {
    self.logger.error(format("Server label '%s' does not exist, or is misconfigured, check config", label));
    cb("Config error");
  }

  var configFromLabel = function(label, cb) {
    try {
      var datacenterLabel = self.pb.servers[label].datacenter;
      var datacenterId = self.pb.datacenters[datacenterLabel];
      var serverId = self.pb.servers[label].id;
      var sshHost = self.ssh[label].host;
      var sshPort = self.ssh[label].port || self.ssh.port;
      var sshUser = self.ssh[label].user || self.ssh.user;
      if (datacenterId && serverId && sshHost && sshPort && sshUser) {
        return {
          datacenterId: datacenterId,
          serverId: serverId,
          sshHost: sshHost,
          sshPort: sshPort,
          sshUser: sshUser,
        }
      }
      else {
        labelError(label, cb);
        return false;
      }
    }
    catch(err) {
      labelError(label, cb);
      return false;
    }
  }

  this.configFromLabel = function(label, cb) {
    return configFromLabel(label, cb);
  }

}

PbServer.prototype.setMockHandlers = function(handlers) {
  this.mockHandlers = handlers;
}

PbServer.prototype.useMockHandlers = function(successStates) {
  // Mocks shouldn't need any more attempts than this.
  this.maxStateChangeQueryAttempts = 2;
  this.mockHandlers.setSuccessStates(successStates);
  this.pbHandler = this.mockHandlers.pbHandler;
  this.sshHandler = this.mockHandlers.sshHandler;
}

PbServer.prototype.useLiveHandlers = function() {
  this.maxStateChangeQueryAttempts = MAX_QUERY_ATTEMPTS;
  this.pbHandler = libpb;
  this.sshHandler = SSH;
}

PbServer.prototype.listDatacenters = function(cb) {
  var self = this;
  cb = cb ? cb : dummyCb;
  var apiCallback = function(err, resp, body) {
    if (err) {
      self.logger.error(format("ERROR: %s, %s", err, body));
      cb(err, body);
    }
    else {
      var result = self.parseBody(body);
      cb.apply(self, result);
    }
  }
  this.logger.info("Getting datacenter info...");
  this.pbHandler.listDatacenters(apiCallback);
}

PbServer.prototype.listServers = function(datacenterLabel, cb) {
  var self = this;
  cb = cb ? cb : dummyCb;
  var apiCallback = function(err, resp, body) {
    if (err) {
      self.logger.error(format("ERROR: %s, %s", err, body));
      cb(err, body);
    }
    else {
      var result = self.parseBody(body);
      cb.apply(self, result);
    }
  }
  var datacenterId = this.pb.datacenters[datacenterLabel];
  if (!datacenterId) {
    var message = format("ERROR: datacenter label %s does not exist, or is misconfigured", datacenterLabel);
    this.logger.error(message);
    cb(message, null);
  }
  else {
    this.logger.info(format("Listing servers for datacenter %s...", datacenterLabel));
    this.pbHandler.listServers(datacenterId, apiCallback)
  }
}

PbServer.prototype.getServer = function(serverLabel, cb) {
  var config = this.configFromLabel(serverLabel, cb);
  if (!config) { return; }
  var self = this;
  cb = cb ? cb : dummyCb;
  var apiCallback = function(err, resp, body) {
    if (err) {
      self.logger.error(format("ERROR: %s, %s", err, body));
      cb(err, body);
    }
    else {
      var result = self.parseBody(body);
      cb.apply(self, result);
    }
  }
  this.logger.info(format("Getting server status for '%s'...", serverLabel));
  this.pbHandler.getServer(config.datacenterId, config.serverId, apiCallback)
}

PbServer.prototype.getNic = function(serverLabel, nicId, cb) {
  var config = this.configFromLabel(serverLabel, cb);
  if (!config) { return; }
  var self = this;
  cb = cb ? cb : dummyCb;
  var apiCallback = function(err, resp, body) {
    if (err) {
      self.logger.error(format("ERROR: %s, %s", err, body));
      cb(err, body);
    }
    else {
      var result = self.parseBody(body);
      cb.apply(self, result);
    }
  }
  this.logger.info(format("Getting info for NIC '%s' on server '%s'...", nicId, serverLabel));
  this.pbHandler.getNic(config.datacenterId, config.serverId, nicId, apiCallback)
}

PbServer.prototype.startServer = function(serverLabel, cb) {
  var config = this.configFromLabel(serverLabel, cb);
  if (!config) { return; }
  this.logger.info(format("Starting server '%s'...", serverLabel));
  this.pbHandler.startServer(config.datacenterId, config.serverId, cb)
}

PbServer.prototype.stopServer = function(serverLabel, cb) {
  var config = this.configFromLabel(serverLabel, cb);
  if (!config) { return; }
  this.logger.info(format("Powering off server '%s'...", serverLabel));
  this.pbHandler.stopServer(config.datacenterId, config.serverId, cb)
}

PbServer.prototype.shutdownServer = function(serverLabel, cb) {
  var config = this.configFromLabel(serverLabel, cb);
  if (!config) { return; }
  var self = this;
  cb = cb ? cb : dummyCb;
  this.logger.info(format("Shutting down server '%s'...", serverLabel));
  var ssh = new this.sshHandler({
    host: config.sshHost,
    port: config.sshPort,
    user: config.sshUser,
    key: this.sshKey,
  });
  var exit = function(code, stdout, stderr) {
    self.logger.debug(format("SSH command exit code: %s", code));
    if (code === 0) {
      self.logger.debug("Shutdown command execution succeeded...");
      cb(null, code);
    }
    else {
      var message = format('SSH command returned with error code: %d, %s', code, stderr);
      self.logger.error(message);
      cb(message);
    }
  }
  var execConfig = {
    exit: exit,
  };
  var startConfig = {
    success: function() {
      self.logger.debug("SSH connection successful...");
    },
    fail: function(err) {
      self.logger.debug(format("SSH connection failed: %s", err));
      cb(err);
    },
  }
  // Executing shutdown without backgrounding hangs, backgrounding the command
  // allows the shutdown to proceed, and our SSH command to get a return value.
  // sudo with the full path allows a non-root user to be used for shutdown,
  // tested on Debian, YMMV on other systems.
  // NOTE: These commands kept separate to support the mock functionality.
  ssh.exec('sudo /sbin/shutdown -P now shutdown-now&', execConfig);
  ssh.start(startConfig);
}

PbServer.prototype.serverStateChange = function(serverLabel, machineToState, serverToState, cb) {
  var self = this;
  cb = cb ? cb : dummyCb;
  var count = 1;
  var checkState = function(err, data) {
    if (err) {
      self.logger.error(format("ERROR: %s, %s", err, data));
      cb(err, data);
      count++;
    }
    else {
      if (count > self.maxStateChangeQueryAttempts) {
        clearInterval(serverStateChange);
        var message = "Max attempts exceeded.";
        self.logger.error(message);
        cb(message);
      }
      else {
        var machineState = data.metadata.state;
        var serverState = data.properties.vmState;
        self.logger.debug(format("Attempt #%d for '%s'", count, serverLabel));
        self.logger.debug("-------------------------------------");
        self.logger.debug(format("Machine state: %s", machineState));
        self.logger.debug(format("Server state: %s", serverState));
        self.logger.debug("-------------------------------------");
        if (machineState == machineToState && serverState == serverToState) {
          self.logger.info(format("State change to (%s, %s) complete for '%s'", machineToState , serverToState, serverLabel));
          clearInterval(serverStateChange);
          cb(null, data);
        }
        count++;
      }
    }
  }
  var get = function() {
    self.getServer(serverLabel, checkState);
  }
  this.logger.info(format("Waiting for '%s' server state to change to (%s, %s)", serverLabel, machineToState , serverToState));
  get();
  var serverStateChange = setInterval(get, this.stateChangeQueryInterval);
}

PbServer.prototype.checkCommand = function(serverLabel, command, cb) {
  var config = this.configFromLabel(serverLabel, cb);
  if (!config) { return; }
  var self = this;
  cb = cb ? cb : dummyCb;
  var count = 1;
  // This prevents overlapping checks and messages.
  var timeout = this.stateChangeQueryInterval - 1000;
  this.logger.debug(format("Checking command: '%s' on '%s'", command, serverLabel));
  this.logger.debug(format("SSH connection timeout set to %d milliseconds", timeout));
  var exit = function(code, stdout, stderr) {
    if (code === 0) {
      clearInterval(checkCommand);
      self.logger.info("Command succeeded");
      cb(null, code);
    }
    else {
      self.logger.debug(format('Command returned with error code: %d, %s', code, stderr));
    }
  }
  var execConfig = {
    exit: exit,
  };
  var startConfig = {
    success: function() {
      self.logger.debug("SSH connection successful...");
    },
    fail: function(err) {
      self.logger.debug(format("SSH connection failed: %s", err));
    },
  }
  var check = function() {
    if (count > self.maxStateChangeQueryAttempts) {
      clearInterval(checkCommand);
      var message = "Max attempts exceeded.";
      self.logger.error(message);
      cb(message);
    }
    else {
      self.logger.debug(format("Attempt #%d on '%s'", count, serverLabel));
      var ssh = new self.sshHandler({
        host: config.sshHost,
        port: config.sshPort,
        user: config.sshUser,
        key: self.sshKey,
        timeout: timeout,
      });
      // NOTE: These commands kept separate to support the mock functionality.
      ssh.exec(command, execConfig);
      ssh.start(startConfig);
      count++;
    }
  }
  check();
  var checkCommand = setInterval(check, this.stateChangeQueryInterval);
}

PbServer.prototype.updateServer = function(serverLabel, profile, cb) {
  var config = this.configFromLabel(serverLabel, cb);
  if (!config) { return; }
  var self = this;
  cb = cb ? cb : dummyCb;
  var apiCallback = function(err, resp, body) {
    if (err) {
      self.logger.error(format("ERROR: %s, %s", err, body));
      cb(err, body);
    }
    else {
      var result = self.parseBody(body);
      cb.apply(self, result);
    }
  }
  this.logger.info(format("Updating server '%s' to profile: %s", serverLabel, profile));
  var data = this.pb.profiles[profile];
  if (data) {
    var updateData = {
      properties: data,
    }
    this.pbHandler.updateServer(config.datacenterId, config.serverId, updateData, apiCallback);
  }
  else {
    this.logger.error(format("ERROR: profile '%s' does not exist", profile));
  }
}

if (module.exports) {
  module.exports = PbServer;
}
