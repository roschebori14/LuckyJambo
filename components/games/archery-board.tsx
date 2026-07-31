"use client";

import { useEffect, useRef, useState } from "react";
import type { ArcheryState, ArcheryShot } from "@/types/archery";
import { TARGET_RADIUS, RING_WIDTH } from "@/lib/games/archery/engine";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";
import { Wind } from "lucide-react";

export default function ArcheryBoard({ matchId, userId }: { matchId: string, userId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneRef = useRef<import("phaser").Scene | null>(null);
  const shootingRef = useRef(false);
  const boardReadyRef = useRef(false);

  const [state, setState] = useState<ArcheryState | null>(null);
  const [error, setError] = useState("");
  const [shooting, setShooting] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const { play } = useSound();

  const isMyTurn = state && state.current_turn === (state.a_player_id === userId ? "A" : "B") && !state.game_over;
  const isSpectator = state && state.a_player_id !== userId && state.b_player_id !== userId;
  const playerA = state?.a_player_id === userId ? "You" : "Player A";
  const playerB = state?.b_player_id === userId ? "You" : "Player B";

  // Real-time and Fetch
  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch(`/api/matches/status?id=${matchId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch state");
        if (data.match?.game_state) setState(data.match.game_state as ArcheryState);
      } catch (err: any) {
        setError(err.message);
      }
    }
    fetchState();
  }, [matchId]);

  useMatchRealtime(matchId, (row) => {
    if (shootingRef.current) return;
    if (row.game_state) {
      setState(row.game_state as ArcheryState);
    }
  });

  useEffect(() => {
    shootingRef.current = shooting;
  }, [shooting]);

  useEffect(() => {
    boardReadyRef.current = boardReady;
  }, [boardReady]);

  // Phaser Setup
  useEffect(() => {
    if (!state || gameRef.current || !containerRef.current) return;

    let initPhaser = async () => {
      const Phaser = (await import("phaser")).default;
      
      const width = containerRef.current!.clientWidth;
      const height = containerRef.current!.clientHeight;

      const config: import("phaser").Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current!,
        width,
        height,
        backgroundColor: "#87CEEB", // Sky blue
        scale: {
           mode: Phaser.Scale.RESIZE,
           autoCenter: Phaser.Scale.CENTER_BOTH
        },
        scene: {
          create: function(this: import("phaser").Scene) {
            sceneRef.current = this;
            
            const w = this.scale.width;
            const h = this.scale.height;
            const cx = w / 2;
            const cy = h / 2;

            // 3D Engine Constants
            const FOCAL_LENGTH = 400;
            const TARGET_Z = 2000;
            
            // State for the 3D world
            this.registry.set('cameraZ', 0);
            this.registry.set('cameraX', 0);
            this.registry.set('cameraY', -100);
            
            // Helper function to project 3D to 2D
            const project = (x: number, y: number, z: number) => {
                const camX = this.registry.get('cameraX');
                const camY = this.registry.get('cameraY');
                const camZ = this.registry.get('cameraZ');
                
                const relativeZ = z - camZ;
                if (relativeZ <= 0) return { x: 0, y: 0, scale: 0, visible: false };
                
                const scale = FOCAL_LENGTH / (FOCAL_LENGTH + relativeZ);
                const screenX = cx + (x - camX) * scale;
                const screenY = cy - (y - camY) * scale; // Y is up in 3D, down on screen
                
                return { x: screenX, y: screenY, scale, visible: true };
            };
            this.registry.set('project', project);

            // 1. Draw Sky & Grass (Background)
            const sky = this.add.graphics();
            sky.fillGradientStyle(0x4ba3e3, 0x4ba3e3, 0x87ceeb, 0x87ceeb, 1);
            sky.fillRect(0, 0, w, h);
            
            const grass = this.add.graphics();
            this.registry.set('grass', grass);

            // 2. Target Container
            const targetGroup = this.add.container(0, 0);
            this.registry.set('targetGroup', targetGroup);
            
            // Target elements
            const legLeft = this.add.rectangle(-60, -100, 15, 200, 0x5C4033);
            const legRight = this.add.rectangle(60, -100, 15, 200, 0x5C4033);
            targetGroup.add([legLeft, legRight]);
            
            const boardSize = TARGET_RADIUS * 2 + 50;
            const backboard = this.add.rectangle(0, 0, boardSize, boardSize, 0xDEB887);
            targetGroup.add(backboard);

            const colors = [
              0xffffff, 0xffffff,
              0x000000, 0x000000,
              0x00a8ff, 0x00a8ff,
              0xe84118, 0xe84118,
              0xfbc531, 0xfbc531 
            ];
            
            for (let i = 0; i < 10; i++) {
              const radius = TARGET_RADIUS - (i * RING_WIDTH);
              const ring = this.add.circle(0, 0, radius, colors[Math.floor(i)]);
              if (i % 2 === 0) ring.setStrokeStyle(2, 0x000000, 0.3);
              else if (i === 1 || i === 3) ring.setStrokeStyle(2, 0xffffff, 0.5);
              targetGroup.add(ring);
            }
            
            // 3. Arrow Container
            const arrowGroup = this.add.container(0, 0);
            this.registry.set('arrowGroup', arrowGroup);
            
            const shaft = this.add.rectangle(0, -30, 4, 80, 0x5C4033);
            const myColor = state.a_player_id === userId ? 0xff0000 : 0x0000ff;
            const fletching = this.add.triangle(0, -60, 0, -15, 12, 10, -12, 10, myColor);
            const tip = this.add.triangle(0, 20, 0, 15, 6, -10, -6, -10, 0xC0C0C0);
            arrowGroup.add([shaft, fletching, tip]);
            
            // 4. Trajectory dots
            const trajectoryDots = Array.from({length: 20}).map(() => {
                const dot = this.add.circle(0, 0, 4, 0xffffff, 0.6);
                dot.visible = false;
                return dot;
            });
            this.registry.set('trajectoryDots', trajectoryDots);

            setBoardReady(true);
          },
          update: function(this: import("phaser").Scene) {
            if (!this.registry.has('project')) return;
            
            const w = this.scale.width;
            const h = this.scale.height;
            const cx = w / 2;
            const cy = h / 2;
            const project = this.registry.get('project');
            const targetGroup = this.registry.get('targetGroup');
            const arrowGroup = this.registry.get('arrowGroup');
            const grass = this.registry.get('grass');
            const TARGET_Z = 2000;
            
            // Update grass and grid
            grass.clear();
            const horizon = project(0, 0, TARGET_Z * 2);
            if (horizon.visible) {
                grass.fillStyle(0x5ca904);
                grass.fillRect(0, horizon.y, w, h - horizon.y);
                
                grass.lineStyle(2, 0xffffff, 0.4);
                const numLanes = 8;
                const laneW = 800;
                for(let i = -numLanes/2; i <= numLanes/2; i++) {
                    const startX = i * laneW;
                    const pNear = project(startX, -200, 0);
                    const pFar = project(startX, -200, TARGET_Z * 2);
                    if (pNear.visible && pFar.visible) {
                        grass.beginPath();
                        grass.moveTo(pNear.x, pNear.y);
                        grass.lineTo(pFar.x, pFar.y);
                        grass.strokePath();
                    }
                }
            }
            
            // Update Target 3D
            const targetPos = project(0, 50, TARGET_Z);
            if (targetPos.visible) {
                targetGroup.setPosition(targetPos.x, targetPos.y);
                targetGroup.setScale(targetPos.scale);
                // Also update past arrows in the target
                targetGroup.list.forEach((child: any) => {
                    if (child.name === 'past-arrow' && child.update3D) {
                        child.update3D();
                    }
                });
            }
            
            // Update Active Arrow 3D
            const arrowData = this.registry.get('arrowData');
            if (arrowData && arrowData.active) {
                const { x, y, z, pitch } = arrowData;
                const arrPos = project(x, y, z);
                if (arrPos.visible) {
                    arrowGroup.visible = true;
                    arrowGroup.setPosition(arrPos.x, arrPos.y);
                    // Scale down as it flies away, rotate based on pitch
                    arrowGroup.setScale(arrPos.scale);
                    // Adjust rotation to match flight path
                    arrowGroup.rotation = -arrowData.yaw; 
                    // To simulate pitch in 2D, we could scale the Y of the arrow contents
                    // For simplicity, we just use the scale
                } else {
                    arrowGroup.visible = false;
                }
            }
            
            // Update Trajectory
            const dots = this.registry.get('trajectoryDots');
            const traj = this.registry.get('trajectory');
            if (traj && traj.length > 0) {
                dots.forEach((dot: any, i: number) => {
                    if (i < traj.length) {
                        const p = project(traj[i].x, traj[i].y, traj[i].z);
                        if (p.visible) {
                            dot.setPosition(p.x, p.y);
                            dot.setScale(p.scale);
                            dot.visible = true;
                        } else dot.visible = false;
                    } else {
                        dot.visible = false;
                    }
                });
            } else {
                dots.forEach((dot: any) => dot.visible = false);
            }
          }
        }
      };
      
      gameRef.current = new Phaser.Game(config);
    };

    initPhaser();

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
  }, [state, matchId]);
  
  // Render past shots
  useEffect(() => {
    if (!boardReady || !sceneRef.current || !state) return;
    const scene = sceneRef.current;
    const targetGroup = scene.registry.get('targetGroup') as import("phaser").GameObjects.Container;
    if (!targetGroup) return;

    const oldArrows = targetGroup.list.filter(c => c.name === 'past-arrow');
    oldArrows.forEach(c => c.destroy());

    const drawShot = (shot: ArcheryShot, isA: boolean) => {
        const color = isA ? 0xff0000 : 0x0000ff;
        
        // Add to targetGroup (which handles the scaling and projection of the board itself)
        const arrowGroup = scene.add.container(shot.finalX, -shot.finalY); // Invert Y because 2D vs 3D
        arrowGroup.name = 'past-arrow';
        
        // Shadow
        const shadow = scene.add.circle(0, 0, 15, 0x000000, 0.4);
        
        // Shaft pointing out (using scale to fake perspective)
        const shaft = scene.add.rectangle(0, 20, 6, 40, 0x5C4033);
        const fletching = scene.add.triangle(0, 40, 0, -10, 15, 10, -15, 10, color);
        
        arrowGroup.add([shadow, shaft, fletching]);
        targetGroup.add(arrowGroup);
    };

    state.a_shots.forEach(s => drawShot(s, true));
    state.b_shots.forEach(s => drawShot(s, false));
    
  }, [state?.a_shots.length, state?.b_shots.length, boardReady]);


  // Interaction Logic
  useEffect(() => {
    if (!boardReady || !sceneRef.current || !state || !isMyTurn) return;
    
    const scene = sceneRef.current;
    const TARGET_Z = 2000;
    const GRAVITY = 0.5;
    // Wind factor affects X velocity per frame
    const windForceX = state.wind_x * 0.05; 
    
    const arrowGroup = scene.registry.get('arrowGroup');
    const resetArrow = () => {
        scene.registry.set('cameraZ', 0);
        scene.registry.set('cameraX', 0);
        scene.registry.set('cameraY', 0);
        
        scene.registry.set('arrowData', {
            active: true,
            x: 0,
            y: 0,
            z: 50,
            yaw: 0,
            pitch: 0
        });
        scene.registry.set('trajectory', []);
    };
    resetArrow();

    let isAiming = false;
    let startPointerX = 0;
    let startPointerY = 0;
    let pullPower = 0;
    let aimAngleX = 0;
    let aimAngleY = 0;
    
    const calculateTrajectory = (power: number, angX: number, angY: number) => {
        let x = 0;
        let y = 0;
        let z = 50;
        
        // Initial velocities
        let vx = angX * power;
        let vy = angY * power;
        let vz = power * 2.5; // Z velocity is main driver
        
        const path = [];
        for (let i = 0; i < 60; i++) {
            if (z > TARGET_Z) break;
            if (i % 3 === 0) path.push({ x, y, z }); // Save every 3rd frame for dots
            
            x += vx;
            y += vy;
            z += vz;
            
            vy -= GRAVITY;
            vx += windForceX;
        }
        scene.registry.set('trajectory', path);
    };
    
    const onPointerDown = (pointer: import("phaser").Input.Pointer) => {
      if (shootingRef.current) return;
      isAiming = true;
      startPointerX = pointer.x;
      startPointerY = pointer.y;
    };
    
    const onPointerMove = (pointer: import("phaser").Input.Pointer) => {
      if (!isAiming) return;
      
      const dx = pointer.x - startPointerX;
      const dy = pointer.y - startPointerY;
      
      // Pull down increases power
      pullPower = Math.max(0, Math.min(60, dy * 0.4));
      
      // Left/Right drag changes X angle. Up/Down slightly changes Y angle.
      aimAngleX = dx * -0.01; 
      aimAngleY = (dy - 100) * 0.01; // Base aim is slightly up to counter gravity
      
      // Visually pull arrow back
      const arrowData = scene.registry.get('arrowData');
      scene.registry.set('arrowData', {
          ...arrowData,
          x: aimAngleX * -50,
          y: -pullPower,
          z: 50 - pullPower,
          yaw: aimAngleX
      });
      
      calculateTrajectory(pullPower, aimAngleX, aimAngleY);
    };
    
    const onPointerUp = async (pointer: import("phaser").Input.Pointer) => {
      if (!isAiming) return;
      isAiming = false;
      scene.registry.set('trajectory', []);
      
      if (pullPower < 10) {
        resetArrow();
        return; // Cancel shot
      }
      
      setShooting(true);
      play("move"); // Bow string release
      
      let x = scene.registry.get('arrowData').x;
      let y = scene.registry.get('arrowData').y;
      let z = scene.registry.get('arrowData').z;
      
      let vx = aimAngleX * pullPower;
      let vy = aimAngleY * pullPower;
      let vz = pullPower * 2.5;
      
      // Physics Loop Event
      const flightTimer = scene.time.addEvent({
          delay: 16, // ~60fps
          loop: true,
          callback: () => {
              x += vx;
              y += vy;
              z += vz;
              
              vy -= GRAVITY;
              vx += windForceX;
              
              const yaw = Math.atan2(vx, vz);
              const pitch = Math.atan2(vy, vz);
              
              // Move camera to follow arrow
              const camZ = scene.registry.get('cameraZ');
              scene.registry.set('cameraZ', camZ + (z - 200 - camZ) * 0.1);
              const camX = scene.registry.get('cameraX');
              scene.registry.set('cameraX', camX + (x * 0.5 - camX) * 0.1);
              
              scene.registry.set('arrowData', { active: true, x, y, z, yaw, pitch });
              
              // Check hit
              if (z >= TARGET_Z) {
                  flightTimer.remove();
                  play("archery-hit");
                  
                  // Target center is (0, 50, TARGET_Z)
                  const hitLocalX = x;
                  const hitLocalY = y - 50; 
                  
                  // Wait 1.5s then submit and reset
                  scene.time.delayedCall(1500, () => {
                      const shot: ArcheryShot = {
                         playerId: userId,
                         angle: aimAngleX, 
                         power: pullPower, 
                         windX: state.wind_x,
                         windY: state.wind_y,
                         finalX: hitLocalX,
                         finalY: -hitLocalY, // Negate Y back for DB standard
                         score: 0 
                      };
                      
                      fetch("/api/archery/shot", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ matchId, shot })
                      }).catch(console.error).finally(() => {
                          setShooting(false);
                          resetArrow();
                      });
                  });
              }
              
              // Miss check (hit ground)
              if (y < -200) {
                  flightTimer.remove();
                  scene.time.delayedCall(1000, () => {
                      // Submit miss
                      fetch("/api/archery/shot", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ matchId, shot: { playerId: userId, angle: 0, power: 0, windX: 0, windY: 0, finalX: 9999, finalY: 9999, score: 0 } })
                      }).finally(() => { setShooting(false); resetArrow(); });
                  });
              }
          }
      });
    };
    
    scene.input.on("pointerdown", onPointerDown);
    scene.input.on("pointermove", onPointerMove);
    scene.input.on("pointerup", onPointerUp);
    
    return () => {
      scene.input.off("pointerdown", onPointerDown);
      scene.input.off("pointermove", onPointerMove);
      scene.input.off("pointerup", onPointerUp);
      scene.registry.set('arrowData', { active: false });
    };
    
  }, [boardReady, isMyTurn, state, userId, play, matchId]);
  
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!state) return <div className="p-4 text-gray-400 font-medium">Loading Archery Range...</div>;

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full">
      {/* Top HUD */}
      <div className="flex w-full max-w-[600px] justify-between items-center px-4 bg-slate-900/40 rounded-xl py-3 border border-slate-700/50">
        
        <div className="flex flex-col items-center">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{playerA}</span>
            <span className="text-2xl font-black text-white">{state.a_score}</span>
        </div>
        
        <div className="flex flex-col items-center gap-1">
            <div className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30">
               ROUND {state.round}
            </div>
            
            <div className="flex items-center gap-2 mt-1 bg-white/10 px-3 py-1.5 rounded-lg shadow-sm">
                <Wind size={16} className="text-sky-300" />
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                        {Math.abs(state.wind_x).toFixed(1)}
                    </span>
                    <div 
                        className="text-white transform transition-transform"
                        style={{ 
                            rotate: `${Math.atan2(state.wind_y, state.wind_x) * (180/Math.PI)}deg` 
                        }}
                    >
                        ➔
                    </div>
                </div>
            </div>
        </div>

        <div className="flex flex-col items-center">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{playerB}</span>
            <span className="text-2xl font-black text-white">{state.b_score}</span>
        </div>
      </div>
      
      {/* Game Canvas Container */}
      <div 
         ref={containerRef} 
         className="relative w-full max-w-[600px] h-[550px] rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950"
      />
      
      {/* Instructions */}
      <div className="bg-slate-900/60 px-6 py-3 rounded-full border border-slate-800">
        <p className="text-sm font-semibold text-white text-center">
            {isMyTurn ? (
                shooting ? "Arrow is flying..." : "Touch and pull back to draw bow!"
            ) : (
                state.game_over ? "Game Over" : "Waiting for opponent..."
            )}
        </p>
      </div>
    </div>
  );
}
