// Run this script in MongoDB shell or create a migration file

const mongoose = require('mongoose');

async function fixKYCTokenIndex() {
  try {
    // Connect to your database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kyc-portal');
    
    const db = mongoose.connection.db;
    const collection = db.collection('users');
    
    console.log('Starting index fix...');
    
    // 1. Check existing indexes
    const existingIndexes = await collection.indexes();
    console.log('Existing indexes:', existingIndexes.map(idx => idx.name));
    
    // 2. Drop the problematic index
    try {
      await collection.dropIndex('kyc.verificationToken.token_1');
      console.log('✅ Dropped problematic index: kyc.verificationToken.token_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('⚠️  Index already doesn\'t exist, continuing...');
      } else {
        throw error;
      }
    }
    
    // 3. Create the new sparse index with partial filter
    await collection.createIndex(
      { 'kyc.verificationToken.token': 1 }, 
      { 
        unique: true, 
        sparse: true,
        partialFilterExpression: { 
          'kyc.verificationToken.token': { $exists: true, $ne: null } 
        },
        name: 'kyc_verification_token_sparse'
      }
    );
    console.log('✅ Created new sparse index for KYC verification tokens');
    
    // 4. Optional: Clean up any duplicate null values (if any exist)
    const duplicateNulls = await collection.countDocuments({
      'kyc.verificationToken.token': null
    });
    
    if (duplicateNulls > 1) {
      console.log(`Found ${duplicateNulls} documents with null tokens`);
      // You might want to clean these up or set them to undefined
      await collection.updateMany(
        { 'kyc.verificationToken.token': null },
        { $unset: { 'kyc.verificationToken': 1 } }
      );
      console.log('✅ Cleaned up null token documents');
    }
    
    console.log('✅ Index fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing index:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the fix
fixKYCTokenIndex();