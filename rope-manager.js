// @ts-nocheck
/**
 * RopeManager for div-based infinite canvas
 *
 * Features:
 * - single canvas rendering layer
 * - world-space ropes
 * - camera transform support
 * - endpoint binding via getter functions
 * - viewport culling
 * - sleep / wake
 * - low allocation update loop
 *
 * Usage:
 *   const manager = new RopeManager({
 *     canvas,
 *     getCamera: () => ({ x: camera.x, y: camera.y, zoom: camera.zoom }),
 *   })
 *
 *   manager.addRope({
 *     id: 'r1',
 *     from: () => ({ x: 100, y: 100 }),
 *     to: () => ({ x: 600, y: 300 }),
 *   })
 *
 *   manager.start()
 */

class RopePoint {
  constructor(x, y, restLength, mass = 1, damping = 0.98, fixed = false) {
    this.x = x;
    this.y = y;
    this.oldX = x;
    this.oldY = y;
    this.restLength = restLength;
    this.mass = mass;
    this.damping = damping;
    this.fixed = fixed;
  }
}

class RopeInstance {
  constructor(options) {
    this.id = options.id;

    this.from = options.from;
    this.to = options.to;

    this.segmentLength = options.segmentLength ?? 24;
    this.solverIterations = options.solverIterations ?? 6;
    this.mass = options.mass ?? 1;
    this.damping = options.damping ?? 0.985;
    this.gravityX = options.gravityX ?? 0;
    this.gravityY = options.gravityY ?? 1200;

    this.lineWidth = options.lineWidth ?? 2;
    this.strokeStyle = options.strokeStyle ?? "#fff";
    this.slack = options.slack ?? 0;

    this.points = [];
    this.sleeping = false;
    this.sleepCounter = 0;
    this.prevDt = 1 / 60;
    this.bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    this._lastFromX = 0;
    this._lastFromY = 0;
    this._lastToX = 0;
    this._lastToY = 0;

    this._buildFromEndpoints(true);
  }

  static lerp(a, b, t) {
    return a + (b - a) * t;
  }

  static distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.hypot(dx, dy);
  }

  _buildFromEndpoints(forceResetOld = false) {
    const start = this.from();
    const end = this.to();

    this._lastFromX = start.x;
    this._lastFromY = start.y;
    this._lastToX = end.x;
    this._lastToY = end.y;

    const totalLen = RopeInstance.distance(start, end);
    const effectiveLen = Math.max(1, totalLen + this.slack);
    const count = Math.max(2, Math.ceil(effectiveLen / this.segmentLength) + 1);
    const restLength = effectiveLen / (count - 1);

    this.points.length = 0;

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = RopeInstance.lerp(start.x, end.x, t);
      const y = RopeInstance.lerp(start.y, end.y, t);
      const fixed = i === 0 || i === count - 1;
      const p = new RopePoint(x, y, restLength, this.mass, this.damping, fixed);

      if (forceResetOld) {
        p.oldX = x;
        p.oldY = y;
      }

      this.points.push(p);
    }

    this._updateBounds();
    this.sleeping = false;
    this.sleepCounter = 0;
  }

  _syncEndpoints() {
    const start = this.from();
    const end = this.to();

    const moved =
      start.x !== this._lastFromX ||
      start.y !== this._lastFromY ||
      end.x !== this._lastToX ||
      end.y !== this._lastToY;

    if (!moved) return false;

    this._lastFromX = start.x;
    this._lastFromY = start.y;
    this._lastToX = end.x;
    this._lastToY = end.y;

    const pointCount = this.points.length;
    const newDistance = Math.hypot(end.x - start.x, end.y - start.y);
    const currentRest = this.points[0]?.restLength ?? this.segmentLength;
    const desiredCount = Math.max(2, Math.ceil((newDistance + this.slack) / currentRest) + 1);

    // If rope length changed too much, rebuild
    if (Math.abs(desiredCount - pointCount) > 2) {
      this._buildFromEndpoints(false);
      return true;
    }

    const first = this.points[0];
    const last = this.points[this.points.length - 1];

    first.x = start.x;
    first.y = start.y;
    first.oldX = start.x;
    first.oldY = start.y;

    last.x = end.x;
    last.y = end.y;
    last.oldX = end.x;
    last.oldY = end.y;

    this.sleeping = false;
    this.sleepCounter = 0;
    return true;
  }

  _updateBounds() {
    const pts = this.points;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = this.lineWidth + 20;
    this.bounds.minX = minX - pad;
    this.bounds.minY = minY - pad;
    this.bounds.maxX = maxX + pad;
    this.bounds.maxY = maxY + pad;
  }

  intersectsWorldRect(rect) {
    return !(
      this.bounds.maxX < rect.minX ||
      this.bounds.minX > rect.maxX ||
      this.bounds.maxY < rect.minY ||
      this.bounds.minY > rect.maxY
    );
  }

  wake() {
    this.sleeping = false;
    this.sleepCounter = 0;
  }

  setStyle(style) {
    if (style.strokeStyle !== undefined) this.strokeStyle = style.strokeStyle;
    if (style.lineWidth !== undefined) this.lineWidth = style.lineWidth;
  }

  update(dt, isVisible) {
    this._syncEndpoints();

    if (!isVisible) {
      this._updateBounds();
      return;
    }

    if (dt <= 0) return;

    const pts = this.points;
    const prevDt = this.prevDt || dt;
    const timeCorrection = prevDt > 0 ? dt / prevDt : 1;
    const dtSq = dt * dt;

    let energy = 0;

    // integrate interior points
    if (!this.sleeping) {
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i];
        if (p.fixed) continue;

        const vx = (p.x - p.oldX) * p.damping * timeCorrection;
        const vy = (p.y - p.oldY) * p.damping * timeCorrection;

        p.oldX = p.x;
        p.oldY = p.y;

        p.x += vx + this.gravityX * dtSq;
        p.y += vy + (this.gravityY + p.mass) * dtSq;

        energy += Math.abs(vx) + Math.abs(vy);
      }

      // constraints: solve each segment once
      for (let iter = 0; iter < this.solverIterations; iter++) {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];

          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const distSq = dx * dx + dy * dy;
          if (distSq === 0) continue;

          const dist = Math.sqrt(distSq);
          const rest = a.restLength;
          const diff = (dist - rest) / dist;

          const ox = dx * diff * 0.5;
          const oy = dy * diff * 0.5;

          if (!a.fixed) {
            a.x += ox;
            a.y += oy;
          }

          if (!b.fixed) {
            b.x -= ox;
            b.y -= oy;
          }
        }

        // re-pin endpoints after each iteration
        const start = this.from();
        const end = this.to();

        const first = pts[0];
        const last = pts[pts.length - 1];

        first.x = start.x;
        first.y = start.y;
        first.oldX = start.x;
        first.oldY = start.y;

        last.x = end.x;
        last.y = end.y;
        last.oldX = end.x;
        last.oldY = end.y;
      }

      if (energy < 0.02) {
        this.sleepCounter++;
        if (this.sleepCounter > 20) {
          this.sleeping = true;
        }
      } else {
        this.sleepCounter = 0;
        this.sleeping = false;
      }
    }

    this.prevDt = dt;
    this._updateBounds();
  }

  draw(ctx) {
    const pts = this.points;
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    // Straight polyline; if you want smoother look, switch to quadratic smoothing
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }

    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  drawSmooth(ctx) {
    const pts = this.points;
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) * 0.5;
      const cy = (pts[i].y + pts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, cx, cy);
    }

    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);

    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.strokeStyle;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

class RopeManager {
  constructor(options) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext("2d");
    this.getCamera =
      options.getCamera ||
      (() => ({
        x: 0,
        y: 0,
        zoom: 1
      }));

    this.useDevicePixelRatio = options.useDevicePixelRatio ?? true;
    this.autoResize = options.autoResize ?? true;
    this.clearEachFrame = options.clearEachFrame ?? true;
    this.renderMode = options.renderMode ?? "smooth"; // "line" | "smooth"
    this.visibilityMargin = options.visibilityMargin ?? 200;
    this.maxDt = options.maxDt ?? 1 / 30;
    this.minZoomRender = options.minZoomRender ?? 0.05;
    this.background = options.background ?? null;

    this.ropes = new Map();
    this.running = false;
    this.lastTime = 0;
    this.rafId = 0;

    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);

    if (this.autoResize) {
      this._resize();
      window.addEventListener("resize", this._resize);
    }
  }

  _resize() {
    const dpr = this.useDevicePixelRatio ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || window.innerWidth));
    const height = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || window.innerHeight));

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this._resize);
    this.ropes.clear();
  }

  addRope(options) {
    if (!options?.id) {
      throw new Error("addRope: id is required");
    }

    const rope = new RopeInstance(options);
    this.ropes.set(options.id, rope);
    return rope;
  }

  removeRope(id) {
    this.ropes.delete(id);
  }

  getRope(id) {
    return this.ropes.get(id);
  }

  clear() {
    this.ropes.clear();
  }

  wakeAll() {
    for (const rope of this.ropes.values()) {
      rope.wake();
    }
  }

  setRenderMode(mode) {
    this.renderMode = mode;
  }

  getWorldViewport(camera = this.getCamera()) {
    const zoom = camera.zoom || 1;
    const halfW = this.viewportWidth / zoom;
    const halfH = this.viewportHeight / zoom;

    return {
      minX: camera.x - this.visibilityMargin / zoom,
      minY: camera.y - this.visibilityMargin / zoom,
      maxX: camera.x + halfW + this.visibilityMargin / zoom,
      maxY: camera.y + halfH + this.visibilityMargin / zoom
    };
  }

  update(dt) {
    const camera = this.getCamera();
    const worldRect = this.getWorldViewport(camera);

    for (const rope of this.ropes.values()) {
      const visible = rope.intersectsWorldRect(worldRect);
      rope.update(dt, visible);
    }
  }

  render() {
    const ctx = this.ctx;
    const camera = this.getCamera();
    const zoom = camera.zoom || 1;

    if (zoom < this.minZoomRender) return;

    if (this.clearEachFrame) {
      ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    if (this.background) {
      ctx.save();
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
      ctx.restore();
    }

    const worldRect = this.getWorldViewport(camera);

    ctx.save();

    // world -> screen transform
    // screenX = (worldX - camera.x) * zoom
    // screenY = (worldY - camera.y) * zoom
    ctx.translate(-camera.x * zoom, -camera.y * zoom);
    ctx.scale(zoom, zoom);

    for (const rope of this.ropes.values()) {
      if (!rope.intersectsWorldRect(worldRect)) continue;

      if (this.renderMode === "line") {
        rope.draw(ctx);
      } else {
        rope.drawSmooth(ctx);
      }
    }

    ctx.restore();
  }

  tick(dt) {
    this.update(dt);
    this.render();
  }

  _frame(now) {
    if (!this.running) return;

    if (!this.lastTime) {
      this.lastTime = now;
    }

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (dt > this.maxDt) dt = this.maxDt;
    if (dt < 0) dt = 1 / 60;

    this.tick(dt);
    this.rafId = requestAnimationFrame(this._frame);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}

export { RopeManager };
