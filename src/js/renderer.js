class Renderer {
  constructor(markup, children, options, callback) {
    this.markup = markup;
    this.children = children;
    this.options = options;
    this.callback = callback;
  }

  render(parent) {
    const template = document.createElement('template');
    template.innerHTML = this.markup.trim();
    const node = template.content.firstChild;

    if (this.options && this.options.contents) {
      node.innerHTML = this.options.contents;
    }

    if (this.options && this.options.className) {
      node.classList.add(this.options.className);
    }

    if (this.options && this.options.data) {
      Object.keys(this.options.data).forEach((key) => {
        node.setAttribute('data-' + key, this.options.data[key]);
      });
    }

    if (this.options && this.options.click) {
      node.addEventListener('click', this.options.click);
    }

    if (this.children) {
      const container = node.querySelector('.note-children-container');
      this.children.forEach((child) => {
        child.render(container || node);
      });
    }

    if (this.callback) {
      this.callback(node, this.options);
    }

    if (this.options && this.options.callback) {
      this.options.callback(node);
    }

    if (parent) {
      parent.appendChild(node);
    }

    return node;
  }
}

export default {
  create: (markup, callback) => {
    return function() {
      const options = typeof arguments[1] === 'object' ? arguments[1] : arguments[0];
      let children = Array.isArray(arguments[0]) ? arguments[0] : [];
      if (options && options.children) {
        children = options.children;
      }
      return new Renderer(markup, children, options, callback);
    };
  },
};
