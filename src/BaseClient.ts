import fetch, { RequestInit, Response }            from "node-fetch"
import Logger                                      from "./Logger"
import { getAccessToken, print, toAbsolute, wait } from "./utils"


export interface BaseClientOptions {
    clientId     : string
    tokenEndpoint: string
    clientSecret?: string
    privateJWK  ?: Record<string, any>
    baseUrl      : string
    resources    : string[]
    logger       : Logger
    [key: string]: any
}

const RETRY_STATUS_CODES = [408, 413, 429, 500, 502, 503, 504, 521, 522, 524];
const RETRY_DELAY = 1000;
const RETRY_LIMIT = 5;

export default class BaseClient
{
    protected accessToken: string = ""

    protected accessTokenExpiresAt: number = 300

    protected requestsCount: number = 0

    protected options: BaseClientOptions

    constructor(options: BaseClientOptions) {
        this.options = options
    }

    private async getAccessToken()
    {
        if (this.accessToken && this.accessTokenExpiresAt - 10 > Date.now() / 1000) {
            return this.accessToken;
        }

        const { token, expiresAt } = await getAccessToken({
            clientId     : this.options.clientId,
            tokenEndpoint: this.options.tokenEndpoint,
            privateJWK   : this.options.privateJWK!,
            resources    : this.options.resources
        })

        this.accessToken = token
        this.accessTokenExpiresAt = expiresAt
        this.requestsCount++
        return token
    }

    protected async getAuthorizationHeader(): Promise<string | undefined>
    {
        if (this.options.privateJWK) {
            const accessToken = await this.getAccessToken()
            return accessToken ? `Bearer ${ accessToken }` : undefined
        }

        if (this.options.clientSecret) {
            return "Basic " + Buffer.from(
                this.options.clientId + ":" + this.options.clientSecret
            ).toString("base64")
        }

        return undefined
    }

    protected async request<T=any>(url: string, options: RequestInit | undefined, raw: true): Promise<Response>;
    protected async request<T=any>(url: string, options: RequestInit | undefined, raw: boolean): Promise<{ response: Response, body: T }>;
    protected async request<T=any>(url: string, options?: RequestInit): Promise<{ response: Response, body: T }>;
    protected async request<T=any>(url: string, options?: RequestInit, raw?: boolean) {
        const _options: RequestInit = {
            ...options,
            headers: {
                accept: "application/json+fhir",
                ...options?.headers
            }
        };
        if (!("authorization" in _options.headers!)) {
            const authorization = await this.getAuthorizationHeader()
            if (authorization) {
                (_options.headers as any).authorization = authorization
            }

            if (options?.headers) {
                Object.assign(_options.headers as any, options.headers)
            }
        }

        url = toAbsolute(url, this.options.baseUrl)

        let response: Response, count = RETRY_LIMIT
        do {
            await wait(count === RETRY_LIMIT ? 0 : RETRY_DELAY)
            const start = Date.now()
            response = await fetch(url, _options)
            this.requestsCount++
            const time = Number(Date.now() - start).toLocaleString()
            await this.options.logger.request(url, response, _options, time)
        } while (!response.ok && RETRY_STATUS_CODES.includes(response.status) && count--)

        if (raw) {
            return response
        }
        
        if (!response.ok) {
            print.commit()
            await this.options.logger.error("GET %s --> %s %s: %j; Response headers: %j", url, response.status, response.statusText, await response.text(), response.headers.raw())
            throw new Error("Request failed. See logs for details.")
        }
        
        let body = await response.text();
        let type = response.headers.get("Content-Type") + "";
        
        if (body.length && type.match(/\bjson\b/i)) {
            body = JSON.parse(body);
        }

        return { response, body: body as T }
    }
}
