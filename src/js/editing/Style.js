import func from '../core/func';
import lists from '../core/lists';
import dom from '../core/dom';

export default class Style {
  /**
   * returns style object from node
   *
   * @param {HTMLElement} node
   * @return {Object}
   */
  fromNode(node) {
    const properties = ['font-family', 'font-size', 'text-align', 'list-style-type', 'line-height'];
    const styleInfo = {};

    properties.forEach(property => {
      styleInfo[property] = window.getComputedStyle(node)[property];
    });

    const fontSize = node.style.fontSize || styleInfo['font-size'];

    styleInfo['font-size'] = parseInt(fontSize, 10);
    styleInfo['font-size-unit'] = fontSize.match(/[a-z%]+$/);

    return styleInfo;
  }

  /**
   * paragraph level style
   *
   * @param {WrappedRange} rng
   * @param {Object} styleInfo
   */
  stylePara(rng, styleInfo) {
    rng.nodes(dom.isPara, { includeAncestor: true }).forEach(para => {
      Object.assign(para.style, styleInfo);
    });
  }

  /**
   * insert and returns styleNodes on range.
   *
   * @param {WrappedRange} rng
   * @param {Object} [options] - options for styleNodes
   * @param {String} [options.nodeName] - default: `SPAN`
   * @param {Boolean} [options.expandClosestSibling] - default: `false`
   * @param {Boolean} [options.onlyPartialContains] - default: `false`
   * @return {Node[]}
   */
  styleNodes(rng, options) {
    rng = rng.splitText();

    const nodeName = (options && options.nodeName) || 'SPAN';
    const expandClosestSibling = !!(options && options.expandClosestSibling);
    const onlyPartialContains = !!(options && options.onlyPartialContains);

    if (rng.isCollapsed()) {
      return [rng.insertNode(dom.create(nodeName))];
    }

    let pred = dom.makePredByNodeName(nodeName);
    const nodes = rng.nodes(dom.isText, { fullyContains: true }).map(text => {
      return dom.singleChildAncestor(text, pred) || dom.wrap(text, nodeName);
    });

    if (expandClosestSibling) {
      if (onlyPartialContains) {
        const nodesInRange = rng.nodes();
        // compose with partial contains predication
        pred = func.and(pred, node => {
          return lists.contains(nodesInRange, node);
        });
      }

      return nodes.map(node => {
        const siblings = dom.withClosestSiblings(node, pred);
        const head = lists.head(siblings);
        const tails = lists.tail(siblings);
        tails.forEach(elem => {
          dom.appendChildNodes(head, elem.childNodes);
          dom.remove(elem);
        });
        return lists.head(siblings);
      });
    } else {
      return nodes;
    }
  }

  /**
   * get current style on cursor
   *
   * @param {WrappedRange} rng
   * @return {Object} - object contains style properties.
   */
  current(rng) {
    const cont = !dom.isElement(rng.sc) ? rng.sc.parentNode : rng.sc;
    let styleInfo = this.fromNode(cont);

    // document.queryCommandState for toggle state
    // [workaround] prevent Firefox nsresult: "0x80004005 (NS_ERROR_FAILURE)"
    try {
      styleInfo = Object.assign(styleInfo, {
        'font-bold': document.queryCommandState('bold') ? 'bold' : 'normal',
        'font-italic': document.queryCommandState('italic') ? 'italic' : 'normal',
        'font-underline': document.queryCommandState('underline') ? 'underline' : 'normal',
        'font-subscript': document.queryCommandState('subscript') ? 'subscript' : 'normal',
        'font-superscript': document.queryCommandState('superscript') ? 'superscript' : 'normal',
        'font-strikethrough': document.queryCommandState('strikethrough') ? 'strikethrough' : 'normal',
        'font-family': document.queryCommandValue('fontname') || styleInfo['font-family'],
      });
    } catch (e) {
      // eslint-disable-next-line
    }

    // list-style-type to list-style(unordered, ordered)
    if (!rng.isOnList()) {
      styleInfo['list-style'] = 'none';
    } else {
      const orderedTypes = ['circle', 'disc', 'disc-leading-zero', 'square'];
      const isUnordered = orderedTypes.indexOf(styleInfo['list-style-type']) > -1;
      styleInfo['list-style'] = isUnordered ? 'unordered' : 'ordered';
    }

    const para = dom.ancestor(rng.sc, dom.isPara);
    if (para && para.style['line-height']) {
      styleInfo['line-height'] = para.style.lineHeight;
    } else {
      const lineHeight = parseInt(styleInfo['line-height'], 10) / parseInt(styleInfo['font-size'], 10);
      styleInfo['line-height'] = lineHeight.toFixed(1);
    }

    styleInfo.anchor = rng.isOnAnchor() && dom.ancestor(rng.sc, dom.isAnchor);
    styleInfo.ancestors = dom.listAncestor(rng.sc, dom.isEditable);
    styleInfo.range = rng;

    return styleInfo;
  }
}
