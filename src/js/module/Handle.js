import dom from '../core/dom';

export default class Handle {
  constructor(context) {
    this.context = context;
    this.$document = document;
    this.$editingArea = context.layoutInfo.editingArea;
    this.options = context.options;
    this.lang = this.options.langInfo;

    this.events = {
      'summernote.mousedown': (we, e) => {
        if (this.update(e.target, e)) {
          e.preventDefault();
        }
      },
      'summernote.keyup summernote.scroll summernote.change summernote.dialog.shown': () => {
        this.update();
      },
      'summernote.disable summernote.blur': () => {
        this.hide();
      },
      'summernote.codeview.toggled': () => {
        this.update();
      },
    };
  }

  initialize() {
    this.$handle = document.createElement('div');
    this.$handle.className = 'note-handle';
    this.$handle.innerHTML = `
      <div class="note-control-selection">
        <div class="note-control-selection-bg"></div>
        <div class="note-control-holder note-control-nw"></div>
        <div class="note-control-holder note-control-ne"></div>
        <div class="note-control-holder note-control-sw"></div>
        <div class="${this.options.disableResizeImage ? 'note-control-holder' : 'note-control-sizing'} note-control-se"></div>
        ${this.options.disableResizeImage ? '' : '<div class="note-control-selection-info"></div>'}
      </div>
    `;
    this.$editingArea.prepend(this.$handle);

    this.$handle.addEventListener('mousedown', (event) => {
      if (dom.isControlSizing(event.target)) {
        event.preventDefault();
        event.stopPropagation();

        const $target = this.$handle.querySelector('.note-control-selection').dataset.target;
        const posStart = $target.getBoundingClientRect();
        const scrollTop = this.$document.documentElement.scrollTop;

        const onMouseMove = (event) => {
          this.context.invoke('editor.resizeTo', {
            x: event.clientX - posStart.left,
            y: event.clientY - (posStart.top - scrollTop),
          }, $target, !event.shiftKey);

          this.update($target, event);
        };

        const onMouseUp = (e) => {
          e.preventDefault();
          this.$document.removeEventListener('mousemove', onMouseMove);
          this.$document.removeEventListener('mouseup', onMouseUp);
          this.context.invoke('editor.afterCommand');
        };

        this.$document.addEventListener('mousemove', onMouseMove);
        this.$document.addEventListener('mouseup', onMouseUp);

        if (!$target.dataset.ratio) { // original ratio.
          $target.dataset.ratio = $target.offsetHeight / $target.offsetWidth;
        }
      }
    });

    // Listen for scrolling on the handle overlay.
    this.$handle.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.update();
    });
  }

  destroy() {
    this.$handle.remove();
  }

  update(target, event) {
    if (this.context.isDisabled()) {
      return false;
    }

    const isImage = dom.isImg(target);
    const $selection = this.$handle.querySelector('.note-control-selection');

    this.context.invoke('imagePopover.update', target, event);

    if (isImage) {
      const $image = target;

      const areaRect = this.$editingArea.getBoundingClientRect();
      const imageRect = target.getBoundingClientRect();

      $selection.style.display = 'block';
      $selection.style.left = `${imageRect.left - areaRect.left}px`;
      $selection.style.top = `${imageRect.top - areaRect.top}px`;
      $selection.style.width = `${imageRect.width}px`;
      $selection.style.height = `${imageRect.height}px`;
      $selection.dataset.target = $image; // save current image element.

      const origImageObj = new Image();
      origImageObj.src = $image.src;

      const sizingText = `${imageRect.width}x${imageRect.height} (${this.lang.image.original}: ${origImageObj.width}x${origImageObj.height})`;
      const infoElement = $selection.querySelector('.note-control-selection-info');
      if (infoElement) {
        infoElement.textContent = sizingText;
      }
      this.context.invoke('editor.saveTarget', target);
    } else {
      this.hide();
    }

    return isImage;
  }

  hide() {
    this.context.invoke('editor.clearTarget');
    Array.from(this.$handle.children).forEach(child => {
      child.style.display = 'none';
    });
  }
}
