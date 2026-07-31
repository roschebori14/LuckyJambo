"use client";

import { useEffect, useRef, useState } from "react";
import type { ArcheryState, ArcheryShot } from "@/types/archery";
import { TARGET_RADIUS, RING_WIDTH } from "@/lib/games/archery/engine";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";

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
    if (row.game_state) setState(row.game_state as ArcheryState);
  });

  useEffect(() => { shootingRef.current = shooting; }, [shooting]);
  useEffect(() => { boardReadyRef.current = boardReady; }, [boardReady]);

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
        backgroundColor: "#000000",
        scale: {
           mode: Phaser.Scale.RESIZE,
           autoCenter: Phaser.Scale.CENTER_BOTH
        },
        scene: {
          preload: function(this: import("phaser").Scene) {
             this.load.image('bg', '/assets/archery/bg.jpg');
          },
          create: function(this: import("phaser").Scene) {
            sceneRef.current = this;
            
            const w = this.scale.width;
            const h = this.scale.height;
            const cx = w / 2;
            const cy = h / 2;

            // 3D Engine Constants
            const FOCAL_LENGTH = 500;
            const TARGET_Z = 2000;
            
            // State for the 3D world
            this.registry.set('cameraZ', 0);
            this.registry.set('cameraX', 0);
            this.registry.set('cameraY', -120);
            
            // Project function
            const project = (x: number, y: number, z: number) => {
                const camX = this.registry.get('cameraX');
                const camY = this.registry.get('cameraY');
                const camZ = this.registry.get('cameraZ');
                
                const relativeZ = z - camZ;
                if (relativeZ <= 0) return { x: 0, y: 0, scale: 0, visible: false };
                
                const scale = FOCAL_LENGTH / (FOCAL_LENGTH + relativeZ);
                const screenX = cx + (x - camX) * scale;
                const screenY = cy - (y - camY) * scale;
                
                return { x: screenX, y: screenY, scale, visible: true };
            };
            this.registry.set('project', project);

            // 1. Premium Background
            const bgImg = this.add.image(cx, cy, 'bg');
            // Scale to fill maintaining aspect ratio
            const scaleX = w / bgImg.width;
            const scaleY = h / bgImg.height;
            const maxScale = Math.max(scaleX, scaleY);
            bgImg.setScale(maxScale);
            this.registry.set('bgImg', bgImg);

            // 2. Target Container
            const targetGroup = this.add.container(0, 0);
            this.registry.set('targetGroup', targetGroup);
            
            // Target Legs (Wood)
            const legLeft = this.add.rectangle(-60, -100, 15, 250, 0x5C4033);
            const legRight = this.add.rectangle(60, -100, 15, 250, 0x5C4033);
            targetGroup.add([legLeft, legRight]);
            
            // Wooden Backboard with gradient-like shadow
            const boardSize = TARGET_RADIUS * 2 + 60;
            const backboard = this.add.rectangle(0, 0, boardSize, boardSize, 0xDEB887);
            backboard.setStrokeStyle(4, 0x8B4513);
            targetGroup.add(backboard);

            // Olympic Target Rings (White, Black, Blue, Red, Yellow)
            const colors = [
              0xffffff, 0xffffff,
              0x2d3436, 0x2d3436,
              0x0984e3, 0x0984e3,
              0xd63031, 0xd63031,
              0xfdccb6, 0xf9ca24 
            ];
            
            for (let i = 0; i < 10; i++) {
              const radius = TARGET_RADIUS - (i * RING_WIDTH);
              const ring = this.add.circle(0, 0, radius, colors[Math.floor(i)]);
              if (i % 2 === 0) ring.setStrokeStyle(2, 0x000000, 0.2);
              else if (i === 1 || i === 3) ring.setStrokeStyle(1, 0xffffff, 0.5);
              targetGroup.add(ring);
            }
            
            // Target Shadow
            const targetShadow = this.add.ellipse(0, 200, 150, 30, 0x000000, 0.3);
            targetGroup.add(targetShadow);
            
            // 3. Arrow Container
            const arrowGroup = this.add.container(0, 0);
            this.registry.set('arrowGroup', arrowGroup);
            
            const shaft = this.add.rectangle(0, -30, 6, 80, 0x3d3d3d);
            const myColor = state.a_player_id === userId ? 0xff0000 : 0x0984e3;
            const fletching = this.add.triangle(0, -60, 0, -20, 14, 10, -14, 10, myColor);
            const tip = this.add.triangle(0, 15, 0, 15, 8, -12, -8, -12, 0xC0C0C0);
            arrowGroup.add([shaft, fletching, tip]);
            
            // 4. Trajectory dots
            const trajectoryDots = Array.from({length: 15}).map(() => {
                const dot = this.add.circle(0, 0, 4, 0xffffff, 0.7);
                dot.visible = false;
                return dot;
            });
            this.registry.set('trajectoryDots', trajectoryDots);
            
            // 5. Floating Score Text setup
            const scoreText = this.add.text(0, 0, '', {
                fontSize: '64px',
                fontFamily: 'Inter, sans-serif',
                fontStyle: '900',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 8,
                align: 'center'
            });
            scoreText.setOrigin(0.5);
            scoreText.visible = false;
            this.registry.set('scoreText', scoreText);

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
            const bgImg = this.registry.get('bgImg');
            const TARGET_Z = 2000;
            
            // Parallax Background based on camera X and Z
            const camZ = this.registry.get('cameraZ');
            const camX = this.registry.get('cameraX');
            // Scale background slightly up as camera moves forward
            const baseScale = Math.max(w / bgImg.width, h / bgImg.height);
            bgImg.setScale(baseScale * (1 + camZ * 0.0001));
            bgImg.setPosition(cx - (camX * 0.05), cy + (camZ * 0.02));
            
            // Update Target 3D
            const targetPos = project(0, 50, TARGET_Z);
            if (targetPos.visible) {
                targetGroup.setPosition(targetPos.x, targetPos.y);
                targetGroup.setScale(targetPos.scale);
            }
            
            // Update Active Arrow 3D
            const arrowData = this.registry.get('arrowData');
            if (arrowData && arrowData.active) {
                const { x, y, z, yaw } = arrowData;
                const arrPos = project(x, y, z);
                if (arrPos.visible) {
                    arrowGroup.visible = true;
                    arrowGroup.setPosition(arrPos.x, arrPos.y);
                    arrowGroup.setScale(arrPos.scale);
                    arrowGroup.rotation = -yaw; 
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
        const color = isA ? 0xff0000 : 0x0984e3;
        
        const arrowGroup = scene.add.container(shot.finalX, -shot.finalY);
        arrowGroup.name = 'past-arrow';
        
        // Shadow
        const shadow = scene.add.circle(0, 0, 15, 0x000000, 0.4);
        
        // Shaft pointing out
        const shaft = scene.add.rectangle(0, 20, 6, 40, 0x3d3d3d);
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
    
    const resetArrow = () => {
        scene.registry.set('cameraZ', 0);
        scene.registry.set('cameraX', 0);
        scene.registry.set('cameraY', -120);
        
        scene.registry.set('arrowData', {
            active: true,
            x: 0,
            y: -100,
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
        let y = -100;
        let z = 50;
        
        let vx = angX * power;
        let vy = angY * power;
        let vz = power * 2.5;
        
        const path = [];
        for (let i = 0; i < 60; i++) {
            if (z > TARGET_Z) break;
            if (i % 4 === 0) path.push({ x, y, z }); 
            
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
      pullPower = Math.max(0, Math.min(60, dy * 0.45));
      
      // Left/Right drag changes X angle. Up/Down slightly changes Y angle.
      aimAngleX = dx * -0.012; 
      aimAngleY = (dy - 120) * 0.012; 
      
      const arrowData = scene.registry.get('arrowData');
      scene.registry.set('arrowData', {
          ...arrowData,
          x: aimAngleX * -60,
          y: -100 - pullPower,
          z: 50 - pullPower * 1.5,
          yaw: aimAngleX
      });
      
      calculateTrajectory(pullPower, aimAngleX, aimAngleY);
    };
    
    const onPointerUp = async (pointer: import("phaser").Input.Pointer) => {
      if (!isAiming) return;
      isAiming = false;
      scene.registry.set('trajectory', []);
      
      if (pullPower < 15) {
        resetArrow();
        return; 
      }
      
      setShooting(true);
      play("move"); 
      
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
              
              // Smooth camera follow
              const camZ = scene.registry.get('cameraZ');
              scene.registry.set('cameraZ', camZ + (z - 250 - camZ) * 0.15);
              const camX = scene.registry.get('cameraX');
              scene.registry.set('cameraX', camX + (x * 0.7 - camX) * 0.15);
              
              scene.registry.set('arrowData', { active: true, x, y, z, yaw, pitch });
              
              if (z >= TARGET_Z) {
                  flightTimer.remove();
                  play("archery-hit");
                  
                  // Calculate hit
                  const hitLocalX = x;
                  const hitLocalY = y - 50; 
                  
                  // Score floating text
                  const distFromCenter = Math.sqrt(hitLocalX * hitLocalX + hitLocalY * hitLocalY);
                  let calculatedScore = 0;
                  if (distFromCenter <= TARGET_RADIUS) {
                      const ring = Math.floor(distFromCenter / RING_WIDTH);
                      calculatedScore = 10 - ring;
                  }
                  
                  const scoreText = scene.registry.get('scoreText') as import("phaser").GameObjects.Text;
                  if (calculatedScore > 0) {
                      scoreText.setText(`+${calculatedScore}`);
                      scoreText.setColor(calculatedScore >= 9 ? '#f1c40f' : '#ffffff');
                      scoreText.setPosition(scene.scale.width / 2, scene.scale.height / 2 - 100);
                      scoreText.visible = true;
                      scoreText.setAlpha(1);
                      scoreText.setScale(0.5);
                      
                      scene.tweens.add({
                          targets: scoreText,
                          y: scoreText.y - 150,
                          alpha: 0,
                          scale: 1.5,
                          duration: 1500,
                          ease: 'Cubic.easeOut',
                      });
                  }
                  
                  // Submit
                  scene.time.delayedCall(1800, () => {
                      const shot: ArcheryShot = {
                         playerId: userId,
                         angle: aimAngleX, 
                         power: pullPower, 
                         windX: state.wind_x,
                         windY: state.wind_y,
                         finalX: hitLocalX,
                         finalY: -hitLocalY, 
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
              
              if (y < -400) {
                  flightTimer.remove();
                  scene.time.delayedCall(1000, () => {
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
    <div className="flex flex-col items-center gap-0 w-full bg-[#E5E5EA] min-h-screen pt-4">
      
      {/* GamePigeon Style Top HUD */}
      <div className="w-full max-w-[600px] px-4 mb-2 flex justify-between items-center bg-white rounded-[24px] py-4 shadow-sm border border-gray-200">
        
        {/* Player A Score */}
        <div className="flex flex-col items-center flex-1">
            <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-lg mb-1 shadow-sm">
               {playerA.charAt(0)}
            </div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{playerA}</span>
            <span className="text-3xl font-black text-gray-800 leading-none mt-1">{state.a_score}</span>
        </div>
        
        {/* Match Info & Wind */}
        <div className="flex flex-col items-center justify-center px-4 flex-none border-x border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Set {state.round}</span>
            
            {/* Wind Indicator (GamePigeon Style) */}
            <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-[10px] text-gray-500 font-semibold uppercase">Wind</span>
                <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 shadow-inner">
                    <span className="text-sm font-bold text-gray-700">
                        {state.wind_x > 0 ? "→" : state.wind_x < 0 ? "←" : "-"}
                    </span>
                    <span className="text-xs font-bold text-gray-800">
                        {Math.abs(state.wind_x).toFixed(1)} m/s
                    </span>
                </div>
            </div>
        </div>

        {/* Player B Score */}
        <div className="flex flex-col items-center flex-1">
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-lg mb-1 shadow-sm">
               {playerB.charAt(0)}
            </div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{playerB}</span>
            <span className="text-3xl font-black text-gray-800 leading-none mt-1">{state.b_score}</span>
        </div>
      </div>
      
      {/* Game Canvas Container */}
      <div 
         ref={containerRef} 
         className="relative w-full max-w-[600px] h-[650px] shadow-sm bg-black"
      />
      
      {/* Instructions Overlay */}
      <div className="w-full max-w-[600px] bg-white py-4 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-10">
        <p className="text-[15px] font-semibold text-gray-600 text-center">
            {isMyTurn ? (
                shooting ? "Arrow is flying..." : "Drag anywhere to aim, pull back to shoot!"
            ) : (
                state.game_over ? "Game Over" : "Waiting for opponent..."
            )}
        </p>
      </div>
    </div>
  );
}
