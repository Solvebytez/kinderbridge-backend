/* eslint-disable no-console */
const path = require("path");
const dotenv = require("dotenv");
const { connectToMongoDB, disconnectFromMongoDB } = require("../src/config/database");

// Load backend env
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

function getDocumentSchema(doc) {
  if (!doc || typeof doc !== "object") {
    return {};
  }
  
  const schema = {};
  
  function analyzeValue(value, key = "") {
    if (value === null || value === undefined) {
      schema[key] = { type: "null", example: null };
    } else if (Array.isArray(value)) {
      schema[key] = {
        type: "array",
        length: value.length,
        itemType: value.length > 0 ? typeof value[0] : "unknown",
      };
      if (value.length > 0 && typeof value[0] === "object" && !Array.isArray(value[0])) {
        schema[key].itemSchema = getDocumentSchema(value[0]);
      }
    } else if (typeof value === "object") {
      schema[key] = {
        type: "object",
        fields: getDocumentSchema(value),
      };
    } else {
      schema[key] = {
        type: typeof value,
        example: typeof value === "string" && value.length > 50 
          ? value.substring(0, 50) + "..." 
          : value,
      };
    }
  }
  
  for (const [key, value] of Object.entries(doc)) {
    analyzeValue(value, key);
  }
  
  return schema;
}

function getFieldNames(schema, prefix = "") {
  const fields = [];
  
  for (const [key, value] of Object.entries(schema)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    fields.push(fullKey);
    
    if (value.type === "object" && value.fields) {
      fields.push(...getFieldNames(value.fields, fullKey));
    }
  }
  
  return fields;
}

function compareSchemas(schema1, schema2, name1 = "Schema 1", name2 = "Schema 2") {
  const fields1 = new Set(getFieldNames(schema1));
  const fields2 = new Set(getFieldNames(schema2));
  
  const onlyIn1 = [...fields1].filter(f => !fields2.has(f));
  const onlyIn2 = [...fields2].filter(f => !fields1.has(f));
  const common = [...fields1].filter(f => fields2.has(f));
  
  return {
    onlyIn1,
    onlyIn2,
    common,
    areIdentical: onlyIn1.length === 0 && onlyIn2.length === 0,
  };
}

async function compareDaycareSchemas() {
  try {
    console.log("🔍 Comparing schemas of 'daycares' and 'daycares_master' collections...\n");

    // Connect to MongoDB
    const connection = await connectToMongoDB();
    const db = connection.db;

    // Get collections
    const daycaresCollection = db.collection("daycares");
    const daycaresMasterCollection = db.collection("daycares_master");

    // Get counts
    const daycaresCount = await daycaresCollection.countDocuments();
    const daycaresMasterCount = await daycaresMasterCollection.countDocuments();

    console.log(`📊 Collection Statistics:`);
    console.log(`   daycares: ${daycaresCount} documents`);
    console.log(`   daycares_master: ${daycaresMasterCount} documents\n`);

    if (daycaresCount === 0) {
      console.log("❌ 'daycares' collection is empty. Cannot compare schemas.");
      return;
    }

    if (daycaresMasterCount === 0) {
      console.log("❌ 'daycares_master' collection is empty. Cannot compare schemas.");
      return;
    }

    // Get sample documents
    console.log("📄 Analyzing sample documents...\n");
    const daycaresSample = await daycaresCollection.findOne({});
    const daycaresMasterSample = await daycaresMasterCollection.findOne({});

    // Get schemas
    const daycaresSchema = getDocumentSchema(daycaresSample);
    const daycaresMasterSchema = getDocumentSchema(daycaresMasterSample);

    // Compare schemas
    const comparison = compareSchemas(
      daycaresSchema,
      daycaresMasterSchema,
      "daycares",
      "daycares_master"
    );

    console.log("=".repeat(80));
    console.log("📋 SCHEMA COMPARISON RESULTS");
    console.log("=".repeat(80) + "\n");

    if (comparison.areIdentical) {
      console.log("✅ SCHEMAS ARE IDENTICAL - Both collections have the same field structure!\n");
    } else {
      console.log("⚠️  SCHEMAS DIFFER - The collections have different field structures.\n");
    }

    console.log(`📈 Common fields (${comparison.common.length}):`);
    if (comparison.common.length > 0) {
      comparison.common.forEach((field, index) => {
        console.log(`   ${index + 1}. ${field}`);
      });
    }

    if (comparison.onlyIn1.length > 0) {
      console.log(`\n📤 Fields only in 'daycares' (${comparison.onlyIn1.length}):`);
      comparison.onlyIn1.forEach((field, index) => {
        console.log(`   ${index + 1}. ${field}`);
      });
    }

    if (comparison.onlyIn2.length > 0) {
      console.log(`\n📥 Fields only in 'daycares_master' (${comparison.onlyIn2.length}):`);
      comparison.onlyIn2.forEach((field, index) => {
        console.log(`   ${index + 1}. ${field}`);
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("📄 SAMPLE DOCUMENT STRUCTURES");
    console.log("=".repeat(80) + "\n");

    console.log("🔹 'daycares' sample document fields:");
    console.log(JSON.stringify(Object.keys(daycaresSample || {}), null, 2));
    
    console.log("\n🔹 'daycares_master' sample document fields:");
    console.log(JSON.stringify(Object.keys(daycaresMasterSample || {}), null, 2));

    console.log("\n" + "=".repeat(80));
    console.log("🔍 DETAILED FIELD COMPARISON");
    console.log("=".repeat(80) + "\n");

    // Show field type comparison for common fields
    if (comparison.common.length > 0) {
      console.log("Common fields with their types:\n");
      
      function getFieldType(schema, fieldPath) {
        const parts = fieldPath.split(".");
        let current = schema;
        for (const part of parts) {
          if (current[part]) {
            current = current[part];
          } else {
            return null;
          }
        }
        return current.type || "unknown";
      }

      comparison.common.slice(0, 20).forEach((field) => {
        const type1 = getFieldType(daycaresSchema, field);
        const type2 = getFieldType(daycaresMasterSchema, field);
        const match = type1 === type2 ? "✅" : "⚠️ ";
        console.log(`   ${match} ${field}: daycares=${type1 || "N/A"}, daycares_master=${type2 || "N/A"}`);
      });

      if (comparison.common.length > 20) {
        console.log(`   ... and ${comparison.common.length - 20} more common fields`);
      }
    }

    console.log("\n✅ Comparison completed!\n");
  } catch (error) {
    console.error("❌ Error comparing schemas:", error);
    throw error;
  } finally {
    await disconnectFromMongoDB();
  }
}

// Run the comparison
compareDaycareSchemas()
  .then(() => {
    console.log("✨ Script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });

