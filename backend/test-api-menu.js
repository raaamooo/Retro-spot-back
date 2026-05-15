const http = require('http');
http.get('http://localhost:5000/api/menu', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const hasAdditions = json.some(c => c.nameEn === 'Additions');
    console.log('Categories:', json.map(c => c.nameEn));
    console.log('Has Additions category?', hasAdditions);
  });
});
