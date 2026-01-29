/**
 * Diagnostic script to check Bitable fields
 * Run with: node check-bitable-fields.js
 */

require('dotenv').config();
const axios = require('axios');

const LARK_APP_ID = process.env.LARK_APP_ID;
const LARK_APP_SECRET = process.env.LARK_APP_SECRET;
const BITABLE_APP_TOKEN = process.env.LARK_BITABLE_APP_TOKEN;
const TABLE_ID = process.env.LARK_THOUGHTS_TABLE_ID;

async function getAccessToken() {
  const response = await axios.post(
    'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: LARK_APP_ID,
      app_secret: LARK_APP_SECRET,
    }
  );
  return response.data.tenant_access_token;
}

async function checkBitableFields() {
  try {
    console.log('🔍 Checking Bitable configuration...\n');
    
    const token = await getAccessToken();
    
    // Get table fields/schema
    console.log('📋 Fetching table fields...');
    const fieldsResponse = await axios.get(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${TABLE_ID}/fields`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    
    console.log('\n✅ Table Fields:\n');
    const fields = fieldsResponse.data.data.items || [];
    fields.forEach(field => {
      console.log(`  • ${field.field_name} (${field.type})`);
      console.log(`    - ID: ${field.field_id}`);
      console.log(`    - Is Primary: ${field.isPrimary || false}`);
      console.log('');
    });
    
    // Get sample records
    console.log('📊 Fetching sample records...\n');
    const recordsResponse = await axios.get(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${TABLE_ID}/records?page_size=3`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    
    const records = recordsResponse.data.data.items || [];
    console.log(`✅ Found ${records.length} sample records:\n`);
    
    records.forEach((record, index) => {
      console.log(`Record ${index + 1}:`);
      console.log(`  Record ID: ${record.record_id}`);
      console.log(`  Fields:`);
      Object.entries(record.fields).forEach(([key, value]) => {
        console.log(`    - ${key}: ${JSON.stringify(value)}`);
      });
      console.log('');
    });
    
    // Check for Created Time field
    const createdTimeField = fields.find(f => 
      f.field_name === 'Created Time' || 
      f.field_name === '创建时间' ||
      f.type === 1001 // System Created Time type
    );
    
    console.log('\n📅 Created Time Field Status:');
    if (createdTimeField) {
      console.log(`  ✅ Found: ${createdTimeField.field_name}`);
      console.log(`  Type: ${createdTimeField.type}`);
      if (createdTimeField.type === 1001) {
        console.log('  ✅ Correct type! (System Created Time)');
      } else if (createdTimeField.type === 2) {
        console.log('  ⚠️  Wrong type! This is a Number field.');
        console.log('  Fix: Delete this field and create a new "Created Time" system field');
      } else if (createdTimeField.type === 1) {
        console.log('  ⚠️  Wrong type! This is a Text field.');
        console.log('  Fix: Delete this field and create a new "Created Time" system field');
      } else {
        console.log(`  ⚠️  Unknown type: ${createdTimeField.type}`);
      }
    } else {
      console.log('  ❌ No Created Time field found!');
      console.log('  Fix: Add a "Created Time" system field to your table');
    }
    
    console.log('\n📝 Recommendations:');
    console.log('  1. If Created Time field is wrong type:');
    console.log('     - Delete the existing "Created Time" field');
    console.log('     - Click "+" to add new field');
    console.log('     - Choose "Created Time" type (should have a clock icon)');
    console.log('     - Lark will auto-fill timestamps for new records');
    console.log('');
    console.log('  2. Required fields in your Bitable table:');
    console.log('     - Thought (Multi-line Text or Text)');
    console.log('     - Author (Text)');
    console.log('     - Meeting Context (Text)');
    console.log('     - Created Time (Created Time - system field)');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkBitableFields();
