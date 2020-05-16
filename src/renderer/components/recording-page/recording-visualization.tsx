import React, { FC, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export const RecordingVisualization: FC = () => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef(false);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (canvasElement && !drawnRef.current) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        ctx.font = '2rem "Source Han Sans"';
        ctx.fillText(t('Nothing for now'), 10, 50);
        drawnRef.current = true;
      }
    }
  }, [t]);

  return <canvas ref={canvasRef} />;
};
