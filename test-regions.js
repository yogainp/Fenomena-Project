// Get valid regions for testing
async function getRegions() {
  try {
    const response = await fetch('http://localhost:3000/api/regions');
    if (response.ok) {
      const regions = await response.json();
      console.log('Available regions (first 5):');
      regions.slice(0, 5).forEach(r => {
        console.log(`  ${r.regionCode}: ${r.city}, ${r.province}`);
      });
      console.log(`...and ${regions.length - 5} more regions`);
      return regions[0].regionCode; // Return first valid region code
    } else {
      console.log('Failed to fetch regions');
      return null;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

getRegions().then(regionCode => {
  if (regionCode) {
    console.log(`\n✅ Use this region code for testing: ${regionCode}`);
  }
});