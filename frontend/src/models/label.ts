import type { CatLabel } from '@cat-store/shared'

export interface LabelColors {
  bg: string
  fg: string
}

// Keyed by the shared CatLabel: a new label in CAT_LABELS fails typecheck until it gets colors here
export const LABEL_COLORS: Record<CatLabel, LabelColors> = {
  Kitten: { bg: 'rgb(255, 228, 214)', fg: 'rgb(154, 59, 18)' },
  Adult: { bg: 'rgb(227, 236, 255)', fg: 'rgb(39, 71, 163)' },
  Senior: { bg: 'rgb(236, 230, 218)', fg: 'rgb(94, 75, 43)' },
  Playful: { bg: 'rgb(255, 242, 194)', fg: 'rgb(122, 91, 0)' },
  Calm: { bg: 'rgb(221, 243, 236)', fg: 'rgb(30, 107, 82)' },
  Affectionate: { bg: 'rgb(255, 224, 234)', fg: 'rgb(160, 36, 79)' },
  'Long-hair': { bg: 'rgb(237, 228, 255)', fg: 'rgb(91, 45, 179)' },
  'Short-hair': { bg: 'rgb(224, 242, 250)', fg: 'rgb(21, 94, 122)' },
  Indoor: { bg: 'rgb(233, 238, 242)', fg: 'rgb(61, 75, 87)' },
  'Good with kids': { bg: 'rgb(230, 246, 217)', fg: 'rgb(63, 107, 18)' },
}
