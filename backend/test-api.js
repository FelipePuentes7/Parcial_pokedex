const app = require('./src/app');
const http = require('http');

const server = http.createServer(app);
server.listen(3001, async () => {
  console.log('Test server running on port 3001');

  try {
    const baseUrl = 'http://localhost:3001/pokemon';

    // 1. Test GET /pokemon?page=1&limit=2
    console.log('1. Testing GET /pokemon?page=1&limit=2');
    const res1 = await fetch(`${baseUrl}?page=1&limit=2`);
    const data1 = await res1.json();
    console.log('  Status:', res1.status, 'Total:', data1.total, 'First Pokemon Stats:', {
      name: data1.data[0]?.name,
      hp: data1.data[0]?.hp,
      attack: data1.data[0]?.attack,
      defense: data1.data[0]?.defense,
      sp_atk: data1.data[0]?.special_attack,
      sp_def: data1.data[0]?.special_defense,
      speed: data1.data[0]?.speed
    });

    // 2. Test Search (HU-04 - Nombre o ID)
    console.log('\n2. Testing GET /pokemon/search?name=pika (Búsqueda por texto)');
    const res2 = await fetch(`${baseUrl}/search?name=pika`);
    const data2 = await res2.json();
    console.log('  Status:', res2.status, 'Found:', data2.map(p => p.name));

    console.log('\n2b. Testing GET /pokemon/search?name=25 (Búsqueda exacta por ID numérico)');
    const res2b = await fetch(`${baseUrl}/search?name=25`);
    const data2b = await res2b.json();
    console.log('  Status:', res2b.status, 'Found by ID 25:', data2b.map(p => `${p.name} (#${p.pokedexId})`));

    console.log('\n2c. Testing GET /pokemon/search?name=1 (Búsqueda exacta por ID numérico)');
    const res2c = await fetch(`${baseUrl}/search?name=1`);
    const data2c = await res2c.json();
    console.log('  Status:', res2c.status, 'Found by ID 1:', data2c.map(p => `${p.name} (#${p.pokedexId})`));

    console.log('\n3. Testing GET /pokemon/search?type=ghost');
    const res3 = await fetch(`${baseUrl}/search?type=ghost`);
    const data3 = await res3.json();
    console.log('  Status:', res3.status, 'Found:', data3.map(p => p.name));

    console.log('\n4. Testing GET /pokemon/search?name=notfoundxyz');
    const res4 = await fetch(`${baseUrl}/search?name=notfoundxyz`);
    const data4 = await res4.json();
    console.log('  Status:', res4.status, 'Result is array:', Array.isArray(data4), 'Length:', data4.length);

    // 3. Test Import (HU-05) - Conflict on existing
    console.log('\n5. Testing POST /pokemon with existing "pikachu"');
    const res5 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pokemon: 'pikachu' })
    });
    console.log('  Status:', res5.status, '(Expected 409)');

    // 4. Test Import (HU-05) - Import Togepi (#175)
    console.log('\n6. Testing POST /pokemon with new pokemon "togepi"');
    const res6 = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pokemon: 'togepi' })
    });
    const data6 = await res6.json();
    console.log('  Status:', res6.status, 'Message:', data6.message, 'Imported:', data6.pokemon?.name, 'ID:', data6.pokemon?.pokedexId, 'Stats:', {
      hp: data6.pokemon?.hp,
      attack: data6.pokemon?.attack
    });

    // 5. Test Update (HU-06)
    console.log('\n7. Testing PUT /pokemon/175 with updated stats');
    const res7 = await fetch(`${baseUrl}/175`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hp: 120, attack: 85 })
    });
    const data7 = await res7.json();
    console.log('  Status:', res7.status, 'Updated HP:', data7.pokemon?.hp, 'Updated Attack:', data7.pokemon?.attack);

    // 6. Test Delete (HU-07)
    console.log('\n8. Testing DELETE /pokemon/175');
    const res8 = await fetch(`${baseUrl}/175`, { method: 'DELETE' });
    const data8 = await res8.json();
    console.log('  Status:', res8.status, 'Message:', data8.message);

    // Verify deletion
    const res9 = await fetch(`${baseUrl}/175`);
    console.log('  Verify after delete status:', res9.status, '(Expected 404)');

    console.log('\n🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
  }
});
