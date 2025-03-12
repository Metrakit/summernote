export default class Placeholder {
  constructor(context) {
    this.context = context;

    this.editingArea = context.layoutInfo.editingArea;
    this.options = context.options;

    if (this.options.inheritPlaceholder === true) {
      // get placeholder value from the original element
      this.options.placeholder = this.context.note.getAttribute('placeholder') || this.options.placeholder;
    }

    this.events = {
      'summernote.init summernote.change': () => {
        this.update();
      },
      'summernote.codeview.toggled': () => {
        this.update();
      },
    };
  }

  shouldInitialize() {
    return !!this.options.placeholder;
  }

  initialize() {
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'note-placeholder';
    this.placeholder.innerHTML = this.options.placeholder;
    this.placeholder.addEventListener('click', () => {
      this.context.invoke('focus');
    });
    this.editingArea.insertBefore(this.placeholder, this.editingArea.firstChild);

    this.update();
  }

  destroy() {
    this.placeholder.remove();
  }

  update() {
    const isShow = !this.context.invoke('codeview.isActivated') && this.context.invoke('editor.isEmpty');
    this.placeholder.style.display = isShow ? 'block' : 'none';
  }
}
