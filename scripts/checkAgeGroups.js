require('dotenv').config({ path: require('path').join(__dirname, '../config.env') });
const { connectToMongoDB } = require('../src/config/database');
const Daycare = require('../src/schemas/DaycareSchema');

async function checkAgeGroups() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await connectToMongoDB();
    
    console.log('\n📊 Checking age group data in daycares...\n');
    
    // Get all daycares
    const daycares = await Daycare.find({}).lean();
    
    console.log(`Total daycares: ${daycares.length}\n`);
    
    // Statistics
    const stats = {
      infant: { total: 0, withData: 0, samples: [] },
      toddler: { total: 0, withData: 0, samples: [] },
      preschool: { total: 0, withData: 0, samples: [] },
      schoolAge: { total: 0, withData: 0, samples: [] },
    };
    
    // Check each daycare
    daycares.forEach((daycare, index) => {
      // Check Infant (birth-18 months)
      if (daycare.ageGroups?.infant) {
        stats.infant.total++;
        const infant = daycare.ageGroups.infant;
        if (infant.capacity > 0 || infant.vacancy > 0 || infant.qualityRating > 0) {
          stats.infant.withData++;
          if (stats.infant.samples.length < 5) {
            stats.infant.samples.push({
              name: daycare.name,
              capacity: infant.capacity,
              vacancy: infant.vacancy,
              qualityRating: infant.qualityRating,
            });
          }
        }
      }
      
      // Check Toddler (18-30 months)
      if (daycare.ageGroups?.toddler) {
        stats.toddler.total++;
        const toddler = daycare.ageGroups.toddler;
        if (toddler.capacity > 0 || toddler.vacancy > 0 || toddler.qualityRating > 0) {
          stats.toddler.withData++;
          if (stats.toddler.samples.length < 5) {
            stats.toddler.samples.push({
              name: daycare.name,
              capacity: toddler.capacity,
              vacancy: toddler.vacancy,
              qualityRating: toddler.qualityRating,
            });
          }
        }
      }
      
      // Check Preschool (30 months-4/5 years)
      if (daycare.ageGroups?.preschool) {
        stats.preschool.total++;
        const preschool = daycare.ageGroups.preschool;
        if (preschool.capacity > 0 || preschool.vacancy > 0 || preschool.qualityRating > 0) {
          stats.preschool.withData++;
          if (stats.preschool.samples.length < 5) {
            stats.preschool.samples.push({
              name: daycare.name,
              capacity: preschool.capacity,
              vacancy: preschool.vacancy,
              qualityRating: preschool.qualityRating,
            });
          }
        }
      }
      
      // Check School-Age (around 5-12 years)
      if (daycare.ageGroups?.schoolAge) {
        stats.schoolAge.total++;
        const schoolAge = daycare.ageGroups.schoolAge;
        if (schoolAge.capacity > 0 || schoolAge.vacancy > 0 || schoolAge.qualityRating > 0) {
          stats.schoolAge.withData++;
          if (stats.schoolAge.samples.length < 5) {
            stats.schoolAge.samples.push({
              name: daycare.name,
              capacity: schoolAge.capacity,
              vacancy: schoolAge.vacancy,
              qualityRating: schoolAge.qualityRating,
            });
          }
        }
      }
    });
    
    // Display results
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('AGE GROUP DATA SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('1. INFANTS (birth-18 months)');
    console.log('   ───────────────────────────────────────────────────────────');
    console.log(`   Total daycares with infant field: ${stats.infant.total}`);
    console.log(`   Daycares with actual data (capacity/vacancy/rating > 0): ${stats.infant.withData}`);
    if (stats.infant.samples.length > 0) {
      console.log('\n   Sample data:');
      stats.infant.samples.forEach((sample, i) => {
        console.log(`   ${i + 1}. ${sample.name}`);
        console.log(`      Capacity: ${sample.capacity}, Vacancy: ${sample.vacancy}, Quality Rating: ${sample.qualityRating}`);
      });
    } else {
      console.log('   ⚠️  No daycares with actual data found');
    }
    
    console.log('\n2. TODDLERS (18-30 months)');
    console.log('   ───────────────────────────────────────────────────────────');
    console.log(`   Total daycares with toddler field: ${stats.toddler.total}`);
    console.log(`   Daycares with actual data (capacity/vacancy/rating > 0): ${stats.toddler.withData}`);
    if (stats.toddler.samples.length > 0) {
      console.log('\n   Sample data:');
      stats.toddler.samples.forEach((sample, i) => {
        console.log(`   ${i + 1}. ${sample.name}`);
        console.log(`      Capacity: ${sample.capacity}, Vacancy: ${sample.vacancy}, Quality Rating: ${sample.qualityRating}`);
      });
    } else {
      console.log('   ⚠️  No daycares with actual data found');
    }
    
    console.log('\n3. PRESCHOOLERS (30 months-4/5 years)');
    console.log('   ───────────────────────────────────────────────────────────');
    console.log(`   Total daycares with preschool field: ${stats.preschool.total}`);
    console.log(`   Daycares with actual data (capacity/vacancy/rating > 0): ${stats.preschool.withData}`);
    if (stats.preschool.samples.length > 0) {
      console.log('\n   Sample data:');
      stats.preschool.samples.forEach((sample, i) => {
        console.log(`   ${i + 1}. ${sample.name}`);
        console.log(`      Capacity: ${sample.capacity}, Vacancy: ${sample.vacancy}, Quality Rating: ${sample.qualityRating}`);
      });
    } else {
      console.log('   ⚠️  No daycares with actual data found');
    }
    
    console.log('\n4. SCHOOL-AGE (around 5-12 years)');
    console.log('   ───────────────────────────────────────────────────────────');
    console.log(`   Total daycares with schoolAge field: ${stats.schoolAge.total}`);
    console.log(`   Daycares with actual data (capacity/vacancy/rating > 0): ${stats.schoolAge.withData}`);
    if (stats.schoolAge.samples.length > 0) {
      console.log('\n   Sample data:');
      stats.schoolAge.samples.forEach((sample, i) => {
        console.log(`   ${i + 1}. ${sample.name}`);
        console.log(`      Capacity: ${sample.capacity}, Vacancy: ${sample.vacancy}, Quality Rating: ${sample.qualityRating}`);
      });
    } else {
      console.log('   ⚠️  No daycares with actual data found');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('DETAILED FIELD BREAKDOWN');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Get detailed breakdown
    const detailedStats = {
      infant: { capacity: [], vacancy: [], qualityRating: [] },
      toddler: { capacity: [], vacancy: [], qualityRating: [] },
      preschool: { capacity: [], vacancy: [], qualityRating: [] },
      schoolAge: { capacity: [], vacancy: [], qualityRating: [] },
    };
    
    daycares.forEach(daycare => {
      ['infant', 'toddler', 'preschool', 'schoolAge'].forEach(group => {
        if (daycare.ageGroups?.[group]) {
          const data = daycare.ageGroups[group];
          if (data.capacity !== undefined) detailedStats[group].capacity.push(data.capacity);
          if (data.vacancy !== undefined) detailedStats[group].vacancy.push(data.vacancy);
          if (data.qualityRating !== undefined) detailedStats[group].qualityRating.push(data.qualityRating);
        }
      });
    });
    
    ['infant', 'toddler', 'preschool', 'schoolAge'].forEach(group => {
      const groupName = group === 'schoolAge' ? 'School-Age' : group.charAt(0).toUpperCase() + group.slice(1);
      console.log(`${groupName}:`);
      console.log(`  Capacity values: ${JSON.stringify(detailedStats[group].capacity.slice(0, 20))}${detailedStats[group].capacity.length > 20 ? '...' : ''}`);
      console.log(`  Vacancy values: ${JSON.stringify(detailedStats[group].vacancy.slice(0, 20))}${detailedStats[group].vacancy.length > 20 ? '...' : ''}`);
      console.log(`  Quality Rating values: ${JSON.stringify(detailedStats[group].qualityRating.slice(0, 20))}${detailedStats[group].qualityRating.length > 20 ? '...' : ''}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAgeGroups();

