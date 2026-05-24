interface N8nClientConfig {
  secret?: string;
  webhookUrl: string;
}

interface N8nWebhookPayload<TPayload> {
  event: string;
  payload: TPayload;
}

export function createN8nClient({ secret, webhookUrl }: N8nClientConfig) {
  return {
    async send<TPayload, TResponse>(payload: N8nWebhookPayload<TPayload>): Promise<TResponse> {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-toolz-secret": secret } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`n8n webhook failed with ${response.status}: ${message}`);
      }

      const responseText = await response.text();
      console.log("n8n raw response", responseText || "<empty>");

      if (!responseText) {
        return {} as TResponse;
      }

      try {
        return JSON.parse(responseText) as TResponse;
      } catch {
        return { rawResponse: responseText } as TResponse;
      }
    }
  };
}
