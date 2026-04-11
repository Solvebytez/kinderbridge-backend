require('dotenv').config({ path: require('path').join(__dirname, '../config.env') });
const { connectToMongoDB } = require('../src/config/database');
const Daycare = require('../src/schemas/DaycareSchema');

async function checkAgeRangeValues() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectToMongoDB();
    
    console.log('\n📊 Checking ageRange field values in daycares...\n');
    
    // Get all distinct ageRange values
    const daycares = await Daycare.find({}).select('ageRange').lean();
    
    // Count occurrences of each ageRange value
    const ageRangeCounts = {};
    const ageRangeSamples = {};
    
    daycares.forEach((daycare) => {
      const ageRange = daycare.ageRange || 'NO';
      if (!ageRangeCounts[ageRange]) {
        ageRangeCounts[ageRange] = 0;
        ageRangeSamples[ageRange] = [];
      }
      ageRangeCounts[ageRange]++;
      if (ageRangeSamples[ageRange].length < 3) {
        ageRangeSamples[ageRange].push(daycare.ageRange);
      }
    });
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('AGE RANGE VALUES IN DATABASE');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const sortedEntries = Object.entries(ageRangeCounts).sort((a, b) => b[1] - a[1]);
    
    sortedEntries.forEach(([ageRange, count]) => {
      console.log(`"${ageRange}": ${count} daycares`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`Total unique ageRange values: ${sortedEntries.length}`);
    console.log(`Total daycares: ${daycares.length}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Also check what the frontend is currently using
    console.log('📋 Frontend currently uses these values:');
    console.log('   - "Infants"');
    console.log('   - "Toddlers"');
    console.log('   - "Preschool"');
    console.log('\n💡 Note: Database has ageGroups (infant, toddler, preschool, schoolAge)');
    console.log('   but ageRange field may have different values\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAgeRangeValues();

