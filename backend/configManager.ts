import fs from 'fs';
import path from 'path';

const configPath = path.join(__dirname, 'config.json');

const defaultConfig = {
  instapayPhone: '01012345678',
  mobileWalletPhone: '01012345678',
  mapEmbedUrl: '',
  paymentProvider: 'instapay',
  table4Price: 50,
  table2Price: 30,
  room7Price: 150
};

export function getConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return { ...defaultConfig, ...JSON.parse(data) };
  } catch (err) {
    return defaultConfig;
  }
}

export function updateConfig(newConfig: any) {
  const current = getConfig();
  const merged = { ...current, ...newConfig };
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
  return merged;
}
