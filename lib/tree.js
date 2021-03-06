const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");
const { merge } = require("sdk/util/object");
const promise = require("helpers/promise");
const { InplaceEditor } = require("devtools/shared/inplace-editor");

const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var Container = Class({
  initialize: function(tree, node) {
    this.tree = tree;
    this.node = node;
    this.elt = null;
    this.expander = null;
    this.children = null;

    let doc = tree.doc;

    this.elt = doc.createElementNS(HTML_NS, "li");
    this.elt.classList.add("child");

    this.line = doc.createElementNS(HTML_NS, "div");
    this.line.classList.add("child");
    this.line.classList.add("tag-line");
    this.line.classList.add("side-menu-widget-item");
    this.line.setAttribute("theme", "dark");
    this.line.setAttribute("tabindex", "0");

    this.elt.appendChild(this.line);

    this.highlighter = doc.createElementNS(HTML_NS, "span");
    this.highlighter.classList.add("highlighter");
    this.line.appendChild(this.highlighter);

    this.expander = doc.createElementNS(HTML_NS, "span");
    this.expander.className = "arrow expander";
    this.expander.setAttribute("open", "");
    this.line.appendChild(this.expander);

    this.label = doc.createElementNS(HTML_NS, "span");
    this.line.appendChild(this.label);

    this.children = doc.createElementNS(HTML_NS, "ul");
    this.children.classList.add("children");

    this.elt.appendChild(this.children);

    this.line.addEventListener("click", (evt) => {
      if (!this.selected) {
        this.select();
        this.expanded = true;
        evt.stopPropagation();
      }
    }, false);
    this.expander.addEventListener("click", (evt) => {
      this.expanded = !this.expanded;
      this.select();
      evt.stopPropagation();
    }, true);

    this.update();
  },

  remove: function() {
    if (this.elt.parentNode) {
      this.elt.parentNode.removeChild(this.elt);
    }
  },

  destroy: function() {  },

  update: function() {
    // XXX: let the node create cooler display
    this.tree.options.nodeFormatter(this.node, this.label);
    this.expander.style.visibility = this.node.hasChildren ? "visible" : "hidden";
  },

  select: function() {
    this.tree.selectContainer(this);
  },

  get selected() {
    return this.line.classList.contains("selected");
  },
  set selected(v) {
    if (v) {
      this.line.classList.add("selected");
    } else {
      this.line.classList.remove("selected");
    }
  },

  get expanded() {
    return !this.elt.classList.contains("tree-collapsed");
  },

  set expanded(v) {
    if (v) {
      this.elt.classList.remove("tree-collapsed");
      this.expander.setAttribute("open", "");
    } else {
      this.expander.removeAttribute("open");
      this.elt.classList.add("tree-collapsed");
    }
  }
});

var TreeView = Class({
  extends: EventTarget,

  initialize: function(document, options) {
    this.doc = document;
    this.options = merge({
      nodeFormatter: function(node, elt) {
        elt.textContent = node.toString();
      }
    }, options);
    this.models = new Set();
    this.roots = new Set();
    this._containers = new Map();
    this.elt = document.createElement("vbox");
    this.elt.tree = this;
    this.elt.className = "side-menu-widget-container sources-tree";
    this.elt.setAttribute("with-arrows", "true");
    this.elt.setAttribute("theme", "dark");
    this.elt.setAttribute("flex", "1");

    this.children = document.createElementNS(HTML_NS, "ul");
    this.children.setAttribute("flex", "1");
    this.elt.appendChild(this.children);

    this.nodeChildrenChanged = this.nodeChildrenChanged.bind(this);
    this.updateNode = this.updateNode.bind(this);
  },

  promptNew: function(initial, parent, sibling=null) {
    let deferred = promise.defer();

    let parentContainer = this._containers.get(parent);
    // Give child updates something to wait on...
    parentContainer.prompting = deferred.promise;

    let item = this.doc.createElement("li");
    item.className = "child";
    let placeholder = this.doc.createElementNS(HTML_NS, "div");
    placeholder.className = "child";
    item.appendChild(placeholder);

    let children = parentContainer.children;
    sibling = sibling ? this._containers.get(sibling).elt : null;
    parentContainer.children.insertBefore(item, sibling ? sibling.nextSibling : children.firstChild);

    new InplaceEditor({
      element: placeholder,
      initial: initial,
      start: editor => {
        editor.input.select();
      },
      done: function(val, commit) {
        if (commit) {
          deferred.resolve(val);
        } else {
          deferred.reject(val);
        }
        parentContainer.line.focus();
      },
      destroy: () => {
        item.parentNode.removeChild(item);
      },
    });

    return deferred.promise;
  },

  addModel: function(model) {
    this.models.add(model);
    let placeholder = this.doc.createElementNS(HTML_NS, "li");
    placeholder.style.display = "none";
    this.children.appendChild(placeholder);
    model.root().then(root => {
      this.roots.add(root);
      let container = this.importNode(root);
      container.line.classList.add("side-menu-widget-group-title");
      container.line.setAttribute("theme", "dark");
      this.selectContainer(container);
      this.children.insertBefore(container.elt, placeholder);
      this.children.removeChild(placeholder);
    }).then(null, console.error);
  },

  removeModel: function(model) {
    this.models.delete(model);

    model.root().then(root => {
      this.removeNode(root);
    });
  },

  select: function(node) {
    this.selectContainer(this._containers.get(node));
  },

  selectContainer: function(container) {
    if (this.selectedContainer === container) {
      return;
    }
    if (this.selectedContainer) {
      this.selectedContainer.selected = false;
    }
    this.selectedContainer = container;
    container.selected = true;
    emit(this, "selection", container.node);
  },

  getSelected: function() {
    return this.selectedContainer.node;
  },

  importNode: function(node) {
    if (!node) {
      return null;
    }

    if (this._containers.has(node)) {
      return this._containers.get(node);
    }

    var container = Container(this, node);
    this._containers.set(node, container);
    this._updateChildren(container);

    node.on("children-changed", this.nodeChildrenChanged);
    node.on("label-change", this.updateNode);

    return container;
  },

  removeNode: function(node) {
    let container = this._containers.get(node);
    container.remove();

    let toRemove = this.descendants(node);
    toRemove.add(node);
    for (let remove of toRemove) {
      this._removeNode(remove);
    }
  },

  _removeNode: function(node) {
    node.off("children-changed", this.nodeChildrenChanged);
    node.off("label-change", this.updateNode);
    this._containers.get(node).destroy();
    this._containers.delete(node);
  },

  nodeChildrenChanged: function(node) {
    this.updateNode(node);
    this._updateChildren(this._containers.get(node));
  },

  updateNode: function(node) {
    let container = this._containers.get(node);
    container.update();
  },

  _updateChildren: function(container) {
    let node = container.node;

    let fragment = this.doc.createDocumentFragment();

    for (let child of node.children) {
      let childContainer = this.importNode(child);
      fragment.appendChild(childContainer.elt);
    }

    while (container.children.firstChild) {
      container.children.removeChild(container.children.firstChild);
    }

    container.children.appendChild(fragment);
  },

  // Return a set with all descendants of the node
  descendants: function(node) {
    let set = new Set();

    function addChildren(item) {
      if (!item.children) {
        return;
      }

      for (let child of item.children) {
        set.add(child);
      }
    }

    addChildren(node);
    for (let item of set) {
      addChildren(item);
    }

    return set;
  }
});

exports.TreeView = TreeView;
