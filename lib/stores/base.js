const { Cc, Ci, Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const URL = require("sdk/url");

var ProjectStore = Class({
  extends: EventTarget,

  // Should be called during initialize() of a subclass.
  initStore: function() {
    this.nodes = new Map();
  },

  refresh: function() {
    return Promise.resolve();
  },

  // This isn't well-thought-through at all.
  updateIndex: function() {
    let idx = new Map();
    for (let [key, node] of this.nodes) {
      let name = node.basename;
      if (!idx.has(name)) {
        idx.set(name, []);
      }
      idx.get(name).push(node);
    }
    this._basenameIndex = idx;
  },

  findBasename: function(basename) {
    console.log("looking for " + basename + " in " + this.displayName);
    return this._basenameIndex.get(basename) || [];
  },

  root: function() {
    throw new Error("root() is not implemented by this project store.");
  }
});
exports.ProjectStore = ProjectStore;

var ProjectNode = Class({
  extends: EventTarget,

  set uri(uri) {
    this._uriBasename = uriBasename(uri);
    this._uri = uri;
  },
  get uri() { return this._uri },

  get basename() { return this._uriBasename },

  get title() { return this.basename },
  get displayName() { return this.basename },

  get isDir() { return false; },
  get hasChildren() { return false; },
});
exports.ProjectNode = ProjectNode;

// Surely there's a better way to do this.
function uriBasename(uri) {
  var basename = uri.path;

  let idx = uri.path.lastIndexOf("/", basename.length - 2);
  if (idx > -1) {
    basename = uri.path.substring(idx + 1);
  }

  if (basename[basename.length - 1] === "/") {
    basename = basename.substring(0, basename.length - 1);
  }

  return basename;
}
