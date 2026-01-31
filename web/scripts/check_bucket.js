
async function checkBucketAndFile() {
    const { createClient } = await import('@supabase/supabase-js');
    const path = await import('path');
    const dotenv = await import('dotenv');

    dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const bucketName = 'master_images';

    console.log(`\n\n=== CHECKING BUCKET: ${bucketName} ===`);

    // 1. Check Bucket Public Status
    const { data: bucket, error } = await supabase.storage.getBucket(bucketName);
    if (error) {
        console.log(`❌ Error getting bucket: ${error.message}`);
    } else {
        console.log(`Bucket Found: ${bucket.name}`);
        console.log(`Public Status: ${bucket.public ? '✅ TRUE (Public)' : '❌ FALSE (Private)'}`);
    }

    // 2. Check File Existence
    const fileName = 'c0bc6c7e-70df-42fb-bf11-5b50c94493e7.png';
    console.log(`\nSearching for: ${fileName}`);

    // Check 'master' folder
    const { data: files } = await supabase.storage.from(bucketName).list('master');
    const found = files?.find(f => f.name === fileName);

    if (found) {
        console.log(`✅ File FOUND in 'master/${fileName}'`);
        console.log(`Size: ${found.metadata.size} bytes`);
    } else {
        console.log(`❌ File NOT FOUND in 'master' folder`);
        // List what IS there
        console.log(`Files in 'master': ${files?.length || 0}`);
        if (files && files.length > 0) {
            console.log('First 3 files:', files.slice(0, 3).map(f => f.name));
        }
    }
}

checkBucketAndFile().catch(console.error);
