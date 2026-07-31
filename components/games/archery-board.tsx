"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
            const horizonY = h * 0.35;
            const targetY = horizonY + 50;
            const cx = w / 2;

            // 1. Draw Sky Gradient (using a graphics rect with gradient fill)
            const sky = this.add.graphics();
            sky.fillGradientStyle(0x4ba3e3, 0x4ba3e3, 0x87ceeb, 0x87ceeb, 1);
            sky.fillRect(0, 0, w, horizonY);

            // 2. Draw Grass Field
            const grass = this.add.graphics();
            grass.fillGradientStyle(0x5ca904, 0x5ca904, 0x3d7401, 0x3d7401, 1);
            grass.fillRect(0, horizonY, w, h - horizonY);

            // 3. Draw Perspective Grid (Archery Lanes)
            const grid = this.add.graphics();
            grid.lineStyle(2, 0xffffff, 0.4);
            const numLanes = 6;
            const laneWidthAtBottom = 150;
            const bottomStart = cx - (numLanes / 2) * laneWidthAtBottom;
            for (let i = 0; i <= numLanes; i++) {
              grid.moveTo(cx, horizonY);
              grid.lineTo(bottomStart + (i * laneWidthAtBottom), h);
            }
            grid.strokePath();

            // Horizontal distance markers
            for (let i = 1; i <= 5; i++) {
               const py = horizonY + Math.pow(i/5, 2) * (h - horizonY);
               grid.lineStyle(1, 0xffffff, 0.3);
               grid.beginPath();
               grid.moveTo(0, py);
               grid.lineTo(w, py);
               grid.strokePath();
            }

            // 4. Create Target Container
            const targetGroup = this.add.container(cx, targetY);
            
            // Legs
            const legLeft = this.add.rectangle(-40, 60, 8, 120, 0x8B4513);
            const legRight = this.add.rectangle(40, 60, 8, 120, 0x8B4513);
            targetGroup.add([legLeft, legRight]);
            
            // Wooden Backboard
            const boardSize = TARGET_RADIUS * 2 + 40;
            const backboard = this.add.rectangle(0, 0, boardSize, boardSize, 0xDEB887);
            backboard.setStrokeStyle(4, 0x8B4513);
            targetGroup.add(backboard);

            // Target Rings
            const colors = [
              0xffffff, 0xffffff, // 1, 2
              0x000000, 0x000000, // 3, 4
              0x00a8ff, 0x00a8ff, // 5, 6
              0xe84118, 0xe84118, // 7, 8
              0xfbc531, 0xfbc531  // 9, 10
            ];
            
            for (let i = 0; i < 10; i++) {
              const radius = TARGET_RADIUS - (i * RING_WIDTH);
              const ring = this.add.circle(0, 0, radius, colors[Math.floor(i)]);
              if (i % 2 === 0) {
                 ring.setStrokeStyle(1, 0x000000, 0.2);
              } else if (i === 1 || i === 3) {
                 ring.setStrokeStyle(1, 0xffffff, 0.4); // white stroke on black/blue for visibility
              }
              targetGroup.add(ring);
            }
            
            // Store target container on the scene for easy access
            this.registry.set('targetGroup', targetGroup);
            
            setBoardReady(true);
          },
          update: function(this: import("phaser").Scene) {}
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

    // Clear old arrows from target
    const oldArrows = targetGroup.list.filter(c => c.name === 'shot-arrow');
    oldArrows.forEach(c => c.destroy());

    // Draw all shots from history
    const drawShot = (shot: ArcheryShot, isA: boolean) => {
        // Red fletching for A, Blue for B
        const color = isA ? 0xff0000 : 0x0000ff;
        
        // Faked 3D arrow stuck in board
        const arrowGroup = scene.add.container(shot.finalX, shot.finalY);
        arrowGroup.name = 'shot-arrow';
        
        // Shaft (sticking out towards the camera, slightly angled down)
        const shaft = scene.add.rectangle(0, 20, 3, 40, 0x8B4513);
        // Fletching
        const fletching = scene.add.triangle(0, 40, 0, -8, 6, 8, -6, 8, color);
        // Shadow on the target face
        const shadow = scene.add.circle(-2, 2, 4, 0x000000, 0.3);
        
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
    const w = scene.scale.width;
    const h = scene.scale.height;
    
    const cx = w / 2;
    const arrowStartX = cx;
    const arrowStartY = h - 60;
    
    const targetGroup = scene.registry.get('targetGroup') as import("phaser").GameObjects.Container;
    const targetCy = h * 0.35 + 50;
    
    // First-person Bow Visuals
    const bowGraphics = scene.add.graphics();
    const bowContainer = scene.add.container(cx, h - 30);
    bowContainer.add(bowGraphics);
    
    // Create arrow for aiming
    const currentArrow = scene.add.container(arrowStartX, arrowStartY);
    // Inner container so we can tween local Y for parabolic arc
    const arrowSprite = scene.add.container(0, 0); 
    const shaft = scene.add.rectangle(0, 0, 4, 100, 0x8B4513);
    const myColor = state.a_player_id === userId ? 0xff0000 : 0x0000ff;
    const fletching = scene.add.triangle(0, 40, 0, -10, 10, 15, -10, 15, myColor);
    const tip = scene.add.triangle(0, -50, 0, -10, 5, 5, -5, 5, 0xC0C0C0);
    arrowSprite.add([shaft, fletching, tip]);
    currentArrow.add(arrowSprite);

    // Crosshair and Wind Path
    const crosshair = scene.add.graphics();
    const drawCrosshairAndBow = (aimX: number, aimY: number, pullDist: number) => {
        crosshair.clear();
        crosshair.lineStyle(2, 0xffffff, 0.8);
        crosshair.beginPath();
        crosshair.arc(aimX, aimY, 15, 0, Math.PI * 2);
        crosshair.moveTo(aimX - 25, aimY);
        crosshair.lineTo(aimX + 25, aimY);
        crosshair.moveTo(aimX, aimY - 25);
        crosshair.lineTo(aimX, aimY + 25);
        crosshair.strokePath();
        
        // Show wind predicted offset faintly
        const windScale = 2.5;
        const offX = aimX + (state.wind_x * windScale);
        const offY = aimY + (state.wind_y * windScale);
        
        // Dotted line showing wind path
        crosshair.lineStyle(2, 0xffffff, 0.4);
        crosshair.beginPath();
        crosshair.moveTo(aimX, aimY);
        crosshair.lineTo(offX, offY);
        crosshair.strokePath();
        
        crosshair.lineStyle(2, 0xff0000, 0.8);
        crosshair.strokeCircle(offX, offY, 5);
        
        // Draw Bow
        bowGraphics.clear();
        const bowWidth = 300;
        const bowHeight = 80;
        
        // Draw wood bow (arc)
        bowGraphics.lineStyle(8, 0x5C4033, 1);
        bowGraphics.beginPath();
        bowGraphics.arc(0, bowHeight, bowWidth / 2, Math.PI + 0.2, Math.PI * 2 - 0.2);
        bowGraphics.strokePath();
        
        // Draw bow string
        const stringY = Math.min(120, pullDist); // String pulls back with arrow
        bowGraphics.lineStyle(2, 0xffffff, 0.8);
        bowGraphics.beginPath();
        // Left tip of bow
        const leftX = -Math.cos(0.2) * (bowWidth/2);
        const leftY = bowHeight - Math.sin(0.2) * (bowWidth/2);
        bowGraphics.moveTo(leftX, leftY);
        // Center nock (where arrow is)
        bowGraphics.lineTo(0, stringY - 10);
        // Right tip of bow
        const rightX = Math.cos(0.2) * (bowWidth/2);
        const rightY = bowHeight - Math.sin(0.2) * (bowWidth/2);
        bowGraphics.lineTo(rightX, rightY);
        bowGraphics.strokePath();
    };

    let isAiming = false;
    let aimX = cx;
    let aimY = targetCy; // Default aim at center of target
    
    // Draw initial bow state
    drawCrosshairAndBow(aimX, aimY, 0);
    
    const onPointerDown = (pointer: import("phaser").Input.Pointer) => {
      if (shootingRef.current) return;
      isAiming = true;
      drawCrosshairAndBow(aimX, aimY, 0);
    };
    
    const onPointerMove = (pointer: import("phaser").Input.Pointer) => {
      if (!isAiming) return;
      
      // Move aim based on drag delta (scaled for sensitivity)
      const sensitivity = 0.8;
      aimX += (pointer.x - pointer.prevPosition.x) * sensitivity;
      aimY += (pointer.y - pointer.prevPosition.y) * sensitivity;
      
      // Pull arrow back visually
      const pull = Math.max(0, pointer.y - pointer.downY);
      currentArrow.y = arrowStartY + Math.min(100, pull);
      
      drawCrosshairAndBow(aimX, aimY, pull);
    };
    
    const onPointerUp = async (pointer: import("phaser").Input.Pointer) => {
      if (!isAiming) return;
      isAiming = false;
      crosshair.clear();
      
      // Calculate landing spot using wind
      const windScale = 2.5; 
      const landX = aimX + (state.wind_x * windScale);
      const landY = aimY + (state.wind_y * windScale);
      
      // Check if they didn't pull back enough to shoot
      const pullDist = Math.max(0, pointer.y - pointer.downY);
      if (pullDist < 20) {
        currentArrow.y = arrowStartY;
        currentArrow.x = arrowStartX;
        drawCrosshairAndBow(aimX, aimY, 0);
        return; // Cancel shot
      }
      
      setShooting(true);
      play("move"); // Bow string release sound (placeholder)
      
      // Snap bow string back
      drawCrosshairAndBow(aimX, aimY, -20);
      setTimeout(() => bowGraphics.clear(), 100);
      
      // Animate arrow flying
      const flightDuration = 800;
      
      // Parabolic arc for the arrow sprite (moves up then down)
      scene.tweens.add({
        targets: arrowSprite,
        y: -150,
        duration: flightDuration / 2,
        ease: 'Sine.easeOut',
        yoyo: true
      });
      
      // Linear tween for the container heading to the target
      scene.tweens.add({
        targets: currentArrow,
        y: landY,
        x: landX,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: flightDuration,
        ease: 'Linear',
        onComplete: () => {
          play("archery-hit");
          currentArrow.visible = false;
          
          // Determine local hit coordinates relative to target center
          const hitLocalX = landX - cx;
          const hitLocalY = landY - targetCy;
          
          // Submit to server
          const shot: ArcheryShot = {
             playerId: userId,
             angle: 0, 
             power: 1, 
             windX: state.wind_x,
             windY: state.wind_y,
             finalX: hitLocalX,
             finalY: hitLocalY,
             score: 0 
          };
          
          fetch("/api/archery/shot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ matchId, shot })
          }).catch(console.error).finally(() => {
              // Zoom effect on target
              scene.tweens.add({
                  targets: targetGroup,
                  scaleX: 2.0,
                  scaleY: 2.0,
                  y: targetCy + 50, // Move down slightly when zoomed
                  duration: 400,
                  ease: 'Back.easeOut',
                  yoyo: true,
                  hold: 1500, // Wait 1.5 seconds so player sees score
                  onComplete: () => {
                      setShooting(false);
                      // Real-time state will update and reset board
                      currentArrow.scale = 1;
                      currentArrow.y = arrowStartY;
                      currentArrow.x = arrowStartX;
                      currentArrow.visible = true;
                      aimX = cx;
                      aimY = targetCy;
                      drawCrosshairAndBow(aimX, aimY, 0);
                  }
              });
          });
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
      currentArrow.destroy();
      crosshair.destroy();
      bowContainer.destroy();
    };
    
  }, [boardReady, isMyTurn, state, userId, play, matchId]);
  
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!state) return <div className="p-4 text-gray-400 font-medium">Loading Archery Range...</div>;

  return (
    <div className="flex flex-col items-center gap-4 py-4 w-full">
      {/* Top HUD */}
      <div className="flex w-full max-w-[600px] justify-between items-center px-4 bg-slate-900/40 rounded-xl py-3 border border-slate-700/50">
        
        {/* Player A Score */}
        <div className="flex flex-col items-center">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{playerA}</span>
            <span className="text-2xl font-black text-white">{state.a_score}</span>
        </div>
        
        {/* Match Info & Wind */}
        <div className="flex flex-col items-center gap-1">
            <div className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30">
               ROUND {state.round}
            </div>
            
            {/* Wind Indicator */}
            <div className="flex items-center gap-2 mt-1 bg-white/10 px-3 py-1.5 rounded-lg shadow-sm">
                <Wind size={16} className="text-sky-300" />
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                        {Math.abs(state.wind_x).toFixed(1)}
                    </span>
                    {/* Direction arrow based on wind_x and wind_y */}
                    <div 
                        className="text-white transform transition-transform"
                        style={{ 
                            rotate: `${Math.atan2(state.wind_y, state.wind_x) * (180/Math.PI)}deg` 
                        }}
                    >
                        ➔
                    </div>
                    <span className="text-xs font-bold text-white">
                        {Math.abs(state.wind_y).toFixed(1)}
                    </span>
                </div>
            </div>
        </div>

        {/* Player B Score */}
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
                shooting ? "Arrow is flying..." : "Drag anywhere to aim, pull back to shoot!"
            ) : (
                state.game_over ? "Game Over" : "Waiting for opponent..."
            )}
        </p>
      </div>
    </div>
  );
}
