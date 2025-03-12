import lists from '../core/lists';
import dom from '../core/dom';

/**
 * Image popover module
 *  mouse events that show/hide popover will be handled by Handle.js.
 *  Handle.js will receive the events and invoke 'imagePopover.update'.
 */
export default class ImagePopover {
  constructor(context) {
    this.context = context;
    this.ui = context.ui;

    this.editable = context.layoutInfo.editable[0];
    this.options = context.options;

    this.events = {
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
    return !lists.isEmpty(this.options.popover.image);
  }

  initialize() {
    this.$popover = this.ui.popover({
      className: 'note-image-popover',
    }).render();
    this.options.container.appendChild(this.$popover);
    const $content = this.$popover.querySelector('.popover-content,.note-popover-content');
    this.context.invoke('buttons.build', $content, this.options.popover.image);

    this.$popover.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }

  destroy() {
    this.$popover.remove();
  }

  update(target, event) {
    if (dom.isImg(target)) {
      const position = target.getBoundingClientRect();
      const containerOffset = this.options.container.getBoundingClientRect();
      let pos = {};
      if (this.options.popatmouse) {
        pos.left = event.pageX - 20;
        pos.top = event.pageY;
      } else {
        pos.left = position.left + window.scrollX;
        pos.top = position.top + window.scrollY;
      }
      pos.top -= containerOffset.top + window.scrollY;
      pos.left -= containerOffset.left + window.scrollX;

      this.$popover.style.display = 'block';
      this.$popover.style.left = `${pos.left}px`;
      this.$popover.style.top = `${pos.top}px`;
    } else {
      this.hide();
    }
  }

  hide() {
    this.$popover.style.display = 'none';
  }
}
