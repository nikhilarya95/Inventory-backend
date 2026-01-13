const nodemailer = require('nodemailer');
const Company = require('../models/Company');


class EmailService {
  constructor() {
    this.primaryProvider = 'emailjs';
    this.nodemailerTransporter = null;
    this.initNodemailer();
  }

  initNodemailer() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.nodemailerTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  async sendWithEmailJS(to, subject, htmlContent, additionalData = {}) {
    try {
      const emailjs = require('@emailjs/nodejs');

      if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID ||
        !process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) {
        throw new Error('EmailJS configuration missing');
      }

      const emailParams = {
        to_email: to,
        subject: subject,
        from_name: 'Payment Alert System',
        from_email: 'noreply@system.com',
        message: htmlContent,
        system_phone: 'System Generated',
        ...additionalData
      };

      const response = await emailjs.send(
        process.env.EMAILJS_SERVICE_ID,
        process.env.EMAILJS_TEMPLATE_ID,
        emailParams,
        {
          publicKey: process.env.EMAILJS_PUBLIC_KEY,
          privateKey: process.env.EMAILJS_PRIVATE_KEY
        }
      );

      console.log('Email sent via EmailJS:', response);
      return { success: true, provider: 'emailjs' };
    } catch (error) {
      console.error('EmailJS error:', error.message);
      throw error;
    }
  }

  async sendWithNodemailer(to, subject, htmlContent) {
    try {
      if (!this.nodemailerTransporter) {
        throw new Error('Nodemailer not configured');
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: to,
        subject: subject,
        html: htmlContent
      };

      const info = await this.nodemailerTransporter.sendMail(mailOptions);
      console.log('Email sent via Nodemailer:', info.messageId);
      return { success: true, provider: 'nodemailer', messageId: info.messageId };
    } catch (error) {
      console.error('Nodemailer error:', error.message);
      throw error;
    }
  }

  async sendEmail(to, subject, htmlContent, additionalData = {}) {
    try {
      return await this.sendWithEmailJS(to, subject, htmlContent, additionalData);
    } catch (primaryError) {
      console.log('Primary email provider (EmailJS) failed, trying Nodemailer...');

      try {
        return await this.sendWithNodemailer(to, subject, htmlContent);
      } catch (secondaryError) {
        console.error('Both email providers failed');
        console.error('EmailJS error:', primaryError.message);
        console.error('Nodemailer error:', secondaryError.message);

        return {
          success: false,
          error: 'Both email providers failed',
          details: {
            emailjs: primaryError.message,
            nodemailer: secondaryError.message
          }
        };
      }
    }
  }

  async sendLowStockAlert(adminEmail, lowStockProducts) {
    const subject = 'Low Stock Alert - Action Required';
    const htmlContent = `
      <h2>Low Stock Alert</h2>
      <p>The following products have quantity less than 3:</p>
      <table border="1" cellpadding="10" style="border-collapse: collapse;">
        <thead>
          <tr>
            <th>Brand</th>
            <th>Product</th>
            <th>Location</th>
            <th>Current Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${lowStockProducts.map(item => `
            <tr>
              <td>${item.product?.brandName || 'N/A'}</td>
              <td>${item.product?.productName || 'N/A'}</td>
              <td>${item.location}</td>
              <td style="color: red; font-weight: bold;">${item.quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p>Please restock these items as soon as possible.</p>
    `;

    return this.sendEmail(adminEmail, subject, htmlContent);
  }

  async sendOrderReminder(salesManEmail, customers) {
    const subject = 'Order Reminder - Customers Pending Orders';
    const htmlContent = `
      <h2>Order Reminder</h2>
      <p>Please take orders from the following customers:</p>
      <table border="1" cellpadding="10" style="border-collapse: collapse;">
        <thead>
          <tr>
            <th>Customer ID</th>
            <th>Shop Name</th>
            <th>Customer Name</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(customer => `
            <tr>
              <td>${customer.customerId}</td>
              <td>${customer.shopName}</td>
              <td>${customer.firstName} ${customer.lastName}</td>
              <td>${customer.phone}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    return this.sendEmail(salesManEmail, subject, htmlContent);
  }

  async sendCustomerDueAlert(salesManEmail, regularCustomers) {
    let companyName = 'System';
    try {
      const company = await Company.findOne();
      if (company) companyName = company.name;
    } catch (err) {
      console.error('Error fetching company for email:', err);
    }

    const subject = `${companyName}: Eligible Customers to take new order`;

    // 1. Array for EmailJS {{#each regular_customers}}
    const customerDataList = regularCustomers.map(c => ({
      shop_name: c.shopName || 'N/A',
      first_name: c.firstName || 'N/A',
      last_name: c.lastName || 'N/A',
      phone: c.phone || 'N/A',
      address: c.address || 'N/A'
    }));

    // 2. Pre-built HTML rows as a backup (variable: {{customer_rows}})
    const customerRowsHtml = regularCustomers.map(c => `
      <tr style="border-bottom: 1px solid #eeeeee;">
        <td style="padding: 10px 4px; font-size: 11px; color: #111111; font-weight: bold; width: 25%; word-break: break-word;">${c.shopName || 'N/A'}</td>
        <td style="padding: 10px 4px; font-size: 10px; color: #444444; width: 20%; word-break: break-word;">${c.firstName || 'N/A'} ${c.lastName || 'N/A'}</td>
        <td style="padding: 10px 4px; font-size: 10px; color: #444444; width: 25%; font-family: monospace;">${c.phone || 'N/A'}</td>
        <td style="padding: 10px 4px; font-size: 10px; color: #666666; width: 30%; line-height: 1.2; word-break: break-word;">${c.address || 'N/A'}</td>
      </tr>
    `).join('');

    return this.sendEmail(salesManEmail, subject, `These customers are eligible to take new orders from ${companyName}.`, {
      regular_customers: customerDataList,
      customer_rows: customerRowsHtml,
      company_name: companyName
    });
  }

}



module.exports = new EmailService();
