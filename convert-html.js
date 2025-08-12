const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const PptxGenJS = require('pptxgenjs');

async function convertToPDF() {
    console.log('Starting PDF conversion...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport to presentation size (16:9 aspect ratio)
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Load the HTML file
    const htmlPath = path.resolve('Doc Phase 2/fenomena_app_presentation.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    
    // Wait for animations and content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate PDF with presentation-friendly settings
    const outputPath = path.resolve('Doc Phase 2/fenomena_app_presentation.pdf');
    await page.pdf({
        path: outputPath,
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
            top: '10mm',
            right: '10mm',
            bottom: '10mm',
            left: '10mm'
        },
        displayHeaderFooter: false
    });
    
    console.log(`PDF saved to: ${outputPath}`);
    await browser.close();
    
    return outputPath;
}

function extractSlideContent(html) {
    const $ = cheerio.load(html);
    const slides = [];
    
    $('.slide').each((index, element) => {
        const slideContent = $(element).find('.slide-content');
        const title = slideContent.find('h1, h2').first().text().replace(/[📋🎯💡🏗📊📅💰📈🚀⚡🧠🤖👥🔐📝📊📱🔍✅🔄]/g, '').trim();
        
        let content = '';
        let bulletPoints = [];
        
        // Extract different types of content
        slideContent.find('p').each((i, p) => {
            const text = $(p).text().trim();
            if (text && !text.includes('/15')) {
                content += text + '\n';
            }
        });
        
        // Extract bullet points from feature cards, timeline items, etc.
        slideContent.find('.feature-card, .timeline-item, .stat-card').each((i, item) => {
            const text = $(item).text().replace(/[📋🎯💡🏗📊📅💰📈🚀⚡🧠🤖👥🔐📝📊📱🔍✅🔄❌📊⏰]/g, '').trim();
            if (text && text.length > 3) {
                bulletPoints.push(text);
            }
        });
        
        // Extract list items
        slideContent.find('li').each((i, li) => {
            const text = $(li).text().replace(/[•]/g, '').trim();
            if (text) {
                bulletPoints.push(text);
            }
        });
        
        slides.push({
            slideNumber: index + 1,
            title: title || `Slide ${index + 1}`,
            content: content.trim(),
            bulletPoints: bulletPoints.slice(0, 6) // Limit to 6 bullet points per slide
        });
    });
    
    return slides;
}

async function convertToPPTX() {
    console.log('Starting PPTX conversion...');
    
    // Read HTML file
    const htmlPath = path.resolve('Doc Phase 2/fenomena_app_presentation.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // Extract slide content
    const slides = extractSlideContent(htmlContent);
    console.log(`Extracted ${slides.length} slides`);
    
    // Create PPTX presentation
    let pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    
    // Define color scheme
    const colors = {
        primary: '667eea',
        secondary: '764ba2',
        accent: '4facfe',
        text: 'ffffff'
    };
    
    slides.forEach((slide, index) => {
        let pptxSlide = pptx.addSlide();
        
        // Alternate background colors
        const bgColor = index % 2 === 0 ? colors.primary : colors.secondary;
        pptxSlide.background = { color: bgColor };
        
        // Add title
        pptxSlide.addText(slide.title, {
            x: 0.5,
            y: 0.5,
            w: '90%',
            h: 1.5,
            fontSize: 28,
            fontFace: 'Segoe UI',
            color: colors.text,
            bold: true,
            align: 'center'
        });
        
        // Add content
        if (slide.content) {
            pptxSlide.addText(slide.content, {
                x: 0.5,
                y: 2.2,
                w: '90%',
                h: 1,
                fontSize: 16,
                fontFace: 'Segoe UI',
                color: colors.text,
                align: 'center'
            });
        }
        
        // Add bullet points
        if (slide.bulletPoints.length > 0) {
            const bulletText = slide.bulletPoints.map(point => `• ${point}`).join('\n');
            pptxSlide.addText(bulletText, {
                x: 1,
                y: 3.5,
                w: '85%',
                h: 3,
                fontSize: 14,
                fontFace: 'Segoe UI',
                color: colors.text,
                valign: 'top'
            });
        }
        
        // Add slide number
        pptxSlide.addText(`${slide.slideNumber}/15`, {
            x: '85%',
            y: '90%',
            w: '12%',
            h: 0.4,
            fontSize: 12,
            fontFace: 'Segoe UI',
            color: colors.text,
            align: 'right'
        });
    });
    
    // Save PPTX file
    const outputPath = path.resolve('Doc Phase 2/fenomena_app_presentation.pptx');
    await pptx.writeFile({ fileName: outputPath });
    console.log(`PPTX saved to: ${outputPath}`);
    
    return outputPath;
}

async function main() {
    try {
        console.log('Converting HTML presentation to PDF and PPTX...\n');
        
        // Convert to PDF
        const pdfPath = await convertToPDF();
        
        // Convert to PPTX
        const pptxPath = await convertToPPTX();
        
        console.log('\n✅ Conversion completed successfully!');
        console.log(`📄 PDF: ${pdfPath}`);
        console.log(`📊 PPTX: ${pptxPath}`);
        
    } catch (error) {
        console.error('❌ Error during conversion:', error);
        process.exit(1);
    }
}

// Run the conversion
main();