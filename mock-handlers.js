var Factory = function(logger) {
  var machineState = 'INACTIVE';
  var serverState = 'SHUTOFF';
  var PbHandler = function() {
    // Allows to have the mock respond with either failure or success.
    // Only applies to start, stop, update methods.
    var successStates = ['start', 'stop', 'update'];
    var that = this;
    var cores = 1;
    var ram = 2048;
    // Milliseconds to simulate time to run a command.
    var commandExecutionTime = 1000;
    var setSuccessStates = function(states) {
      if (typeof states !== 'undefined') {
        successStates = states;
      }
    }
    var setMachineState = function(state) {
      machineState = state;
    }
    var setServerState = function(state) {
      serverState = state;
    }
    var setCommandExecutionTime = function(milliseconds) {
      commandExecutionTime = milliseconds;
    }
    this.setSuccessStates = function(states) {
      setSuccessStates(states);
    }
    this.setMachineState = function(state) {
      setMachineState(state);
    }
    this.setServerState = function(state) {
      setServerState(state);
    }
    this.setCommandExecutionTime = function(milliseconds) {
      setCommandExecutionTime(milliseconds);
    }
    var handler = {
      setauth: function setauth(username, password) {
        // Called by core pb lib.
      },
      setdepth: function setdepth(depth) {
        // Called by core pb lib.
      },
      listDatacenters: function listDatacenters(cb) {
        logger.debug(arguments.callee.name + " called");
      },
      listServers: function listServers(datacenterId, cb) {
        logger.debug(arguments.callee.name + " called");
      },
      getServer: function getServer(datacenterId, serverId, apiCallback) {
        logger.debug(arguments.callee.name + " called");
        var serverStatus = function() {
          var data = {
            metadata: {
              state: machineState,
            },
            properties: {
              name: "test name",
              vmState: serverState,
              cores: cores,
              ram: ram,
            },
          }
          apiCallback(null, {statusCode: 200}, JSON.stringify(data));
        }
        setTimeout(serverStatus, commandExecutionTime);
      },
      startServer: function startServer(datacenterId, serverId, apiCallback) {
        logger.debug(arguments.callee.name + " called");
        machineState = 'INACTIVE';
        serverState = 'SHUTOFF';
        var startServer = function() {
          var success = successStates.indexOf('start') !== -1;
          var err = success ? null : 'error';
          var statusCode = success ? 202 : 500;
          apiCallback(err, {statusCode: statusCode}, '');
          var serverRunning = function() {
            if (success) {
              machineState = 'AVAILABLE';
              serverState = 'RUNNING';
            }
          }
          setTimeout(serverRunning, commandExecutionTime * 3);
        }
        setTimeout(startServer, commandExecutionTime);
      },
      stopServer: function stopServer(datacenterId, serverId, apiCallback) {
        logger.debug(arguments.callee.name + " called");
        machineState = 'AVAILABLE';
        serverState = 'SHUTOFF';
        var stopServer = function() {
          var success = successStates.indexOf('stop') !== -1;
          var err = success ? null : 'error';
          var statusCode = success ? 202 : 500;
          apiCallback(err, {statusCode: statusCode}, '');
          var serverStopped = function() {
            if (success) {
              machineState = 'INACTIVE';
              serverState = 'SHUTOFF';
            }
          }
          setTimeout(serverStopped, commandExecutionTime * 3);
        }
        setTimeout(stopServer, commandExecutionTime);
      },
      updateServer: function updateServer(datacenterId, serverId, updateData, apiCallback) {
        logger.debug(arguments.callee.name + " called");
        var updateServer = function() {
          var success = successStates.indexOf('update') !== -1;
          var err = success ? null : 'error';
          var statusCode = 500;
          var data = null;
          if (success) {
            statusCode = 202;
            data = {
              properties: {
                name: "test name",
                cores: updateData.properties.cores,
                ram: updateData.properties.ram,
              },
            }
            data = JSON.stringify(data);
          }
          apiCallback(err, {statusCode: statusCode}, data);
        }
        setTimeout(updateServer, commandExecutionTime);
      },
    }
    Object.keys(handler).forEach(function(key, index) {
      that[key] = function() {
        handler[key].apply(that, arguments);
      }
    });
  }

  var SshHandler = function() {
    var that = this;
    // Milliseconds to simulate time to run a command.
    var commandExecutionTime = 1000;
    var setCommandExecutionTime = function(milliseconds) {
      commandExecutionTime = milliseconds;
    }
    this.setCommandExecutionTime = function(milliseconds) {
      setCommandExecutionTime(milliseconds);
    }
    var handler = {
      exec: function exec(command, config) {
        logger.debug(arguments.callee.name + " called");
        config && config.exit && config.exit(0, '', '');
        // This is a little clunky, but I don't see any elegant way to
        // penetrate the shutdown command with these mocks.
        if (command == 'shutdown -P now shutdown-now&') {
          machineState = 'AVAILABLE';
          serverState = 'RUNNING';
          var serverShutdown = function() {
            machineState = 'AVAILABLE';
            serverState = 'SHUTOFF';
          }
          setTimeout(serverShutdown, commandExecutionTime * 3);
        }
      },
      start: function setdepth(config) {
        logger.debug(arguments.callee.name + " called");
        var start = function() {
          config && config.success && config.success();
        }
        setTimeout(start, commandExecutionTime);
      },
    }
    Object.keys(handler).forEach(function(key, index) {
      that[key] = function() {
        handler[key].apply(that, arguments);
      }
    });
  }

  return {
    pbHandler: new PbHandler(),
    sshHandler: SshHandler,
  }

}

module.exports = Factory;

