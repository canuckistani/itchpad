const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");

var AspectChooser = Class({
  extends: Plugin,

  init: function(host) {
    this.doc = host.document;

    this.elt = this.host.createToolbarGroup({
      parent: "#plugin-toolbar-right",
      id: "pair-choice",
      class: "",
    });

    this.live = this.host.createToolbarButton({
      parent: this.elt,
      id: "pair-live",
      class: "devtools-tab source-live"
    });

    this.project = this.host.createToolbarButton({
      parent: this.elt,
      id: "pair-project",
      class: "devtools-tab source-project"
    });

    this.update = this.update.bind(this);

    this.live.addEventListener("click", () => {
      if (this.host.currentShell) {
        this.host.currentShell.selectAspect("live");
      }
    });

    this.project.addEventListener("click", () => {
      if (this.host.currentShell) {
        this.host.currentShell.selectAspect("project");
      }
    });
  },

  onEditorActivated: function(editor) {
    this.setShell(editor.shell);
  },
  onEditorDeactivated: function(editor) {
    this.setShell(null);
  },

  setShell: function(shell) {
    if (shell === this.shell) {
      return;
    }

    if (this.shell) {
      this.shell.off("aspect-changed", this.update);
      this.shell.pair.off("changed", this.update);
    }
    this.shell = shell;
    if (!shell) {
      this.elt.setAttribute("aspects", "");
      return;
    }
    this.shell.on("aspect-changed", this.update);
    this.shell.pair.on("changed", this.update);

    this.update();
  },

  update: function() {
    let shell = this.host.currentShell;

    let aspects = (shell.live ? "live " : "") + (shell.project ? "project " : "");
    this.elt.setAttribute("aspects", aspects);

    this.project.setAttribute("label", shell.project ? shell.project.displayName : "None");
    this.live.setAttribute("label", shell.live ? shell.live.displayName : "None");

    let selected = shell.currentAspect;
    let notSelected = selected === "project" ? "live" : "project";
    this.doc.getElementById("pair-" + selected).setAttribute("selected", "true");
    this.doc.getElementById("pair-" + notSelected).removeAttribute("selected");
  }
});
exports.AspectChooser = AspectChooser;
registerPlugin(AspectChooser);
