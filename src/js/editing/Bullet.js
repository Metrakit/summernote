import lists from '../core/lists';
import func from '../core/func';
import dom from '../core/dom';
import range from '../core/range';

export default class Bullet {
  /**
   * toggle ordered list
   */
  insertOrderedList(editable) {
    this.toggleList('OL', editable);
  }

  /**
   * toggle unordered list
   */
  insertUnorderedList(editable) {
    this.toggleList('UL', editable);
  }

  /**
   * indent
   */
  indent(editable) {
    const rng = range.create(editable).wrapBodyInlineWithPara();

    const paras = rng.nodes(dom.isPara, { includeAncestor: true });
    const clustereds = lists.clusterBy(paras, func.peq2('parentNode'));

    clustereds.forEach((paras) => {
      const head = lists.head(paras);
      if (dom.isLi(head)) {
        const previousList = this.findList(head.previousSibling);
        if (previousList) {
          paras.forEach((para) => previousList.appendChild(para));
        } else {
          this.wrapList(paras, head.parentNode.nodeName);
          paras.map((para) => para.parentNode).forEach((para) => this.appendToPrevious(para));
        }
      } else {
        paras.forEach((para) => {
          para.style.marginLeft = `${(parseInt(para.style.marginLeft, 10) || 0) + 25}px`;
        });
      }
    });

    rng.select();
  }

  /**
   * outdent
   */
  outdent(editable) {
    const rng = range.create(editable).wrapBodyInlineWithPara();

    const paras = rng.nodes(dom.isPara, { includeAncestor: true });
    const clustereds = lists.clusterBy(paras, func.peq2('parentNode'));

    clustereds.forEach((paras) => {
      const head = lists.head(paras);
      if (dom.isLi(head)) {
        this.releaseList([paras]);
      } else {
        paras.forEach((para) => {
          const val = parseInt(para.style.marginLeft, 10) || 0;
          para.style.marginLeft = val > 25 ? `${val - 25}px` : '';
        });
      }
    });

    rng.select();
  }

  /**
   * toggle list
   *
   * @param {String} listName - OL or UL
   */
  toggleList(listName, editable) {
    const rng = range.create(editable).wrapBodyInlineWithPara();

    let paras = rng.nodes(dom.isPara, { includeAncestor: true });
    const bookmark = rng.paraBookmark(paras);
    const clustereds = lists.clusterBy(paras, func.peq2('parentNode'));

    // paragraph to list
    if (lists.find(paras, dom.isPurePara)) {
      let wrappedParas = [];
      clustereds.forEach((paras) => {
        wrappedParas = wrappedParas.concat(this.wrapList(paras, listName));
      });
      paras = wrappedParas;
      // list to paragraph or change list style
    } else {
      const diffLists = rng
        .nodes(dom.isList, {
          includeAncestor: true,
        })
        .filter((listNode) => {
          return listNode.nodeName !== listName;
        });

      if (diffLists.length) {
        diffLists.forEach((listNode) => {
          dom.replace(listNode, listName);
        });
      } else {
        paras = this.releaseList(clustereds, true);
      }
    }

    range.createFromParaBookmark(bookmark, paras).select();
  }

  /**
   * @param {Node[]} paras
   * @param {String} listName
   * @return {Node[]}
   */
  wrapList(paras, listName) {
    const head = lists.head(paras);
    const last = lists.last(paras);

    const prevList = dom.isList(head.previousSibling) && head.previousSibling;
    const nextList = dom.isList(last.nextSibling) && last.nextSibling;

    const listNode = prevList || dom.insertAfter(dom.create(listName || 'UL'), last);

    // P to LI
    paras = paras.map((para) => {
      return dom.isPurePara(para) ? dom.replace(para, 'LI') : para;
    });

    // append to list(<ul>, <ol>)
    dom.appendChildNodes(listNode, paras, true);

    if (nextList) {
      dom.appendChildNodes(listNode, lists.from(nextList.childNodes), true);
      dom.remove(nextList);
    }

    return paras;
  }

  /**
   * @method releaseList
   *
   * @param {Array[]} clustereds
   * @param {Boolean} isEscapseToBody
   * @return {Node[]}
   */
  releaseList(clustereds, isEscapseToBody) {
    let releasedParas = [];

    clustereds.forEach((paras) => {
      const head = lists.head(paras);
      const last = lists.last(paras);

      const headList = isEscapseToBody ? dom.lastAncestor(head, dom.isList) : head.parentNode;
      const parentItem = headList.parentNode;

      if (headList.parentNode.nodeName === 'LI') {
        paras.forEach((para) => {
          const newList = this.findNextSiblings(para);

          if (parentItem.nextSibling) {
            parentItem.parentNode.insertBefore(para, parentItem.nextSibling);
          } else {
            parentItem.parentNode.appendChild(para);
          }

          if (newList.length) {
            this.wrapList(newList, headList.nodeName);
            para.appendChild(newList[0].parentNode);
          }
        });

        if (headList.children.length === 0) {
          parentItem.removeChild(headList);
        }

        if (parentItem.childNodes.length === 0) {
          parentItem.parentNode.removeChild(parentItem);
        }
      } else {
        const lastList =
          headList.childNodes.length > 1
            ? dom.splitTree(
              headList,
              {
                node: last.parentNode,
                offset: dom.position(last) + 1,
              },
              {
                isSkipPaddingBlankHTML: true,
              },
            )
            : null;

        const middleList = dom.splitTree(
          headList,
          {
            node: head.parentNode,
            offset: dom.position(head),
          },
          {
            isSkipPaddingBlankHTML: true,
          },
        );

        paras = isEscapseToBody
          ? dom.listDescendant(middleList, dom.isLi)
          : lists.from(middleList.childNodes).filter(dom.isLi);

        // LI to P
        if (isEscapseToBody || !dom.isList(headList.parentNode)) {
          paras = paras.map((para) => {
            return dom.replace(para, 'P');
          });
        }

        lists.from(paras).reverse().forEach((para) => {
          dom.insertAfter(para, headList);
        });

        // remove empty lists
        const rootLists = lists.compact([headList, middleList, lastList]);
        rootLists.forEach((rootList) => {
          const listNodes = [rootList].concat(dom.listDescendant(rootList, dom.isList));
          listNodes.reverse().forEach((listNode) => {
            if (!dom.nodeLength(listNode)) {
              dom.remove(listNode, true);
            }
          });
        });
      }

      releasedParas = releasedParas.concat(paras);
    });

    return releasedParas;
  }

  /**
   * @method appendToPrevious
   *
   * Appends list to previous list item, if
   * none exist it wraps the list in a new list item.
   *
   * @param {HTMLNode} ListItem
   * @return {HTMLNode}
   */
  appendToPrevious(node) {
    return node.previousSibling ? dom.appendChildNodes(node.previousSibling, [node]) : this.wrapList([node], 'LI');
  }

  /**
   * @method findList
   *
   * Finds an existing list in list item
   *
   * @param {HTMLNode} ListItem
   * @return {Array[]}
   */
  findList(node) {
    return node ? lists.find(node.children, (child) => ['OL', 'UL'].includes(child.nodeName)) : null;
  }

  /**
   * @method findNextSiblings
   *
   * Finds all list item siblings that follow it
   *
   * @param {HTMLNode} ListItem
   * @return {HTMLNode}
   */
  findNextSiblings(node) {
    const siblings = [];
    while (node.nextSibling) {
      siblings.push(node.nextSibling);
      node = node.nextSibling;
    }
    return siblings;
  }
}
