/**
 * Deploy Application - Phase 2 Web Desktop Expansion
 *
 * Standalone deployment management interface for ALFRED applications.
 * Separate from Docker - focused on application deployment workflows.
 *
 * Features:
 * - Deployment list with status (preview/production)
 * - Create preview deployments
 * - Promote to production
 * - Real-time health monitoring
 * - Deployment history
 *
 * Architecture: Sections pattern per .ruler/58-desktop-app-organization.md
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 5
 */

export { DeployApp, DeployAppWindow } from "./deploy-app";
