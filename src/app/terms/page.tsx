import type { Metadata } from "next";
import Link from "next/link";
import { NucleusWordmark } from "@/components/nucleus-wordmark";

export const metadata: Metadata = {
  title: "Terms of Service — The Nucleus",
  description: "Terms of Service for The Nucleus campus management platform.",
};

const EFFECTIVE_DATE = "18 April 2026";
const CONTACT_EMAIL = "info.thenucleus@gmail.com";
const COMPANY_NAME = "The Nucleus";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 no-underline text-foreground">
            <NucleusWordmark decorative size="sm" />
          </Link>
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-sm text-muted-foreground mb-2">Last updated: {EFFECTIVE_DATE}</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-10 text-lg leading-relaxed">
          These Terms of Service govern your access to and use of The Nucleus mobile application and web platform
          operated by {COMPANY_NAME}. By creating an account or using the platform, you agree to these terms.
        </p>

        <Section title="1. Eligibility">
          <p>
            The Nucleus is intended for use by enrolled students, faculty, professors, and authorised staff of
            participating colleges and universities. You must be at least 13 years of age
            (or the minimum digital consent age in your jurisdiction) to use the platform. If your school has
            made The Nucleus available to minors under 18, parental or guardian consent is required.
          </p>
        </Section>

        <Section title="2. Account Registration">
          <p>
            You may register using an institutional email address and password, or sign in with Google when that
            option is available. You are responsible for maintaining the confidentiality of your
            credentials and for all activity that occurs under your account. Notify us immediately at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>{" "}
            if you suspect unauthorised access.
          </p>
          <p className="mt-3">
            You agree to provide accurate, current, and complete information during registration and to keep your
            profile up to date. Accounts found to contain false information may be suspended without notice.
          </p>
        </Section>

        <Section title="3. Biometric Data and Face Recognition">
          <p>
            The Nucleus collects facial photographs and generates mathematical representations of your facial
            geometry for the purpose of verifying student identity during attendance marking.
            By enrolling your face, you expressly consent to:
          </p>
          <ul className="mt-3 list-disc pl-6 space-y-2">
            <li>Capture and storage of your facial photographs on secure cloud infrastructure.</li>
            <li>Generation and storage of biometric identifiers derived from those photographs.</li>
            <li>Comparison of your face against stored biometric templates during attendance sessions.</li>
          </ul>
          <p className="mt-3">
            You may withdraw your biometric consent at any time by deleting your face registration from the app
            settings or by contacting us at {CONTACT_EMAIL}. Upon withdrawal, all stored facial photographs and
            biometric data associated with your account will be permanently deleted within 30 days.
          </p>
        </Section>

        <Section title="4. Camera and Device Permissions">
          <p>
            The app requests access to your device camera solely for face registration and attendance verification.
            The app does not record continuous video, access your photo library, or capture images outside of
            explicit user-initiated actions (tapping &quot;Capture&quot; or starting the face registration flow).
          </p>
        </Section>

        <Section title="5. Location Data">
          <p>
            The app may request access to your device location to assist with Wi-Fi network based attendance
            verification (confirming you are on campus). Location data is used only for in-session attendance
            checks and is not stored persistently or shared with third parties.
          </p>
        </Section>

        <Section title="6. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="mt-3 list-disc pl-6 space-y-2">
            <li>Register facial data of any person other than yourself.</li>
            <li>Attempt to spoof, bypass, or deceive the face recognition system.</li>
            <li>Mark attendance on behalf of another student (proxy attendance).</li>
            <li>Reverse-engineer, decompile, or extract biometric data or machine-learning models.</li>
            <li>Use the platform for any unlawful purpose or in violation of your school&apos;s policies.</li>
            <li>Harass, impersonate, or harm other users of the platform.</li>
          </ul>
          <p className="mt-3">
            Violations may result in immediate account suspension and may be reported to your school.
          </p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>
            The Nucleus platform, including its software, design, and content, is owned by {COMPANY_NAME} and
            is protected by applicable intellectual property laws. You are granted a limited, non-exclusive,
            non-transferable licence to access and use the platform for its intended educational purpose. You
            retain ownership of any content you submit (e.g. profile information) and grant {COMPANY_NAME} a
            limited licence to use that content solely to operate the platform.
          </p>
        </Section>

        <Section title="8. Availability and Modifications">
          <p>
            We aim to maintain high availability but do not guarantee uninterrupted service. We reserve the
            right to modify, suspend, or discontinue any feature at any time with reasonable notice where
            practicable. We may update these Terms periodically; continued use after updates constitutes acceptance.
            Material changes will be communicated via in-app notice or email.
          </p>
        </Section>

        <Section title="9. Disclaimers">
          <p>
            The platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
            kind, express or implied. {COMPANY_NAME} does not warrant that the face recognition system will be
            100% accurate, and it should not be used as the sole basis for academic disciplinary action without
            corroborating evidence.
          </p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, {COMPANY_NAME} and its affiliates shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages arising from your
            use of the platform, including but not limited to loss of data, missed attendance records, or
            academic consequences. Our total aggregate liability for any claim shall not exceed the amount paid
            by the fees paid for the service in the twelve months preceding the claim.
          </p>
        </Section>

        <Section title="11. Data Deletion and Account Termination">
          <p>
            You may request deletion of your account and all associated data (including biometric data) at any
            time by contacting us at {CONTACT_EMAIL} or using the delete-account option in app settings. Data
            will be permanently erased within 30 days of a confirmed deletion request, except where retention is
            required by law. We may terminate accounts that violate these Terms.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These Terms are governed by the laws of India. Any disputes arising from these Terms shall be
            subject to the exclusive jurisdiction of the courts located in the place of {COMPANY_NAME}&apos;s
            principal place of business, unless otherwise required by applicable consumer protection law in
            your jurisdiction.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms may be directed to:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>
      </main>

      <footer className="border-t border-border mt-16">
        <div className="mx-auto max-w-3xl px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} {COMPANY_NAME}</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl font-semibold mb-3 text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
