const puppeteer = require('puppeteer');
const path = require('path');

async function convertToPDF() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // Convert Proposal Document
        console.log('Converting proposal document to PDF...');
        const proposalPage = await browser.newPage();
        const proposalPath = path.join(__dirname, 'Proposal_Pengembangan_Fenomena_App.html');
        await proposalPage.goto(`file://${proposalPath}`, { waitUntil: 'networkidle0' });
        
        await proposalPage.pdf({
            path: 'Proposal_Pengembangan_Fenomena_App.pdf',
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });
        console.log('✅ Proposal PDF created successfully!');

        // Convert Presentation
        console.log('Converting presentation to PDF...');
        const presentationPage = await browser.newPage();
        const presentationPath = path.join(__dirname, 'Presentasi_Proposal_Fenomena_App.html');
        await presentationPage.goto(`file://${presentationPath}`, { waitUntil: 'networkidle0' });
        
        // Set viewport for presentation format
        await presentationPage.setViewport({ width: 1920, height: 1080 });
        
        await presentationPage.pdf({
            path: 'Presentasi_Proposal_Fenomena_App.pdf',
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            }
        });
        console.log('✅ Presentation PDF created successfully!');

        console.log('\n🎉 PDF conversion completed!');
        console.log('Files created:');
        console.log('- Proposal_Pengembangan_Fenomena_App.pdf');
        console.log('- Presentasi_Proposal_Fenomena_App.pdf');

    } catch (error) {
        console.error('❌ Error during PDF conversion:', error);
    } finally {
        await browser.close();
    }
}

convertToPDF();