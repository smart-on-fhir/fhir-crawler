import fetch, { RequestInit, Response }            from "node-fetch"
import Logger                                      from "./Logger"
import { getAccessToken, print, toAbsolute, wait } from "./utils"


export interface BaseClientOptions {
    clientId        : string
    tokenEndpoint   : string
    privateJWKorSecret: Record<string, any> | string
    baseUrl         : string
    resources       : string[]
    logger          : Logger
    retryStatusCodes: number[]
    retryDelay      : number
    retryLimit      : number
    [key: string]   : any
}

export default class BaseClient
{
    protected accessToken: string = ""

    protected accessTokenExpiresAt: number = 300

    public requestsCount: number = 0

    protected options: BaseClientOptions

    constructor(options: BaseClientOptions) {
        this.options = options
    }

    private async getAccessToken() {
        if (this.accessToken && this.accessTokenExpiresAt - 10 > Date.now() / 1000) {
            return this.accessToken;
        }

        const { token, expiresAt } = await getAccessToken({
            clientId     : this.options.clientId,
            tokenEndpoint: this.options.tokenEndpoint,
            privateJWK   : this.options.privateJWKorSecret as any,
            resources    : this.options.resources
        }, this.options.logger)

        this.accessToken = token
        this.accessTokenExpiresAt = expiresAt
        this.requestsCount++
        return token
    }

    protected async getAuthorizationHeader(): Promise<string> {
        if (typeof this.options.privateJWKorSecret === "string") {
            return "Basic " + Buffer.from(
                this.options.clientId + ":" + this.options.clientSecret
            ).toString("base64")
        }
        return `Bearer ${ await this.getAccessToken() }`
    }

    protected async request<T=any>(url: string, options: RequestInit | undefined, raw: true): Promise<Response>;
    protected async request<T=any>(url: string, options: RequestInit | undefined, raw: boolean): Promise<{ response: Response, body: T }>;
    protected async request<T=any>(url: string, options?: RequestInit): Promise<{ response: Response, body: T }>;
    protected async request<T=any>(url: string, options?: RequestInit, raw?: boolean) {
        const { baseUrl, logger, retryLimit, retryDelay, retryStatusCodes } = this.options
        const _options: RequestInit = {
            ...options,
            headers: {
                accept: "application/json+fhir",
                ...options?.headers
            }
        };

        // Can opt-out by passing { authorization: undefined } in headers
        if (!("authorization" in _options.headers!)) {
            const authorization = await this.getAuthorizationHeader()
            if (authorization) {
                (_options.headers as any).authorization = authorization
            }

            if (options?.headers) {
                Object.assign(_options.headers as any, options.headers)
            }
        }

        url = toAbsolute(url, baseUrl)

        let response: Response, count = retryLimit
        do {
            await wait(count === retryLimit ? 0 : retryDelay)
            const start = Date.now()
            response = await fetch(url, _options)
            this.requestsCount++
            const time = Number(Date.now() - start).toLocaleString()
            await logger.request(url, response, _options, time)
        } while (!response.ok && retryStatusCodes.includes(response.status) && count--)

        if (raw) {
            return response
        }
        
        if (!response.ok) {
            print.commit()
            await logger.error(
                "GET %s --> %s %s: %j; Response headers: %j",
                url,
                response.status,
                response.statusText,
                await response.text(),
                response.headers.raw()
            )
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
