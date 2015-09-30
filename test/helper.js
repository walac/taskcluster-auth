var assert      = require('assert');
var Promise     = require('promise');
var path        = require('path');
var _           = require('lodash');
var base        = require('taskcluster-base');
var v1          = require('../auth/v1');
var taskcluster = require('taskcluster-client');
var mocha       = require('mocha');
var server      = require('../bin/server');
var exchanges   = require('../auth/exchanges');

// Load configuration
var cfg = base.config({
  defaults:     require('../config/defaults'),
  profile:      require('../config/test'),
  filename:     'taskcluster-auth'
});

// Create subject to be tested by test
var helper = module.exports = {};

helper.cfg = cfg;
helper.testaccount = _.keys(JSON.parse(cfg.get('auth:azureAccounts')))[0];
helper.rootAccessToken = cfg.get('auth:rootAccessToken');

// Skip tests if no AWS credentials is configured
if (!cfg.get('azure:accountKey') ||
    !cfg.get('auth:rootAccessToken') ||
    !cfg.get('influx:connectionString') ||
    !cfg.get('pulse:password')) {
  console.log("Skip tests for due to missing credentials!");
  process.exit(1);
}

// Configure PulseTestReceiver
helper.events = new base.testing.PulseTestReceiver(cfg.get('pulse'), mocha);

var webServer = null;
mocha.before(async () => {
  webServer = await server('test');
  webServer.setTimeout(1500);

  // Create client for working with API
  helper.baseUrl = 'http://localhost:' + webServer.address().port + '/v1';
  var reference = v1.reference({baseUrl: helper.baseUrl});
  helper.Auth = taskcluster.createClient(reference);
  helper.auth = new helper.Auth({
    baseUrl:          helper.baseUrl,
    credentials: {
      clientId:       'root',
      accessToken:    cfg.get('auth:rootAccessToken')
    }
  });

  var exchangeReference = exchanges.reference({
    exchangePrefix:   cfg.get('auth:exchangePrefix'),
    credentials:      cfg.get('pulse')
  });
  helper.AuthEvents = taskcluster.createClient(exchangeReference);
  helper.authEvents = new helper.AuthEvents();
});

// Cleanup after tests
mocha.after(async () => {
  // Kill webServer
  await webServer.terminate();
});
