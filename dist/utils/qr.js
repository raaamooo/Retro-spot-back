"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLocationQR = generateLocationQR;
const qrcode_1 = __importDefault(require("qrcode"));
async function generateLocationQR(locationName, baseUrl) {
    try {
        const encodedLocation = encodeURIComponent(locationName);
        const url = `${baseUrl}/menu?location=${encodedLocation}`;
        // Generate high-fidelity SVG string instead of PNG
        const svg = await qrcode_1.default.toString(url, {
            type: 'svg',
            width: 300,
            margin: 2,
            color: {
                dark: '#3D2010', // Dark Coffee color
                light: '#FFFFFF' // White background
            }
        });
        // Dynamically extract the viewBox dimensions to scale logo overlay coordinates perfectly
        const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
        let viewWidth = 37;
        let viewHeight = 37;
        if (viewBoxMatch) {
            const parts = viewBoxMatch[1].split(' ');
            if (parts.length === 4) {
                viewWidth = parseFloat(parts[2]);
                viewHeight = parseFloat(parts[3]);
            }
        }
        const centerX = viewWidth / 2;
        const centerY = viewHeight / 2;
        // Proportional dimensions based on the QR code coordinate space
        const badgeWidth = viewWidth * 0.45;
        const badgeHeight = viewHeight * 0.125;
        const badgeX = centerX - (badgeWidth / 2);
        const badgeY = centerY - (badgeHeight / 2);
        const rx = badgeHeight * 0.15;
        const strokeWidth = viewWidth * 0.008;
        const fontSize = badgeHeight * 0.48;
        const textY = centerY + (fontSize * 0.32); // Adjust text baseline to center perfectly
        const customElements = `
  <!-- Logo/Text Badge dynamically scaled to grid -->
  <rect x="${badgeX.toFixed(3)}" y="${badgeY.toFixed(3)}" width="${badgeWidth.toFixed(3)}" height="${badgeHeight.toFixed(3)}" rx="${rx.toFixed(3)}" fill="#FFFFFF" stroke="#3D2010" stroke-width="${strokeWidth.toFixed(3)}" />
  <text x="${centerX.toFixed(3)}" y="${textY.toFixed(3)}" font-family="'Cormorant Garamond', Georgia, serif" font-size="${fontSize.toFixed(3)}" font-weight="bold" fill="#3D2010" text-anchor="middle" letter-spacing="0.1">Retrospot</text>
</svg>`;
        const modifiedSvg = svg.replace('</svg>', customElements);
        // Convert to Base64 Data URL for universal <img> compatibility
        const base64 = Buffer.from(modifiedSvg).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
    }
    catch (err) {
        console.error('Failed to generate QR code', err);
        throw err;
    }
}
