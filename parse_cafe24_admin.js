const fs = require('fs');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const turndownPluginGfm = require('turndown-plugin-gfm');

const html = fs.readFileSync('cafe24_admin_api.html', 'utf8');
const $ = cheerio.load(html);

// We replace the "더보기" buttons with a clearer markdown header
// Then just let turndown do its job on the entire body.
$('.btn-endpoint-show').each((i, el) => {
    $(el).parent().replaceWith('<h4>[더보기 상세 내용]</h4>');
});

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndownService.use(turndownPluginGfm.tables);

// Clean up scripts, styles etc
$('script, style, noscript').remove();

let markdown = '# Cafe24 REST API Documentation\n\n';
const mainContentHtml = $('.content-body').html() || $('.main-content').html() || $('.docs-content').html() || $('body').html();

markdown += turndownService.turndown(mainContentHtml);

const outputPath = 'c:/Users/RICH/.gemini/antigravity/scratch/cms_s/web/docs/Cafe24/AdminAPI-extracted.md';
fs.writeFileSync(outputPath, markdown);
console.log('Final Markdown saved to ' + outputPath);
