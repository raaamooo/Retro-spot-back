import QRCode from 'qrcode';

export async function generateLocationQR(locationId: string, baseUrl: string): Promise<string> {
  try {
    const url = `${baseUrl}/menu?locationId=${locationId}`;
    const qrDataUrl = await QRCode.toDataURL(url);
    return qrDataUrl;
  } catch (err) {
    console.error('Failed to generate QR code', err);
    throw err;
  }
}
