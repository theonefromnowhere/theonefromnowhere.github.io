/**
 * Every piece of copy on the site lives here. Components only map over this —
 * no text is hardcoded in JSX, so editing the site means editing one file.
 *
 * `sections` drives three things at once: the choices on the entry panel, the
 * hash routes, and the stations in the 3D world (src/three/world.ts keys off
 * the same ids). Adding a section means adding an entry here and a station
 * there — nothing else.
 */

export type SectionId = 'about' | 'experience' | 'publications' | 'contact'

export type Section = {
  id: SectionId
  /** Shown on the entry panel choice. */
  label: string
  /** One line under the label on the entry panel. Keep it short. */
  blurb: string
  /** Small-caps label above the section heading. */
  eyebrow: string
  title: string
}

export type Role = {
  title: string
  org: string
  location: string
  period: string
  points: string[]
}

export type Publication = {
  title: string
  venue: string
  year: string
  arxiv: string
  citations: number
  collaboration?: string
}

export type Link = {
  label: string
  href: string
}

export const site = {
  name: 'Svyatoslav Trusov',
  role: 'PhD',
  tagline: 'Machine learning scientist — neural surrogates for cosmology.',
  location: 'Paris, France',
  intro:
    'I build neural surrogate models, Bayesian inference pipelines and the ' +
    'scientific software around them — mostly in JAX and PyTorch, mostly on ' +
    'HPC clusters, mostly pointed at the large-scale structure of the universe. ' +
    'Pick a direction to travel.',

  sections: [
    {
      id: 'about',
      label: 'About',
      blurb: 'Background, and the tools I reach for.',
      eyebrow: 'About',
      title: 'What I do',
    },
    {
      id: 'experience',
      label: 'Experience',
      blurb: 'Research posts, engineering roles, degrees.',
      eyebrow: 'Career',
      title: 'Experience',
    },
    {
      id: 'publications',
      label: 'Publications',
      blurb: 'Peer-reviewed work, including DESI.',
      eyebrow: 'Research',
      title: 'Publications',
    },
    {
      id: 'contact',
      label: 'Contact',
      blurb: 'Where to find me.',
      eyebrow: 'Contact',
      title: 'Get in touch',
    },
  ] satisfies Section[],

  about: {
    body: [
      'I am a postdoctoral machine learning researcher at the Institut ' +
        "d'Astrophysique de Paris, with a PhD in cosmology from Sorbonne " +
        'University. My work sits where deep learning meets physical ' +
        'simulation: emulators that stand in for expensive computations ' +
        'without giving up the accuracy the science depends on.',
      'In practice that means hybrid 3D architectures (U-Net + FNO) in ' +
        'JAX/Flax, physics-informed losses that make small-sample training ' +
        'viable, and differentiable inference pipelines with Hamiltonian ' +
        'Monte Carlo end to end. The results have run from 64× to 300× faster ' +
        'than the pipelines they replaced, on 20× less training data.',
      'Before physics I spent six years writing C# and Unity — cross-platform ' +
        'interactive systems and AR. That is where the taste for real-time ' +
        'graphics comes from, and why this page is a world you fly through ' +
        'rather than a page you scroll.',
    ],
    skills: [
      {
        group: 'Machine learning',
        items: [
          '3D CNNs',
          'U-Net',
          'Fourier Neural Operators',
          'Bayesian inference (HMC)',
          'Simulation-based inference',
          'PINNs',
          'Uncertainty quantification',
        ],
      },
      {
        group: 'Software',
        items: ['Python', 'JAX / Flax', 'PyTorch', 'NumPy / SciPy', 'C#', 'Docker', 'Git'],
      },
      {
        group: 'Systems',
        items: [
          'GPU optimisation (JIT)',
          'HPC clusters',
          'mpi4py',
          'Async REST APIs',
          'Automated ML pipelines',
        ],
      },
    ],
    languages: 'English (C1) · French (B2) · Russian (native)',
  },

  roles: [
    {
      title: 'Postdoctoral Machine Learning Researcher',
      org: "Institut d'Astrophysique de Paris",
      location: 'Paris, France',
      period: '2024 — present',
      points: [
        'Hybrid 3D neural architectures (U-Net + FNO3D) in JAX/Flax for volumetric emulation, accelerating simulation walltimes by 64×.',
        'Physics-informed loss functions for small-sample regimes, cutting training data requirements by 20× with negligible accuracy loss.',
        'A self-contained differentiable JAX package for Bayesian inference: HMC with adaptive step-size tuning and automated convergence diagnostics.',
        'Automated training pipeline for residual neural emulators using Latin Hypercube sampling and continuous 3D patch extraction.',
        'Production web dashboard with an async REST API and SSH/SFTP connectivity, monitoring distributed GPU inference across compute clusters. JIT-compiled 3D ray-marching tools.',
      ],
    },
    {
      title: 'Doctoral Researcher — Simulation-Based Inference',
      org: 'Sorbonne University / LPNHE',
      location: 'Paris, France',
      period: '2021 — 2024',
      points: [
        'PyTorch emulator for simulation-based inference, reducing pipeline cost by ~300× while holding strict accuracy thresholds.',
        'Validated inference pipelines against systematic effects and model mismatch, decreasing overall measurement error by ~20%.',
      ],
    },
    {
      title: 'Software Engineer',
      org: 'SensoryLab',
      location: 'Moscow, Russia',
      period: '2019',
      points: [
        'Full-stack control systems for behavioural experiments and automated EEG signal-processing pipelines.',
      ],
    },
    {
      title: 'Software Developer — C# / Unity3D',
      org: 'Skies Studios & freelance',
      location: 'Various',
      period: '2012 — 2018',
      points: [
        'Cross-platform interactive systems and augmented reality applications in C#.',
      ],
    },
  ] satisfies Role[],

  education: [
    {
      degree: 'PhD, Cosmology & Physics',
      org: 'Sorbonne University, Paris',
      period: '2021 — 2024',
    },
    {
      degree: 'M.Sc, High Energy Physics',
      org: 'École Polytechnique (FR) & ETH Zürich (CH)',
      period: '2019 — 2021',
    },
    {
      degree: 'B.Sc & M.Sc, Theoretical Physics',
      org: 'Moscow State University',
      period: '2014 — 2019',
    },
  ],

  /* Citation counts are a snapshot from INSPIRE-HEP (2026-07-22) — they only
     ever go up, so refresh them when you next touch this file. */
  publications: [
    {
      title:
        'DESI 2024 II: sample definitions, characteristics, and two-point clustering statistics',
      venue: 'JCAP',
      year: '2024',
      arxiv: '2411.12020',
      citations: 138,
      collaboration: 'DESI',
    },
    {
      title: 'DESI 2024 VI: cosmological constraints from the measurements of BAO',
      venue: 'JCAP',
      year: '2024',
      arxiv: '2404.03002',
      citations: 1980,
      collaboration: 'DESI',
    },
    {
      title: 'DESI 2024 III: baryon acoustic oscillations from galaxies and quasars',
      venue: 'JCAP',
      year: '2024',
      arxiv: '2404.03000',
      citations: 555,
      collaboration: 'DESI',
    },
    {
      title: 'DESI 2024 IV: Baryon Acoustic Oscillations from the Lyman-α forest',
      venue: 'JCAP',
      year: '2024',
      arxiv: '2404.03001',
      citations: 399,
      collaboration: 'DESI',
    },
    {
      title:
        'Neural network-based model of galaxy power spectrum: fast full-shape galaxy power spectrum analysis',
      venue: 'MNRAS',
      year: '2024',
      arxiv: '2403.20093',
      citations: 6,
    },
    {
      title: 'The two-point correlation function covariance with fewer mocks',
      venue: 'MNRAS',
      year: '2023',
      arxiv: '2306.16332',
      citations: 13,
    },
    {
      title:
        'The Uchuu–SDSS galaxy light-cones: clustering, redshift space distortion and BAO signal',
      venue: 'MNRAS',
      year: '2022',
      arxiv: '2208.00540',
      citations: 28,
    },
  ] satisfies Publication[],

  contact: {
    note:
      'Open to machine-learning and scientific-software roles, and to collaboration ' +
      'on anything that needs a fast, honest surrogate for an expensive simulation.',
  },

  links: [
    { label: 'Email', href: 'mailto:trusov.s.k@gmail.com' },
    { label: 'INSPIRE-HEP', href: 'https://inspirehep.net/authors/2690316' },
    { label: 'ORCID', href: 'https://orcid.org/0000-0002-2414-6720' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/' }, // TODO: full profile URL
    { label: 'GitHub', href: 'https://github.com/' }, // TODO: full profile URL
  ] satisfies Link[],
} as const

export const sectionIds = site.sections.map((s) => s.id)

export function findSection(id: string): Section | undefined {
  return site.sections.find((s) => s.id === id)
}

export function arxivUrl(id: string): string {
  return `https://arxiv.org/abs/${id}`
}
