import { CONFIG, type AppState } from "./config";

export class Particle {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  // Track position in continuous noise space (doesn't wrap)
  noiseX: number;
  noiseY: number;
  seed: number;
  anchorX: number;
  anchorY: number;
  freq: number;
  phase: number;
  radius: number;
  waveOffset: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    // Initialize noise space at same position
    this.noiseX = x;
    this.noiseY = y;
    this.seed = Math.random() * 10000;
    this.anchorX = x;
    this.anchorY = y;
    this.freq = 0.3 + Math.random() * 0.7;
    this.phase = Math.random() * Math.PI * 2;
    this.radius = 20 + Math.random() * 60;
    this.waveOffset = Math.random() * Math.PI * 2;
  }

  update(dt: number, q5: any, state: AppState) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const speed = CONFIG.speed;
    const t = state.time;
    const w = state.width;
    const h = state.height;

    switch (CONFIG.motion) {
      case "vectorfield": {
        // Vector field using perlin noise in continuous noise space
        const scale = CONFIG.vectorFieldScale;
        const timeScale = CONFIG.vectorFieldTimeScale;

        // Sample noise from continuous noise space (not wrapped position)
        const nx = q5.noise(this.noiseX * scale, this.noiseY * scale, t * timeScale * 0.1);
        const ny = q5.noise(
          this.noiseX * scale + 1000,
          this.noiseY * scale,
          t * timeScale * 0.1 + 1000,
        );

        // Convert noise (-1 to 1) to angle, then to velocity
        const angle = nx * Math.PI * 2;
        this.vx = Math.cos(angle) * speed * 2;
        this.vy = Math.sin(angle) * speed * 2;

        // Add curl noise for more interesting patterns
        if (CONFIG.curlNoiseAmount > 0) {
          const cx = q5.noise(
            this.noiseX * scale + 2000,
            this.noiseY * scale,
            t * timeScale * 0.1 + 2000,
          );
          this.vx += -ny * CONFIG.curlNoiseAmount;
          this.vy += cx * CONFIG.curlNoiseAmount;
        }

        // Add brownian motion
        if (CONFIG.brownianAmount > 0) {
          this.vx += (Math.random() - 0.5) * CONFIG.brownianAmount;
          this.vy += (Math.random() - 0.5) * CONFIG.brownianAmount;
        }
        break;
      }
      case "perlin": {
        const nx = q5.noise(this.seed + t * 0.2 * speed);
        const ny = q5.noise(this.seed + 1000 + t * 0.2 * speed);
        this.vx = (nx - 0.5) * 2 * speed * 2;
        this.vy = (ny - 0.5) * 2 * speed * 2;
        break;
      }
      case "curl": {
        // Curl noise approximation - particles spiral around noise points
        const scale = CONFIG.vectorFieldScale;
        const eps = 1;
        const n1 = q5.noise(this.noiseX + eps, this.noiseY);
        const n2 = q5.noise(this.noiseX - eps, this.noiseY);
        const n3 = q5.noise(this.noiseX, this.noiseY + eps);
        const n4 = q5.noise(this.noiseX, this.noiseY - eps);
        this.vx = (n3 - n4) * speed * 3;
        this.vy = -(n1 - n2) * speed * 3;
        break;
      }
      case "brownian": {
        this.vx += (Math.random() - 0.5) * speed * 2;
        this.vy += (Math.random() - 0.5) * speed * 2;
        this.vx *= 0.95;
        this.vy *= 0.95;
        break;
      }
      case "orbit": {
        this.x =
          this.anchorX +
          Math.cos(t * this.freq * CONFIG.orbitSpeed + this.phase) *
            this.radius;
        this.y =
          this.anchorY +
          Math.sin(t * this.freq * CONFIG.orbitSpeed * 1.3 + this.phase) *
            this.radius;
        this.applyBounds(state);
        return;
      }
      case "wave": {
        // Wave motion - particles flow in sine waves
        const waveX = Math.sin(this.noiseY * 0.01 + t * speed + this.waveOffset);
        const waveY = Math.cos(this.noiseX * 0.01 + t * speed + this.waveOffset);
        this.vx = waveX * speed;
        this.vy = waveY * speed;
        break;
      }
      case "boid": {
        // Boid flocking behavior
        this.applyBoidRules(state.particles, state);
        break;
      }
      case "none":
      default:
        return;
    }

    // Apply temporary attractor/repeller forces if enabled and mouse is down
    if (CONFIG.attractorEnabled && state.mouseIsDown && CONFIG.motion !== "none") {
      this.applyMouseAttractor(state);
    }

    // Update noise space position (never wraps)
    this.noiseX += this.vx * dt;
    this.noiseY += this.vy * dt;

    // Update visual position with wrapping
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.applyBounds(state);
  }

  private applyMouseAttractor(state: AppState): void {
    const dx = state.mouseX - this.x;
    const dy = state.mouseY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CONFIG.attractorRadius && dist > 0) {
      // Shift = repel, no shift = attract
      const isRepel = state.mouseShiftIsDown;
      const strength = isRepel ? -CONFIG.attractorStrength : CONFIG.attractorStrength;

      // Calculate influence with decay
      const influence = (1 - dist / CONFIG.attractorRadius) * Math.abs(strength) * CONFIG.attractorDecay;
      const dirX = dx / dist;
      const dirY = dy / dist;

      // Apply force
      this.vx += dirX * influence * (strength > 0 ? 1 : -1) * 0.5;
      this.vy += dirY * influence * (strength > 0 ? 1 : -1) * 0.5;
    }

    // Check exclusion zones and push particles out
    for (const zone of state.exclusionZones) {
      this.applyExclusionZone(zone, state);
    }
  }

  private applyExclusionZone(zone: import("./config").ExclusionZone, state: AppState): void {
    let inside = false;
    let pushX = 0, pushY = 0;

    if (zone.type === "circle") {
      const dx = this.x - zone.x;
      const dy = this.y - zone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < zone.radius!) {
        inside = true;
        const distNorm = Math.max(0.01, dist);
        pushX = (dx / distNorm) * 2;
        pushY = (dy / distNorm) * 2;
      }
    } else if (zone.type === "rectangle" || zone.type === "ellipse") {
      const halfW = zone.width / 2;
      const halfH = zone.height / 2;
      const centerX = zone.x + halfW;
      const centerY = zone.y + halfH;

      if (this.x > zone.x && this.x < zone.x + zone.width &&
          this.y > zone.y && this.y < zone.y + zone.height) {
        inside = true;
        // Find nearest edge
        const distLeft = this.x - zone.x;
        const distRight = zone.x + zone.width - this.x;
        const distTop = this.y - zone.y;
        const distBottom = zone.y + zone.height - this.y;

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);
        if (minDist === distLeft) pushX = -1;
        else if (minDist === distRight) pushX = 1;
        else if (minDist === distTop) pushY = -1;
        else pushY = 1;
      }
    }

    if (inside) {
      this.x += pushX * 2;
      this.y += pushY * 2;
      this.vx += pushX * 5;
      this.vy += pushY * 5;

      // Also push noise space
      this.noiseX = this.x;
      this.noiseY = this.y;
    }
  }

  private applyBoidRules(particles: Particle[], state: AppState) {
    const perception = CONFIG.boidPerception;
    const maxSpeed = CONFIG.boidMaxSpeed;
    const maxForce = CONFIG.boidMaxForce;

    // Initialize acceleration
    let ax = 0;
    let ay = 0;

    // Boid rule accumulators
    let sepX = 0, sepY = 0;        // Separation
    let aliX = 0, aliY = 0;        // Alignment
    let cohX = 0, cohY = 0;        // Cohesion
    let separationCount = 0;
    let neighborCount = 0;

    for (const other of particles) {
      if (other === this) continue;

      // Calculate distance considering wrapping
      const dx = this.getWrappedDistance(this.x, other.x, state.width);
      const dy = this.getWrappedDistance(this.y, other.y, state.height);
      const distSq = dx * dx + dy * dy;

      if (distSq < perception * perception && distSq > 0) {
        const dist = Math.sqrt(distSq);

        // Separation: steer away from nearby boids
        if (dist < perception * 0.5) {
          sepX -= dx / dist;
          sepY -= dy / dist;
          separationCount++;
        }

        // Alignment: average velocity of neighbors
        aliX += other.vx;
        aliY += other.vy;

        // Cohesion: average position of neighbors
        cohX += other.x;
        cohY += other.y;

        neighborCount++;
      }
    }

    // Apply separation
    if (separationCount > 0) {
      sepX /= separationCount;
      sepY /= separationCount;
      const sepMag = Math.sqrt(sepX * sepX + sepY * sepY);
      if (sepMag > 0) {
        sepX = (sepX / sepMag) * maxSpeed - this.vx;
        sepY = (sepY / sepMag) * maxSpeed - this.vy;
        const steerMag = Math.sqrt(sepX * sepX + sepY * sepY);
        if (steerMag > maxForce) {
          sepX = (sepX / steerMag) * maxForce;
          sepY = (sepY / steerMag) * maxForce;
        }
      }
      ax += sepX * CONFIG.boidSeparation;
      ay += sepY * CONFIG.boidSeparation;
    }

    // Apply alignment and cohesion
    if (neighborCount > separationCount) {
      // Alignment
      aliX /= (neighborCount - separationCount);
      aliY /= (neighborCount - separationCount);
      const aliMag = Math.sqrt(aliX * aliX + aliY * aliY);
      if (aliMag > 0) {
        aliX = (aliX / aliMag) * maxSpeed - this.vx;
        aliY = (aliY / aliMag) * maxSpeed - this.vy;
        const steerMag = Math.sqrt(aliX * aliX + aliY * aliY);
        if (steerMag > maxForce) {
          aliX = (aliX / steerMag) * maxForce;
          aliY = (aliY / steerMag) * maxForce;
        }
      }
      ax += aliX * CONFIG.boidAlignment;
      ay += aliY * CONFIG.boidAlignment;

      // Cohesion
      cohX /= (neighborCount - separationCount);
      cohY /= (neighborCount - separationCount);
      // Desired velocity towards center
      cohX = cohX - this.x;
      cohY = cohY - this.y;
      const cohMag = Math.sqrt(cohX * cohX + cohY * cohY);
      if (cohMag > 0) {
        cohX = (cohX / cohMag) * maxSpeed - this.vx;
        cohY = (cohY / cohMag) * maxSpeed - this.vy;
        const steerMag = Math.sqrt(cohX * cohX + cohY * cohY);
        if (steerMag > maxForce) {
          cohX = (cohX / steerMag) * maxForce;
          cohY = (cohY / steerMag) * maxForce;
        }
      }
      ax += cohX * CONFIG.boidCohesion;
      ay += cohY * CONFIG.boidCohesion;
    }

    // Update velocity with acceleration
    this.vx += ax;
    this.vy += ay;

    // Limit speed
    const speedMag = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speedMag > maxSpeed) {
      this.vx = (this.vx / speedMag) * maxSpeed;
      this.vy = (this.vy / speedMag) * maxSpeed;
    }

    // Scale by global speed multiplier
    this.vx *= CONFIG.speed;
    this.vy *= CONFIG.speed;
  }

  private getWrappedDistance(a: number, b: number, size: number): number {
    let diff = b - a;
    if (diff > size / 2) diff -= size;
    if (diff < -size / 2) diff += size;
    return diff;
  }

  private applyBounds(state: AppState) {
    const w = state.width;
    const h = state.height;
    if (CONFIG.edgeBehavior === "wrap") {
      // Wrap visual position only, not noise space
      // This keeps noise sampling continuous while visual wraps
      if (this.x < 0) this.x += w;
      if (this.x > w) this.x -= w;
      if (this.y < 0) this.y += h;
      if (this.y > h) this.y -= h;
    } else if (CONFIG.edgeBehavior === "bounce") {
      if (this.x < 0) {
        this.x = 0;
        this.vx *= -1;
        this.noiseX = this.x; // Sync noise space on bounce
      }
      if (this.x > w) {
        this.x = w;
        this.vx *= -1;
        this.noiseX = this.x;
      }
      if (this.y < 0) {
        this.y = 0;
        this.vy *= -1;
        this.noiseY = this.y;
      }
      if (this.y > h) {
        this.y = h;
        this.vy *= -1;
        this.noiseY = this.y;
      }
    } else {
      // clamp
      this.x = Math.max(0, Math.min(w, this.x));
      this.y = Math.max(0, Math.min(h, this.y));
      this.noiseX = this.x;
      this.noiseY = this.y;
    }
  }
}

export function createParticles(count: number, width: number, height: number): Particle[] {
  const arr: Particle[] = [];
  for (let i = 0; i < count; i++) {
    arr.push(new Particle(Math.random() * width, Math.random() * height));
  }
  return arr;
}

export function syncParticleCount(
  particles: Particle[],
  target: number,
  width: number,
  height: number,
): Particle[] {
  while (particles.length < target) {
    particles.push(new Particle(Math.random() * width, Math.random() * height));
  }
  while (particles.length > target) {
    particles.pop();
  }
  return particles;
}
