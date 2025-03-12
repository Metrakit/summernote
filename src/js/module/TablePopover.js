import env from '../core/env';
import lists from '../core/lists';
import dom from '../core/dom';

export default class TablePopover {
  constructor(context) {
    this.context = context;

    this.ui = context.ui;
    this.options = context.options;
    this.events = {
      'summernote.mousedown': (we, event) => {
        this.update(event.target);
      },
      'summernote.keyup summernote.scroll summernote.change': () => {
        this.update();
      },
      'summernote.disable summernote.dialog.shown': () => {
        this.hide();
      },
      'summernote.blur': (we, event) => {
        if (event.originalEvent && event.originalEvent.relatedTarget) {
          if (!this.$popover.contains(event.originalEvent.relatedTarget)) {
            this.hide();
          }
        } else {
          this.hide();
        }
      },
    };
  }

  shouldInitialize() {
    return !lists.isEmpty(this.options.popover.table);
  }

  initialize() {
    this.$popover = this.ui.popover({
      className: 'note-table-popover',
    }).render();
    this.options.container.appendChild(this.$popover);
    const $content = this.$popover.querySelector('.popover-content,.note-popover-content');

    this.context.invoke('buttons.build', $content, this.options.popover.table);

    // [workaround] Disable Firefox's default table editor
    if (env.isFF) {
      document.execCommand('enableInlineTableEditing', false, false);
    }

    this.$popover.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }

  destroy() {
    this.$popover.remove();
  }

  update(target) {
    if (this.context.isDisabled()) {
      return false;
    }

    const isCell = dom.isCell(target) || dom.isCell(target?.parentElement);

    if (isCell) {
      const pos = dom.posFromPlaceholder(target);
      const containerOffset = this.options.container.getBoundingClientRect();
      pos.top -= containerOffset.top;
      pos.left -= containerOffset.left;

      this.$popover.style.display = 'block';
      this.$popover.style.left = `${pos.left}px`;
      this.$popover.style.top = `${pos.top}px`;
    } else {
      this.hide();
    }

    return isCell;
  }

  hide() {
    this.$popover.style.display = 'none';
  }
}
