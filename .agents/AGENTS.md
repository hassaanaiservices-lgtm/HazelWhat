# Deployment Rule for Railway

Whenever pushing/deploying code changes to production for Railway:
1. Run local build verification (`npm run build`).
2. Stage and commit changes.
3. **MUST push to all remote branches on GitHub**: `feature/promotions-broadcast`, `main`, and `master`:
   ```bash
   git push origin master master:main master:feature/promotions-broadcast
   ```
   *Reason*: Railway's connected target branch for this service is `feature/promotions-broadcast`. Pushing to `feature/promotions-broadcast`, `main`, and `master` ensures Railway always triggers deployments automatically without delay.
