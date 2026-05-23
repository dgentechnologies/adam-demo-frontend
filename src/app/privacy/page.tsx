'use client';

import Link from 'next/link';
import styles from './privacy.module.css';

export default function Privacy() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Link href="/" className={styles.backLink}>
          ← Back to Login
        </Link>

        <h1 className={styles.title}>Privacy Policy</h1>

        <div className={styles.section}>
          <h2>1. Introduction</h2>
          <p>
            Dgen Technologies Pvt. Ltd. ("we," "us," or "our") operates the ADAM web experience. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
            when you use our service.
          </p>
          <p>
            ADAM is AI and can make mistakes.
          </p>
        </div>

        <div className={styles.section}>
          <h2>2. What Information Do We Collect?</h2>
          
          <h3>Account Information</h3>
          <p>
            When you sign up or log in, we collect:
          </p>
          <ul>
            <li>Email address</li>
            <li>Name</li>
            <li>Google account ID (for OAuth authentication)</li>
          </ul>

          <h3>Session Metadata</h3>
          <p>
            We collect information about your ADAM session including:
          </p>
          <ul>
            <li>Session start and end timestamps</li>
            <li>Session duration</li>
            <li>Number of conversation turns</li>
            <li>Browser type and user agent</li>
            <li>Geographic location (country code)</li>
          </ul>

          <h3>Conversation Data - NOT COLLECTED</h3>
          <p>
            <strong>Important:</strong> We do NOT collect, store, or retain the actual conversation content 
            exchanged with ADAM during your session. Your conversations are completely private and ephemeral—
            they exist only during your real-time interaction.
          </p>
        </div>

        <div className={styles.section}>
          <h2>3. How Do We Use Your Information?</h2>
          
          <h3>Account Information</h3>
          <ul>
            <li>Authenticate and authorize your access to the ADAM service</li>
            <li>Send you updates and notifications about the service</li>
            <li>Manage your account and profile</li>
          </ul>

          <h3>Session Metadata and Non-Conversation Data</h3>
          <ul>
            <li><strong>Service Improvement:</strong> Analyzing usage patterns to optimize performance</li>
            <li><strong>AI Training:</strong> Using aggregated, anonymized session data to improve ADAM's capabilities</li>
            <li><strong>Analytics:</strong> Understanding user engagement and service quality</li>
            <li><strong>Security:</strong> Detecting and preventing abuse or unauthorized access</li>
          </ul>

          <h3>Conversation Data</h3>
          <p>
            Since we do not collect conversation data, it cannot be used for any purpose. Your conversations 
            remain entirely private.
          </p>
        </div>

        <div className={styles.section}>
          <h2>4. How Is Your Information Protected?</h2>
          <p>
            We implement industry-standard security measures including:
          </p>
          <ul>
            <li>Encryption of data in transit (HTTPS/TLS)</li>
            <li>Secure authentication protocols</li>
            <li>Regular security audits and assessments</li>
            <li>Limited access to personal information (need-to-know basis)</li>
            <li>Secure data storage with Firebase services (Google Cloud infrastructure)</li>
          </ul>
          <p>
            However, no security measure is 100% secure. We cannot guarantee absolute security of your data.
          </p>
        </div>

        <div className={styles.section}>
          <h2>5. Data Retention</h2>
          <p>
            <strong>Conversation Data:</strong> Never stored or retained.
          </p>
          <p>
            <strong>Account and Session Data:</strong> Retained as long as your account is active. 
            You may request deletion of your account and associated data at any time by contacting us.
          </p>
          <p>
            <strong>Aggregated Data:</strong> We may retain aggregated or anonymized data indefinitely 
            for analytics and improvement purposes.
          </p>
        </div>

        <div className={styles.section}>
          <h2>6. Third-Party Services</h2>
          <p>
            We use the following third-party services:
          </p>
          <ul>
            <li><strong>Google OAuth:</strong> For secure authentication</li>
            <li><strong>Firebase:</strong> For authentication and storage services</li>
            <li><strong>Vercel:</strong> For hosting the frontend application</li>
            <li><strong>Railway:</strong> For hosting the backend relay/server application</li>
            <li><strong>Google Gemini API:</strong> For AI conversational capabilities (no conversation storage)</li>
          </ul>
          <p>
            These services have their own privacy policies. We encourage you to review them.
          </p>
        </div>

        <div className={styles.section}>
          <h2>7. Your Rights and Choices</h2>
          <p>
            You have the right to:
          </p>
          <ul>
            <li>Access your personal information</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and data</li>
            <li>Opt out of future communications</li>
            <li>Know what data we collect about you</li>
          </ul>
          <p>
            To exercise these rights, please contact us at the email address below.
          </p>
        </div>

        <div className={styles.section}>
          <h2>8. International Data Transfers</h2>
          <p>
            Your information may be stored and processed in India and other jurisdictions where Dgen Technologies 
            operates. By using ADAM, you consent to the transfer of your information to countries outside your 
            country of residence, which may have different data protection laws.
          </p>
        </div>

        <div className={styles.section}>
          <h2>9. Children's Privacy</h2>
          <p>
            The ADAM service is not intended for children under 18 years old. We do not knowingly collect 
            personal information from children. If we learn that we have collected personal information from 
            a child under 18, we will promptly delete such information.
          </p>
        </div>

        <div className={styles.section}>
          <h2>10. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we will 
            notify you by email or by prominently posting the new Privacy Policy on our website. Your continued 
            use of ADAM after such modifications constitutes your acceptance of the updated Privacy Policy.
          </p>
        </div>

        <div className={styles.section}>
          <h2>11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our privacy practices, please contact us:
          </p>
          <p>
            <strong>Dgen Technologies Pvt. Ltd.</strong><br />
            Kolkata, India<br />
            Website: dgentechnologies.com<br />
            Email: contact@dgentechnologies.com
          </p>
        </div>

        <div className={styles.footer}>
          <p>Last updated: May 2026</p>
        </div>
      </div>
    </div>
  );
}
