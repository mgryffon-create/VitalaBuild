import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6" data-testid="privacy-back-btn">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 12, 2025</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>VitalaMatch ("we," "our," or "us") is committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our healthcare job-matching platform. Please read this policy carefully.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <p><strong>Account Information:</strong> When you register, we collect your name, email address, and role (Job Seeker or Employer).</p>
            <p><strong>Profile Information:</strong> Job Seekers may provide professional details including specialty, experience, certifications, education, and work history. Employers may provide company information and job posting details.</p>
            <p><strong>Documents:</strong> Job Seekers may upload documents to the Secure Document Vault, including government identification, professional licenses, certifications, health records, health screenings, and resumes. These documents may include sensitive personal information.</p>
            <p><strong>Usage Data:</strong> We automatically collect information about how you interact with the Service, including pages viewed, features used, job applications submitted, and time spent on the platform.</p>
            <p><strong>Device Information:</strong> We may collect information about the device you use to access the Service, including browser type, operating system, and IP address.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, maintain, and improve the Service</li>
              <li>Match Job Seekers with relevant job opportunities</li>
              <li>Facilitate communication between Job Seekers and Employers</li>
              <li>Process onboarding workflows and verify compliance requirements</li>
              <li>Send service-related notifications (e.g., offer updates, onboarding tasks)</li>
              <li>Detect and prevent fraud, abuse, and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Information Sharing</h2>
            <p><strong>With Employers:</strong> When you apply to or express interest in a position, relevant profile information is shared with the Employer. During onboarding, Employers may view the status of your compliance requirements (e.g., whether a document was satisfied from your vault) but do not have unrestricted access to your entire document vault.</p>
            <p><strong>With Service Providers:</strong> We may share information with third-party service providers who assist in operating the platform (e.g., cloud hosting, email delivery). These providers are contractually obligated to protect your information.</p>
            <p><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or government request, or to protect the rights, safety, or property of VitalaMatch, our users, or the public.</p>
            <p>We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Document Vault & Data Security</h2>
            <p>Documents uploaded to the Secure Document Vault are stored securely. We implement industry-standard security measures including encryption in transit and access controls. However, no system is completely secure, and we cannot guarantee absolute security of your data.</p>
            <p>Documents in the vault are reused across multiple job applications and onboarding workflows to reduce redundant uploads. You maintain control over your vault and can delete documents at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
            <p>We retain your account information and documents for as long as your account is active. If you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain certain information by law or for legitimate business purposes (e.g., dispute resolution, fraud prevention).</p>
            <p>Onboarding records may be retained for the duration required by applicable healthcare regulations.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
            <p>Depending on your location, you may have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request your data in a portable format</li>
              <li><strong>Opt-out:</strong> Opt out of certain data processing activities</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at <a href="mailto:privacy@vitalamatch.com" className="text-primary hover:underline">privacy@vitalamatch.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Cookies & Tracking</h2>
            <p>We use essential cookies to maintain your session and authenticate your account. We may use analytics tools to understand how the Service is used. You can control cookie settings through your browser.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Children's Privacy</h2>
            <p>The Service is not intended for individuals under the age of 18. We do not knowingly collect information from children.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify users of material changes via email or in-app notification. Your continued use of the Service after changes are posted constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact us at:</p>
            <p>VitalaMatch<br /><a href="mailto:privacy@vitalamatch.com" className="text-primary hover:underline">privacy@vitalamatch.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
