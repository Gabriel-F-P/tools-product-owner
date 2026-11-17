/*!
 * Logo animada da TNA Inovações. Arquivo único, sem dependências e sem fontes externas.
 *
 * Uso:
 *   Carregue este arquivo na página com uma tag script e escreva:
 *   <tna-logo style="width:320px"></tna-logo>
 *
 * Atributos:
 *   variant     full | symbol               (padrão: full)
 *   animate     hover | loop | none         (padrão: hover)
 *   intro       presente = a marca se desenha ao aparecer
 *   descriptor  pt | en | none              (padrão: pt)
 *   accent      cor dos degraus             (padrão: #77B800)
 *   ink         cor das fitas e do nome     (padrão: cor do texto ao redor)
 *   speed       segundos por volta          (padrão: 2.8)
 *
 * Também aceita as variáveis CSS --tna-accent e --tna-ink.
 * Métodos: el.start(), el.stop(), el.replayIntro()
 * SVG estático: TnaLogo.svg({variant, descriptor, accent, ink})
 */
(function () {
  if (typeof window === 'undefined' || !window.customElements || customElements.get('tna-logo')) return;

  var WORD = 'M420.6 192V81.3H374.9V51.2H503V81.3H457.3V192ZM519.8 192V51.2H552.3L603.6 116.6Q605 118.2 607.4 121.3Q609.7 124.4 612 127.5Q614.3 130.7 615.3 132.6L616.3 132.3Q616.3 127.8 616.3 123.6Q616.3 119.4 616.3 116.6V51.2H650.3V192H617.9L563.6 123.1Q561 119.8 558.6 116.4Q556.2 112.9 554.8 110.6L553.8 110.8Q553.8 114.1 553.8 117.5Q553.8 120.9 553.8 123.1V192ZM663.4 192 716.2 51.2H760.3L813.2 192H774.1L765.6 167.6H709.5L701.1 192ZM718.3 140.1H756.6L746.6 110.4Q745.8 108.2 744.6 104.8Q743.5 101.4 742.4 97.6Q741.2 93.8 740.2 89.9Q739.2 86 738.2 83.1H736.7Q735.9 87 734.4 92Q732.8 96.9 731.3 101.8Q729.8 106.7 728.5 110.4Z';
  var DESC = { pt: 'M374.9 248V245.6H379.4V229.1H374.9V226.7H386.8V229.1H382.3V245.6H386.8V248ZM438.4 226.7H441V248H437.8L429.4 231H429.4V248H426.8V226.7H429.9L438.3 243.9H438.4ZM486.9 226.2Q490.9 226.2 493 229.1Q495.2 232.1 495.2 237.4Q495.2 242.7 493 245.6Q490.9 248.5 486.9 248.5Q483 248.5 480.8 245.6Q478.6 242.7 478.6 237.4Q478.6 232.1 480.8 229.1Q483 226.2 486.9 226.2ZM486.9 228.7Q484.4 228.7 483 231Q481.6 233.3 481.6 237.4Q481.6 241.4 483 243.7Q484.4 246 486.9 246Q489.5 246 490.9 243.7Q492.3 241.4 492.3 237.4Q492.3 233.3 490.9 231Q489.5 228.7 486.9 228.7ZM548.5 226.7 541.6 248H538.3L531.5 226.7H534.5L540 245.1L545.5 226.7ZM598.6 248 596.7 241.6H589.3L587.4 248H584.5L591.2 226.7H594.8L601.5 248ZM590 239.2H596L593 229.2ZM654.2 232.6H651.3Q650.8 230.9 649.8 229.8Q648.9 228.7 646.8 228.7Q644.8 228.7 643.6 229.8Q642.3 230.9 641.8 232.9Q641.2 234.8 641.2 237.4Q641.2 241.7 642.7 243.9Q644.1 246 646.8 246Q649 246 650 244.7Q651 243.4 651.5 240.8H654.4Q654 244.6 651.9 246.6Q649.9 248.5 646.8 248.5Q644 248.5 642.1 247.2Q640.2 245.8 639.3 243.3Q638.3 240.8 638.3 237.4Q638.3 235.1 638.7 233.1Q639.2 231 640.2 229.5Q641.2 228 642.9 227.1Q644.5 226.2 646.9 226.2Q649 226.2 650.5 227Q652 227.9 652.9 229.3Q653.9 230.8 654.2 232.6ZM645.4 250.6 646.9 247.6H648.2L647 249.9Q647.4 249.8 647.9 249.8Q648.7 249.8 649.4 250.3Q650.1 250.8 650.1 251.9Q650.1 253.1 649.2 253.8Q648.2 254.5 646.7 254.5Q646 254.5 645.3 254.3Q644.6 254.1 644.1 253.8L644.7 252.5Q645.1 252.7 645.7 252.8Q646.2 253 646.8 253Q647.3 253 647.8 252.8Q648.3 252.5 648.3 251.9Q648.3 251.5 647.9 251.3Q647.6 251.1 647.2 251.1Q646.6 251.1 646.1 251.4ZM699.1 226.2Q703 226.2 705.2 229.1Q707.4 232.1 707.4 237.4Q707.4 242.7 705.2 245.6Q703 248.5 699.1 248.5Q695.2 248.5 693 245.6Q690.8 242.7 690.8 237.4Q690.8 232.1 693 229.1Q695.2 226.2 699.1 226.2ZM699.1 228.7Q696.6 228.7 695.2 231Q693.8 233.3 693.8 237.4Q693.8 241.4 695.2 243.7Q696.6 246 699.1 246Q701.6 246 703 243.7Q704.4 241.4 704.4 237.4Q704.4 233.3 703 231Q701.6 228.7 699.1 228.7ZM702.1 220.8H703.9Q703.4 224 701.1 224Q700.6 224 699.8 223.6Q699.1 223.3 698.3 223Q697.6 222.7 697.1 222.7Q696.4 222.7 696.1 223.9H694.3Q694.8 220.8 696.9 220.8Q697.5 220.8 698.3 221.1Q699 221.4 699.7 221.7Q700.5 222 701 222Q701.8 222 702.1 220.8ZM758.1 238.3H749V245.5H759.2V248H746.2V226.7H758.6V229.2H749V235.8H758.1ZM812.6 232.8H809.8Q809.8 231 808.7 229.8Q807.6 228.6 805.4 228.6Q803.2 228.6 802 229.6Q800.9 230.6 800.9 232Q800.9 234.5 803.8 235.2L808.1 236.2Q810.6 236.8 811.9 238.3Q813.2 239.9 813.2 241.9Q813.2 244 812.2 245.5Q811.3 247 809.6 247.8Q807.9 248.5 805.6 248.5Q801.7 248.5 799.6 246.6Q797.5 244.6 797.4 241.2H800.2Q800.2 243.3 801.6 244.7Q803 246 805.7 246Q808.1 246 809.2 245Q810.3 243.9 810.3 242.3Q810.3 240.9 809.6 240.1Q808.8 239.2 807.2 238.9L802.8 237.8Q800.5 237.3 799.2 235.9Q798 234.5 798 232.3Q798 230.5 798.9 229.1Q799.8 227.7 801.5 227Q803.2 226.2 805.5 226.2Q807.7 226.2 809.3 227Q810.9 227.8 811.7 229.3Q812.6 230.7 812.6 232.4Z', en: 'M374.9 248V245.6H379.4V229.1H374.9V226.7H386.8V229.1H382.3V245.6H386.8V248ZM432.6 226.7H435.2V248H432L423.6 231H423.6V248H421V226.7H424.1L432.6 243.9H432.6ZM479.8 226.7H482.5V248H479.3L470.9 231H470.9V248H468.2V226.7H471.3L479.8 243.9H479.8ZM522.6 226.2Q526.5 226.2 528.7 229.1Q530.9 232.1 530.9 237.4Q530.9 242.7 528.7 245.6Q526.5 248.5 522.6 248.5Q518.7 248.5 516.5 245.6Q514.3 242.7 514.3 237.4Q514.3 232.1 516.5 229.1Q518.7 226.2 522.6 226.2ZM522.6 228.7Q520.1 228.7 518.7 231Q517.3 233.3 517.3 237.4Q517.3 241.4 518.7 243.7Q520.1 246 522.6 246Q525.1 246 526.5 243.7Q527.9 241.4 527.9 237.4Q527.9 233.3 526.5 231Q525.1 228.7 522.6 228.7ZM578.4 226.7 571.5 248H568.2L561.3 226.7H564.3L569.9 245.1L575.4 226.7ZM622.6 248 620.8 241.6H613.4L611.5 248H608.6L615.3 226.7H618.9L625.6 248ZM614.1 239.2H620.1L617.1 229.2ZM672.2 229.2H665.8V248H662.9V229.2H656.5V226.7H672.2ZM705.6 248V245.6H710.2V229.1H705.6V226.7H717.6V229.1H713V245.6H717.6V248ZM758.8 226.2Q762.8 226.2 765 229.1Q767.1 232.1 767.1 237.4Q767.1 242.7 765 245.6Q762.8 248.5 758.8 248.5Q754.9 248.5 752.7 245.6Q750.5 242.7 750.5 237.4Q750.5 232.1 752.7 229.1Q754.9 226.2 758.8 226.2ZM758.8 228.7Q756.3 228.7 754.9 231Q753.5 233.3 753.5 237.4Q753.5 241.4 754.9 243.7Q756.3 246 758.8 246Q761.4 246 762.8 243.7Q764.2 241.4 764.2 237.4Q764.2 233.3 762.8 231Q761.4 228.7 758.8 228.7ZM810.6 226.7H813.2V248H810L801.6 231H801.6V248H799V226.7H802.1L810.5 243.9H810.6Z' };
  var VIEW = { symbol: '0 0 320 320', full: '0 0 820 320' };

  /* Hélice: duas fitas em onda, eixo a 45°, exatamente quatro degraus por lobo */
  var CX = 160, CY = 160, HALF = 160, AMP = 65, PER = 440, SW = 25, RW = 15, CUT = 16, ROOT = Math.SQRT1_2;
  var RUNGS = [-67.5, -22.5, 22.5, 67.5], RWIN = 110, TAU = Math.PI * 2, W = TAU / PER;

  function n(v) { return Math.round(v * 100) / 100; }
  function pt(s, d, ft) {
    var y = d * AMP * Math.sin(W * s + ft);
    return [CX + s * ROOT - y * ROOT, CY + s * ROOT + y * ROOT];
  }
  function tan(s, d, ft) {
    var y = d * AMP * W * Math.cos(W * s + ft);
    return [ROOT - y * ROOT, ROOT + y * ROOT];
  }
  function curve(d, a, b, ft) {
    var k = Math.max(1, Math.ceil((b - a) / 44)), h = (b - a) / k, p = pt(a, d, ft), out = 'M' + n(p[0]) + ' ' + n(p[1]);
    for (var i = 0; i < k; i++) {
      var s0 = a + i * h, s1 = s0 + h, p0 = pt(s0, d, ft), p1 = pt(s1, d, ft), t0 = tan(s0, d, ft), t1 = tan(s1, d, ft);
      out += 'C' + n(p0[0] + t0[0] * h / 3) + ' ' + n(p0[1] + t0[1] * h / 3) + ' ' + n(p1[0] - t1[0] * h / 3) + ' ' + n(p1[1] - t1[1] * h / 3) + ' ' + n(p1[0]) + ' ' + n(p1[1]);
    }
    return out;
  }
  function par(k) { return ((k % 2) + 2) % 2; }

  /* Desenha o símbolo. ph gira a hélice; reveal (0 a 1) faz a montagem. As fitas são cortadas de verdade: funciona em qualquer fundo. */
  function symbol(ph, reveal, ink, accent) {
    var ft = Math.PI / 2 + ph, base = Math.round(ft / Math.PI), out = '', limit = -HALF + HALF * 2 * Math.min(1, reveal / 0.7), k, i;
    for (k = base - 4; k <= base + 4; k++) {
      var m = ((k + 0.5) * Math.PI - ft) / W;
      for (i = 0; i < RUNGS.length; i++) {
        var r = m + RUNGS[i], al = Math.max(0, Math.min(1, (RWIN - Math.abs(r)) / 15)) * Math.max(0, Math.min(1, (reveal - 0.55 - i * 0.08) / 0.15));
        if (al <= 0) continue;
        var a = pt(r, 1, ft), b = pt(r, -1, ft);
        out += '<path d="M' + n(a[0]) + ' ' + n(a[1]) + 'L' + n(b[0]) + ' ' + n(b[1]) + '" fill="none" stroke="' + accent + '" stroke-width="' + RW + '"' + (al < 1 ? ' opacity="' + n(al) + '"' : '') + '/>';
      }
    }
    [-1, 1].forEach(function (d) {
      var cuts = [];
      for (k = base - 5; k <= base + 5; k++) {
        var x = (k * Math.PI - ft) / W;
        if (Math.abs(x) < HALF + CUT && (par(k) ? 1 : -1) !== d) cuts.push(x);
      }
      cuts.sort(function (p, q) { return p - q; });
      var from = -HALF;
      cuts.concat([Infinity]).forEach(function (x) {
        var to = Math.min(limit, x === Infinity ? HALF : x - CUT);
        if (to > from + 0.5) out += '<path d="' + curve(d, from, to, ft) + '" fill="none" stroke="' + ink + '" stroke-width="' + SW + '"/>';
        if (x !== Infinity) from = Math.max(from, x + CUT);
      });
      [-HALF, HALF].forEach(function (e) {
        if (e > limit) return;
        if (cuts.some(function (x) { return Math.abs(x - e) < CUT; })) return;
        var c = pt(e, d, ft);
        out += '<circle cx="' + n(c[0]) + '" cy="' + n(c[1]) + '" r="' + SW / 2 + '" fill="' + ink + '"/>';
      });
    });
    return out;
  }
  function word(variant, descriptor, ink, alpha) {
    if (variant === 'symbol') return '';
    var d = DESC[descriptor];
    /* Centraliza o texto no eixo do símbolo (y = 160): só TNA vai de 51 a 192; com descritor, até a linha de base em 248 */
    var dy = d ? 10 : 38.4;
    return '<g transform="translate(0 ' + dy + ')"' + (alpha < 1 ? ' opacity="' + n(alpha) + '"' : '') + ' fill="' + ink + '"><path d="' + WORD + '"/>' + (d ? '<path d="' + d + '"/>' : '') + '</g>';
  }

  var CSS = ':host{display:inline-block;width:240px;max-width:100%;line-height:0;vertical-align:middle}:host([variant="symbol"]){width:64px}svg{display:block;width:100%;height:auto;overflow:visible}';

  function TnaLogo() { return Reflect.construct(HTMLElement, [], TnaLogo); }
  TnaLogo.prototype = Object.create(HTMLElement.prototype);
  TnaLogo.prototype.constructor = TnaLogo;
  Object.setPrototypeOf(TnaLogo, HTMLElement);
  Object.defineProperty(TnaLogo, 'observedAttributes', { get: function () { return ['variant', 'animate', 'descriptor', 'accent', 'ink', 'speed']; } });

  var P = TnaLogo.prototype;
  P.connectedCallback = function () {
    if (!this.shadowRoot) {
      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>' + CSS + '</style><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TNA Inovações"></svg>';
      this._svg = root.querySelector('svg');
      var self = this;
      this._on = function () { self._hover = true; if (self._mode() === 'hover') self._run(); };
      this._off = function () { self._hover = false; };
      this.addEventListener('pointerenter', this._on);
      this.addEventListener('pointerleave', this._off);
      this.addEventListener('focusin', this._on);
      this.addEventListener('focusout', this._off);
    }
    this._ph = 0; this._reveal = 1; this._v = 0;
    this._still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.hasAttribute('intro') && !this._still) this.replayIntro(); else this._draw();
    if (this._mode() === 'loop') this._run();
  };
  P.disconnectedCallback = function () { cancelAnimationFrame(this._raf); this._raf = 0; };
  P.attributeChangedCallback = function () {
    if (!this._svg) return;
    if (this._mode() === 'loop') this._run();
    this._draw();
  };
  P._mode = function () { return this.getAttribute('animate') || 'hover'; };
  P._draw = function () {
    var ink = this.getAttribute('ink') || 'var(--tna-ink,currentColor)';
    var accent = this.getAttribute('accent') || 'var(--tna-accent,#77B800)';
    var variant = this.getAttribute('variant') === 'symbol' ? 'symbol' : 'full';
    var alpha = Math.max(0, Math.min(1, (this._reveal - 0.45) / 0.4));
    this._svg.setAttribute('viewBox', VIEW[variant]);
    this._svg.innerHTML = symbol(this._ph, this._reveal, ink, accent) + word(variant, this.getAttribute('descriptor') || 'pt', ink, alpha);
  };
  P._run = function () {
    if (this._raf || this._still || !this.isConnected) return;
    var self = this, last = performance.now();
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var turn = TAU / (parseFloat(self.getAttribute('speed')) || 2.8), loop = self._forced || self._mode() === 'loop', on = loop || self._hover, busy = false;
      if (self._reveal < 1) { self._reveal = Math.min(1, self._reveal + dt / 1.3); busy = true; }
      if (on || self._v > 0 || self._ph > 0) {
        self._v += ((on ? turn : Math.max(turn * 0.45, self._v * 0.97)) - self._v) * Math.min(1, dt * 7);
        self._ph += self._v * dt;
        if (on) self._target = null; else if (self._target == null) self._target = Math.ceil(self._ph / TAU - 1e-6) * TAU;
        if (!on && self._ph >= self._target) { self._ph = 0; self._v = 0; self._target = null; } else busy = true;
        if (self._ph >= TAU * 50) self._ph -= TAU * 50;
      }
      self._draw();
      self._raf = busy ? requestAnimationFrame(tick) : 0;
    }
    this._raf = requestAnimationFrame(tick);
  };
  P.start = function () { this._forced = true; this._run(); };
  P.stop = function () { this._forced = false; };
  P.replayIntro = function () {
    if (this._still) return;
    this._reveal = 0; this._draw(); this._run();
  };

  TnaLogo.svg = function (o) {
    o = o || {};
    var variant = o.variant === 'symbol' ? 'symbol' : 'full', ink = o.ink || '#111214', accent = o.accent || '#77B800';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + VIEW[variant] + '" role="img" aria-label="TNA Inovações">' + symbol(0, 1, ink, accent) + word(variant, o.descriptor || 'pt', ink, 1) + '</svg>';
  };

  window.TnaLogo = TnaLogo;
  customElements.define('tna-logo', TnaLogo);
})();

