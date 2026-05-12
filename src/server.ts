import "dotenv/config"
import { Elysia } from "elysia"
import { betterAuth } from "./auth/auth.plugin"
import { corsMiddleware } from "./middleware/cors.middleware"
import { HealthController } from "./modules/health"
import { ConversationsController } from "./modules/conversations"
import { MediaController } from "./modules/media"
import { ProfileController } from "./modules/profile"
import { AnalyticsController } from "./modules/analytics"
import { UsersController } from "./modules/users"
import { TurnsController } from "./modules/turns"

const app = new Elysia()
  .use(corsMiddleware)
  .use(betterAuth)
  .use(HealthController)
  .use(ConversationsController)
  .use(MediaController)
  .use(ProfileController)
  .use(AnalyticsController)
  .use(UsersController)
  .use(TurnsController)
  .listen(process.env.PORT ?? 3001)

if (!process.send) {
  console.log(`🦊 secret-models-back running at http://${app.server?.hostname}:${app.server?.port}`)
}
