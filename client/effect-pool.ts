import * as T from 'three';

interface Slot {
  mesh: T.Mesh;
  material: T.MeshBasicMaterial;
  active: boolean;
  life: number;
  max: number;
  velocity: T.Vector3;
}

const UP = new T.Vector3(0, 1, 0);
const direction = new T.Vector3();

function slots(count: number, geometry: T.BufferGeometry, opacity: number): Slot[] {
  const result: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const material = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false });
    const mesh = new T.Mesh(geometry, material); mesh.visible = false; mesh.frustumCulled = false;
    result.push({ mesh, material, active: false, life: 0, max: 1, velocity: new T.Vector3() });
  }
  return result;
}

/** Bounded visual-only pool. Gameplay events are never dropped; only old decorative FX are reused. */
export class CombatEffectPool {
  private beamGeometry = new T.CylinderGeometry(.017, .017, 1, 5);
  private sparkGeometry = new T.BoxGeometry(.035, .035, .035);
  private beams = slots(32, this.beamGeometry, .9);
  private sparks = slots(192, this.sparkGeometry, 1);
  private beamCursor = 0;
  private sparkCursor = 0;

  constructor(private scene: () => T.Scene) {}

  beam(from: T.Vector3, to: T.Vector3, color: number): void {
    direction.copy(to).sub(from); const length = direction.length(); if (length < .02) return;
    const beam = this.take(this.beams, 'beamCursor');
    beam.material.color.setHex(color); beam.material.opacity = .9; beam.life = beam.max = .16;
    beam.mesh.position.copy(from).addScaledVector(direction, .5); beam.mesh.scale.set(1, length, 1);
    beam.mesh.quaternion.setFromUnitVectors(UP, direction.normalize()); this.activate(beam);
    for (let i = 0; i < 6; i++) {
      const spark = this.take(this.sparks, 'sparkCursor');
      spark.material.color.setHex(color); spark.material.opacity = 1; spark.life = spark.max = .23;
      spark.mesh.position.copy(to); spark.mesh.scale.setScalar(1); spark.mesh.quaternion.identity();
      spark.velocity.set((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3); this.activate(spark);
    }
  }

  update(dt: number): void {
    for (const slot of this.beams) this.updateSlot(slot, dt, false);
    for (const slot of this.sparks) this.updateSlot(slot, dt, true);
  }

  clear(): void {
    for (const slot of [...this.beams, ...this.sparks]) {
      slot.active = false; slot.mesh.visible = false; slot.mesh.removeFromParent();
    }
  }

  dispose(): void {
    this.clear(); this.beamGeometry.dispose(); this.sparkGeometry.dispose();
    for (const slot of [...this.beams, ...this.sparks]) slot.material.dispose();
  }

  private activate(slot: Slot): void {
    const scene=this.scene(); if(slot.mesh.parent!==scene)scene.add(slot.mesh); slot.active=true; slot.mesh.visible=true;
  }

  private take(pool: Slot[], cursor: 'beamCursor'|'sparkCursor'): Slot {
    const index=this[cursor]; this[cursor]=(index+1)%pool.length; return pool[index];
  }

  private updateSlot(slot: Slot, dt: number, gravity: boolean): void {
    if (!slot.active) return;
    slot.life-=dt; slot.material.opacity=Math.max(0,slot.life/slot.max);
    if (gravity) { slot.mesh.position.addScaledVector(slot.velocity,dt); slot.velocity.y-=dt*5; }
    if (slot.life<=0) { slot.active=false; slot.mesh.visible=false; }
  }
}
