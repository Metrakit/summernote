export default class Toolbar {
  constructor(context) {
    this.context = context;

    this.$window = window;
    this.$document = document;

    this.ui = context.ui;
    this.$note = context.layoutInfo.note;
    this.$editor = context.layoutInfo.editor;
    this.$toolbar = context.layoutInfo.toolbar;
    this.$editable = context.layoutInfo.editable;
    this.$statusbar = context.layoutInfo.statusbar;
    this.options = context.options;

    this.isFollowing = false;
    this.followScroll = this.followScroll.bind(this);
  }

  shouldInitialize() {
    return !this.options.airMode;
  }

  initialize() {
    this.options.toolbar = this.options.toolbar || [];

    if (!this.options.toolbar.length) {
      this.$toolbar.style.display = 'none';
    } else {
      this.context.invoke('buttons.build', this.$toolbar, this.options.toolbar);
    }

    if (this.options.toolbarContainer) {
      this.options.toolbarContainer.appendChild(this.$toolbar);
    }

    this.changeContainer(false);

    this.$note.addEventListener('summernote.keyup', () => {
      this.context.invoke('buttons.updateCurrentStyle');
    });
    this.$note.addEventListener('summernote.mouseup', () => {
      this.context.invoke('buttons.updateCurrentStyle');
    });
    this.$note.addEventListener('summernote.change', () => {
      this.context.invoke('buttons.updateCurrentStyle');
    });

    this.context.invoke('buttons.updateCurrentStyle');
    if (this.options.followingToolbar) {
      this.$window.addEventListener('scroll', this.followScroll);
      this.$window.addEventListener('resize', this.followScroll);
    }
  }

  destroy() {
    while (this.$toolbar.firstChild) {
      this.$toolbar.removeChild(this.$toolbar.firstChild);
    }

    if (this.options.followingToolbar) {
      this.$window.removeEventListener('scroll', this.followScroll);
      this.$window.removeEventListener('resize', this.followScroll);
    }
  }

  followScroll() {
    if (this.$editor.classList.contains('fullscreen')) {
      return false;
    }

    const editorHeight = this.$editor.offsetHeight;
    const editorWidth = this.$editor.offsetWidth;
    const toolbarHeight = this.$toolbar.offsetHeight;
    const statusbarHeight = this.$statusbar.offsetHeight;

    let otherBarHeight = 0;
    if (this.options.otherStaticBar) {
      otherBarHeight = document.querySelector(this.options.otherStaticBar).offsetHeight;
    }

    const currentOffset = this.$document.documentElement.scrollTop || this.$document.body.scrollTop;
    const editorOffsetTop = this.$editor.getBoundingClientRect().top + currentOffset;
    const editorOffsetBottom = editorOffsetTop + editorHeight;
    const activateOffset = editorOffsetTop - otherBarHeight;
    const deactivateOffsetBottom = editorOffsetBottom - otherBarHeight - toolbarHeight - statusbarHeight;

    if (!this.isFollowing &&
      (currentOffset > activateOffset) && (currentOffset < deactivateOffsetBottom - toolbarHeight)) {
      this.isFollowing = true;
      this.$editable.style.marginTop = `${this.$toolbar.offsetHeight}px`;
      this.$toolbar.style.position = 'fixed';
      this.$toolbar.style.top = `${otherBarHeight}px`;
      this.$toolbar.style.width = `${editorWidth}px`;
      this.$toolbar.style.zIndex = 1000;
    } else if (this.isFollowing &&
      ((currentOffset < activateOffset) || (currentOffset > deactivateOffsetBottom))) {
      this.isFollowing = false;
      this.$toolbar.style.position = 'relative';
      this.$toolbar.style.top = '0';
      this.$toolbar.style.width = '100%';
      this.$toolbar.style.zIndex = 'auto';
      this.$editable.style.marginTop = '';
    }
  }

  changeContainer(isFullscreen) {
    if (isFullscreen) {
      this.$editor.insertBefore(this.$toolbar, this.$editor.firstChild);
    } else {
      if (this.options.toolbarContainer) {
        this.options.toolbarContainer.appendChild(this.$toolbar);
      }
    }
    if (this.options.followingToolbar) {
      this.followScroll();
    }
  }

  updateFullscreen(isFullscreen) {
    this.ui.toggleBtnActive(this.$toolbar.querySelector('.btn-fullscreen'), isFullscreen);

    this.changeContainer(isFullscreen);
  }

  updateCodeview(isCodeview) {
    this.ui.toggleBtnActive(this.$toolbar.querySelector('.btn-codeview'), isCodeview);
    if (isCodeview) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  activate(isIncludeCodeview) {
    let buttons = this.$toolbar.querySelectorAll('button');
    if (!isIncludeCodeview) {
      buttons = Array.from(buttons).filter(btn => !btn.classList.contains('note-codeview-keep'));
    }
    this.ui.toggleBtn(buttons, true);
  }

  deactivate(isIncludeCodeview) {
    let buttons = this.$toolbar.querySelectorAll('button');
    if (!isIncludeCodeview) {
      buttons = Array.from(buttons).filter(btn => !btn.classList.contains('note-codeview-keep'));
    }
    this.ui.toggleBtn(buttons, false);
  }
}
