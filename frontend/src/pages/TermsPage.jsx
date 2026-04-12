import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TermsPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6" data-testid="terms-back-btn">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 12, 2025</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>By accessing or using the VitalaMatch platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. VitalaMatch reserves the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p>VitalaMatch is a job-matching platform that connects healthcare professionals ("Job Seekers" or "Candidates") with healthcare employers ("Employers"). The Service facilitates job discovery, application management, document storage, and onboarding workflows. VitalaMatch does not employ Job Seekers, nor does it act as a staffing agency.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. User Accounts</h2>
            <p>To use the Service, you must create an account and provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify VitalaMatch immediately of any unauthorized use of your account.</p>
            <p>You may not create multiple accounts for the same individual, impersonate another person, or provide false information during registration.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. User Responsibilities</h2>
            <p><strong>Job Seekers</strong> agree to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide truthful and accurate profile information, including licenses, certifications, and work history</li>
              <li>Upload only authentic documents to the Secure Document Vault</li>
              <li>Keep profile and credential information up to date</li>
              <li>Respond to employer communications and onboarding requirements in a timely manner</li>
            </ul>
            <p className="mt-3"><strong>Employers</strong> agree to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Post only legitimate, lawful job opportunities</li>
              <li>Provide accurate job descriptions, compensation details, and requirements</li>
              <li>Comply with all applicable employment laws and regulations</li>
              <li>Use candidate information solely for hiring evaluation purposes</li>
              <li>Not discriminate against candidates in violation of applicable law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Job Posting Rules</h2>
            <p>Employers must ensure all job postings comply with applicable federal, state, and local laws. Job postings must not contain misleading information about compensation, duties, or working conditions. VitalaMatch reserves the right to remove any job posting that violates these Terms or applicable law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. No Guarantee of Employment</h2>
            <p>VitalaMatch is a platform that facilitates connections between Job Seekers and Employers. We do not guarantee that any user will receive a job offer, find suitable candidates, or that any employment relationship will result from the use of our Service. All hiring decisions are made solely by Employers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Document Vault</h2>
            <p>The Secure Document Vault allows Job Seekers to upload and store professional documents. Documents stored in the vault may be referenced during onboarding workflows for positions you accept. By uploading documents, you represent that you have the right to share them and that they are authentic.</p>
            <p>VitalaMatch stores documents securely but does not independently verify the authenticity of uploaded documents unless explicitly stated. Employers may request additional verification as part of their onboarding process.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Acceptable Use Policy</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload fraudulent, forged, or misleading documents</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Scrape, crawl, or use automated means to access the Service without permission</li>
              <li>Interfere with the proper functioning of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law, VitalaMatch and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service. VitalaMatch's total liability shall not exceed the amount you paid to VitalaMatch in the twelve (12) months preceding the event giving rise to the claim.</p>
            <p>VitalaMatch does not guarantee the accuracy of information provided by other users, including job postings, credentials, or profile information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Termination</h2>
            <p>VitalaMatch reserves the right to suspend or terminate your account at any time, with or without cause, with or without notice. Upon termination, your right to use the Service will immediately cease. You may also delete your account at any time through the Settings page.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
            <p>If you have questions about these Terms, please contact us at <a href="mailto:legal@vitalamatch.com" className="text-primary hover:underline">legal@vitalamatch.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
