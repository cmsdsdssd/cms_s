const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('cafe24_api.html', 'utf8');
const $ = cheerio.load(html);

console.log('Searching for "더보기"...');
$('*:contains("더보기")').each((i, el) => {
    if ($(el).children().length === 0 || $(el).text().trim() === '더보기') {
        let current = $(el);
        let path = current.prop('tagName');
        let classes = current.attr('class') || '';

        // get parent tree
        for (let j = 0; j < 3; j++) {
            current = current.parent();
            if (!current || !current.prop('tagName')) break;
            path = current.prop('tagName') + (current.attr('class') ? '.' + current.attr('class').split(' ').join('.') : '') + ' > ' + path;
        }
        console.log(`Matched text: "${$(el).text().trim()}"`);
        console.log(`Tree: ${path}`);
        console.log(`Classes: ${classes}`);
        console.log(`Parent classes: ${$(el).parent().attr('class') || ''}`);
        console.log('---');
    }
});
