import { ArkosRouter } from 'arkos';
import { RouteHook } from 'arkos'

export const hook: RouteHook<"prisma"> = { }


const notificationPreferenceRouter = ArkosRouter({ 
  openapi: { tags: ["Notification Preferences"] }
})

export default notificationPreferenceRouter
