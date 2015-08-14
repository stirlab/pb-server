var Factory = function() {
  var machineState = 'INACTIVE';
  var serverState = 'SHUTOFF';
  var PbHandler = function() {
    // Allows to have the mock respond with either failure or success.
    // Only applies to start, stop, update methods.
    var successState = true;
    var that = this;
    var cores = 1;
    var ram = 2048;
    // Milliseconds to simulate time to run a command.
    var commandExecutionTime = 1000;
    var setSuccessState = function(bool) {
      successState = bool;
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
    this.setSuccessState = function(bool) {
      setSuccessState(bool);
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
        console.log(arguments.callee.name + " called");
      },
      listServers: function listServers(datacenterId, cb) {
        console.log(arguments.callee.name + " called");
      },
      getServer: function getServer(datacenterId, serverId, apiCallback) {
        console.log(arguments.callee.name + " called");
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
        console.log(arguments.callee.name + " called");
        machineState = 'INACTIVE';
        serverState = 'SHUTOFF';
        var startServer = function() {
          var err = successState ? null : 'error';
          var statusCode = successState ? 202 : 500;
          apiCallback(err, {statusCode: statusCode}, '');
          var serverRunning = function() {
            if (successState) {
              machineState = 'AVAILABLE';
              serverState = 'RUNNING';
            }
          }
          setTimeout(serverRunning, commandExecutionTime * 3);
        }
        setTimeout(startServer, commandExecutionTime);
      },
      stopServer: function stopServer(datacenterId, serverId, apiCallback) {
        console.log(arguments.callee.name + " called");
        machineState = 'AVAILABLE';
        serverState = 'SHUTOFF';
        var stopServer = function() {
          var err = successState ? null : 'error';
          var statusCode = successState ? 202 : 500;
          apiCallback(err, {statusCode: statusCode}, '');
          var serverStopped = function() {
            if (successState) {
              machineState = 'INACTIVE';
              serverState = 'SHUTOFF';
            }
          }
          setTimeout(serverStopped, commandExecutionTime * 3);
        }
        setTimeout(stopServer, commandExecutionTime);
      },
      updateServer: function updateServer(datacenterId, serverId, updateData, apiCallback) {
        console.log(arguments.callee.name + " called");
        var updateServer = function() {
          var err = successState ? null : 'error';
          var statusCode = 500;
          var data = null;
          if (successState) {
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
        console.log(arguments.callee.name + " called");
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
        console.log(arguments.callee.name + " called");
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

