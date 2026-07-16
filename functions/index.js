/**
 * Cloud Functions entry point. Each function is defined in its own module
 * and re-exported here so `firebase deploy --only functions:<name>` works.
 */
exports.workspaceAgent = require('./agent').workspaceAgent;
