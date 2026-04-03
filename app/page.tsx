import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--reva-bg)' }}>
      {/* Top nav */}
      <header className="bg-white border-b border-[var(--reva-border)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Reva-style logo mark */}
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--reva-orange)' }}>
              RU
            </div>
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: 'var(--reva-navy)' }}>REVA UNIVERSITY</p>
              <p className="text-xs leading-tight" style={{ color: 'var(--reva-muted)' }}>Student Resource Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--reva-border)', color: 'var(--reva-navy)' }}>
              Log In
            </Link>
            <Link href="/signup" className="btn-reva">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6 border" style={{ background: 'var(--reva-orange-light)', color: 'var(--reva-orange-dark)', borderColor: '#FDDBB4' }}>
          ★ First 150 students get FREE premium access
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: 'var(--reva-navy)' }}>
          Your semester notes,<br />
          <span style={{ color: 'var(--reva-orange)' }}>organised & unlocked.</span>
        </h1>
        <p className="text-lg max-w-xl mb-8" style={{ color: 'var(--reva-muted)' }}>
          Unit-wise study materials, mock papers released 24 hours before exams, and AI-powered Q&amp;A — built exclusively for Reva University students.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/signup" className="btn-reva px-8 py-3 text-base">
            Start for Free
          </Link>
          <Link href="/login" className="px-8 py-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--reva-border)', color: 'var(--reva-navy)' }}>
            Already have an account
          </Link>
        </div>
      </section>

      {/* Feature cards — Reva portal card style */}
      <section className="max-w-5xl mx-auto w-full px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              color: 'var(--reva-teal)',
              bg: 'var(--reva-teal-light)',
              icon: '📚',
              title: 'Unit-wise Notes',
              desc: 'Unit 1 free forever. Full access (Units 1–4) for ₹159/semester.',
            },
            {
              color: 'var(--reva-orange)',
              bg: 'var(--reva-orange-light)',
              icon: '📝',
              title: 'Mock Papers',
              desc: 'Automatically released 24 hours before every exam — no delays.',
            },
            {
              color: '#8E24AA',
              bg: '#F3E5F5',
              icon: '🤖',
              title: 'AI Q&A',
              desc: 'Ask anything about your subject. Answers from your own syllabus only.',
            },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-2xl p-5 border" style={{ borderColor: 'var(--reva-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: f.bg }}>
                {f.icon}
              </div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--reva-navy)' }}>{f.title}</h3>
              <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs" style={{ borderColor: 'var(--reva-border)', color: 'var(--reva-muted)' }}>
        revauniversity.online — built by Sai Pranav &amp; Kartik &nbsp;·&nbsp; Phase 1: CSE &amp; CNIT &nbsp;·&nbsp; ₹159 / semester
      </footer>
    </div>
  )
}
