async function main() {
  try {
    const res = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: '4010e756-688f-43de-82d7-8754eb23bcd0',
        customerName: 'Test HTTP',
        notes: '',
        paymentMethod: 'CASH',
        tipAmount: 0,
        subtotal: 100,
        total: 100,
        items: [
          {
            menuItemId: '1', // Fake ID
            quantity: 1,
            itemPriceAtTime: 100
          }
        ]
      })
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error("HTTP error:", e.message);
  }
}
main();
