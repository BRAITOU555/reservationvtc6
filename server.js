// Utilisez require pour charger esm et initialiser le support des modules ES
require = require('esm')(module);
module.exports = require('./server.mjs');
