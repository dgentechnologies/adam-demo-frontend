// app/icon.tsx — generates the site favicon dynamically via Next.js ImageResponse.
// This eliminates the /favicon.ico 404 without needing a binary file in /public.
import { ImageResponse } from 'next/og';

export const size        = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          '100%',
          height:         '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
          borderRadius:   '6px',
          color:          '#ffffff',
          fontSize:       '18px',
          fontWeight:     900,
          letterSpacing:  '-0.5px',
        }}
      >
        D
      </div>
    ),
    { ...size },
  );
}
