'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './demo.module.css';

const BG2_FACE_RECT = {
  x: 580 / 1672,
  y: 254 / 940,
  w: 177 / 1672,
  h: 128 / 940,
};

const EMOTIONS = [
  'angry',
  'confused',
  'happy',
  'ideal',
  'love',
  'panic',
  'reconnecting',
  'rizz',
  'sad',
  'search-thinking',
  'speeking',
  'shy',
  'sleep',
  'surprised',
];

export default function DemoPage() {
  const [activeEmotion, setActiveEmotion] = useState<string>('happy');
  const [emotionLayerStyle, setEmotionLayerStyle] = useState({
    left: '34.69%',
    top: '27.02%',
    width: '10.59%',
    height: '13.62%',
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const testAreaRef = useRef<HTMLDivElement>(null);
  const bgImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeLoad = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          // Hide scrollbars and fit content
          const style = iframeDoc.createElement('style');
          style.textContent = `
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000 !important;
  }

  body {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  svg {
    width: 100% !important;
    height: 100% !important;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) !important;
  }

  .label {
    display: none !important;
  }

  ::-webkit-scrollbar {
    display: none;
  }
`;
          iframeDoc.head.appendChild(style);
        }
      } catch (e) {
        // CORS or other restrictions
        console.log('Could not inject styles into iframe');
      }
    };

    iframe.addEventListener('load', handleIframeLoad);
    return () => iframe.removeEventListener('load', handleIframeLoad);
  }, []);

  useEffect(() => {
    const updateEmotionLayerPosition = () => {
      const container = testAreaRef.current;
      const bg = bgImageRef.current;
      if (!container || !bg || !bg.naturalWidth || !bg.naturalHeight) return;

      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const nw = bg.naturalWidth;
      const nh = bg.naturalHeight;

      // Match CSS object-fit: cover mapping for bg2.png.
      const scale = Math.max(cw / nw, ch / nh);
      const renderW = nw * scale;
      const renderH = nh * scale;
      const offsetX = (cw - renderW) / 2;
      const offsetY = (ch - renderH) / 2;

      const left = offsetX + BG2_FACE_RECT.x * renderW;
      const top = offsetY + BG2_FACE_RECT.y * renderH;
      const width = BG2_FACE_RECT.w * renderW;
      const height = BG2_FACE_RECT.h * renderH;

      setEmotionLayerStyle({
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
    };

    const bg = bgImageRef.current;
    if (!bg) return;

    if (bg.complete) {
      updateEmotionLayerPosition();
    }

    bg.addEventListener('load', updateEmotionLayerPosition);
    window.addEventListener('resize', updateEmotionLayerPosition);

    return () => {
      bg.removeEventListener('load', updateEmotionLayerPosition);
      window.removeEventListener('resize', updateEmotionLayerPosition);
    };
  }, []);

  return (
    <div className={styles.container}>
      <div ref={testAreaRef} className={styles.testArea}>
        {/* Background Image */}
        <img ref={bgImageRef} src="/images/bg2.png" alt="Background" className={styles.bgImage} />

        {/* Emotion Layer - Iframe */}
        <div className={styles.emotionLayer} style={emotionLayerStyle}>
          <iframe
            ref={iframeRef}
            key={activeEmotion}
            src={`/emotions/${activeEmotion}.html`}
            className={styles.emotionIframe}
            title={`${activeEmotion} emotion`}
            scrolling="no"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>

      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <h2 className={styles.title}>Emotion Test Panel</h2>
        <p className={styles.subtitle}>Click an emotion to test</p>

        <div className={styles.buttonGrid}>
          {EMOTIONS.map((emotion) => (
            <button
              key={emotion}
              className={`${styles.emotionBtn} ${activeEmotion === emotion ? styles.active : ''}`}
              onClick={() => setActiveEmotion(emotion)}
            >
              {emotion}
            </button>
          ))}
        </div>

        <div className={styles.info}>
          <p>
            <strong>Active Emotion:</strong> {activeEmotion}
          </p>
          <p className={styles.hint}>Emotion HTML files are displayed as iframes positioned behind the background image.</p>
        </div>
      </div>
    </div>
  );
}
