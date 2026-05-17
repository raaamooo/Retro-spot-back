import QRCode from 'qrcode';

export async function generateLocationQR(locationId: string, baseUrl: string): Promise<string> {
  try {
    const url = `${baseUrl}/menu?locationId=${locationId}`;
    
    // Generate high-fidelity SVG string instead of PNG
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: 300,
      margin: 2,
      color: {
        dark: '#3D2010',  // Dark Coffee color
        light: '#FFFFFF'  // White background
      }
    });

    // Insert white badge and elegant brand text "Retrospot" in the center of 300x300 viewBox
    const customElements = `
  <!-- Logo/Text Badge -->
  <rect x="80" y="132" width="140" height="36" rx="6" fill="#FFFFFF" stroke="#3D2010" stroke-width="2" />
  <text x="150" y="156" font-family="'Cormorant Garamond', Georgia, serif" font-size="16" font-weight="bold" fill="#3D2010" text-anchor="middle" letter-spacing="1">Retrospot</text>
</svg>`;

    const modifiedSvg = svg.replace('</svg>', customElements);
    
    // Convert to Base64 Data URL for universal <img> compatibility
    const base64 = Buffer.from(modifiedSvg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (err) {
    console.error('Failed to generate QR code', err);
    throw err;
  }
}
