const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('cafe24_api.html', 'utf8');
const $ = cheerio.load(html);

let out = '';
$('*:contains("더보기")').each((i, el) => {
    if ($(el).text().trim() === '더보기' && $(el).children().length === 0) {
        out += '--- Found button ---\n';
        out += 'Button HTML: ' + $.html(el) + '\n';
        out += 'Parent HTML: ' + $.html($(el).parent()).substring(0, 300) + '\n';
        out += 'Next sibling HTML: ' + $.html($(el).parent().next()).substring(0, 300) + '\n';
    }
});
fs.writeFileSync('test_dom2_out.txt', out);
