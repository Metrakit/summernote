import env from '../core/env';
import key from '../core/key';

export default class ImageDialog {
  constructor(context) {
    this.context = context;
    this.ui = context.ui;
    this.$body = document.body;
    this.$editor = context.layoutInfo.editor;
    this.options = context.options;
    this.lang = this.options.langInfo;
  }

  initialize() {
    let imageLimitation = '';
    if (this.options.maximumImageFileSize) {
      const unit = Math.floor(Math.log(this.options.maximumImageFileSize) / Math.log(1024));
      const readableSize = (this.options.maximumImageFileSize / Math.pow(1024, unit)).toFixed(2) * 1 +
                         ' ' + ' KMGTP'[unit] + 'B';
      imageLimitation = `<small>${this.lang.image.maximumFileSize + ' : ' + readableSize}</small>`;
    }

    const $container = this.options.dialogsInBody ? this.$body : this.options.container;
    const body = [
      '<div class="form-group note-form-group note-group-select-from-files">',
        '<label for="note-dialog-image-file-' + this.options.id + '" class="note-form-label">' + this.lang.image.selectFromFiles + '</label>',
        '<input id="note-dialog-image-file-' + this.options.id + '" class="note-image-input form-control-file note-form-control note-input" ',
        ' type="file" name="files" accept="'+this.options.acceptImageFileTypes+'" multiple="multiple"/>',
        imageLimitation,
      '</div>',
      '<div class="form-group note-group-image-url">',
        '<label for="note-dialog-image-url-' + this.options.id + '" class="note-form-label">' + this.lang.image.url + '</label>',
        '<input id="note-dialog-image-url-' + this.options.id + '" class="note-image-url form-control note-form-control note-input" type="text"/>',
      '</div>',
    ].join('');
    const buttonClass = 'btn btn-primary note-btn note-btn-primary note-image-btn';
    const footer = `<input type="button" href="#" class="${buttonClass}" value="${this.lang.image.insert}" disabled>`;

    this.$dialog = this.ui.dialog({
      title: this.lang.image.insert,
      fade: this.options.dialogsFade,
      body: body,
      footer: footer,
    }).render().appendTo($container);
  }

  destroy() {
    this.ui.hideDialog(this.$dialog);
    this.$dialog.remove();
  }

  bindEnterKey($input, $btn) {
    $input.addEventListener('keypress', (event) => {
      if (event.keyCode === key.code.ENTER) {
        event.preventDefault();
        $btn.click();
      }
    });
  }

  show() {
    this.context.invoke('editor.saveRange');
    this.showImageDialog().then((data) => {
      // [workaround] hide dialog before restore range for IE range focus
      this.ui.hideDialog(this.$dialog);
      this.context.invoke('editor.restoreRange');

      if (typeof data === 'string') { // image url
        // If onImageLinkInsert set,
        if (this.options.callbacks.onImageLinkInsert) {
          this.context.triggerEvent('image.link.insert', data);
        } else {
          this.context.invoke('editor.insertImage', data);
        }
      } else { // array of files
        this.context.invoke('editor.insertImagesOrCallback', data);
      }
    }).catch(() => {
      this.context.invoke('editor.restoreRange');
    });
  }

  /**
   * show image dialog
   *
   * @param {HTMLElement} $dialog
   * @return {Promise}
   */
  showImageDialog() {
    return new Promise((resolve, reject) => {
      const $imageInput = this.$dialog.querySelector('.note-image-input');
      const $imageUrl = this.$dialog.querySelector('.note-image-url');
      const $imageBtn = this.$dialog.querySelector('.note-image-btn');

      this.ui.onDialogShown(this.$dialog, () => {
        this.context.triggerEvent('dialog.shown');

        // Cloning imageInput to clear element.
        const newImageInput = $imageInput.cloneNode(true);
        $imageInput.parentNode.replaceChild(newImageInput, $imageInput);
        newImageInput.addEventListener('change', (event) => {
          resolve(event.target.files || event.target.value);
        });
        newImageInput.value = '';

        $imageUrl.addEventListener('input', () => {
          this.ui.toggleBtn($imageBtn, $imageUrl.value);
        });
        $imageUrl.value = '';

        if (!env.isSupportTouch) {
          $imageUrl.focus();
        }

        $imageBtn.addEventListener('click', (event) => {
          event.preventDefault();
          resolve($imageUrl.value);
        });

        this.bindEnterKey($imageUrl, $imageBtn);
      });

      this.ui.onDialogHidden(this.$dialog, () => {
        newImageInput.removeEventListener('change', () => {});
        $imageUrl.removeEventListener('input', () => {});
        $imageBtn.removeEventListener('click', () => {});

        if (deferred.state() === 'pending') {
          reject();
        }
      });

      this.ui.showDialog(this.$dialog);
    });
  }
}
