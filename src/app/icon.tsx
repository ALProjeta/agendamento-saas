import { ImageResponse } from 'next/og'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '40px',
      }}
    >
      <span
        style={{
          color: '#D3AF37',
          fontSize: 130,
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
