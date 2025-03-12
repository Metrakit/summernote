import range from '../core/range';

export default class History {
  constructor(context) {
    this.stack = [];
    this.stackOffset = -1;
    this.context = context;
    this.editable = context.layoutInfo.editable;
  }

  makeSnapshot() {
    const rng = range.create(this.editable);
    const emptyBookmark = { s: { path: [], offset: 0 }, e: { path: [], offset: 0 } };

    return {
      contents: this.editable.innerHTML,
      bookmark: ((rng && rng.isOnEditable()) ? rng.bookmark(this.editable) : emptyBookmark),
    };
  }

  applySnapshot(snapshot) {
    if (snapshot.contents !== null) {
      this.editable.innerHTML = snapshot.contents;
    }
    if (snapshot.bookmark !== null) {
      range.createFromBookmark(this.editable, snapshot.bookmark).select();
    }
  }

  rewind() {
    if (this.editable.innerHTML !== this.stack[this.stackOffset].contents) {
      this.recordUndo();
    }

    this.stackOffset = 0;
    this.applySnapshot(this.stack[this.stackOffset]);
  }

  commit() {
    this.stack = [];
    this.stackOffset = -1;
    this.recordUndo();
  }

  reset() {
    this.stack = [];
    this.stackOffset = -1;
    this.editable.innerHTML = '';
    this.recordUndo();
  }

  undo() {
    if (this.editable.innerHTML !== this.stack[this.stackOffset].contents) {
      this.recordUndo();
    }

    if (this.stackOffset > 0) {
      this.stackOffset--;
      this.applySnapshot(this.stack[this.stackOffset]);
    }
  }

  redo() {
    if (this.stack.length - 1 > this.stackOffset) {
      this.stackOffset++;
      this.applySnapshot(this.stack[this.stackOffset]);
    }
  }

  recordUndo() {
    this.stackOffset++;

    if (this.stack.length > this.stackOffset) {
      this.stack = this.stack.slice(0, this.stackOffset);
    }

    this.stack.push(this.makeSnapshot());

    if (this.stack.length > this.context.options.historyLimit) {
      this.stack.shift();
      this.stackOffset -= 1;
    }
  }
}
