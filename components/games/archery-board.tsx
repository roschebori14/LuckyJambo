"use client";

import { useEffect, useRef, useState } from "react";
import type { ArcheryState, ArcheryShot } from "@/types/archery";
import { TARGET_RADIUS, RING_WIDTH } from "@/lib/games/archery/engine";
import { useMatchRealtime } from "@/hooks/use-match-realtime";
import { useSound } from "@/lib/sound/sound-manager";

const CANVAS_W = 400;
const CANVAS_H = 600;

interface Props {
  matchId: string;
  userId: string;
}

export default function ArcheryBoard({ matchId, userId }: Props) {
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

  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch(`/api/matches/${matchId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (data.game_state) setState(data.game_state as ArcheryState);
      } catch (err: any) {
        setError(err.message);
      }
    }
    fetchState();
  }, [matchId]);

  useMatchRealtime(matchId, (row) => {
    // If we're shooting, ignore updates (optimistic update wins).
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

  useEffect(() => {
    if (!state || gameRef.current || !containerRef.current) return;

    let initPhaser = async () => {
      const Phaser = (await import("phaser")).default;
      const config: import("phaser").Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current!,
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: "#6ab04c",
        scene: {
          preload: function(this: import("phaser").Scene) {},
          create: function(this: import("phaser").Scene) {
            sceneRef.current = this;
            
            // Draw Target at the top center
            const cx = CANVAS_W / 2;
            const cy = 150;
            
            const colors = [
              0xffffff, 0xffffff, // 1, 2
              0x000000, 0x000000, // 3, 4
              0x00a8ff, 0x00a8ff, // 5, 6
              0xe84118, 0xe84118, // 7, 8
              0xfbc531, 0xfbc531  // 9, 10
            ];
            
            for (let i = 0; i < 10; i++) {
              const radius = TARGET_RADIUS - (i * RING_WIDTH);
              this.add.circle(cx, cy, radius, colors[Math.floor(i)]);
              if (i % 2 === 0) {
                 this.add.circle(cx, cy, radius, 0x000000, 0).setStrokeStyle(1, 0x000000, 0.2);
              }
            }
            
            // Crosshair / Wind indicator
            this.add.text(10, 10, 'Wind', { color: '#000' });
            
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
  
  // Handling dragging for archery shot
  useEffect(() => {
    if (!boardReady || !sceneRef.current || !state || !isMyTurn) return;
    
    const scene = sceneRef.current;
    
    // Draw an arrow for the player to aim
    const arrowStartX = CANVAS_W / 2;
    const arrowStartY = CANVAS_H - 100;
    
    const aimLine = scene.add.line(0, 0, arrowStartX, arrowStartY, arrowStartX, arrowStartY, 0xff0000).setOrigin(0,0);
    const arrowBody = scene.add.rectangle(arrowStartX, arrowStartY, 4, 60, 0x8B4513);
    const arrowHead = scene.add.triangle(arrowStartX, arrowStartY - 30, 0, 10, 5, 0, 10, 10, 0xC0C0C0);
    
    let isAiming = false;
    let dragStartX = 0;
    let dragStartY = 0;
    
    const onPointerDown = (pointer: import("phaser").Input.Pointer) => {
      if (shootingRef.current) return;
      isAiming = true;
      dragStartX = pointer.x;
      dragStartY = pointer.y;
    };
    
    const onPointerMove = (pointer: import("phaser").Input.Pointer) => {
      if (!isAiming) return;
      
      const dx = dragStartX - pointer.x;
      const dy = Math.max(0, dragStartY - pointer.y); // only pull back
      
      // Calculate angle and power
      // This is a simplified aiming mechanism
      arrowBody.x = arrowStartX - dx;
      arrowHead.x = arrowStartX - dx;
      
      // Just a visual representation
    };
    
    const onPointerUp = async (pointer: import("phaser").Input.Pointer) => {
      if (!isAiming) return;
      isAiming = false;
      
      const dx = dragStartX - pointer.x;
      const dy = Math.max(0, dragStartY - pointer.y);
      
      const power = Math.min(1, Math.sqrt(dx*dx + dy*dy) / 200);
      const angle = Math.atan2(-dy, -dx);
      
      if (power < 0.1) {
        // Cancel shot
        arrowBody.x = arrowStartX;
        arrowHead.x = arrowStartX;
        return;
      }
      
      // Execute shot
      setShooting(true);
      
      // Faked simulation:
      // In 2D, we just figure out where it lands based on angle and wind.
      const flightDuration = 1000; // ms
      
      // Center of target is at cx=CANVAS_W/2, cy=150
      const cx = CANVAS_W / 2;
      const cy = 150;
      
      // Calculate landing point
      // If angle is straight up (-Math.PI/2) and power is 1, it hits center?
      // Let's make a simple mapping.
      const normalizedDx = dx / 150;
      const normalizedDy = dy / 150;
      
      const landX = cx + (normalizedDx * 200) + (state.wind_x * 10);
      const landY = cy - (normalizedDy * 200) + 200 + (state.wind_y * 10); // +200 offset to require some pull
      
      // Animate arrow flying
      scene.tweens.add({
        targets: [arrowBody, arrowHead],
        y: landY,
        x: landX,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: flightDuration,
        ease: 'Power2',
        onComplete: async () => {
          play("wood_hit"); // placeholder sound
          
          // submit shot
          const shot: ArcheryShot = {
             playerId: userId,
             angle,
             power,
             windX: state.wind_x,
             windY: state.wind_y,
             finalX: landX - cx,
             finalY: landY - cy,
             score: 0 // to be calculated on server
          };
          
          try {
            const res = await fetch("/api/archery/shot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                 matchId,
                 shot
              })
            });
            
            // We can reload state or let realtime handle it
          } catch (e) {
            console.error(e);
          }
          
          setShooting(false);
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
      aimLine.destroy();
      arrowBody.destroy();
      arrowHead.destroy();
    };
    
  }, [boardReady, isMyTurn, state, userId, play, matchId]);
  
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!state) return <div className="p-4 text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      {/* Scoreboard */}
      <div className="flex w-full max-w-[400px] justify-between px-4 font-mono text-xl text-white">
        <div>P1: {state.a_score}</div>
        <div>Round: {state.round}</div>
        <div>P2: {state.b_score}</div>
      </div>
      
      {/* Wind Indicator */}
      <div className="flex w-full max-w-[400px] justify-between px-4 text-white">
        <div>Wind X: {state.wind_x.toFixed(1)}</div>
        <div>Wind Y: {state.wind_y.toFixed(1)}</div>
      </div>
      
      <div 
         ref={containerRef} 
         className="relative w-[400px] h-[600px] rounded-xl overflow-hidden shadow-2xl border-4 border-slate-800"
      />
      
      <p className="text-sm text-gray-400 mt-4 text-center max-w-sm">
        {isMyTurn ? "Drag down and release to shoot" : (state.game_over ? "Game Over" : "Waiting for opponent...")}
      </p>
    </div>
  );
}
