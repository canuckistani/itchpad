const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const picker = require("helpers/file-picker");

var OpenPlugin = Class({
  extends: Plugin,

  init: function(host) {},

  onCommand: function(cmd) {
    if (cmd === "cmd-open") {
      picker.showOpen({
        window: this.host.window
      }).then(path => {
        this.open(path);
      });
    }
  },

  open: function(path) {
    this.host.project.resourceFor(path).then(resource => {
      this.host.openResource(resource);
    });
  }
});

exports.OpenPlugin = OpenPlugin;
registerPlugin(OpenPlugin);
