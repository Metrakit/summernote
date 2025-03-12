import env from '../core/env';
import key from '../core/key';
import func from '../core/func';
import lists from '../core/lists';
import dom from '../core/dom';
import range from '../core/range';
import { readFileAsDataURL, createImage } from '../core/async';
import History from '../editing/History';
import Style from '../editing/Style';
import Typing from '../editing/Typing';
import Table from '../editing/Table';
import Bullet from '../editing/Bullet';

const KEY_BOGUS = 'bogus';
const MAILTO_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const TEL_PATTERN = /^(\+?\d{1,3}[\s-]?)?(\d{1,4})[\s-]?(\d{1,4})[\s-]?(\d{1,4})$/;
const URL_SCHEME_PATTERN = /^([A-Za-z][A-Za-z0-9+-.]*\:|#|\/)/;

/**
 * @class Editor
 */
export default class Editor {
  constructor(context) {
    this.context = context;

    this.$note = context.layoutInfo.note;
    this.$editor = context.layoutInfo.editor;
    console.log('context.layoutInfo.editor', context.layoutInfo.editor)
    this.$editable = context.layoutInfo.editable;
    this.options = context.options;
    this.lang = this.options.langInfo;

    this.editable = this.$editable[0];
    console.log(' this.$editable[0]', this.$editable[0])
    this.lastRange = null;
    this.snapshot = null;

    this.style = new Style();
    this.table = new Table();
    this.typing = new Typing(context);
    this.bullet = new Bullet();
    this.history = new History(context);

    this.context.memo('help.escape', this.lang.help.escape);
    this.context.memo('help.undo', this.lang.help.undo);
    this.context.memo('help.redo', this.lang.help.redo);
    this.context.memo('help.tab', this.lang.help.tab);
    this.context.memo('help.untab', this.lang.help.untab);
    this.context.memo('help.insertParagraph', this.lang.help.insertParagraph);
    this.context.memo('help.insertOrderedList', this.lang.help.insertOrderedList);
    this.context.memo('help.insertUnorderedList', this.lang.help.insertUnorderedList);
    this.context.memo('help.indent', this.lang.help.indent);
    this.context.memo('help.outdent', this.lang.help.outdent);
    this.context.memo('help.formatPara', this.lang.help.formatPara);
    this.context.memo('help.insertHorizontalRule', this.lang.help.insertHorizontalRule);
    this.context.memo('help.fontName', this.lang.help.fontName);

    const commands = [
      'bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript',
      'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
      'formatBlock', 'removeFormat', 'backColor',
    ];

    for (let idx = 0, len = commands.length; idx < len; idx++) {
      this[commands[idx]] = ((sCmd) => {
        return (value) => {
          this.beforeCommand();
          document.execCommand(sCmd, false, value);
          this.afterCommand(true);
        };
      })(commands[idx]);
      this.context.memo('help.' + commands[idx], this.lang.help[commands[idx]]);
    }

    this.fontName = this.wrapCommand((value) => {
      return this.fontStyling('font-family', env.validFontName(value));
    });

    this.fontSize = this.wrapCommand((value) => {
      const unit = this.currentStyle()['font-size-unit'];
      return this.fontStyling('font-size', value + unit);
    });

    this.fontSizeUnit = this.wrapCommand((value) => {
      const size = this.currentStyle()['font-size'];
      return this.fontStyling('font-size', size + value);
    });

    for (let idx = 1; idx <= 6; idx++) {
      this['formatH' + idx] = ((idx) => {
        return () => {
          this.formatBlock('H' + idx);
        };
      })(idx);
      this.context.memo('help.formatH' + idx, this.lang.help['formatH' + idx]);
    }

    this.insertParagraph = this.wrapCommand(() => {
      this.typing.insertParagraph(this.editable);
    });

    this.insertOrderedList = this.wrapCommand(() => {
      this.bullet.insertOrderedList(this.editable);
    });

    this.insertUnorderedList = this.wrapCommand(() => {
      this.bullet.insertUnorderedList(this.editable);
    });

    this.indent = this.wrapCommand(() => {
      this.bullet.indent(this.editable);
    });

    this.outdent = this.wrapCommand(() => {
      this.bullet.outdent(this.editable);
    });

    this.insertNode = this.wrapCommand((node) => {
      if (this.isLimited(node.textContent.length)) {
        return;
      }
      const rng = this.getLastRange();
      rng.insertNode(node);
      this.setLastRange(range.createFromNodeAfter(node).select());
    });

    this.insertText = this.wrapCommand((text) => {
      if (this.isLimited(text.length)) {
        return;
      }
      const rng = this.getLastRange();
      const textNode = rng.insertNode(document.createTextNode(text));
      this.setLastRange(range.create(textNode, textNode.length).select());
    });

    this.pasteHTML = this.wrapCommand((markup) => {
      if (this.isLimited(markup.length)) {
        return;
      }
      markup = this.context.invoke('codeview.purify', markup);
      const contents = this.getLastRange().pasteHTML(markup);
      this.setLastRange(range.createFromNodeAfter(contents[contents.length - 1]).select());
    });

    this.formatBlock = this.wrapCommand((tagName, target) => {
      const onApplyCustomStyle = this.options.callbacks.onApplyCustomStyle;
      if (onApplyCustomStyle) {
        onApplyCustomStyle.call(this, target, this.context, this.onFormatBlock);
      } else {
        this.onFormatBlock(tagName, target);
      }
    });

    this.insertHorizontalRule = this.wrapCommand(() => {
      const hrNode = this.getLastRange().insertNode(document.createElement('HR'));
      if (hrNode.nextSibling) {
        this.setLastRange(range.create(hrNode.nextSibling, 0).normalize().select());
      }
    });

    this.lineHeight = this.wrapCommand((value) => {
      this.style.stylePara(this.getLastRange(), {
        lineHeight: value,
      });
    });

    this.createLink = this.wrapCommand((linkInfo) => {
      let rel = [];
      let linkUrl = linkInfo.url;
      const linkText = linkInfo.text;
      const isNewWindow = linkInfo.isNewWindow;
      const addNoReferrer = this.options.linkAddNoReferrer;
      const addNoOpener = this.options.linkAddNoOpener;
      let rng = linkInfo.range || this.getLastRange();
      const additionalTextLength = linkText.length - rng.toString().length;
      if (additionalTextLength > 0 && this.isLimited(additionalTextLength)) {
        return;
      }
      const isTextChanged = rng.toString() !== linkText;

      if (typeof linkUrl === 'string') {
        linkUrl = linkUrl.trim();
      }

      if (this.options.onCreateLink) {
        linkUrl = this.options.onCreateLink(linkUrl);
      } else {
        linkUrl = this.checkLinkUrl(linkUrl);
      }

      let anchors = [];
      if (isTextChanged) {
        rng = rng.deleteContents();
        const anchor = rng.insertNode(document.createElement('A'));
        anchor.textContent = linkText;
        anchors.push(anchor);
      } else {
        anchors = this.style.styleNodes(rng, {
          nodeName: 'A',
          expandClosestSibling: true,
          onlyPartialContains: true,
        });
      }

      anchors.forEach((anchor) => {
        anchor.setAttribute('href', linkUrl);
        if (isNewWindow) {
          anchor.setAttribute('target', '_blank');
          if (addNoReferrer) {
            rel.push('noreferrer');
          }
          if (addNoOpener) {
            rel.push('noopener');
          }
          if (rel.length) {
            anchor.setAttribute('rel', rel.join(' '));
          }
        } else {
          anchor.removeAttribute('target');
        }
      });

      this.setLastRange(
        this.createRangeFromList(anchors).select()
      );
    });

    this.color = this.wrapCommand((colorInfo) => {
      const foreColor = colorInfo.foreColor;
      const backColor = colorInfo.backColor;

      if (foreColor) { document.execCommand('foreColor', false, foreColor); }
      if (backColor) { document.execCommand('backColor', false, backColor); }
    });

    this.foreColor = this.wrapCommand((colorInfo) => {
      document.execCommand('foreColor', false, colorInfo);
    });

    this.insertTable = this.wrapCommand((dim) => {
      const dimension = dim.split('x');

      const rng = this.getLastRange().deleteContents();
      rng.insertNode(this.table.createTable(dimension[0], dimension[1], this.options));
    });

    this.removeMedia = this.wrapCommand(() => {
      let target = this.restoreTarget().parentNode;
      if (target.closest('figure')) {
        target.closest('figure').remove();
      } else {
        target = this.restoreTarget().remove();
      }
      
      this.setLastRange(range.createFromSelection(target).select());
      this.context.triggerEvent('media.delete', target, this.$editable);
    });

    this.floatMe = this.wrapCommand((value) => {
      const target = this.restoreTarget();
      target.classList.toggle('note-float-left', value === 'left');
      target.classList.toggle('note-float-right', value === 'right');
      target.style.float = (value === 'none' ? '' : value);
    });

    this.resize = this.wrapCommand((value) => {
      const target = this.restoreTarget();
      value = parseFloat(value);
      if (value === 0) {
        target.style.width = '';
      } else {
        target.style.width = value * 100 + '%';
        target.style.height = '';
      }
    });
  }

  initialize() {
    this.$editable.addEventListener('keydown', (event) => {
      if (event.keyCode === key.code.ENTER) {
        this.context.triggerEvent('enter', event);
      }
      this.context.triggerEvent('keydown', event);

      this.snapshot = this.history.makeSnapshot();
      this.hasKeyShortCut = false;
      if (!event.defaultPrevented) {
        if (this.options.shortcuts) {
          this.hasKeyShortCut = this.handleKeyMap(event);
        } else {
          this.preventDefaultEditableShortCuts(event);
        }
      }
      if (this.isLimited(1, event)) {
        const lastRange = this.getLastRange();
        if (lastRange.eo - lastRange.so === 0) {
          return false;
        }
      }
      this.setLastRange();

      if (this.options.recordEveryKeystroke) {
        if (this.hasKeyShortCut === false) {
          this.history.recordUndo();
        }
      }
    });

    this.$editable.addEventListener('keyup', (event) => {
      this.setLastRange();
      this.context.triggerEvent('keyup', event);
    });

    this.$editable.addEventListener('focus', (event) => {
      this.setLastRange();
      this.context.triggerEvent('focus', event);
    });

    this.$editable.addEventListener('blur', (event) => {
      this.context.triggerEvent('blur', event);
    });

    this.$editable.addEventListener('mousedown', (event) => {
      this.context.triggerEvent('mousedown', event);
    });

    this.$editable.addEventListener('mouseup', (event) => {
      this.setLastRange();
      this.history.recordUndo();
      this.context.triggerEvent('mouseup', event);
    });

    this.$editable.addEventListener('scroll', (event) => {
      this.context.triggerEvent('scroll', event);
    });

    this.$editable.addEventListener('paste', (event) => {
      this.setLastRange();
      this.context.triggerEvent('paste', event);
    });

    this.$editable.addEventListener('copy', (event) => {
      this.context.triggerEvent('copy', event);
    });

    this.$editable.addEventListener('input', () => {
      if (this.isLimited(0) && this.snapshot) {
        this.history.applySnapshot(this.snapshot);
      }
    });

    this.$editable.setAttribute('spellcheck', this.options.spellCheck);
    this.$editable.setAttribute('autocorrect', this.options.spellCheck);

    if (this.options.disableGrammar) {
      this.$editable.setAttribute('data-gramm', false);
    }

    this.$editable.innerHTML = dom.html(this.$note) || dom.emptyPara;

    this.$editable.addEventListener(env.inputEventName, func.debounce(() => {
      this.context.triggerEvent('change', this.$editable.innerHTML, this.$editable);
    }, 10));

    this.$editable.addEventListener('focusin', (event) => {
      this.context.triggerEvent('focusin', event);
    });

    this.$editable.addEventListener('focusout', (event) => {
      this.context.triggerEvent('focusout', event);
    });

    if (this.options.airMode) {
      if (this.options.overrideContextMenu) {
        this.$editor.addEventListener('contextmenu', (event) => {
          this.context.triggerEvent('contextmenu', event);
          event.preventDefault();
        });
      }
    } else {
      if (this.options.width) {
        this.$editor.style.width = this.options.width + 'px';
      }
      if (this.options.height) {
        this.$editable.style.height = this.options.height + 'px';
      }
      if (this.options.maxHeight) {
        this.$editable.style.maxHeight = this.options.maxHeight + 'px';
      }
      if (this.options.minHeight) {
        this.$editable.style.minHeight = this.options.minHeight + 'px';
      }
    }

    this.history.recordUndo();
    this.setLastRange();
  }

  destroy() {
    this.$editable.removeEventListener('keydown');
    this.$editable.removeEventListener('keyup');
    this.$editable.removeEventListener('focus');
    this.$editable.removeEventListener('blur');
    this.$editable.removeEventListener('mousedown');
    this.$editable.removeEventListener('mouseup');
    this.$editable.removeEventListener('scroll');
    this.$editable.removeEventListener('paste');
    this.$editable.removeEventListener('copy');
    this.$editable.removeEventListener('input');
    this.$editable.removeEventListener(env.inputEventName);
    this.$editable.removeEventListener('focusin');
    this.$editable.removeEventListener('focusout');
  }

  handleKeyMap(event) {
    const keyMap = this.options.keyMap[env.isMac ? 'mac' : 'pc'];
    const keys = [];

    if (event.metaKey) { keys.push('CMD'); }
    if (event.ctrlKey && !event.altKey) { keys.push('CTRL'); }
    if (event.shiftKey) { keys.push('SHIFT'); }

    const keyName = key.nameFromCode[event.keyCode];
    if (keyName) {
      keys.push(keyName);
    }

    const eventName = keyMap[keys.join('+')];

    if (keyName === 'TAB' && !this.options.tabDisable) {
      this.afterCommand();
    } else if (eventName) {
      if (this.context.invoke(eventName) !== false) {
        event.preventDefault();
        return true;
      }
    } else if (key.isEdit(event.keyCode)) {
      if (key.isRemove(event.keyCode)) {
        this.context.invoke('removed');
      }
      this.afterCommand();
    }
    return false;
  }

  preventDefaultEditableShortCuts(event) {
    if ((event.ctrlKey || event.metaKey) &&
      [66, 73, 85].includes(event.keyCode)) {
      event.preventDefault();
    }
  }

  isLimited(pad, event) {
    pad = pad || 0;

    if (typeof event !== 'undefined') {
      if (key.isMove(event.keyCode) ||
          key.isNavigation(event.keyCode) ||
          (event.ctrlKey || event.metaKey) ||
          [key.code.BACKSPACE, key.code.DELETE].includes(event.keyCode)) {
        return false;
      }
    }

    if (this.options.maxTextLength > 0) {
      if ((this.$editable.textContent.length + pad) > this.options.maxTextLength) {
        return true;
      }
    }
    return false;
  }

  checkLinkUrl(linkUrl) {
    if (MAILTO_PATTERN.test(linkUrl)) {
      return 'mailto://' + linkUrl;
    } else if (TEL_PATTERN.test(linkUrl)) {
      return 'tel://' + linkUrl;
    } else if (!URL_SCHEME_PATTERN.test(linkUrl)) {
      return 'http://' + linkUrl;
    }
    return linkUrl;
  }

  createRange() {
    this.focus();
    this.setLastRange();
    return this.getLastRange();
  }

  createRangeFromList(lst) {
    const startRange = range.createFromNodeBefore(lst[0]);
    const startPoint = startRange.getStartPoint();
    const endRange = range.createFromNodeAfter(lst[lst.length - 1]);
    const endPoint = endRange.getEndPoint();

    return range.create(
      startPoint.node,
      startPoint.offset,
      endPoint.node,
      endPoint.offset
    );
  }

  setLastRange(rng) {
    if (rng) {
      this.lastRange = rng;
    } else {
      console.log('this.editable', this.editable)
      this.lastRange = range.create(this.editable);

      if (!this.lastRange.sc.closest('.note-editable')) {
        this.lastRange = range.createFromBodyElement(this.editable);
      }
    }
  }

  getLastRange() {
    if (!this.lastRange) {
      this.setLastRange();
    }
    return this.lastRange;
  }

  saveRange(thenCollapse) {
    if (thenCollapse) {
      this.getLastRange().collapse().select();
    }
  }

  restoreRange() {
    if (this.lastRange) {
      this.lastRange.select();
      this.focus();
    }
  }

  saveTarget(node) {
    this.$editable.dataset.target = node;
  }

  clearTarget() {
    delete this.$editable.dataset.target;
  }

  restoreTarget() {
    return this.$editable.dataset.target;
  }

  currentStyle() {
    let rng = range.create();
    if (rng) {
      rng = rng.normalize();
    }
    return rng ? this.style.current(rng) : this.style.fromNode(this.$editable);
  }

  styleFromNode(node) {
    return this.style.fromNode(node);
  }

  undo() {
    this.context.triggerEvent('before.command', this.$editable.innerHTML);
    this.history.undo();
    this.context.triggerEvent('change', this.$editable.innerHTML, this.$editable);
  }

  commit() {
    this.context.triggerEvent('before.command', this.$editable.innerHTML);
    this.history.commit();
    this.context.triggerEvent('change', this.$editable.innerHTML, this.$editable);
  }

  redo() {
    this.context.triggerEvent('before.command', this.$editable.innerHTML);
    this.history.redo();
    this.context.triggerEvent('change', this.$editable.innerHTML, this.$editable);
  }

  beforeCommand() {
    this.context.triggerEvent('before.command', this.$editable.innerHTML);

    document.execCommand('styleWithCSS', false, this.options.styleWithCSS);

    this.focus();
  }

  afterCommand(isPreventTrigger) {
    this.normalizeContent();
    this.history.recordUndo();
    if (!isPreventTrigger) {
      this.context.triggerEvent('change', this.$editable.innerHTML, this.$editable);
    }
  }

  tab() {
    const rng = this.getLastRange();
    if (rng.isCollapsed() && rng.isOnCell()) {
      this.table.tab(rng);
    } else {
      if (this.options.tabSize === 0) {
        return false;
      }

      if (!this.isLimited(this.options.tabSize)) {
        this.beforeCommand();
        this.typing.insertTab(rng, this.options.tabSize);
        this.afterCommand();
      }
    }
  }

  /**
   * handle shift+tab key
   */
  untab() {
    const rng = this.getLastRange();
    if (rng.isCollapsed() && rng.isOnCell()) {
      this.table.tab(rng, true);
    } else {
      if (this.options.tabSize === 0) {
        return false;
      }
    }
  }

  /**
   * run given function between beforeCommand and afterCommand
   */
  wrapCommand(fn) {
    return function() {
      this.beforeCommand();
      fn.apply(this, arguments);
      this.afterCommand();
    };
  }

  /**
   * removed (function added by 1der1)
  */
  removed(rng, node, tagName) { // LB
    rng = range.create();
    if (rng.isCollapsed() && rng.isOnCell()) {
      node = rng.ec;
      if( (tagName = node.tagName) &&
        (node.childElementCount === 1) &&
        (node.childNodes[0].tagName === "BR") ){

        if(tagName === "P") {
          node.remove();
        } else if(['TH', 'TD'].indexOf(tagName) >=0) {
          node.firstChild.remove();
        }
      }
    }
  }

  /**
   * insert image
   *
   * @param {String} src
   * @param {String|Function} param
   * @return {Promise}
   */
  insertImage(src, param) {
    return createImage(src, param).then((image) => {
      this.beforeCommand();

      if (typeof param === 'function') {
        param(image);
      } else {
        if (typeof param === 'string') {
          image.setAttribute('data-filename', param);
        }
        image.style.width = Math.min(this.$editable.clientWidth, image.width) + 'px';
      }

      image.style.display = 'block';
      this.getLastRange().insertNode(image);
      this.setLastRange(range.createFromNodeAfter(image).select());
      this.afterCommand();
    }).catch((e) => {
      this.context.triggerEvent('image.upload.error', e);
    });
  }

  /**
   * insertImages
   * @param {File[]} files
   */
  insertImagesAsDataURL(files) {
    Array.from(files).forEach((file) => {
      const filename = file.name;
      if (this.options.maximumImageFileSize && this.options.maximumImageFileSize < file.size) {
        this.context.triggerEvent('image.upload.error', this.lang.image.maximumFileSizeError);
      } else {
        readFileAsDataURL(file).then((dataURL) => {
          return this.insertImage(dataURL, filename);
        }).catch(() => {
          this.context.triggerEvent('image.upload.error');
        });
      }
    });
  }

  /**
   * insertImagesOrCallback
   * @param {File[]} files
   */
  insertImagesOrCallback(files) {
    const callbacks = this.options.callbacks;
    // If onImageUpload set,
    if (callbacks.onImageUpload) {
      this.context.triggerEvent('image.upload', files);
      // else insert Image as dataURL
    } else {
      this.insertImagesAsDataURL(files);
    }
  }

  /**
   * return selected plain text
   * @return {String} text
   */
  getSelectedText() {
    let rng = this.getLastRange();

    // if range on anchor, expand range with anchor
    if (rng.isOnAnchor()) {
      rng = range.createFromNode(dom.ancestor(rng.sc, dom.isAnchor));
    }

    return rng.toString();
  }

  onFormatBlock(tagName, target) {
    // [workaround] for MSIE, IE need `<`
    document.execCommand('FormatBlock', false, env.isMSIE ? '<' + tagName + '>' : tagName);

    // support custom class
    if (target && target.length) {
      // find the exact element has given tagName
      if (target[0].tagName.toUpperCase() !== tagName.toUpperCase()) {
        target = target.querySelectorAll(tagName);
      }

      if (target && target.length) {
        const currentRange = this.createRange();
        const parent = [currentRange.sc, currentRange.ec].closest(tagName);
        // remove class added for current block
        parent.classList.remove();
        const className = target[0].className || '';
        if (className) {
          parent.classList.add(className);
        }
      }
    }
  }

  formatPara() {
    this.formatBlock('P');
  }

  fontStyling(target, value) {
    const rng = this.getLastRange();

    if (rng !== '') {
      const spans = this.style.styleNodes(rng);
      this.$editor.querySelector('.note-status-output').innerHTML = '';
      spans.forEach(span => span.style[target] = value);

      // [workaround] added styled bogus span for style
      //  - also bogus character needed for cursor position
      if (rng.isCollapsed()) {
        const firstSpan = lists.head(spans);
        if (firstSpan && !dom.nodeLength(firstSpan)) {
          firstSpan.innerHTML = dom.ZERO_WIDTH_NBSP_CHAR;
          range.createFromNode(firstSpan.firstChild).select();
          this.setLastRange();
          this.$editable.dataset[KEY_BOGUS] = firstSpan;
        }
      } else {
        rng.select();
      }
    } else {
      const noteStatusOutput = Date.now();
      this.$editor.querySelector('.note-status-output').innerHTML = '<div id="note-status-output-' + noteStatusOutput + '" class="alert alert-info">' + this.lang.output.noSelection + '</div>';
      setTimeout(function() { document.getElementById('note-status-output-' + noteStatusOutput).remove(); }, 5000);
    }
  }

  /**
   * unlink
   *
   * @type command
   */
  unlink() {
    let rng = this.getLastRange();
    if (rng.isOnAnchor()) {
      const anchor = dom.ancestor(rng.sc, dom.isAnchor);
      rng = range.createFromNode(anchor);
      rng.select();
      this.setLastRange();

      this.beforeCommand();
      document.execCommand('unlink');
      this.afterCommand();
    }
  }

  /**
   * returns link info
   *
   * @return {Object}
   * @return {WrappedRange} return.range
   * @return {String} return.text
   * @return {Boolean} [return.isNewWindow=true]
   * @return {String} [return.url=""]
   */
  getLinkInfo() {
    if (!this.hasFocus()) {
      this.focus();
    }

    const rng = this.getLastRange().expand(dom.isAnchor);
    // Get the first anchor on range(for edit).
    const anchor = lists.head(rng.nodes(dom.isAnchor));
    const linkInfo = {
      range: rng,
      text: rng.toString(),
      url: anchor ? anchor.getAttribute('href') : '',
    };

    // When anchor exists,
    if (anchor) {
      // Set isNewWindow by checking its target.
      linkInfo.isNewWindow = anchor.getAttribute('target') === '_blank';
    }

    return linkInfo;
  }

  addRow(position) {
    const rng = this.getLastRange(this.$editable);
    if (rng.isCollapsed() && rng.isOnCell()) {
      this.beforeCommand();
      this.table.addRow(rng, position);
      this.afterCommand();
    }
  }

  addCol(position) {
    const rng = this.getLastRange(this.$editable);
    if (rng.isCollapsed() && rng.isOnCell()) {
      this.beforeCommand();
      this.table.addCol(rng, position);
      this.afterCommand();
    }
  }

  deleteRow() {
    const rng = this.getLastRange(this.$editable);
    if (rng.isCollapsed() && rng.isOnCell()) {
      this.beforeCommand();
      this.table.deleteRow(rng);
      this.afterCommand();
    }
  }

  deleteCol() {
    const rng = this.getLastRange(this.$editable);
    if (rng.isCollapsed() && rng.isOnCell()) {
      this.beforeCommand();
      this.table.deleteCol(rng);
      this.afterCommand();
    }
  }

  deleteTable() {
    const rng = this.getLastRange(this.$editable);
    if (rng.isCollapsed() && rng.isOnCell()) {
      this.beforeCommand();
      this.table.deleteTable(rng);
      this.afterCommand();
    }
  }

  /**
   * @param {Position} pos
   * @param {Element} target - target element
   * @param {Boolean} [bKeepRatio] - keep ratio
   */
  resizeTo(pos, target, bKeepRatio) {
    let imageSize;
    if (bKeepRatio) {
      const newRatio = pos.y / pos.x;
      const ratio = target.dataset.ratio;
      imageSize = {
        width: ratio > newRatio ? pos.x : pos.y / ratio,
        height: ratio > newRatio ? pos.x * ratio : pos.y,
      };
    } else {
      imageSize = {
        width: pos.x,
        height: pos.y,
      };
    }

    target.style.width = imageSize.width + 'px';
    target.style.height = imageSize.height + 'px';
  }

  /**
   * returns whether editable area has focus or not.
   */
  hasFocus() {
    return document.activeElement === this.$editable;
  }

  /**
   * set focus
   */
  focus() {
    // [workaround] Screen will move when page is scolled in IE.
    //  - do focus when not focused
    if (!this.hasFocus()) {
      this.$editable.focus();
    }
  }

  /**
   * returns whether contents is empty or not.
   * @return {Boolean}
   */
  isEmpty() {
    return dom.isEmpty(this.$editable) || dom.emptyPara === this.$editable.innerHTML;
  }

  /**
   * Removes all contents and restores the editable instance to an _emptyPara_.
   */
  empty() {
    this.context.invoke('code', dom.emptyPara);
  }

  /**
   * normalize content
   */
  normalizeContent() {
    this.$editable.normalize();
  }
}
