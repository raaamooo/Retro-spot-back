const http = require('http');

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

async function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let response = '';
      res.on('data', chunk => response += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: response }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    const menu = await fetchJson('http://localhost:5000/api/menu');
    const firstItem = menu[0].items[0];
    
    // Invalid location ID
    const locationId = 'Table 1';
    
    const res = await postJson('http://localhost:5000/api/orders', {
      locationId: locationId,
      customerName: 'Test HTTP Invalid Location',
      notes: '',
      paymentMethod: 'CASH',
      tipAmount: 0,
      subtotal: firstItem.price,
      total: firstItem.price,
      items: [
        {
          menuItemId: firstItem.id,
          quantity: 1,
          itemPriceAtTime: firstItem.price
        }
      ]
    });
    
    console.log('Order creation result:', res.status, res.data);
  } catch (e) {
    console.error("HTTP error:", e.message);
  }
}
main();
