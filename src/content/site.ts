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
  /**
   * The journal citation — volume, year and article/page. This is the date of
   * record, not the arXiv posting: every one of these appeared in press a year
   * or more after the preprint, so the two differ throughout.
   */
  reference: string
  /** Journal volume year, for sorting and for the summary line. */
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
  tagline: 'Physicist and machine learning scientist',
  location: 'Paris, France',
  intro:
    'I study large-scale structure with Bayesian inference pipelines and machine learning,' +
    'and I build scientific software around them — mostly in JAX and PyTorch, mostly on ' +
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
      'I am a postdoctoral astrophysics researcher at the Institut ' +
        "d'Astrophysique de Paris, with a PhD in cosmology from Sorbonne " +
        'University. I work primarily on large-scale structure analsysis,' +
        ' preparing the statistical and machine-learning tools and methods for '+ 
        'the next generation of galaxy surveys (DESI, Euclid, etc).',
      'In practice that means lots of inference pipelines, working with large data,  hybrid 3D architectures (U-Net + FNO) in ' +
        'JAX/Flax, physics-informed losses that make small-sample training ' +
        'viable, and differentiable inference pipelines with Hamiltonian ' +
        'Monte Carlo end to end. The results have run from 64× to 300× faster ' +
        'than the pipelines they replaced, on 20× less training data.',
      'Before physics I spent six years writing C# and Unity — cross-platform ' +
        'interactive systems and AR. That is where the taste for real-time ' +
        'graphics comes from.',
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
      title: 'Postdoc: Simulation Based Inference & Neural Surrogates',
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
      title: 'Doctoral Researcher - DESI BGS analysis',
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

  /* References and citation counts are a snapshot from INSPIRE-HEP
     (2026-07-22). Listed newest first by date of publication in the journal,
     which is not the arXiv order — the DESI IV preprint predates the DESI II
     one, but reached press six months later. Counts only ever go up, so
     refresh them when you next touch this file. */
  publications: [
    {
      title:
        'DESI 2024 II: sample definitions, characteristics, and two-point clustering statistics',
      reference: 'JCAP 07 (2025) 017',
      year: '2025',
      arxiv: '2411.12020',
      citations: 138,
      collaboration: 'DESI',
    },
    {
      title: 'DESI 2024 III: baryon acoustic oscillations from galaxies and quasars',
      reference: 'JCAP 04 (2025) 012',
      year: '2025',
      arxiv: '2404.03000',
      citations: 555,
      collaboration: 'DESI',
    },
    {
      title:
        'Neural network-based model of galaxy power spectrum: fast full-shape galaxy power spectrum analysis',
      reference: 'MNRAS 538 (2025) 1789',
      year: '2025',
      arxiv: '2403.20093',
      citations: 6,
    },
    {
      title: 'DESI 2024 VI: cosmological constraints from the measurements of BAO',
      reference: 'JCAP 02 (2025) 021',
      year: '2025',
      arxiv: '2404.03002',
      citations: 1980,
      collaboration: 'DESI',
    },
    {
      title: 'DESI 2024 IV: Baryon Acoustic Oscillations from the Lyman-α forest',
      reference: 'JCAP 01 (2025) 124',
      year: '2025',
      arxiv: '2404.03001',
      citations: 399,
      collaboration: 'DESI',
    },
    {
      title:
        'The Uchuu–SDSS galaxy light-cones: clustering, redshift space distortion and BAO signal',
      reference: 'MNRAS 528 (2024) 7236',
      year: '2024',
      arxiv: '2208.00540',
      citations: 28,
    },
    {
      title: 'The two-point correlation function covariance with fewer mocks',
      reference: 'MNRAS 527 (2024) 9048',
      year: '2024',
      arxiv: '2306.16332',
      citations: 13,
    },
  ] satisfies Publication[],

  contact: {
    note:
      'Open to machine-learning and scientific-software roles, and to collaboration ' +
      'on anything that needs a fast, honest surrogate for an expensive simulation.',
  },

  links: [
    { label: 'Email', href: 'mailto:trusov.s.k@gmail.com' },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/svyatoslav-trusov-a8a423257/',
    },
    // Taken from this repository's own remote — confirm it is the account you
    // want linked if you keep work under a second one.
    { label: 'GitHub', href: 'https://github.com/theonefromnowhere' },
    { label: 'Aquila GitLab', href: 'https://git.aquila-consortium.org/strusov' },
    { label: 'INSPIRE-HEP', href: 'https://inspirehep.net/authors/2690316' },
    { label: 'ORCID', href: 'https://orcid.org/0000-0002-2414-6720' },
  ] satisfies Link[],
} as const

export const sectionIds = site.sections.map((s) => s.id)

export function findSection(id: string): Section | undefined {
  return site.sections.find((s) => s.id === id)
}

export function arxivUrl(id: string): string {
  return `https://arxiv.org/abs/${id}`
}
