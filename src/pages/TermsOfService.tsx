import { useEffect } from "react";

const TermsOfService = () => {
  useEffect(() => {
    document.title = "Terms of Service - Inno Google Ads Assistant";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Terms of Service for Inno - AI-powered Google Ads campaign analysis and optimization platform. Understand your rights and responsibilities.');
    }
  }, []);

  return (
    <>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="prose prose-lg max-w-none">
            <header className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4 text-foreground">Terms of Service</h1>
              <p className="text-muted-foreground text-lg">
                Effective Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-muted-foreground">
                Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </header>

            <main className="space-y-8 text-foreground">
              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Agreement to Terms</h2>
                <p className="mb-4">
                  Welcome to Inno ("we," "our," or "us"), an AI-powered Google Ads optimization platform. These Terms of Service 
                  ("Terms") govern your use of our website located at ads-boost-ai.lovable.app and our AI-powered Google Ads 
                  analysis and optimization services (collectively, the "Service").
                </p>
                <p className="mb-4">
                  By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these 
                  Terms, then you may not access the Service. These Terms constitute a legally binding agreement between you and Inno.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Service Description</h2>
                <p className="mb-4">
                  Inno provides AI-powered analysis and optimization recommendations for Google Ads campaigns. Our Service includes:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li><strong>Campaign Analysis:</strong> AI-driven analysis of your Google Ads campaign performance</li>
                  <li><strong>Optimization Recommendations:</strong> Automated suggestions to improve campaign effectiveness</li>
                  <li><strong>Performance Insights:</strong> Data visualization and trend analysis of your advertising metrics</li>
                  <li><strong>Automated Reporting:</strong> Regular insights and recommendations delivered to your email</li>
                  <li><strong>Strategic Guidance:</strong> AI-powered strategic recommendations for campaign improvement</li>
                </ul>
                <p className="mb-4">
                  Our Service integrates with Google Ads through official Google APIs to access and analyze your advertising data.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">User Responsibilities</h2>
                
                <h3 className="text-xl font-medium mb-3 text-foreground">Account Requirements</h3>
                <p className="mb-4">To use our Service, you must:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Own or have authorized access to the Google Ads accounts you connect</li>
                  <li>Be at least 18 years old or have parental consent</li>
                  <li>Provide accurate and complete information during registration</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Comply with Google Ads policies and terms of service</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Proper Usage</h3>
                <p className="mb-4">You agree to:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Use the Service only for lawful purposes and in accordance with these Terms</li>
                  <li>Not attempt to gain unauthorized access to our systems or other users' accounts</li>
                  <li>Not use the Service to violate any applicable laws or regulations</li>
                  <li>Not reverse engineer, decompile, or attempt to extract our AI algorithms</li>
                  <li>Not use automated systems to access the Service beyond normal usage</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Google Ads Account Compliance</h3>
                <p className="mb-4">You represent and warrant that:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>You have the legal right to connect and analyze the Google Ads accounts you provide</li>
                  <li>Your Google Ads accounts comply with Google's advertising policies</li>
                  <li>You will not hold us responsible for any violations of Google's terms by your accounts</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Our Responsibilities</h2>
                
                <h3 className="text-xl font-medium mb-3 text-foreground">Service Provision</h3>
                <p className="mb-4">We commit to:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Provide AI-powered analysis and recommendations based on your Google Ads data</li>
                  <li>Maintain reasonable uptime and performance of our Service</li>
                  <li>Protect your data according to our Privacy Policy</li>
                  <li>Provide customer support for technical issues</li>
                  <li>Continuously improve our AI algorithms and Service features</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Data Security</h3>
                <p className="mb-4">We will:</p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Implement industry-standard security measures to protect your data</li>
                  <li>Encrypt all data transmissions and storage</li>
                  <li>Comply with applicable data protection regulations</li>
                  <li>Provide you with control over your data and Google account connections</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Google Ads Data Access</h2>
                
                <h3 className="text-xl font-medium mb-3 text-foreground">Scope of Access</h3>
                <p className="mb-4">
                  By connecting your Google Ads account, you grant us permission to access:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Campaign performance data (impressions, clicks, conversions, spend)</li>
                  <li>Account structure information (campaigns, ad groups, keywords)</li>
                  <li>Targeting and bidding configurations</li>
                  <li>Historical performance data for trend analysis</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Data Usage Limitations</h3>
                <p className="mb-4">
                  We will only use your Google Ads data to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Provide AI-powered analysis and optimization recommendations</li>
                  <li>Generate performance insights and reports</li>
                  <li>Improve our Service through aggregated, anonymized analysis</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Revocation Rights</h3>
                <p className="mb-4">
                  You may revoke our access to your Google Ads data at any time by:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Disconnecting your Google account through our platform</li>
                  <li>Revoking permissions through your Google account settings</li>
                  <li>Contacting our support team for assistance</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">AI Recommendations and Disclaimers</h2>
                
                <h3 className="text-xl font-medium mb-3 text-foreground">Nature of AI Recommendations</h3>
                <p className="mb-4">
                  Our AI-powered recommendations are generated based on data analysis and machine learning algorithms. 
                  These recommendations:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Are suggestions only and should not be considered professional advertising advice</li>
                  <li>May not be suitable for all business situations or advertising goals</li>
                  <li>Should be reviewed and evaluated before implementation</li>
                  <li>Do not guarantee specific results or performance improvements</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Performance Disclaimers</h3>
                <p className="mb-4 font-medium">
                  IMPORTANT: We cannot guarantee specific results from implementing our recommendations.
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Advertising performance depends on many factors beyond our control</li>
                  <li>Market conditions, competition, and consumer behavior affect results</li>
                  <li>You are solely responsible for your advertising decisions and campaign performance</li>
                  <li>Past performance does not indicate future results</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Limitation of Liability</h2>
                <p className="mb-4 font-medium">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, INNO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, 
                  SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
                </p>
                <p className="mb-4">
                  This includes but is not limited to:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Lost profits or revenue from advertising campaigns</li>
                  <li>Business interruption or loss of business opportunities</li>
                  <li>Data loss or corruption</li>
                  <li>Costs of procuring substitute services</li>
                </ul>
                <p className="mb-4">
                  Our total liability for any claims arising from or related to the Service shall not exceed the amount 
                  you paid us for the Service in the 12 months preceding the claim.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Account Termination</h2>
                
                <h3 className="text-xl font-medium mb-3 text-foreground">Your Right to Terminate</h3>
                <p className="mb-4">
                  You may terminate your account at any time by:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Using the account deletion feature in your account settings</li>
                  <li>Contacting our support team at business@chatworks.nl</li>
                  <li>Disconnecting all Google Ads accounts from our platform</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Our Right to Terminate</h3>
                <p className="mb-4">
                  We may suspend or terminate your account if:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>You violate these Terms of Service</li>
                  <li>You use the Service for illegal or fraudulent purposes</li>
                  <li>Your Google Ads accounts violate Google's policies</li>
                  <li>We are required to do so by law or regulation</li>
                </ul>

                <h3 className="text-xl font-medium mb-3 text-foreground">Effect of Termination</h3>
                <p className="mb-4">
                  Upon termination:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Your access to the Service will be immediately revoked</li>
                  <li>We will delete your personal data according to our Privacy Policy</li>
                  <li>You will no longer receive insights or recommendations</li>
                  <li>These Terms will remain in effect for any unresolved matters</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Intellectual Property</h2>
                <p className="mb-4">
                  The Service, including our AI algorithms, software, content, and trademarks, is owned by Inno and protected 
                  by intellectual property laws. You may not:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Copy, modify, or create derivative works of our Service</li>
                  <li>Reverse engineer or attempt to extract our AI algorithms</li>
                  <li>Use our trademarks or branding without permission</li>
                  <li>Redistribute or resell our Service or recommendations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Privacy and Data Protection</h2>
                <p className="mb-4">
                  Your privacy is important to us. Our collection and use of personal information is governed by our 
                  Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy 
                  to understand our data practices.
                </p>
                <p className="mb-4">
                  By using our Service, you acknowledge that you have read and understood our Privacy Policy and consent 
                  to our data practices described therein.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Modifications to Terms</h2>
                <p className="mb-4">
                  We may modify these Terms at any time. We will notify you of material changes by:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Posting updated Terms on our website</li>
                  <li>Sending email notification to your registered email address</li>
                  <li>Displaying a notice in our application</li>
                </ul>
                <p className="mb-4">
                  Your continued use of the Service after the effective date of any changes constitutes acceptance of the updated Terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Governing Law and Disputes</h2>
                <p className="mb-4">
                  These Terms are governed by and construed in accordance with the laws of the Netherlands. 
                  Any disputes arising from or relating to these Terms or the Service will be resolved through 
                  binding arbitration in accordance with the rules of the Netherlands Arbitration Institute.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Severability</h2>
                <p className="mb-4">
                  If any provision of these Terms is found to be unenforceable or invalid, the remaining provisions 
                  will remain in full force and effect. The invalid provision will be replaced with a valid provision 
                  that most closely matches the intent of the original provision.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Contact Information</h2>
                <p className="mb-4">
                  If you have questions about these Terms of Service, please contact us:
                </p>
                <div className="bg-muted p-6 rounded-lg">
                  <p className="mb-2"><strong>Email:</strong> business@chatworks.nl</p>
                  <p className="mb-2"><strong>Website:</strong> ads-boost-ai.lovable.app</p>
                  <p className="mb-2"><strong>Subject Line:</strong> "Terms of Service Inquiry"</p>
                  <p className="mb-2"><strong>Response time:</strong> We aim to respond to all inquiries within 72 hours</p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">Entire Agreement</h2>
                <p className="mb-4">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and Inno 
                  regarding the Service and supersede all prior and contemporaneous agreements, whether written or oral.
                </p>
              </section>
            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;