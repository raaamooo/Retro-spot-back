"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const qrcode_1 = __importDefault(require("qrcode"));
const fs_1 = __importDefault(require("fs"));
async function test() {
    const url = 'http://localhost:3000/menu?locationId=Table_4';
    try {
        // Generate SVG string
        const svg = await qrcode_1.default.toString(url, {
            type: 'svg',
            width: 300,
            margin: 2,
            color: {
                dark: '#3D2010', // Dark Coffee
                light: '#FFFFFF' // White background
            }
        });
        // We want to insert a white badge and text in the center of the QR code.
        // In a 300x300 viewBox, the center is at (150, 150).
        const customElements = `
  <!-- Logo/Text Badge -->
  <rect x="80" y="132" width="140" height="36" rx="6" fill="#FFFFFF" stroke="#3D2010" stroke-width="2" />
  <text x="150" y="156" font-family="'Cormorant Garamond', Georgia, serif" font-size="16" font-weight="bold" fill="#3D2010" text-anchor="middle" letter-spacing="1">Retrospot</text>
</svg>`;
        const modifiedSvg = svg.replace('</svg>', customElements);
        // Save to test file
        fs_1.default.writeFileSync('test_qr.svg', modifiedSvg);
        console.log('Successfully generated test_qr.svg');
        const base64 = Buffer.from(modifiedSvg).toString('base64');
        const dataUrl = `data:image/svg+xml;base64,${base64}`;
        console.log('Data URL length:', dataUrl.length);
    }
    catch (err) {
        console.error(err);
    }
}
test();
