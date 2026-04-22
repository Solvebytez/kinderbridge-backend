// PDF Report Generator Service
const PDFDocument = require('pdfkit');

function generateDaycareReportPDF(daycares, userEmail, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      const title =
        typeof options?.title === "string" && options.title.trim().length > 0
          ? options.title.trim()
          : "Top 30 Daycare Report";
      const safeText = (value) =>
        String(value ?? "")
          // pdfkit default fonts commonly can't render emoji; remove them to avoid mojibake.
          .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
          .replace(/\s+/g, " ")
          .trim();
      
      // Collect PDF data
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);
      
      // Header
      doc.fontSize(24)
         .fillColor('#1e40af')
         .text(safeText(title), { align: 'center' });
      
      doc.moveDown();
      doc.fontSize(12)
         .fillColor('#6b7280')
         .text(`Generated for: ${safeText(userEmail)}`, { align: 'center' });
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-CA', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, { align: 'center' });
      
      doc.moveDown(2);
      
      // Summary
      doc.fontSize(16)
         .fillColor('#1e40af')
         .text('Summary', { underline: true });
      
      doc.fontSize(12)
         .fillColor('#000000')
         .text(`Total Daycares: ${daycares.length}`, { indent: 20 });
      
      doc.moveDown(2);
      
      // Daycare Details
      daycares.forEach((daycare, index) => {
        // Page break if needed (except for first item)
        if (index > 0 && doc.y > 700) {
          doc.addPage();
        }
        
        // Daycare Name
        doc.fontSize(18)
           .fillColor('#1e40af')
           .text(`${index + 1}. ${safeText(daycare.name || 'Unnamed Daycare')}`, { 
             underline: true,
             continued: false
           });
        
        doc.moveDown(0.5);
        
        // Basic Info
        doc.fontSize(11)
           .fillColor('#000000');
        
        if (daycare.location || daycare.city) {
          doc.text(`Location: ${safeText(daycare.location || daycare.city || 'N/A')}`, { indent: 20 });
        }
        
        if (daycare.address) {
          doc.text(`Address: ${safeText(daycare.address)}`, { indent: 20 });
        }
        
        if (daycare.rating) {
          const stars = '*'.repeat(Math.floor(Number(daycare.rating) || 0));
          doc.text(`Rating: ${safeText(daycare.rating || 'N/A')}${stars ? ` ${stars}` : ""}`, { indent: 20 });
        }
        
        if (daycare.price) {
          doc.text(`Price: ${safeText(daycare.price)}`, { indent: 20 });
        }
        
        if (daycare.phone) {
          doc.text(`Phone: ${safeText(daycare.phone)}`, { indent: 20 });
        }
        
        if (daycare.email) {
          doc.text(`Email: ${safeText(daycare.email)}`, { indent: 20 });
        }
        
        if (daycare.website) {
          doc.text(`Website: ${safeText(daycare.website)}`, { indent: 20 });
        }
        
        if (daycare.hours) {
          doc.text(`Hours: ${safeText(daycare.hours)}`, { indent: 20 });
        }
        
        if (daycare.ageRange) {
          const ageRange = Array.isArray(daycare.ageRange) 
            ? daycare.ageRange.join(', ') 
            : daycare.ageRange;
          doc.text(`Age Range: ${safeText(ageRange || 'N/A')}`, { indent: 20 });
        }
        
        doc.moveDown(0.5);
        
        // Description
        if (daycare.description) {
          doc.fontSize(10)
             .fillColor('#4b5563')
             .text('Description:', { indent: 20, underline: true });
          doc.text(safeText(daycare.description), { 
            indent: 20,
            align: 'left',
            width: 500
          });
        }
        
        doc.moveDown(0.5);
        
        // Features
        if (daycare.features && Array.isArray(daycare.features) && daycare.features.length > 0) {
          doc.fontSize(10)
             .fillColor('#4b5563')
             .text('Features:', { indent: 20, underline: true });
          daycare.features.forEach(feature => {
            doc.text(`  - ${safeText(feature)}`, { indent: 20 });
          });
        }
        
        doc.moveDown(1.5);
        
        // Separator line
        doc.moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .strokeColor('#e5e7eb')
           .lineWidth(1)
           .stroke();
        
        doc.moveDown(1);
      });
      
      // Add final footer message
      doc.moveDown(2);
      doc.fontSize(10)
         .fillColor('#6b7280')
         .text('--- End of Report ---', { align: 'center' });
      doc.fontSize(8)
         .fillColor('#9ca3af')
         .text('Daycare Concierge - Your trusted childcare search partner', { align: 'center' });
      doc.text(`Report generated: ${new Date().toISOString()}`, { align: 'center' });
      
      // Finalize PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

// Generate Welcome Guide PDF for new users
function generateWelcomeGuidePDF(userName, userEmail) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'LETTER'
      });
      const buffers = [];
      
      // Collect PDF data
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);
      
      const brandName = process.env.SMTP_FROM_NAME || 'KinderBridge';
      const brandEmail = process.env.SMTP_FROM_EMAIL || 'noreply@kinderbridge.com';
      
      // Header Section with Branding (matching email design)
      doc.rect(0, 0, 612, 120)
         .fillColor('#2c3e50')
         .fill();
      
      doc.fillColor('#ffffff')
         .fontSize(32)
         .font('Helvetica-Bold')
         .text(brandName, 50, 40, { align: 'left' });
      
      doc.fillColor('#bdc3c7')
         .fontSize(12)
         .font('Helvetica-Oblique')
         .text('Finding daycare with actual availability', 50, 75, { align: 'left' });
      
      doc.moveDown(3);
      
      // Welcome Section
      doc.fillColor('#2c3e50')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(`Welcome to ${brandName}!`, { align: 'center' });
      
      doc.moveDown(0.5);
      doc.fillColor('#7f8c8d')
         .fontSize(14)
         .font('Helvetica')
         .text(`Welcome Guide for ${userName}`, { align: 'center' });
      
      doc.fillColor('#95a5a6')
         .fontSize(11)
         .text(`Generated on: ${new Date().toLocaleDateString('en-CA', { 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric'
         })}`, { align: 'center' });
      
      doc.moveDown(2);
      
      // Getting Started Section
      doc.fillColor('#3498db')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('Getting Started', { underline: true });
      
      doc.moveDown(0.8);
      doc.fillColor('#2c3e50')
         .fontSize(13)
         .font('Helvetica')
         .text(`Hi ${userName},`, { indent: 20 });
      
      doc.moveDown(0.5);
      doc.fillColor('#34495e')
         .fontSize(12)
         .font('Helvetica')
         .text(`Welcome to ${brandName}! We're thrilled to have you join our community of parents finding the perfect daycare for their children.`, { 
           indent: 20,
           align: 'left',
           width: 500,
           lineGap: 5
         });
      
      doc.moveDown(1.5);
      
      // What You Can Do Section
      doc.fillColor('#3498db')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('What You Can Do', { underline: true });
      
      doc.moveDown(0.8);
      doc.fillColor('#2c3e50')
         .fontSize(12)
         .font('Helvetica');
      
      const features = [
        '🔍 Search for daycares in your area',
        '⭐ Save your favorite daycares',
        '📊 Get personalized recommendations',
        '📝 Access detailed daycare information',
        '🔔 Set up alerts for new availability',
        '💬 Contact daycare providers directly'
      ];
      
      features.forEach(feature => {
        doc.text(feature, { indent: 30, lineGap: 4 });
        doc.moveDown(0.4);
      });
      
      doc.moveDown(1.5);
      
      // Story Section (matching email's highlighted box)
      doc.rect(50, doc.y, 512, 80)
         .fillColor('#f8f9fa')
         .fill();
      
      doc.fillColor('#3498db')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Our Story', 60, doc.y - 70, { underline: true });
      
      doc.fillColor('#555555')
         .fontSize(11)
         .font('Helvetica')
         .text(`We started this platform after experiencing the challenge of finding quality daycare with real availability. If you've ever felt that same frustration, you know how stressful it can be. Our hope is that ${brandName} makes this process a whole lot easier for you.`, {
           x: 60,
           y: doc.y - 50,
           width: 492,
           lineGap: 3
         });
      
      doc.y = doc.y + 90;
      doc.moveDown(1);
      
      // Tips Section
      doc.fillColor('#3498db')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('Tips for Finding the Perfect Daycare', { underline: true });
      
      doc.moveDown(0.8);
      doc.fillColor('#2c3e50')
         .fontSize(12)
         .font('Helvetica');
      
      const tips = [
        'Use our advanced search filters to narrow down options',
        'Read reviews and ratings from other parents',
        'Check availability in real-time',
        'Save multiple daycares to compare later',
        'Set up alerts to be notified when spots become available',
        'Contact providers directly through our platform'
      ];
      
      tips.forEach((tip, index) => {
        doc.fillColor('#34495e')
           .text(`${index + 1}. ${tip}`, { indent: 30, lineGap: 4 });
        doc.moveDown(0.4);
      });
      
      doc.moveDown(1.5);
      
      // Feedback Section (matching email design)
      doc.rect(50, doc.y, 512, 120)
         .fillColor('#ffffff')
         .strokeColor('#e5e5e5')
         .lineWidth(2)
         .fillAndStroke();
      
      doc.fillColor('#2c3e50')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Share Your Feedback', 60, doc.y + 15);
      
      doc.fillColor('#2c3e50')
         .fontSize(13)
         .font('Helvetica-Bold')
         .text('💬 Quick chat', 60, doc.y + 40);
      
      doc.fillColor('#7f8c8d')
         .fontSize(10)
         .font('Helvetica')
         .text('I\'d love to learn more about why you signed up and how we can make the app even better for families like yours. If you\'re open to a quick 5-10 minute call, just reply with a time that works for you.', {
           x: 60,
           y: doc.y + 55,
           width: 492,
           lineGap: 2
         });
      
      doc.fillColor('#2c3e50')
         .fontSize(13)
         .font('Helvetica-Bold')
         .text('✉️ Send feedback', 60, doc.y + 85);
      
      doc.fillColor('#7f8c8d')
         .fontSize(10)
         .font('Helvetica')
         .text('Have thoughts, suggestions, or questions? Just reply to this email—we read every message personally. Your feedback would mean a lot—it\'ll help shape the future of ' + brandName + '.', {
           x: 60,
           y: doc.y + 100,
           width: 492,
           lineGap: 2
         });
      
      doc.y = doc.y + 130;
      doc.moveDown(1.5);
      
      // Closing
      doc.fillColor('#34495e')
         .fontSize(12)
         .font('Helvetica')
         .text('Looking forward to hearing from you and building this together,', { lineGap: 3 });
      
      doc.moveDown(1);
      
      // Signature
      doc.fillColor('#2c3e50')
         .fontSize(13)
         .font('Helvetica-Bold')
         .text(`The ${brandName} Team`);
      
      doc.fillColor('#7f8c8d')
         .fontSize(11)
         .font('Helvetica')
         .text(`Founder, ${brandName}`);
      
      doc.fillColor('#3498db')
         .fontSize(11)
         .text(brandEmail);
      
      doc.moveDown(2);
      
      // Footer (matching email footer)
      doc.rect(0, doc.page.height - 100, 612, 100)
         .fillColor('#2c3e50')
         .fill();
      
      doc.fillColor('#ecf0f1')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(brandName, 50, doc.page.height - 85, { align: 'left' });
      
      doc.fillColor('#bdc3c7')
         .fontSize(11)
         .font('Helvetica-Oblique')
         .text('Built by parents, for parents', 50, doc.page.height - 70, { align: 'left' });
      
      doc.fillColor('#95a5a6')
         .fontSize(9)
         .text(`${brandEmail} | Toronto, ON, Canada`, 50, doc.page.height - 55, { align: 'left' });
      
      doc.fillColor('#7f8c8d')
         .fontSize(8)
         .text(`This welcome message complies with Canada's Anti-Spam Legislation (CASL). You received this because you confirmed your email address for a ${brandName} account.`, {
           x: 50,
           y: doc.page.height - 40,
           width: 512,
           align: 'left',
           lineGap: 2
         });
      
      // Finalize PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateDaycareReportPDF,
  generateWelcomeGuidePDF
};

