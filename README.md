# pb-server
Small library to manage profitbricks.com virtual servers.

The following operations are supported:
 * Start
 * Stop (safe, issues shutdown command first)
 * Shutdown (safe, issues shutdown command to server before powering off)
 * Hard stop
 * Update cores and RAM based on configured 'profiles'
 * Get basic server status information (state, cores, RAM)

## Installation
```
git clone https://github.com/thehunmonkgroup/pb-server.git
cd pb-server
npm install
cp config.sample.js config.js
```

Edit config.js to taste.

## Usage

### CLI

#### For commands on individual servers.
Run ```pb``` without arguments for script usage.

#### For commands on groups of servers.
Run ```pb-group``` without arguments for script usage.

### As a node module.

```javascript
var PbServer = require('./pb-server');
var config = require('./config');
var pb = new PbServer(config.pb, config.ssh);

// Use the label for the server as defined in config.js, serverIds object.
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
