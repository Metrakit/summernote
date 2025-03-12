import func from '../core/func';
import lists from '../core/lists';
import dom from '../core/dom';
import range from '../core/range';
import key from '../core/key';

const POPOVER_DIST = 5;

export default class HintPopover {
  constructor(context) {
    this.context = context;

    this.ui = context.ui;
    this.$editable = context.layoutInfo.editable;
    this.options = context.options;
    this.hint = this.options.hint || [];
    this.direction = this.options.hintDirection || 'bottom';
    this.hints = Array.isArray(this.hint) ? this.hint : [this.hint];

    this.events = {
      'summernote.keyup': (we, event) => {
        if (!event.defaultPrevented) {
          this.handleKeyup(event);
        }
      },
      'summernote.keydown': (we, event) => {
        this.handleKeydown(event);
      },
      'summernote.disable summernote.dialog.shown summernote.blur': () => {
        this.hide();
      },
    };
  }

  shouldInitialize() {
    return this.hints.length > 0;
  }

  initialize() {
    this.lastWordRange = null;
    this.matchingWord = null;
    this.$popover = this.ui.popover({
      className: 'note-hint-popover',
      hideArrow: true,
      direction: '',
    }).render();
    this.options.container.appendChild(this.$popover);

    this.$popover.style.display = 'none';
    this.$content = this.$popover.querySelector('.popover-content,.note-popover-content');
    this.$content.addEventListener('click', (event) => {
      if (event.target.classList.contains('note-hint-item')) {
        this.$content.querySelector('.active').classList.remove('active');
        event.target.classList.add('active');
        this.replace();
      }
    });

    this.$popover.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }

  destroy() {
    this.$popover.remove();
  }

  selectItem($item) {
    this.$content.querySelector('.active').classList.remove('active');
    $item.classList.add('active');

    this.$content.scrollTop = $item.offsetTop - (this.$content.clientHeight / 2);
  }

  moveDown() {
    const $current = this.$content.querySelector('.note-hint-item.active');
    const $next = $current.nextElementSibling;

    if ($next) {
      this.selectItem($next);
    } else {
      let $nextGroup = $current.parentElement.nextElementSibling;

      if (!$nextGroup) {
        $nextGroup = this.$content.querySelector('.note-hint-group');
      }

      this.selectItem($nextGroup.querySelector('.note-hint-item'));
    }
  }

  moveUp() {
    const $current = this.$content.querySelector('.note-hint-item.active');
    const $prev = $current.previousElementSibling;

    if ($prev) {
      this.selectItem($prev);
    } else {
      let $prevGroup = $current.parentElement.previousElementSibling;

      if (!$prevGroup) {
        $prevGroup = this.$content.querySelector('.note-hint-group:last-child');
      }

      this.selectItem($prevGroup.querySelector('.note-hint-item:last-child'));
    }
  }

  replace() {
    const $item = this.$content.querySelector('.note-hint-item.active');

    if ($item) {
      var node = this.nodeFromItem($item);
      if (this.matchingWord !== null && this.matchingWord.length === 0) {
        this.lastWordRange.so = this.lastWordRange.eo;
      } else if (this.matchingWord !== null && this.matchingWord.length > 0 && !this.lastWordRange.isCollapsed()) {
        let rangeCompute = this.lastWordRange.eo - this.lastWordRange.so - this.matchingWord.length;
        if (rangeCompute > 0) {
          this.lastWordRange.so += rangeCompute;
        }
      }
      this.lastWordRange.insertNode(node);

      if (this.options.hintSelect === 'next') {
        var blank = document.createTextNode('');
        node.after(blank);
        range.createFromNodeBefore(blank).select();
      } else {
        range.createFromNodeAfter(node).select();
      }

      this.lastWordRange = null;
      this.hide();
      this.context.invoke('editor.focus');
      this.context.triggerEvent('change', this.$editable.innerHTML, this.$editable);
    }
  }

  nodeFromItem($item) {
    const hint = this.hints[$item.dataset.index];
    const item = $item.dataset.item;
    let node = hint.content ? hint.content(item) : item;
    if (typeof node === 'string') {
      node = dom.createText(node);
    }
    return node;
  }

  createItemTemplates(hintIdx, items) {
    const hint = this.hints[hintIdx];
    return items.map((item, idx) => {
      const $item = document.createElement('div');
      $item.className = 'note-hint-item';
      $item.innerHTML = hint.template ? hint.template(item) : item + '';
      $item.dataset.index = hintIdx;
      $item.dataset.item = item;

      if (hintIdx === 0 && idx === 0) {
        $item.classList.add('active');
      }

      return $item;
    });
  }

  handleKeydown(event) {
    if (this.$popover.style.display === 'none') {
      return;
    }

    if (event.keyCode === key.code.ENTER) {
      event.preventDefault();
      this.replace();
    } else if (event.keyCode === key.code.UP) {
      event.preventDefault();
      this.moveUp();
    } else if (event.keyCode === key.code.DOWN) {
      event.preventDefault();
      this.moveDown();
    }
  }

  searchKeyword(index, keyword, callback) {
    const hint = this.hints[index];
    if (hint && hint.match.test(keyword) && hint.search) {
      const matches = hint.match.exec(keyword);
      this.matchingWord = matches[0];
      hint.search(matches[1], callback);
    } else {
      callback();
    }
  }

  createGroup(idx, keyword) {
    const $group = document.createElement('div');
    $group.className = `note-hint-group note-hint-group-${idx}`;
    this.searchKeyword(idx, keyword, (items) => {
      items = items || [];
      if (items.length) {
        $group.append(...this.createItemTemplates(idx, items));
        this.show();
      }
    });

    return $group;
  }

  handleKeyup(event) {
    if (!lists.contains([key.code.ENTER, key.code.UP, key.code.DOWN], event.keyCode)) {
      let range = this.context.invoke('editor.getLastRange');
      let wordRange, keyword;
      if (this.options.hintMode === 'words') {
        wordRange = range.getWordsRange(range);
        keyword = wordRange.toString();

        this.hints.forEach((hint) => {
          if (hint.match.test(keyword)) {
            wordRange = range.getWordsMatchRange(hint.match);
            return false;
          }
        });

        if (!wordRange) {
          this.hide();
          return;
        }

        keyword = wordRange.toString();
      } else {
        wordRange = range.getWordRange();
        keyword = wordRange.toString();
      }

      if (this.hints.length && keyword) {
        this.$content.innerHTML = '';

        const bnd = func.rect2bnd(lists.last(wordRange.getClientRects()));
        const containerOffset = this.options.container.getBoundingClientRect();
        if (bnd) {
          bnd.top -= containerOffset.top;
          bnd.left -= containerOffset.left;

          this.$popover.style.display = 'none';
          this.lastWordRange = wordRange;
          this.hints.forEach((hint, idx) => {
            if (hint.match.test(keyword)) {
              this.createGroup(idx, keyword).appendTo(this.$content);
            }
          });
          this.$content.querySelector('.note-hint-item').classList.add('active');

          if (this.direction === 'top') {
            this.$popover.style.left = `${bnd.left}px`;
            this.$popover.style.top = `${bnd.top - this.$popover.offsetHeight - POPOVER_DIST}px`;
          } else {
            this.$popover.style.left = `${bnd.left}px`;
            this.$popover.style.top = `${bnd.top + bnd.height + POPOVER_DIST}px`;
          }
        }
      } else {
        this.hide();
      }
    }
  }

  show() {
    this.$popover.style.display = 'block';
  }

  hide() {
    this.$popover.style.display = 'none';
  }
}
