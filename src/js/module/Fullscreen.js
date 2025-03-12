export default class Fullscreen {
  constructor(context) {
    this.context = context;

    this.editor = context.layoutInfo.editor;
    this.toolbar = context.layoutInfo.toolbar;
    this.editable = context.layoutInfo.editable;
    this.codable = context.layoutInfo.codable;

    this.window = window;
    this.scrollbar = document.documentElement;
    this.scrollbarClassName = 'note-fullscreen-body';

    this.onResize = () => {
      this.resizeTo({
        h: this.window.innerHeight - this.toolbar.offsetHeight,
      });
    };
  }

  resizeTo(size) {
    this.editable.style.height = `${size.h}px`;
    this.codable.style.height = `${size.h}px`;
    if (this.codable.dataset.cmeditor) {
      this.codable.dataset.cmeditor.setsize(null, size.h);
    }
  }

  /**
   * toggle fullscreen
   */
  toggle() {
    this.editor.classList.toggle('fullscreen');
    const isFullscreen = this.isFullscreen();
    this.scrollbar.classList.toggle(this.scrollbarClassName, isFullscreen);
    if (isFullscreen) {
      this.editable.dataset.orgHeight = this.editable.style.height;
      this.editable.dataset.orgMaxHeight = this.editable.style.maxHeight;
      this.editable.style.maxHeight = '';
      this.window.addEventListener('resize', this.onResize);
      this.onResize();
    } else {
      this.window.removeEventListener('resize', this.onResize);
      this.resizeTo({ h: this.editable.dataset.orgHeight });
      this.editable.style.maxHeight = this.editable.dataset.orgMaxHeight;
    }

    this.context.invoke('toolbar.updateFullscreen', isFullscreen);
  }

  isFullscreen() {
    return this.editor.classList.contains('fullscreen');
  }

  destroy() {
    this.scrollbar.classList.remove(this.scrollbarClassName);
  }
}
