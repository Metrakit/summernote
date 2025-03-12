import func from './core/func';
import lists from './core/lists';
import dom from './core/dom';

export default class Context {
  /**
   * @param {HTMLElement} note
   * @param {Object} options
   */
  constructor(note, options) {
    this.note = note;

    this.memos = {};
    this.modules = {};
    this.layoutInfo = {};
    this.options = Object.assign({}, options);

    // init ui with options
    window.summernote.ui = window.summernote.ui_template(this.options);
    this.ui = window.summernote.ui;

    this.initialize();
  }

  /**
   * create layout and initialize modules and other resources
   */
  initialize() {
    this.layoutInfo = this.ui.createLayout(this.note);
    this._initialize();
    this.note.style.display = 'none';
    return this;
  }

  /**
   * destroy modules and other resources and remove layout
   */
  destroy() {
    this._destroy();
    this.note.removeAttribute('data-summernote');
    this.ui.removeLayout(this.note, this.layoutInfo);
  }

  /**
   * destroy modules and other resources and initialize it again
   */
  reset() {
    const disabled = this.isDisabled();
    this.code(dom.emptyPara);
    this._destroy();
    this._initialize();

    if (disabled) {
      this.disable();
    }
  }

  _initialize() {
    // set own id
    this.options.id = func.uniqueId(Date.now());
    // set default container for tooltips, popovers, and dialogs
    this.options.container = this.options.container || this.layoutInfo.editor;

    // add optional buttons
    const buttons = Object.assign({}, this.options.buttons);
    Object.keys(buttons).forEach((key) => {
      this.memo('button.' + key, buttons[key]);
    });

    const modules = Object.assign({}, this.options.modules, window.summernote.plugins || {});

    // add and initialize modules
    Object.keys(modules).forEach((key) => {
      this.module(key, modules[key], true);
    });

    Object.keys(this.modules).forEach((key) => {
      this.initializeModule(key);
    });
  }

  _destroy() {
    // destroy modules with reversed order
    Object.keys(this.modules)
      .reverse()
      .forEach((key) => {
        this.removeModule(key);
      });

    Object.keys(this.memos).forEach((key) => {
      this.removeMemo(key);
    });
    // trigger custom onDestroy callback
    this.triggerEvent('destroy', this);
  }

  code(html) {
    const isActivated = this.invoke('codeview.isActivated');

    if (html === undefined) {
      this.invoke('codeview.sync');
      return isActivated ? this.layoutInfo.codable.value : this.layoutInfo.editable.innerHTML;
    } else {
      if (isActivated) {
        this.invoke('codeview.sync', html);
      } else {
        this.layoutInfo.editable.innerHTML = html;
      }
      this.note.value = html;
      this.triggerEvent('change', html, this.layoutInfo.editable);
    }
  }

  isDisabled() {
    return this.layoutInfo.editable.getAttribute('contenteditable') === 'false';
  }

  enable() {
    this.layoutInfo.editable.setAttribute('contenteditable', true);
    this.invoke('toolbar.activate', true);
    this.triggerEvent('disable', false);
    this.options.editing = true;
  }

  disable() {
    // close codeview if codeview is opened
    if (this.invoke('codeview.isActivated')) {
      this.invoke('codeview.deactivate');
    }
    this.layoutInfo.editable.setAttribute('contenteditable', false);
    this.options.editing = false;
    this.invoke('toolbar.deactivate', true);

    this.triggerEvent('disable', true);
  }

  triggerEvent() {
    const namespace = lists.head(arguments);
    const args = lists.tail(lists.from(arguments));

    const callback = this.options.callbacks[func.namespaceToCamel(namespace, 'on')];
    if (callback) {
      callback.apply(this.note, args);
    }
    const event = new CustomEvent('summernote.' + namespace, { detail: args });
    this.note.dispatchEvent(event);
  }

  initializeModule(key) {
    const module = this.modules[key];
    module.shouldInitialize = module.shouldInitialize || func.ok;
    if (!module.shouldInitialize()) {
      return;
    }

    // initialize module
    if (module.initialize) {
      module.initialize();
    }

    // attach events
    if (module.events) {
      dom.attachEvents(this.note, module.events);
    }
  }

  module(key, ModuleClass, withoutInitialize) {
    if (arguments.length === 1) {
      return this.modules[key];
    }

    this.modules[key] = new ModuleClass(this);

    if (!withoutInitialize) {
      this.initializeModule(key);
    }
  }

  removeModule(key) {
    const module = this.modules[key];
    if (module.shouldInitialize()) {
      if (module.events) {
        dom.detachEvents(this.note, module.events);
      }

      if (module.destroy) {
        module.destroy();
      }
    }

    delete this.modules[key];
  }

  memo(key, obj) {
    if (arguments.length === 1) {
      return this.memos[key];
    }
    this.memos[key] = obj;
  }

  removeMemo(key) {
    if (this.memos[key] && this.memos[key].destroy) {
      this.memos[key].destroy();
    }

    delete this.memos[key];
  }

  /**
   * Some buttons need to change their visual style immediately once they get pressed
   */
  createInvokeHandlerAndUpdateState(namespace, value) {
    return (event) => {
      this.createInvokeHandler(namespace, value)(event);
      this.invoke('buttons.updateCurrentStyle');
    };
  }

  createInvokeHandler(namespace, value) {
    return (event) => {
      event.preventDefault();
      const target = event.target;
      this.invoke(namespace, value || target.closest('[data-value]').dataset.value, target);
    };
  }

  invoke() {
    const namespace = lists.head(arguments);
    const args = lists.tail(lists.from(arguments));

    const splits = namespace.split('.');
    const hasSeparator = splits.length > 1;
    const moduleName = hasSeparator && lists.head(splits);
    const methodName = hasSeparator ? lists.last(splits) : lists.head(splits);

    const module = this.modules[moduleName || 'editor'];
    if (!moduleName && this[methodName]) {
      return this[methodName].apply(this, args);
    } else if (module && module[methodName] && module.shouldInitialize()) {
      return module[methodName].apply(module, args);
    }
  }
}
