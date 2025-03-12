import '@/js/settings';
import renderer from '@/js/renderer';

import './summernote-bs5.scss';

const editor = renderer.create('<div class="note-editor note-frame card"></div>');
const toolbar = renderer.create('<div class="note-toolbar card-header" role="toolbar"></div>');
const editingArea = renderer.create('<div class="note-editing-area"></div>');
const codable = renderer.create('<textarea class="note-codable" aria-multiline="true"></textarea>');
const editable = renderer.create('<div class="note-editable card-block" contentEditable="true" role="textbox" aria-multiline="true"/>');
const statusbar = renderer.create([
  '<output class="note-status-output" role="status" aria-live="polite"></output>',
  '<div class="note-statusbar" role="status">',
    '<div class="note-resizebar" aria-label="Resize">',
      '<div class="note-icon-bar"></div>',
      '<div class="note-icon-bar"></div>',
      '<div class="note-icon-bar"></div>',
    '</div>',
  '</div>',
].join(''));

const airEditor = renderer.create('<div class="note-editor note-airframe"></div>');
const airEditable = renderer.create([
  '<div class="note-editable" contentEditable="true" role="textbox" aria-multiline="true"></div>',
  '<output class="note-status-output" role="status" aria-live="polite"></output>',
].join(''));

const buttonGroup = renderer.create('<div class="note-btn-group btn-group">');

const dropdown = renderer.create('<div class="note-dropdown-menu dropdown-menu" role="list">', function(node, options) {
  const markup = Array.isArray(options.items) ? options.items.map(function(item) {
    const value = (typeof item === 'string') ? item : (item.value || '');
    const content = options.template ? options.template(item) : item;
    const option = (typeof item === 'object') ? item.option : undefined;

    const dataValue = 'data-value="' + value + '"';
    const dataOption = (option !== undefined) ? ' data-option="' + option + '"' : '';
    return '<a class="dropdown-item" href="#" ' + (dataValue + dataOption) + ' role="listitem" aria-label="' + value + '">' + content + '</a>';
  }).join('') : options.items;

  node.innerHTML = markup;
  node.setAttribute('aria-label', options.title);

  if (options && options.codeviewKeepButton) {
    node.classList.add('note-codeview-keep');
  }
});

const dropdownButtonContents = function(contents) {
  return contents;
};

const dropdownCheck = renderer.create('<div class="note-dropdown-menu dropdown-menu note-check" role="list">', function(node, options) {
  const markup = Array.isArray(options.items) ? options.items.map(function(item) {
    const value = (typeof item === 'string') ? item : (item.value || '');
    const content = options.template ? options.template(item) : item;
    return '<a class="dropdown-item" href="#" data-value="' + value + '" role="listitem" aria-label="' + item + '">' + icon(options.checkClassName) + ' ' + content + '</a>';
  }).join('') : options.items;
  node.innerHTML = markup;
  node.setAttribute('aria-label', options.title);

  if (options && options.codeviewKeepButton) {
    node.classList.add('note-codeview-keep');
  }
});

const dialog = renderer.create('<div class="modal note-modal" aria-hidden="false" tabindex="-1" role="dialog"></div>', function(node, options) {
  if (options.fade) {
    node.classList.add('fade');
  }
  node.setAttribute('aria-label', options.title);
  node.innerHTML = [
    '<div class="modal-dialog">',
      '<div class="modal-content">',
        (options.title ? '<div class="modal-header">' +
          '<h4 class="modal-title">' + options.title + '</h4>' +
          '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" aria-hidden="true"></button>' +
        '</div>' : ''),
        '<div class="modal-body">' + options.body + '</div>',
        (options.footer ? '<div class="modal-footer">' + options.footer + '</div>' : ''),
      '</div>',
    '</div>',
  ].join('');
});

const popover = renderer.create([
  '<div class="note-popover popover bs-popover-auto show">',
    '<div class="popover-arrow"></div>',
    '<div class="popover-body note-popover-content note-children-container"></div>',
  '</div>',
].join(''), function(node, options) {
  const direction = typeof options.direction !== 'undefined' ? options.direction : 'bottom';

  node.setAttribute('data-popper-placement', direction);

  if (options.hideArrow) {
    node.querySelector('.popover-arrow').style.display = 'none';
  }
});

const checkbox = renderer.create('<div class="form-check"></div>', function(node, options) {
  node.innerHTML = [
    '<label class="form-check-label"' + (options.id ? ' for="note-' + options.id + '"' : '') + '>',
      '<input type="checkbox" class="form-check-input"' + (options.id ? ' id="note-' + options.id + '"' : ''),
        (options.checked ? ' checked' : ''),
        ' aria-label="' + (options.text ? options.text : '') + '"',
        ' aria-checked="' + (options.checked ? 'true' : 'false') + '"/>',
      ' ' + (options.text ? options.text : '') +
    '</label>',
  ].join('');
});

const icon = function(iconClassName, tagName) {
  if (iconClassName.match(/^</)) {
    return iconClassName;
  }
  tagName = tagName || 'i';
  return '<' + tagName + ' class="' + iconClassName + '"></' + tagName+'>';
};

const ui = function(editorOptions) {
  return {
    editor: editor,
    toolbar: toolbar,
    editingArea: editingArea,
    codable: codable,
    editable: editable,
    statusbar: statusbar,
    airEditor: airEditor,
    airEditable: airEditable,
    buttonGroup: buttonGroup,
    dropdown: dropdown,
    dropdownButtonContents: dropdownButtonContents,
    dropdownCheck: dropdownCheck,
    dialog: dialog,
    popover: popover,
    icon: icon,
    checkbox: checkbox,
    options: editorOptions,

    palette: function(node, options) {
      return renderer.create('<div class="note-color-palette"></div>', function(node, options) {
        const contents = [];
        for (let row = 0, rowSize = options.colors.length; row < rowSize; row++) {
          const eventName = options.eventName;
          const colors = options.colors[row];
          const colorsName = options.colorsName[row];
          const buttons = [];
          for (let col = 0, colSize = colors.length; col < colSize; col++) {
            const color = colors[col];
            const colorName = colorsName[col];
            buttons.push([
              '<button type="button" class="note-color-btn"',
              'style="background-color:', color, '" ',
              'data-event="', eventName, '" ',
              'data-value="', color, '" ',
              'title="', colorName, '" ',
              'aria-label="', colorName, '" ',
              'data-toggle="button" tabindex="-1"></button>',
            ].join(''));
          }
          contents.push('<div class="note-color-row">' + buttons.join('') + '</div>');
        }
        node.innerHTML = contents.join('');

        if (options.tooltip) {
          const tooltipOptions = {
            container: options.container || editorOptions.container,
            trigger: 'hover',
            placement: 'bottom',
          };

          const tooltipElements = node.querySelectorAll('.note-color-btn');
          tooltipElements.forEach((tooltipElement) => {
            tooltipElement.setAttribute('title', tooltipElement.getAttribute('aria-label'));
            tooltipElement.setAttribute('data-bs-toggle', 'tooltip');
            new bootstrap.Tooltip(tooltipElement, tooltipOptions);
          });
        }
      })(node, options);
    },

    button: function(node, options) {
      return renderer.create('<button type="button" class="note-btn btn btn-outline-secondary btn-sm" tabindex="-1">', function(node, options) {
        if (options && options.data && options.data.toggle === 'dropdown') {
          node.removeAttribute('data-toggle');
          node.setAttribute('data-bs-toggle', 'dropdown');
          if (options && options.tooltip) {
            node.setAttribute('title', options.tooltip);
            node.setAttribute('aria-label', options.tooltip);
          }
        } else if (options && options.tooltip) {
          node.setAttribute('title', options.tooltip);
          node.setAttribute('aria-label', options.tooltip);
          new bootstrap.Tooltip(node, {
            container: options.container || editorOptions.container,
            trigger: 'hover',
            placement: 'bottom',
          });
          node.addEventListener('click', () => {
            bootstrap.Tooltip.getInstance(node).hide();
          });
        }
        if (options && options.codeviewButton) {
          node.classList.add('note-codeview-keep');
        }
      })(node, options);
    },

    toggleBtn: function(btn, isEnable) {
      btn.classList.toggle('disabled', !isEnable);
      btn.disabled = !isEnable;
    },

    toggleBtnActive: function(btn, isActive) {
      btn.classList.toggle('active', isActive);
    },

    onDialogShown: function(dialog, handler) {
      dialog.addEventListener('shown.bs.modal', handler, { once: true });
    },

    onDialogHidden: function(dialog, handler) {
      dialog.addEventListener('hidden.bs.modal', handler, { once: true });
    },

    showDialog: function(dialog) {
      const modal = new bootstrap.Modal(dialog);
      modal.show();
    },

    hideDialog: function(dialog) {
      const modal = bootstrap.Modal.getInstance(dialog);
      modal.hide();
    },

    createLayout: function(note) {
      const editorElement = (editorOptions.airMode ? airEditor([
        editingArea([
          codable(),
          airEditable(),
        ]),
      ]) : (editorOptions.toolbarPosition === 'bottom'
        ? editor([
          editingArea([
            codable(),
            editable(),
          ]),
          toolbar(),
          statusbar(),
        ])
        : editor([
          toolbar(),
          editingArea([
            codable(),
            editable(),
          ]),
          statusbar(),
        ])
      )).render();

      note.insertAdjacentElement('afterend', editorElement);

      return {
        note: note,
        editor: editorElement,
        toolbar: editorElement.querySelector('.note-toolbar'),
        editingArea: editorElement.querySelector('.note-editing-area'),
        editable: editorElement.querySelector('.note-editable'),
        codable: editorElement.querySelector('.note-codable'),
        statusbar: editorElement.querySelector('.note-statusbar'),
      };
    },

    removeLayout: function(note, layoutInfo) {
      note.innerHTML = layoutInfo.editable.innerHTML;
      layoutInfo.editor.remove();
      note.style.display = '';
    },
  };
};

window.summernote = Object.assign(window.summernote || {}, {
  ui_template: ui,
  interface: 'bs5',
});


// @TODO a decommenter
// window.summernote.options.styleTags = [
//   'p',
//   { title: 'Blockquote', tag: 'blockquote', className: 'blockquote', value: 'blockquote' },
//   'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
// ];
