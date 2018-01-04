# pb-server
Small library to manage profitbricks.com virtual servers.

The following operations are supported:
 * Start
 * Stop (safe, issues shutdown command first)
 * Shutdown (safe, issues shutdown command to server before powering off)
 * Hard stop
 * Update cores and RAM based on configured 'profiles'
 * Get basic server status information (state, cores, RAM)
 * Run commands on groups of servers via custom configured groups
 * Operate on servers in different datacenters

Both a CLI executable and a Node.js library are provided.

## Installation
```
git clone https://github.com/thehunmonkgroup/pb-server.git
cd pb-server
npm install
cp config.sample.js config.js
```

Edit config.js to taste.

See [config.sample.js](config.sample.js) for a fully commented explanation of
the various configuration options.

## Usage

### CLI

#### For commands on individual (or groups of configured) servers.
Run ```pb``` without arguments for script usage.

The CLI executable supports configuring 'groups' in the config file which
allow commands to be run on multiple servers at once.

### As a node module.

```javascript
var PbServer = require('./pb-server');
var config = require('./config');
var pb = new PbServer(config.pb, config.ssh);

// Server labels are the keys as defined in config.js, 'servers' object.
var serverName = 'serverLabelOne';
var cb = function(err, data) {
  if (err) {
    console.log(format("ERROR: %s, %s", err, data));
  }
  console.log(data);
}
pb.getServer(serverName, cb);
```

See ```pb-server.js``` for all currently supported methods, and ```pb``` for more usage examples.

## Shell completion

The provided [pb.bash_completion](pb.bash_completion) can be used to enable
shell completion for BASH.

## Support

The issue tracker for this project is provided to file bug reports, feature
requests, and project tasks -- support requests are not accepted via the issue
tracker. For all support-related issues, including configuration, usage, and
training, consider hiring a competent consultant.
