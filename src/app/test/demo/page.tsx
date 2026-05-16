'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './demo.module.css';

const EMOTIONS = [
  'angry',
  'confused',
  'happy',
  'love',
  'panic',
  'reconnecting',
  'rizz',
  'sad',
  'search-thinking',
  'shy',
  'sleep',
  'surprised',
];

export default function DemoPage() {
  const [activeEmotion, setActiveEmotion] = useState<string>('happy');
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  return (
    <div className={styles.container}>
      <div className={styles.testArea}>
        {/* Background Image */}
        <img src="/images/bg2.png" alt="Background" className={styles.bgImage} />

        {/* Emotion Layer - Iframe */}
        <div className={styles.emotionLayer}>
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
