const EDITABLE_PADDING = 24;

export default class Statusbar {
  constructor(context) {
    this.$document = document;
    this.$statusbar = context.layoutInfo.statusbar;
    this.$editable = context.layoutInfo.editable;
    this.$codable = context.layoutInfo.codable;
    this.options = context.options;
  }

  initialize() {
    if (this.options.airMode || this.options.disableResizeEditor) {
      this.destroy();
      return;
    }

    this.$statusbar.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.$statusbar.addEventListener('touchstart', this.onMouseDown.bind(this));
  }

  onMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const editableTop = this.$editable.getBoundingClientRect().top + window.scrollY;
    const editableCodeTop = this.$codable.getBoundingClientRect().top + window.scrollY;

    const onStatusbarMove = (event) => {
      const originalEvent = (event.type === 'mousemove') ? event : event.touches[0];
      let height = originalEvent.clientY - (editableTop + EDITABLE_PADDING);
      let heightCode = originalEvent.clientY - (editableCodeTop + EDITABLE_PADDING);

      height = (this.options.minheight > 0) ? Math.max(height, this.options.minheight) : height;
      height = (this.options.maxHeight > 0) ? Math.min(height, this.options.maxHeight) : height;
      heightCode = (this.options.minheight > 0) ? Math.max(heightCode, this.options.minheight) : heightCode;
      heightCode = (this.options.maxHeight > 0) ? Math.min(heightCode, this.options.maxHeight) : heightCode;

      this.$editable.style.height = `${height}px`;
      this.$codable.style.height = `${heightCode}px`;
    };

    const onMouseUp = () => {
      this.$document.removeEventListener('mousemove', onStatusbarMove);
      this.$document.removeEventListener('touchmove', onStatusbarMove);
    };

    this.$document.addEventListener('mousemove', onStatusbarMove);
    this.$document.addEventListener('touchmove', onStatusbarMove);
    this.$document.addEventListener('mouseup', onMouseUp, { once: true });
    this.$document.addEventListener('touchend', onMouseUp, { once: true });
  }

  destroy() {
    this.$statusbar.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.$statusbar.removeEventListener('touchstart', this.onMouseDown.bind(this));
    this.$statusbar.classList.add('locked');
  }
}
