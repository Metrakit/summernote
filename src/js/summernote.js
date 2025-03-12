import env from './core/env';
import lists from './core/lists';
import Context from './Context';

class Summernote {
  constructor(element, options) {
    this.element = element;
    this.options = options;
    this.init();
  }

  init() {
    this.options.langInfo = { ...$.summernote.lang['en-US'], ...$.summernote.lang[this.options.lang] };
    this.options.icons = { ...$.summernote.options.icons, ...this.options.icons };
    this.options.tooltip = this.options.tooltip === 'auto' ? !env.isSupportTouch : this.options.tooltip;

    const context = new Context(this.element, this.options);
    this.element.summernoteContext = context;
    context.triggerEvent('init', context.layoutInfo);

    if (this.options.focus) {
      context.invoke('editor.focus');
    }
  }

  invoke(method, ...args) {
    const context = this.element.summernoteContext;
    if (context) {
      return context.invoke(method, ...args);
    }
  }
}

function summernote(element, ...args) {
  const type = typeof lists.head(args);
  const isExternalAPICalled = type === 'string';
  const hasInitOptions = type === 'object';

  const options = { ...$.summernote.options, ...(hasInitOptions ? lists.head(args) : {}) };

  if (!element.summernoteContext) {
    new Summernote(element, options);
  }

  if (isExternalAPICalled) {
    return element.summernoteContext.invoke(...args);
  }

  return element;
}

// test
window.Summernote = summernote;

// @TODO A decommenter ou pas.
// // Usage example
// const element = document.querySelector('#summernote');
// summernote(element, { focus: true });
