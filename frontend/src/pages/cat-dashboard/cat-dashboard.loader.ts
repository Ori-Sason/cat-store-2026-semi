import { catService } from '../../services/cat.service'

export async function catDashboardLoader() {
  const labelStats = await catService.getLabelStats()
  return { labelStats }
}
