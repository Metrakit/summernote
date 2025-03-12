export default class Dropzone {
  constructor(context) {
    this.context = context;
    this.$eventListener = document;
    this.$editor = context.layoutInfo.editor;
    this.$editable = context.layoutInfo.editable;
    this.options = context.options;
    this.lang = this.options.langInfo;
    this.documentEventHandlers = {};

    this.$dropzone = document.createElement('div');
    this.$dropzone.className = 'note-dropzone';
    this.$dropzone.innerHTML = '<div class="note-dropzone-message"></div>';
    this.$editor.insertBefore(this.$dropzone, this.$editor.firstChild);
  }

  /**
   * attach Drag and Drop Events
   */
  initialize() {
    if (this.options.disableDragAndDrop) {
      // prevent default drop event
      this.documentEventHandlers.onDrop = (e) => {
        e.preventDefault();
      };
      // do not consider outside of dropzone
      this.$eventListener = this.$dropzone;
      this.$eventListener.addEventListener('drop', this.documentEventHandlers.onDrop);
    } else {
      this.attachDragAndDropEvent();
    }
  }

  /**
   * attach Drag and Drop Events
   */
  attachDragAndDropEvent() {
    let collection = new Set();
    const $dropzoneMessage = this.$dropzone.querySelector('.note-dropzone-message');

    this.documentEventHandlers.onDragenter = (e) => {
      const isCodeview = this.context.invoke('codeview.isActivated');
      const hasEditorSize = this.$editor.offsetWidth > 0 && this.$editor.offsetHeight > 0;
      if (!isCodeview && collection.size === 0 && hasEditorSize) {
        this.$editor.classList.add('dragover');
        this.$dropzone.style.width = `${this.$editor.offsetWidth}px`;
        this.$dropzone.style.height = `${this.$editor.offsetHeight}px`;
        $dropzoneMessage.textContent = this.lang.image.dragImageHere;
      }
      collection.add(e.target);
    };

    this.documentEventHandlers.onDragleave = (e) => {
      collection.delete(e.target);

      // If nodeName is BODY, then just make it over (fix for IE)
      if (collection.size === 0 || e.target.nodeName === 'BODY') {
        collection.clear();
        this.$editor.classList.remove('dragover');
      }
    };

    this.documentEventHandlers.onDrop = () => {
      collection.clear();
      this.$editor.classList.remove('dragover');
    };

    // show dropzone on dragenter when dragging a object to document
    // -but only if the editor is visible, i.e. has a positive width and height
    this.$eventListener.addEventListener('dragenter', this.documentEventHandlers.onDragenter);
    this.$eventListener.addEventListener('dragleave', this.documentEventHandlers.onDragleave);
    this.$eventListener.addEventListener('drop', this.documentEventHandlers.onDrop);

    // change dropzone's message on hover.
    this.$dropzone.addEventListener('dragenter', () => {
      this.$dropzone.classList.add('hover');
      $dropzoneMessage.textContent = this.lang.image.dropImage;
    });
    this.$dropzone.addEventListener('dragleave', () => {
      this.$dropzone.classList.remove('hover');
      $dropzoneMessage.textContent = this.lang.image.dragImageHere;
    });

    // attach dropImage
    this.$dropzone.addEventListener('drop', (event) => {
      const dataTransfer = event.dataTransfer;

      // stop the browser from opening the dropped content
      event.preventDefault();

      if (dataTransfer && dataTransfer.files && dataTransfer.files.length) {
        this.$editable.focus();
        this.context.invoke('editor.insertImagesOrCallback', dataTransfer.files);
      } else {
        Array.from(dataTransfer.types).forEach((type) => {
          // skip moz-specific types
          if (type.toLowerCase().indexOf('_moz_') > -1) {
            return;
          }
          const content = dataTransfer.getData(type);

          if (type.toLowerCase().indexOf('text') > -1) {
            this.context.invoke('editor.pasteHTML', content);
          } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            Array.from(tempDiv.childNodes).forEach((item) => {
              this.context.invoke('editor.insertNode', item);
            });
          }
        });
      }
    });
    this.$dropzone.addEventListener('dragover', (event) => event.preventDefault());
  }

  destroy() {
    Object.keys(this.documentEventHandlers).forEach((key) => {
      this.$eventListener.removeEventListener(key.slice(2).toLowerCase(), this.documentEventHandlers[key]);
    });
    this.documentEventHandlers = {};
  }
}
