export default function LegalPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Terms of Service and Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">These documents are a baseline notice for the app and should be reviewed by counsel before launch.</p>
      </div>

      <section className="rounded-xl border border-border p-6">
        <h2 className="text-xl font-semibold">Terms of Service</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          By using Zivona, you agree to use the service lawfully, refrain from harmful or illegal activity, and respect the rights of other users and the platform. The platform may suspend or remove access for violations of these terms or applicable law.
        </p>
      </section>

      <section className="rounded-xl border border-border p-6">
        <h2 className="text-xl font-semibold">Privacy Policy</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Zivona collects account information, profile data, content you create, messages, marketplace data, and consent records to operate the platform. We process this data to provide core functionality, safety controls, and legal compliance features.
        </p>
      </section>
    </div>
  )
}
