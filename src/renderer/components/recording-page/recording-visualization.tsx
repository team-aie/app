import React, { FC, useEffect, useRef } from 'react';

export const RecordingVisualization: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef(false);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (canvasElement && !drawnRef.current) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        ctx.font = '2rem Source Han Sans';
        ctx.fillText('Nothing here for now', 10, 50);
        drawnRef.current = true;
      }
    }
  }, []);

  return <canvas ref={canvasRef} />;
};
