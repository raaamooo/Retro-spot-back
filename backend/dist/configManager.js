"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.updateConfig = updateConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const configPath = path_1.default.join(__dirname, 'config.json');
const defaultConfig = {
    instapayPhone: '01012345678',
    mobileWalletPhone: '01012345678',
    mapEmbedUrl: '',
    paymentProvider: 'instapay',
    table4Price: 50,
    table2Price: 30,
    room7Price: 150
};
function getConfig() {
    if (!fs_1.default.existsSync(configPath)) {
        fs_1.default.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
    }
    try {
        const data = fs_1.default.readFileSync(configPath, 'utf8');
        return { ...defaultConfig, ...JSON.parse(data) };
    }
    catch (err) {
        return defaultConfig;
    }
}
function updateConfig(newConfig) {
    const current = getConfig();
    const merged = { ...current, ...newConfig };
    fs_1.default.writeFileSync(configPath, JSON.stringify(merged, null, 2));
    return merged;
}
