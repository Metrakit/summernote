import lists from '../core/lists';
import dom from '../core/dom';

export default class LinkPopover {
  constructor(context) {
    this.context = context;

    this.ui = context.ui;
    this.options = context.options;
    this.events = {
      'summernote.keyup summernote.mouseup summernote.change summernote.scroll': () => {
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
    return !lists.isEmpty(this.options.popover.link);
  }

  initialize() {
    this.$popover = this.ui.popover({
      className: 'note-link-popover',
      callback: (node) => {
        const content = node.querySelector('.popover-content,.note-popover-content');
        const span = document.createElement('span');
        const anchor = document.createElement('a');
        anchor.target = '_blank';
        span.appendChild(anchor);
        span.appendChild(document.createTextNode('\u00A0'));
        content.prepend(span);
      },
    }).render().appendTo(this.options.container);
    const content = this.$popover.querySelector('.popover-content,.note-popover-content');

    this.context.invoke('buttons.build', content, this.options.popover.link);

    this.$popover.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }

  destroy() {
    this.$popover.remove();
  }

  update() {
    if (!this.context.invoke('editor.hasFocus')) {
      this.hide();
      return;
    }

    const rng = this.context.invoke('editor.getLastRange');
    if (rng.isCollapsed() && rng.isOnAnchor()) {
      const anchor = dom.ancestor(rng.sc, dom.isAnchor);
      const href = anchor.getAttribute('href');
      const popoverAnchor = this.$popover.querySelector('a');
      popoverAnchor.setAttribute('href', href);
      popoverAnchor.textContent = href;

      const pos = dom.posFromPlaceholder(anchor);
      const containerOffset = this.options.container.getBoundingClientRect();
      pos.top -= containerOffset.top;
      pos.left -= containerOffset.left;

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
