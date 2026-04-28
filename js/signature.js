/**
 * signature.js — Digital signature canvas for PDF export
 */

const SignatureService = {
  _canvas: null,
  _ctx: null,
  _drawing: false,
  _hasStrokes: false,

  init() {
    this._canvas = document.getElementById('signature-canvas');
    if (!this._canvas) return;
    this._ctx = this._canvas.getContext('2d');
    
    // Use ResizeObserver for accurate sizing
    const resizeObserver = new ResizeObserver(() => {
      this._setupCanvas();
    });
    resizeObserver.observe(this._canvas.parentElement || this._canvas);
    
    this._bindEvents();
  },

  _setupCanvas() {
    // Only resize if dimensions actually exist
    const rect = this._canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    // Save current strokes if resizing (not implemented, but good practice to clear safely)
    if (this._hasStrokes) return; // Don't wipe if user already drew something

    const dpr = window.devicePixelRatio || 1;
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.scale(dpr, dpr);
    this._ctx.lineWidth = 2.5;
    this._ctx.lineCap = 'round';
    this._ctx.lineJoin = 'round';
    this._ctx.strokeStyle = '#1A1A2E';
  },

  _bindEvents() {
    const canvas = this._canvas;

    canvas.addEventListener('pointerdown', (e) => {
      this._drawing = true;
      this._hasStrokes = true;
      const { x, y } = this._getPos(e);
      this._ctx.beginPath();
      this._ctx.moveTo(x, y);
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this._drawing) return;
      const { x, y } = this._getPos(e);
      this._ctx.lineTo(x, y);
      this._ctx.stroke();
    });

    canvas.addEventListener('pointerup', () => {
      this._drawing = false;
    });

    canvas.addEventListener('pointercancel', () => {
      this._drawing = false;
    });
  },

  _getPos(e) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  },

  clear() {
    if (!this._ctx) return;
    const rect = this._canvas.getBoundingClientRect();
    this._ctx.clearRect(0, 0, rect.width, rect.height);
    this._hasStrokes = false;
  },

  isEmpty() {
    return !this._hasStrokes;
  },

  getDataURL() {
    if (!this._canvas || !this._hasStrokes) return null;
    // Create a temporary canvas at actual pixel size
    const tempCanvas = document.createElement('canvas');
    const rect = this._canvas.getBoundingClientRect();
    tempCanvas.width = rect.width * 2;
    tempCanvas.height = rect.height * 2;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this._canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    return tempCanvas.toDataURL('image/png');
  },

  show(callback) {
    this.clear();
    const overlay = document.getElementById('modal-signature-overlay');
    overlay?.classList.add('active');

    // Re-setup canvas after modal is visible
    setTimeout(() => {
      this._setupCanvas();
    }, 350);

    // Store callback for confirm button
    this._onConfirm = callback;
  },

  hide() {
    document.getElementById('modal-signature-overlay')?.classList.remove('active');
  }
};
