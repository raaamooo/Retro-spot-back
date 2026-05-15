"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLocationQR = generateLocationQR;
const qrcode_1 = __importDefault(require("qrcode"));
async function generateLocationQR(locationId, baseUrl) {
    try {
        const url = `${baseUrl}/menu?locationId=${locationId}`;
        const qrDataUrl = await qrcode_1.default.toDataURL(url);
        return qrDataUrl;
    }
    catch (err) {
        console.error('Failed to generate QR code', err);
        throw err;
    }
}
