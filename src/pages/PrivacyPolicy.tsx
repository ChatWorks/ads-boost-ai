import { useEffect } from "react";

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = "Privacy Policy - Inno Google Ads Assistant";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Privacy Policy for Inno - AI-powered Google Ads campaign analysis and optimization platform. Learn how we protect your data and comply with Google API policies.');
    }
  }, []);

  return (
    <>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="prose prose-lg max-w-none">
            <header className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4 text-foreground">Privacy Policy</h1>
              <p className="text-muted-foreground text-lg">
                Effective Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-muted-foreground">
                Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </header>

            <main className="space-y-8 text-foreground">
              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Introduction</h2>
                <p className="mb-4">
                  Welcome to Inno ("we," "our," or "us"), an AI-powered Google Ads optimization platform available at ads-boost-ai.lovable.app. 
                  This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service to analyze 
                  and optimize your Google Ads campaigns through artificial intelligence.
                </p>
                <p className="mb-4">
                  We are committed to protecting your privacy and complying with all applicable data protection laws, including the Google API 
                  Services User Data Policy. By using our service, you agree to the collection and use of information in accordance with this policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Information We Collect</h2>
                
                <h3 className="text-xl font-medium mb-3 text-foreground">Google Account Information</h3>
                <p className="mb-4">
                  When you connect your Google account to our service, we collect:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Basic profile information (name, email address)</li>
                  <li>Google account identifiers necessary for API access</li>
                  <li>Authentication tokens to access your Google Ads data</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Google Ads Data</h3>
                <p className="mb-4">
                  Through the Google Ads API, we access and process:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Campaign performance metrics (impressions, clicks, conversions, spend)</li>
                  <li>Ad group and keyword performance data</li>
                  <li>Account structure information (campaigns, ad groups, keywords)</li>
                  <li>Targeting settings and bid strategies</li>
                  <li>Historical performance data for trend analysis</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Usage Information</h3>
                <p className="mb-4">
                  We automatically collect information about how you use our service:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>App usage patterns and feature interactions</li>
                  <li>Device and browser information</li>
                  <li>IP address and general location data</li>
                  <li>Session duration and frequency of use</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">How We Use Your Information</h2>
                <p className="mb-4">
                  We use the collected information to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li><strong>Provide AI-powered analysis:</strong> Generate insights and optimization recommendations for your Google Ads campaigns</li>
                  <li><strong>Performance monitoring:</strong> Track campaign performance and identify improvement opportunities</li>
                  <li><strong>Automated insights:</strong> Deliver personalized recommendations based on your campaign data</li>
                  <li><strong>Service improvement:</strong> Enhance our AI algorithms and platform functionality</li>
                  <li><strong>Technical support:</strong> Provide customer support and troubleshoot issues</li>
                  <li><strong>Security:</strong> Detect and prevent unauthorized access or fraudulent activity</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Data Sharing and Disclosure</h2>
                <p className="mb-4 font-medium">
                  We do NOT sell, trade, or rent your Google user data to third parties.
                </p>
                <p className="mb-4">
                  We may share your information only in the following limited circumstances:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li><strong>Service providers:</strong> Trusted third-party services that help us operate our platform (cloud hosting, analytics) under strict data protection agreements</li>
                  <li><strong>Legal compliance:</strong> When required by law, court order, or regulatory authority</li>
                  <li><strong>Business transfer:</strong> In connection with a merger, acquisition, or sale of business assets (with user notification)</li>
                  <li><strong>Emergency situations:</strong> To protect the safety of our users or the public</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Data Retention and Deletion</h2>
                <p className="mb-4">
                  We retain your data only as long as necessary to provide our services and comply with legal obligations:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li><strong>Active accounts:</strong> Data is retained while your account is active and for up to 90 days after account deletion</li>
                  <li><strong>Google Ads data:</strong> Refreshed regularly and retained for up to 2 years for historical analysis</li>
                  <li><strong>Analytics data:</strong> Aggregated and anonymized data may be retained for service improvement</li>
                </ul>
                <p className="mb-4">
                  You can request deletion of your data at any time by contacting us at business@chatworks.nl. We will process deletion requests within 30 days.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Your Rights and Controls</h2>
                <p className="mb-4">
                  You have the following rights regarding your data:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal data</li>
                  <li><strong>Revocation:</strong> Revoke consent for data processing at any time</li>
                  <li><strong>Google account disconnection:</strong> Disconnect your Google account through your account settings</li>
                  <li><strong>Data portability:</strong> Request your data in a machine-readable format</li>
                </ul>
                <p className="mb-4">
                  To exercise these rights, contact us at business@chatworks.nl or through your account settings.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Security Measures</h2>
                <p className="mb-4">
                  We implement industry-standard security measures to protect your data:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li><strong>Encryption:</strong> All data is encrypted in transit and at rest using AES-256 encryption</li>
                  <li><strong>Access controls:</strong> Strict access controls and authentication requirements for our systems</li>
                  <li><strong>Regular audits:</strong> Regular security audits and vulnerability assessments</li>
                  <li><strong>Secure infrastructure:</strong> Data stored in SOC 2 compliant cloud infrastructure</li>
                  <li><strong>Token management:</strong> Secure handling and storage of Google API authentication tokens</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Google API Services Compliance</h2>
                <p className="mb-4">
                  Our use of Google APIs is governed by the Google API Services User Data Policy. We specifically commit to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Using Google user data only for providing and improving our AI-powered Google Ads optimization services</li>
                  <li>Not transferring Google user data to third parties (except as disclosed in this policy)</li>
                  <li>Not using Google user data for advertising purposes</li>
                  <li>Providing users with clear disclosure and control over data access</li>
                  <li>Implementing appropriate security measures for Google user data</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">International Data Transfers</h2>
                <p className="mb-4">
                  Your data may be transferred to and processed in countries other than your country of residence. 
                  We ensure appropriate safeguards are in place for international transfers, including standard contractual clauses 
                  and adequacy decisions where applicable.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Children's Privacy</h2>
                <p className="mb-4">
                  Our service is not intended for children under 13 years of age. We do not knowingly collect personal information 
                  from children under 13. If we discover that we have collected personal information from a child under 13, 
                  we will delete such information immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Changes to This Policy</h2>
                <p className="mb-4">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Posting the updated policy on our website</li>
                  <li>Sending an email notification to your registered email address</li>
                  <li>Displaying a prominent notice in our application</li>
                </ul>
                <p className="mb-4">
                  Your continued use of our service after the effective date of any changes constitutes acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Contact Information</h2>
                <p className="mb-4">
                  If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="bg-muted p-6 rounded-lg">
                  <p className="mb-2"><strong>Email:</strong> business@chatworks.nl</p>
                  <p className="mb-2"><strong>Website:</strong> ads-boost-ai.lovable.app</p>
                  <p className="mb-2"><strong>Response time:</strong> We aim to respond to all privacy-related inquiries within 72 hours</p>
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;