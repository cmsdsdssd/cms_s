
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificFile() {
    const targetBucket = 'master_images';
    const targetFilePartial = 'c0bc6c7e'; // Part of the UUID from error message

    console.log(`Checking bucket '${targetBucket}' for file like '${targetFilePartial}'...`);

    // Check Root
    const { data: rootFiles } = await supabase.storage.from(targetBucket).list();
    const foundInRoot = rootFiles?.find(f => f.name.includes(targetFilePartial));

    if (foundInRoot) {
        console.log(`✅ FOUND in ROOT: ${foundInRoot.name}`);
    } else {
        console.log(`❌ NOT found in ROOT`);
    }

    // Check 'master' folder
    const { data: masterFiles } = await supabase.storage.from(targetBucket).list('master');
    const foundInMaster = masterFiles?.find(f => f.name.includes(targetFilePartial));

    if (foundInMaster) {
        console.log(`✅ FOUND in 'master' folder: master/${foundInMaster.name}`);
    } else {
        console.log(`❌ NOT found in 'master' folder`);
    }
}

checkSpecificFile().catch(console.error);
