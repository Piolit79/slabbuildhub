export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-sm text-gray-700 font-sans">
      <h1 className="text-2xl font-bold mb-1 text-gray-900">Privacy Policy</h1>
      <p className="text-xs text-gray-400 mb-8">SLAB Builders HUB — Last updated March 2026</p>

      <p className="mb-4">
        This Privacy Policy describes how SLAB Builders ("we," "us," or "our") collects, uses, and
        protects information in connection with SLAB Builders HUB ("Application"). The Application
        is an internal business tool restricted to authorized SLAB Builders personnel.
      </p>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">1. Information We Collect</h2>
      <p className="mb-2">We collect the following types of information through the Application:</p>
      <ul className="list-disc pl-5 mb-4 space-y-1">
        <li>Account credentials (email address, encrypted password)</li>
        <li>Project data including budgets, contracts, payments, and draws</li>
        <li>Vendor and subcontractor information</li>
        <li>Financial records including check numbers and payment amounts</li>
        <li>Documents and files uploaded to the Application</li>
        <li>QuickBooks OAuth tokens when the QuickBooks integration is enabled</li>
      </ul>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">2. How We Use Information</h2>
      <p className="mb-2">Information collected is used solely to:</p>
      <ul className="list-disc pl-5 mb-4 space-y-1">
        <li>Operate and maintain the Application for internal business use</li>
        <li>Sync financial data with connected third-party services (e.g., QuickBooks Online)</li>
        <li>Authenticate and manage user access</li>
        <li>Maintain records necessary for SLAB Builders project management</li>
      </ul>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">3. Data Storage</h2>
      <p className="mb-4">
        All application data is stored securely using Supabase (PostgreSQL), hosted on AWS
        infrastructure. Data is encrypted in transit via HTTPS and at rest. OAuth tokens for
        third-party integrations are stored in the database and accessible only via server-side
        functions.
      </p>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">4. Third-Party Services</h2>
      <p className="mb-4">
        The Application integrates with the following third-party services:
      </p>
      <ul className="list-disc pl-5 mb-4 space-y-1">
        <li><strong>Supabase</strong> — database and authentication</li>
        <li><strong>Vercel</strong> — application hosting and serverless functions</li>
        <li><strong>QuickBooks Online (Intuit)</strong> — financial data sync (optional)</li>
        <li><strong>OpenAI</strong> — AI-assisted features</li>
      </ul>
      <p className="mb-4">
        Each service operates under its own privacy policy. We do not sell or share data with any
        third party beyond what is necessary to operate these integrations.
      </p>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">5. QuickBooks Data</h2>
      <p className="mb-4">
        When you connect QuickBooks Online, we access check transaction data scoped to the
        projects you select. We store only the OAuth access and refresh tokens necessary to
        maintain the connection. QuickBooks financial data synced into the Application is used
        exclusively for internal project tracking and is not shared externally.
      </p>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">6. Access Controls</h2>
      <p className="mb-4">
        Access to the Application is restricted to authorized SLAB Builders employees and
        contractors. User accounts are managed by company administrators. We do not provide public
        access to any data stored in the Application.
      </p>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">7. Data Retention</h2>
      <p className="mb-4">
        Project and financial data is retained for the duration of the project and for as long as
        required to meet SLAB Builders' business and legal obligations. User accounts are removed
        upon termination of employment or contract.
      </p>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">8. Your Rights</h2>
      <p className="mb-4">
        Authorized users may request access to, correction of, or deletion of their personal data
        by contacting a company administrator. We will respond to reasonable requests within 30
        days.
      </p>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">9. Changes to This Policy</h2>
      <p className="mb-4">
        We may update this Privacy Policy from time to time. The "last updated" date at the top of
        this page reflects the most recent revision.
      </p>

      <h2 className="font-semibold text-gray-900 mt-6 mb-2">10. Contact</h2>
      <p className="mb-4">
        For privacy-related questions or requests, contact SLAB Builders at piolit@gmail.com
      </p>
    </div>
  );
}
