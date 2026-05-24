export interface IntegrationSettings {
  discordWebhookUrl: string;
  linearApiKey: string;
  linearDefaultStateId: string;
  linearListWebhookUrl: string;
  linearProjectId: string;
  linearTeamId: string;
  linearToolWebhookUrl: string;
  linearWebhookSecret: string;
  sheetsWebhookUrl: string;
}

const settings: IntegrationSettings = {
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? "",
  linearApiKey: process.env.LINEAR_API_KEY ?? "",
  linearDefaultStateId: process.env.LINEAR_DEFAULT_STATE_ID ?? "",
  linearListWebhookUrl: process.env.N8N_LINEAR_LISTEN_WEBHOOK_URL ?? "",
  linearProjectId: process.env.LINEAR_PROJECT_ID ?? "",
  linearTeamId: process.env.LINEAR_TEAM_ID ?? "",
  linearToolWebhookUrl: process.env.N8N_LINEAR_WEBHOOK_URL ?? "",
  linearWebhookSecret: process.env.N8N_WEBHOOK_SECRET ?? "",
  sheetsWebhookUrl: process.env.SHEETS_WEBHOOK_URL ?? ""
};

export function getIntegrationSettings() {
  return { ...settings };
}

export function updateIntegrationSettings(updates: Partial<IntegrationSettings>) {
  Object.assign(settings, updates);
  return getIntegrationSettings();
}
