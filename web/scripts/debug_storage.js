
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    console.log('URL:', supabaseUrl);
    console.log('KEY:', supabaseKey ? 'Found' : 'Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
    console.log('--- Checking Storage Buckets ---');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
        console.error('Error listing buckets:', bucketError);
        return;
    }

    console.log('Buckets found:', buckets.map(b => b.name));

    const targetBucket = 'master_images'; // We want to check this specific bucket
    const foundBucket = buckets.find(b => b.name === targetBucket);

    if (!foundBucket) {
        console.error(`❌ Bucket '${targetBucket}' NOT found!`);
        console.log('Please create it or update NEXT_PUBLIC_SUPABASE_BUCKET in .env.local');
    } else {
        console.log(`✅ Bucket '${targetBucket}' exists.`);

        // Check root files
        console.log(`\n--- Listing files in '${targetBucket}' (Root) ---`);
        const { data: rootFiles, error: rootError } = await supabase.storage.from(targetBucket).list();
        if (rootError) console.error(rootError);
        else {
            console.log(`Found ${rootFiles.length} items in root:`);
            rootFiles.forEach(f => console.log(` - ${f.name} (${f.metadata?.mimetype})`));
        }

        // Check 'master' folder
        console.log(`\n--- Listing files in '${targetBucket}/master' ---`);
        const { data: masterFiles, error: masterError } = await supabase.storage.from(targetBucket).list('master');
        if (masterError) console.error(masterError);
        else {
            console.log(`Found ${masterFiles.length} items in 'master' folder:`);
            masterFiles.slice(0, 10).forEach(f => console.log(` - ${f.name}`));
        }
    }
}

checkStorage().catch(console.error);
