const LINEAR_GRAPHQL_ENDPOINT = "https://api.linear.app/graphql";

export interface LinearClientConfig {
  apiKey: string;
}

interface LinearGraphqlResponse<TData> {
  data?: TData;
  errors?: Array<{ message: string }>;
}

export class LinearApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearApiError";
  }
}

export function createLinearClient(config: LinearClientConfig) {
  async function request<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    const response = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: config.apiKey
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new LinearApiError(`Linear request failed with status ${response.status}`);
    }

    const body = (await response.json()) as LinearGraphqlResponse<TData>;

    if (body.errors?.length) {
      throw new LinearApiError(body.errors.map((error) => error.message).join("; "));
    }

    if (!body.data) {
      throw new LinearApiError("Linear response did not include data.");
    }

    return body.data;
  }

  return {
    request
  };
}
