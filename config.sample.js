module.exports = {
  pb: {
    username: 'your profitbricks username',
    password: 'your profitbricks password',
    depth: 1,
    datacenters: {
      datacenterLabel1: 'datacenter id where some servers are located',
      datacenterLabel2: 'datacenter id where some other servers are located',
    },
    servers: {
      serverLabelOne: {
        id: 'server id of this server',
        datacenter: 'datacenterLabel1',
      },
      serverLabelTwo: {
        id: 'server id of this server',
        datacenter: 'datacenterLabel1',
      },
      serverLabelThree: {
        id: 'server id of this server',
        datacenter: 'datacenterLabel2',
      },
    },
    // Groups are used by the pb-group command.
    groups: {
      groupLabelAll: {
        servers: [
          'serverLabelOne',
          'serverLabelTwo',
          'serverLabelThree',
        ],
      },
      groupLabelSome: {
        servers: [
          'serverLabelOne',
          'serverLabelTwo',
        ],
        // Can also be set per group, overrides main setting.
        manageHostsFile: true,
      },
      // If enabled, manages local DNS mappings for the servers, useful for
      // enabling easier SSH access. The server label will be used as the DNS
      // name.
      // The setting here controls the behavior for all configured groups.
      // NOTE: if this is enabled, the NPM package 'hostile' must be
      // installed and in the require path.
      manageHostsFile: false,
    },
    profiles: {
      dev: {
        cores: 1,
        ram: 2048,
      },
      prod: {
        cores: 8,
        ram: 10240,
      },
    },
  },
  ssh: {
    // Supplying the host as below is optional, if not provided, the IP
    // address from the server will be used.
    serverLabelTwo: {
      host: 'hostname or IP to reach server',
    },
    // port, user, and key can be overridden per server.
    serverLabelThree: {
      port: 5000,
      user: 'some other SSH username',
      key: 'some other full path to private key for SSH access',
    },
    // These defaults apply to all SSH entries unless specifically overridden
    // in the server config.
    port: 22,
    user: 'SSH username',
    key: 'full path to private key for SSH access',
  },
}

