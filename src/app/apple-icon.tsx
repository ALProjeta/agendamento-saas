import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: '#D3AF37',
          fontSize: 120,
          fontWeight: 900,
          fontFamily: 'Georgia, serif',
          lineHeight: 1,
          marginTop: 8,
        }}
      >
        S
      </span>
    </div>,
    { ...size },
  )
}
