"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const client_1 = require("@prisma/client");
const socketEvents_1 = require("../socketEvents");
const prisma = new client_1.PrismaClient();
// Default configuration values
const DEFAULTS = {
    taxRate: { value: '14', label: 'Tax Rate (%)' },
    serviceChargeRate: { value: '0', label: 'Service Charge (%)' },
    loyaltyPointsPerEGP: { value: '1', label: 'Loyalty Points per EGP Spent' },
    loyaltyRedemptionRate: { value: '0.1', label: 'EGP Value per Loyalty Point' },
    rushThresholdMinutes: { value: '5', label: 'Rush Threshold (minutes)' },
    criticalThresholdMinutes: { value: '10', label: 'Critical Wait Threshold (minutes)' },
    idleTimeoutMinutes: { value: '30', label: 'Auto-Logout Idle Timeout (minutes)' },
    shiftStartHour: { value: '8', label: 'Default Shift Start Hour' },
    shiftEndHour: { value: '22', label: 'Default Shift End Hour' },
    currency: { value: 'EGP', label: 'Currency Code' },
};
class ConfigService {
    io;
    cache = new Map();
    constructor(io) {
        this.io = io;
    }
    /**
     * Initialize defaults if not present in the database.
     */
    async seedDefaults() {
        for (const [key, { value, label }] of Object.entries(DEFAULTS)) {
            const existing = await prisma.systemConfig.findUnique({ where: { key } });
            if (!existing) {
                await prisma.systemConfig.create({ data: { key, value, label } });
            }
        }
        // Populate cache
        await this.refreshCache();
    }
    /**
     * Get a single config value. Returns the default if not found.
     */
    async getConfig(key) {
        if (this.cache.has(key))
            return this.cache.get(key);
        const record = await prisma.systemConfig.findUnique({ where: { key } });
        if (record) {
            this.cache.set(key, record.value);
            return record.value;
        }
        return DEFAULTS[key]?.value || '';
    }
    /**
     * Get a config value as a number.
     */
    async getNumber(key) {
        const val = await this.getConfig(key);
        return parseFloat(val) || 0;
    }
    /**
     * Set a config value and broadcast the change.
     */
    async setConfig(key, value) {
        const record = await prisma.systemConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value, label: DEFAULTS[key]?.label || key },
        });
        this.cache.set(key, value);
        this.io.emit(socketEvents_1.EVENTS.CONFIG_UPDATED, { key, value });
        return record;
    }
    /**
     * Get all configuration values.
     */
    async getAllConfigs() {
        const records = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
        return records;
    }
    /**
     * Refresh the in-memory cache from the database.
     */
    async refreshCache() {
        const records = await prisma.systemConfig.findMany();
        this.cache.clear();
        records.forEach(r => this.cache.set(r.key, r.value));
    }
}
exports.ConfigService = ConfigService;
