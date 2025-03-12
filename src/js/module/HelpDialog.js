import env from '../core/env';

export default class HelpDialog {
  constructor(context) {
    this.context = context;

    this.ui = context.ui;
    this.$body = document.body;
    this.$editor = context.layoutInfo.editor;
    this.options = context.options;
    this.lang = this.options.langInfo;
  }

  initialize() {
    const $container = this.options.dialogsInBody ? this.$body : this.options.container;
    const body = `
      <p class="text-center">
        <a href="http://summernote.org/" target="_blank" rel="noopener noreferrer">Summernote @@VERSION@@</a> · 
        <a href="https://github.com/summernote/summernote" target="_blank" rel="noopener noreferrer">Project</a> · 
        <a href="https://github.com/summernote/summernote/issues" target="_blank" rel="noopener noreferrer">Issues</a>
      </p>
    `;

    this.$dialog = this.ui.dialog({
      title: this.lang.options.help,
      fade: this.options.dialogsFade,
      body: this.createShortcutList(),
      footer: body,
      callback: ($node) => {
        const modalBody = $node.querySelector('.modal-body, .note-modal-body');
        if (modalBody) {
          modalBody.style.maxHeight = '300px';
          modalBody.style.overflow = 'scroll';
        }
      },
    }).render().appendTo($container);
  }

  destroy() {
    this.ui.hideDialog(this.$dialog);
    this.$dialog.remove();
  }

  createShortcutList() {
    const keyMap = this.options.keyMap[env.isMac ? 'mac' : 'pc'];
    return Object.keys(keyMap).map((key) => {
      const command = keyMap[key];
      const row = document.createElement('div');
      row.innerHTML = `
        <div class="help-list-item">
          <label style="width: 180px; margin-right: 10px;"><kbd>${key}</kbd></label>
          <span>${this.context.memo('help.' + command) || command}</span>
        </div>
      `;
      return row.innerHTML;
    }).join('');
  }

  /**
   * show help dialog
   *
   * @return {Promise}
   */
  showHelpDialog() {
    return new Promise((resolve) => {
      this.ui.onDialogShown(this.$dialog, () => {
        this.context.triggerEvent('dialog.shown');
        resolve();
      });
      this.ui.showDialog(this.$dialog);
    });
  }

  show() {
    this.context.invoke('editor.saveRange');
    this.showHelpDialog().then(() => {
      this.context.invoke('editor.restoreRange');
    });
  }
}
