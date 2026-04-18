const highlights = [
  {
    title: 'Mise en place rapide',
    description:
      'Déployez OpenGed en quelques étapes et structurez vos bibliothèques documentaires sans complexité inutile.',
  },
  {
    title: 'Workflow simplifié',
    description:
      'Créez des circuits de validation compréhensibles par toutes les équipes pour fluidifier les décisions.',
  },
  {
    title: 'Fiabilité opérationnelle',
    description:
      'Versioning, audit et suivi des actions pour garder la maîtrise complète de vos documents.',
  },
];

const workflowSteps = [
  {
    title: 'Centraliser',
    description: 'Regroupez les documents dans une GED unique et organisée.',
  },
  {
    title: 'Valider',
    description: 'Attribuez les tâches et automatisez les validations clés.',
  },
  {
    title: 'Tracer',
    description: 'Suivez l’historique et sécurisez la conformité de vos processus.',
  },
];

const useCases = ['Ressources humaines', 'Finance & achats', 'Qualité & conformité'];

export function ShowcasePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-16 lg:pt-24">
        <p className="inline-flex rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-200">
          Open source by design
        </p>
        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-white md:text-5xl">
          La GED open source simple à déployer, pensée pour les workflows métier.
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-slate-300">
          OpenGed aide les organisations de toutes tailles à centraliser leurs documents, fluidifier leurs processus
          et gagner du temps avec une mise en place rapide.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href="https://github.com/freezlike/openged"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            Voir le projet sur GitHub
          </a>
          <a
            href="/login"
            className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400"
          >
            Accéder à l’application
          </a>
        </div>

        <ul className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <li>✓ Open source</li>
          <li>✓ Déploiement rapide</li>
          <li>✓ Workflow simplifié</li>
          <li>✓ Fiable et évolutif</li>
        </ul>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/50">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
          {highlights.map((highlight) => (
            <article key={highlight.title} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold text-white">{highlight.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{highlight.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold text-white">Un workflow en 3 étapes</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">Étape {index + 1}</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm text-slate-300">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/50">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold text-white">Pensé pour vos usages documentaires</h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            {useCases.map((useCase) => (
              <li key={useCase} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">
                {useCase}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-sky-400/30 bg-sky-400/10 p-8">
            <h3 className="text-2xl font-bold text-white">Open source & transparent</h3>
            <p className="mt-3 max-w-2xl text-sm text-slate-200">
              OpenGed reste 100% open source : code accessible, roadmap visible et contribution communautaire ouverte.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <a
                href="https://github.com/freezlike/openged"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
              >
                Contribuer sur GitHub
              </a>
              <a
                href="/login"
                className="rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:border-white"
              >
                Explorer la démo
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
