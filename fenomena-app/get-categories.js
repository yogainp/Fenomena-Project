async function getCategories() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fenomena.com', password: 'admin123' })
  });
  const cookie = loginRes.headers.get('set-cookie').match(/auth-token=([^;]+)/)[1];
  
  const categoriesRes = await fetch('http://localhost:3000/api/categories', {
    headers: { 'Cookie': 'auth-token=' + cookie }
  });
  const categories = await categoriesRes.json();
  
  console.log('Available categories:');
  categories.forEach((c, i) => {
    console.log(`${i + 1}. ID: ${c.id}, Name: ${c.name}`);
  });
}
getCategories().catch(console.error);