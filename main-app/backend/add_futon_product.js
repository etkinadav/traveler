// Simple script to add futon product to database
// This will be called after the server is running

const futonProduct = {
  name: 'futon',
  model: 'futon',
  matirials: {},
  params: [
    {
      name: 'width',
      type: 'number',
      default: 200,
      min: 100,
      max: 300,
      round: 1
    },
    {
      name: 'depth',
      type: 'number',
      default: 120,
      min: 80,
      max: 200,
      round: 1
    },
    {
      name: 'plata',
      type: 'beamSingle',
      default: 0,
      min: 0,
      max: 0,
      round: 0,
      beams: []
    },
    {
      name: 'leg',
      type: 'beamSingle',
      default: 0,
      min: 0,
      max: 0,
      round: 0,
      beams: []
    },
    {
      name: 'extraBeam',
      type: 'number',
      default: 4,
      min: 2,
      max: 6,
      round: 0
    }
  ],
  restrictions: []
};

console.log('Futon product definition:');
console.log(JSON.stringify(futonProduct, null, 2));
console.log('\nTo add this product to the database, make a POST request to:');
console.log('http://localhost:3000/api/products');
console.log('With the above JSON as the request body.');


