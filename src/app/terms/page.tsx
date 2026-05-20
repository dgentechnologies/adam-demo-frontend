'use client';

import Link from 'next/link';
import styles from './terms.module.css';

export default function Terms() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Link href="/" className={styles.backLink}>
          ← Back to Login
        </Link>

        <h1>Terms and Conditions</h1>
        
        <div className={styles.section}>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using the ADAM web experience provided by DGEN Technologies Pvt. Ltd., 
            you agree to comply with and be bound by these Terms and Conditions. If you do not agree 
            with any part of these terms, you may not use this service.
          </p>
        </div>

        <div className={styles.section}>
          <h2>2. Service Description</h2>
          <p>
            ADAM (Autonomous Desktop AI Module) is an interactive AI-powered conversational experience 
            provided by DGEN Technologies. The web demo is a 5-minute session designed to showcase the 
            capabilities of the ADAM system.
          </p>
        </div>

        <div className={styles.section}>
          <h2>3. User Eligibility</h2>
          <p>
            You must be at least 18 years old to use this service. By using ADAM, you represent and 
            warrant that you have the legal capacity to enter into this agreement.
          </p>
        </div>

        <div className={styles.section}>
          <h2>4. User Conduct</h2>
          <p>
            You agree not to:
          </p>
          <ul>
            <li>Use the service for any unlawful or harmful purposes</li>
            <li>Attempt to gain unauthorized access to the system</li>
            <li>Disrupt or interfere with the normal operation of the service</li>
            <li>Share abusive, harassing, or defamatory content</li>
            <li>Violate any applicable laws or regulations</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2>5. Data Collection and Use</h2>
          <p>
            <strong>Conversation Privacy:</strong> All conversation data exchanged during your ADAM session 
            is <strong>completely private and will not be collected or stored by DGEN Technologies</strong>. 
            Your conversations are not saved, processed for analysis, or used for any purpose beyond the 
            real-time interaction.
          </p>
          <p>
            <strong>Other Information:</strong> Non-conversation information such as email address, name, 
            session metadata (duration, timestamp), and general usage patterns may be collected and used 
            for:
          </p>
          <ul>
            <li>Improving and optimizing the ADAM service</li>
            <li>Training machine learning models to enhance AI capabilities</li>
            <li>Analytics and product insights</li>
            <li>Communicating updates and improvements</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2>6. Intellectual Property</h2>
          <p>
            All content, technology, and materials within the ADAM service are the intellectual property 
            of DGEN Technologies Pvt. Ltd. You may not reproduce, modify, or distribute any part of this 
            service without explicit permission.
          </p>
        </div>

        <div className={styles.section}>
          <h2>7. Limitation of Liability</h2>
          <p>
            DGEN Technologies is provided on an "as-is" basis. DGEN Technologies Pvt. Ltd. is not liable 
            for any indirect, incidental, special, or consequential damages arising from the use of this 
            service. In no event shall our total liability exceed the amount paid by you, if any.
          </p>
        </div>

        <div className={styles.section}>
          <h2>8. Modification of Service</h2>
          <p>
            DGEN Technologies reserves the right to modify or discontinue the ADAM service at any time 
            without notice. We shall not be liable to you or any third party for any modification, 
            suspension, or discontinuation of the service.
          </p>
        </div>

        <div className={styles.section}>
          <h2>9. Governing Law</h2>
          <p>
            These Terms and Conditions are governed by and construed in accordance with the laws of India, 
            and you irrevocably submit to the exclusive jurisdiction of the courts located in India.
          </p>
        </div>

        <div className={styles.section}>
          <h2>10. Contact Information</h2>
          <p>
            For questions regarding these Terms and Conditions, please contact us at:
          </p>
          <p>
            <strong>DGEN Technologies Pvt. Ltd.</strong><br />
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
