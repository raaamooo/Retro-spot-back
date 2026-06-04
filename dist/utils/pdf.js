"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReceiptPDF = generateReceiptPDF;
exports.generateBookingPDF = generateBookingPDF;
exports.generateArtBidPDF = generateArtBidPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function generateReceiptPDF(orderGroups, tableId) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ margin: 50 });
            const filename = `receipt_${tableId}_${Date.now()}.pdf`;
            const filepath = path_1.default.join(__dirname, '..', 'public', 'receipts', filename);
            // Ensure directory exists
            fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
            const writeStream = fs_1.default.createWriteStream(filepath);
            doc.pipe(writeStream);
            // Header
            doc.fontSize(20).text('Retro Spot Cafe', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Table/Location ID: ${tableId}`, { align: 'center' });
            doc.text(`Date: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown();
            let grandTotal = 0;
            // Orders
            orderGroups.forEach((order, idx) => {
                doc.fontSize(14).text(`Order #${idx + 1}`);
                order.items.forEach((item) => {
                    const itemTotal = item.quantity * item.itemPriceAtTime;
                    doc.fontSize(12).text(`${item.quantity}x ${item.menuItem.nameEn} - $${itemTotal.toFixed(2)}`);
                    if (item.additions) {
                        doc.fillColor('grey').fontSize(10).text(`   Additions: ${item.additions}`);
                        doc.fillColor('black');
                    }
                });
                grandTotal += order.total;
                doc.moveDown();
            });
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown();
            doc.fontSize(16).text(`Total: $${grandTotal.toFixed(2)}`, { align: 'right' });
            doc.end();
            writeStream.on('finish', () => resolve(`/receipts/${filename}`));
            writeStream.on('error', reject);
        }
        catch (err) {
            reject(err);
        }
    });
}
function generateBookingPDF(booking) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ margin: 50 });
            const filename = `booking_${booking.id}.pdf`;
            const filepath = path_1.default.join(__dirname, '..', 'public', 'bookings', filename);
            fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
            const writeStream = fs_1.default.createWriteStream(filepath);
            doc.pipe(writeStream);
            doc.fontSize(20).text('Retro Spot - Booking Confirmation', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text(`Booking ID: ${booking.id}`);
            doc.text(`Name: ${booking.name}`);
            doc.text(`Event Type: ${booking.eventType}`);
            doc.text(`People: ${booking.peopleCount}`);
            doc.text(`Date: ${booking.date}`);
            doc.text(`Time: ${booking.startTime} - ${booking.endTime}`);
            doc.text(`Total Price: $${booking.totalPrice.toFixed(2)}`);
            doc.text(`Status: ${booking.status}`);
            doc.end();
            writeStream.on('finish', () => resolve(`/bookings/${filename}`));
            writeStream.on('error', reject);
        }
        catch (err) {
            reject(err);
        }
    });
}
function generateArtBidPDF(bid) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ margin: 50 });
            const filename = `bid_${bid.id}.pdf`;
            const filepath = path_1.default.join(__dirname, '..', 'public', 'bids', filename);
            fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
            const writeStream = fs_1.default.createWriteStream(filepath);
            doc.pipe(writeStream);
            doc.fontSize(20).text('Retro Spot - Art Bid Confirmation', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text(`Bid ID: ${bid.id}`);
            doc.text(`Art Piece: ${bid.art.titleEn}`);
            doc.text(`Bidder Name: ${bid.bidderName}`);
            doc.text(`Bid Amount: $${bid.bidAmount.toFixed(2)}`);
            doc.text(`Status: ${bid.status}`);
            doc.end();
            writeStream.on('finish', () => resolve(`/bids/${filename}`));
            writeStream.on('error', reject);
        }
        catch (err) {
            reject(err);
        }
    });
}
